import { prisma } from './db'
import { ClipboardData } from '@/types/clipboard'
import { Prisma } from '@prisma/client'

export interface ClipboardServiceOptions {
  maxContentSize?: number
  retryAttempts?: number
}

export interface ClipboardCreateInput {
  code: string
  content: string
}

export interface ClipboardUpdateInput {
  content: string
  version?: number // For optimistic locking
}

export interface ClipboardServiceError extends Error {
  code: 'NOT_FOUND' | 'CONFLICT' | 'VALIDATION_ERROR' | 'DATABASE_ERROR' | 'CONTENT_TOO_LARGE'
  details?: any
}

class ClipboardServiceImpl {
  private readonly maxContentSize: number
  private readonly retryAttempts: number

  constructor(options: ClipboardServiceOptions = {}) {
    this.maxContentSize = options.maxContentSize || 1048576 // 1MB
    this.retryAttempts = options.retryAttempts || 3
  }

  /**
   * 创建自定义错误
   */
  private createError(
    code: ClipboardServiceError['code'], 
    message: string, 
    details?: any
  ): ClipboardServiceError {
    const error = new Error(message) as ClipboardServiceError
    error.code = code
    error.details = details
    return error
  }

  /**
   * 验证内容大小
   */
  private validateContent(content: string): void {
    if (content.length > this.maxContentSize) {
      throw this.createError(
        'CONTENT_TOO_LARGE',
        `内容大小超过限制 (${this.maxContentSize} bytes)`,
        { contentSize: content.length, maxSize: this.maxContentSize }
      )
    }
  }

  /**
   * 获取剪切板，如果不存在则创建
   */
  async getOrCreateClipboard(code: string): Promise<ClipboardData> {
    try {
      // 首先尝试获取现有剪切板并更新访问时间
      const existing = await prisma.clipboard.findUnique({
        where: { code }
      })

      if (existing) {
        // 更新最后访问时间
        const updated = await prisma.clipboard.update({
          where: { code },
          data: { lastAccessed: new Date() }
        })
        return updated
      }

      // 如果不存在，创建新的剪切板
      const newClipboard = await prisma.clipboard.create({
        data: {
          code,
          content: '',
          lastAccessed: new Date()
        }
      })

      return newClipboard
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // 处理唯一约束冲突（并发创建相同代码的剪切板）
        if (error.code === 'P2002') {
          // 重试获取，因为可能是并发创建导致的冲突
          const existing = await prisma.clipboard.findUnique({
            where: { code }
          })
          if (existing) {
            return await prisma.clipboard.update({
              where: { code },
              data: { lastAccessed: new Date() }
            })
          }
        }
      }
      
      throw this.createError('DATABASE_ERROR', '获取或创建剪切板失败', error)
    }
  } 
 /**
   * 创建或更新剪切板内容
   */
  async upsertClipboard(input: ClipboardCreateInput): Promise<ClipboardData> {
    this.validateContent(input.content)

    try {
      const clipboard = await prisma.clipboard.upsert({
        where: { code: input.code },
        update: {
          content: input.content,
          lastAccessed: new Date()
        },
        create: {
          code: input.code,
          content: input.content,
          lastAccessed: new Date()
        }
      })

      return clipboard
    } catch (error) {
      throw this.createError('DATABASE_ERROR', '创建或更新剪切板失败', error)
    }
  }

  /**
   * 更新剪切板内容（带并发控制）
   */
  async updateClipboard(code: string, input: ClipboardUpdateInput): Promise<ClipboardData> {
    this.validateContent(input.content)

    let attempt = 0
    while (attempt < this.retryAttempts) {
      try {
        // 首先检查剪切板是否存在
        const existing = await prisma.clipboard.findUnique({
          where: { code }
        })

        if (!existing) {
          throw this.createError('NOT_FOUND', '剪切板不存在')
        }

        // 如果提供了版本号，进行乐观锁检查
        if (input.version !== undefined) {
          const currentVersion = existing.updatedAt.getTime()
          if (input.version !== currentVersion) {
            throw this.createError(
              'CONFLICT', 
              '剪切板已被其他用户修改，请刷新后重试',
              { 
                expectedVersion: input.version, 
                currentVersion: currentVersion 
              }
            )
          }
        }

        // 更新剪切板
        const updated = await prisma.clipboard.update({
          where: { 
            code,
            // 添加额外的版本检查以防止并发更新
            updatedAt: existing.updatedAt
          },
          data: {
            content: input.content,
            lastAccessed: new Date()
          }
        })

        return updated
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          // 处理并发更新冲突
          if (error.code === 'P2025' && attempt < this.retryAttempts - 1) {
            attempt++
            // 短暂延迟后重试
            await new Promise(resolve => setTimeout(resolve, 100 * attempt))
            continue
          }
        }

        if (error instanceof Error && 'code' in error) {
          throw error // 重新抛出我们的自定义错误
        }

        throw this.createError('DATABASE_ERROR', '更新剪切板失败', error)
      }
    }

    throw this.createError('CONFLICT', '更新失败，请重试')
  }

  /**
   * 删除剪切板
   */
  async deleteClipboard(code: string): Promise<void> {
    try {
      await prisma.clipboard.delete({
        where: { code }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw this.createError('NOT_FOUND', '剪切板不存在')
        }
      }
      throw this.createError('DATABASE_ERROR', '删除剪切板失败', error)
    }
  }

  /**
   * 检查代码是否已存在
   */
  async codeExists(code: string): Promise<boolean> {
    try {
      const count = await prisma.clipboard.count({
        where: { code }
      })
      return count > 0
    } catch (error) {
      throw this.createError('DATABASE_ERROR', '检查代码存在性失败', error)
    }
  }

  /**
   * 获取剪切板统计信息
   */
  async getStats(): Promise<{
    totalClipboards: number
    totalContentSize: number
    oldestClipboard?: Date
    newestClipboard?: Date
  }> {
    try {
      const [count, aggregation] = await Promise.all([
        prisma.clipboard.count(),
        prisma.clipboard.aggregate({
          _sum: {
            content: true
          },
          _min: {
            createdAt: true
          },
          _max: {
            createdAt: true
          }
        })
      ])

      return {
        totalClipboards: count,
        totalContentSize: aggregation._sum.content || 0,
        oldestClipboard: aggregation._min.createdAt || undefined,
        newestClipboard: aggregation._max.createdAt || undefined
      }
    } catch (error) {
      throw this.createError('DATABASE_ERROR', '获取统计信息失败', error)
    }
  }

  /**
   * 批量获取剪切板（用于清理任务）
   */
  async getClipboardsForCleanup(options: {
    olderThan?: Date
    limit?: number
    orderBy?: 'lastAccessed' | 'createdAt'
  } = {}): Promise<ClipboardData[]> {
    try {
      const where: Prisma.ClipboardWhereInput = {}
      
      if (options.olderThan) {
        where.lastAccessed = {
          lt: options.olderThan
        }
      }

      const clipboards = await prisma.clipboard.findMany({
        where,
        orderBy: {
          [options.orderBy || 'lastAccessed']: 'asc'
        },
        take: options.limit
      })

      return clipboards
    } catch (error) {
      throw this.createError('DATABASE_ERROR', '获取清理候选剪切板失败', error)
    }
  }

  /**
   * 批量删除剪切板
   */
  async deleteClipboards(codes: string[]): Promise<number> {
    try {
      const result = await prisma.clipboard.deleteMany({
        where: {
          code: {
            in: codes
          }
        }
      })

      return result.count
    } catch (error) {
      throw this.createError('DATABASE_ERROR', '批量删除剪切板失败', error)
    }
  }

  /**
   * 更新访问时间（轻量级操作）
   */
  async updateAccessTime(code: string): Promise<void> {
    try {
      await prisma.clipboard.update({
        where: { code },
        data: { lastAccessed: new Date() }
      })
    } catch (error) {
      // 访问时间更新失败不应该影响主要功能
      console.warn(`更新访问时间失败 (code: ${code}):`, error)
    }
  }

  /**
   * 事务操作：原子性地执行多个数据库操作
   */
  async transaction<T>(
    operations: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    try {
      return await prisma.$transaction(operations)
    } catch (error) {
      throw this.createError('DATABASE_ERROR', '事务执行失败', error)
    }
  }
}

// 导出单例实例
export const clipboardService = new ClipboardServiceImpl()

// 导出类型和类，以便测试时可以创建新实例
export { ClipboardServiceImpl }