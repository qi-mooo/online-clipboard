import { clipboardService } from './clipboard-service'

export interface CleanupOptions {
  maxAge?: number // 最大年龄（天）
  maxTotalSize?: number // 最大总大小（字节）
  maxCount?: number // 最大数量
  batchSize?: number // 批处理大小
  dryRun?: boolean // 是否为试运行
}

export interface CleanupResult {
  deletedCount: number
  freedSpace: number
  totalProcessed: number
  errors: string[]
  dryRun: boolean
}

export interface CleanupStats {
  totalClipboards: number
  totalSize: number
  oldestClipboard?: Date
  newestClipboard?: Date
  candidatesForCleanup: number
}

class CleanupServiceImpl {
  private readonly defaultOptions: Required<CleanupOptions> = {
    maxAge: 30, // 30 天
    maxTotalSize: 100 * 1024 * 1024, // 100MB
    maxCount: 10000, // 10,000 个剪切板
    batchSize: 100, // 每批处理 100 个
    dryRun: false
  }

  /**
   * 执行数据清理
   */
  async cleanup(options: CleanupOptions = {}): Promise<CleanupResult> {
    const opts = { ...this.defaultOptions, ...options }
    const result: CleanupResult = {
      deletedCount: 0,
      freedSpace: 0,
      totalProcessed: 0,
      errors: [],
      dryRun: opts.dryRun
    }

    try {
      // 获取当前统计信息
      const stats = await clipboardService.getStats()
      result.totalProcessed = stats.totalClipboards

      // 如果没有数据需要清理，直接返回
      if (stats.totalClipboards === 0) {
        return result
      }

      // 按年龄清理
      if (opts.maxAge > 0) {
        const ageResult = await this.cleanupByAge(opts.maxAge, opts.batchSize, opts.dryRun)
        result.deletedCount += ageResult.deletedCount
        result.freedSpace += ageResult.freedSpace
        result.errors.push(...ageResult.errors)
      }

      // 按总大小清理
      if (opts.maxTotalSize > 0) {
        const sizeResult = await this.cleanupBySize(opts.maxTotalSize, opts.batchSize, opts.dryRun)
        result.deletedCount += sizeResult.deletedCount
        result.freedSpace += sizeResult.freedSpace
        result.errors.push(...sizeResult.errors)
      }

      // 按数量清理
      if (opts.maxCount > 0) {
        const countResult = await this.cleanupByCount(opts.maxCount, opts.batchSize, opts.dryRun)
        result.deletedCount += countResult.deletedCount
        result.freedSpace += countResult.freedSpace
        result.errors.push(...countResult.errors)
      }

      return result
    } catch (error) {
      result.errors.push(`清理过程中发生错误: ${error instanceof Error ? error.message : String(error)}`)
      return result
    }
  }

  /**
   * 按年龄清理数据
   */
  private async cleanupByAge(
    maxAgeDays: number, 
    batchSize: number, 
    dryRun: boolean
  ): Promise<Omit<CleanupResult, 'totalProcessed' | 'dryRun'>> {
    const result = {
      deletedCount: 0,
      freedSpace: 0,
      errors: []
    }

    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays)

      let hasMore = true
      while (hasMore) {
        const oldClipboards = await clipboardService.getClipboardsForCleanup({
          olderThan: cutoffDate,
          limit: batchSize,
          orderBy: 'lastAccessed'
        })

        if (oldClipboards.length === 0) {
          hasMore = false
          break
        }

        // 计算释放的空间
        const batchContentSize = oldClipboards.reduce((sum, clipboard) => sum + clipboard.content.length, 0)
        
        if (!dryRun) {
          const codes = oldClipboards.map(c => c.code)
          const deletedCount = await clipboardService.deleteClipboards(codes)
          result.deletedCount += deletedCount
        } else {
          result.deletedCount += oldClipboards.length
        }

        result.freedSpace += batchContentSize

        // 如果删除的数量少于批大小，说明没有更多数据了
        if (oldClipboards.length < batchSize) {
          hasMore = false
        }
      }
    } catch (error) {
      result.errors.push(`按年龄清理失败: ${error instanceof Error ? error.message : String(error)}`)
    }

    return result
  }

  /**
   * 按总大小清理数据
   */
  private async cleanupBySize(
    maxTotalSize: number, 
    batchSize: number, 
    dryRun: boolean
  ): Promise<Omit<CleanupResult, 'totalProcessed' | 'dryRun'>> {
    const result = {
      deletedCount: 0,
      freedSpace: 0,
      errors: []
    }

    try {
      const stats = await clipboardService.getStats()
      
      if (stats.totalContentSize <= maxTotalSize) {
        return result // 不需要清理
      }

      const targetReduction = stats.totalContentSize - maxTotalSize
      let currentReduction = 0

      // 按最后访问时间排序，删除最旧的数据
      let hasMore = true
      while (hasMore && currentReduction < targetReduction) {
        const oldClipboards = await clipboardService.getClipboardsForCleanup({
          limit: batchSize,
          orderBy: 'lastAccessed'
        })

        if (oldClipboards.length === 0) {
          hasMore = false
          break
        }

        // 计算这批数据的大小
        const batchContentSize = oldClipboards.reduce((sum, clipboard) => sum + clipboard.content.length, 0)
        
        if (!dryRun) {
          const codes = oldClipboards.map(c => c.code)
          const deletedCount = await clipboardService.deleteClipboards(codes)
          result.deletedCount += deletedCount
        } else {
          result.deletedCount += oldClipboards.length
        }

        result.freedSpace += batchContentSize
        currentReduction += batchContentSize

        // 如果删除的数量少于批大小，说明没有更多数据了
        if (oldClipboards.length < batchSize) {
          hasMore = false
        }
      }
    } catch (error) {
      result.errors.push(`按大小清理失败: ${error instanceof Error ? error.message : String(error)}`)
    }

    return result
  }

  /**
   * 按数量清理数据
   */
  private async cleanupByCount(
    maxCount: number, 
    batchSize: number, 
    dryRun: boolean
  ): Promise<Omit<CleanupResult, 'totalProcessed' | 'dryRun'>> {
    const result = {
      deletedCount: 0,
      freedSpace: 0,
      errors: []
    }

    try {
      const stats = await clipboardService.getStats()
      
      if (stats.totalClipboards <= maxCount) {
        return result // 不需要清理
      }

      const targetDeletion = stats.totalClipboards - maxCount
      let currentDeletion = 0

      // 按最后访问时间排序，删除最旧的数据
      let hasMore = true
      while (hasMore && currentDeletion < targetDeletion) {
        const remainingToDelete = Math.min(batchSize, targetDeletion - currentDeletion)
        
        const oldClipboards = await clipboardService.getClipboardsForCleanup({
          limit: remainingToDelete,
          orderBy: 'lastAccessed'
        })

        if (oldClipboards.length === 0) {
          hasMore = false
          break
        }

        // 计算释放的空间
        const batchContentSize = oldClipboards.reduce((sum, clipboard) => sum + clipboard.content.length, 0)
        
        if (!dryRun) {
          const codes = oldClipboards.map(c => c.code)
          const deletedCount = await clipboardService.deleteClipboards(codes)
          result.deletedCount += deletedCount
          currentDeletion += deletedCount
        } else {
          result.deletedCount += oldClipboards.length
          currentDeletion += oldClipboards.length
        }

        result.freedSpace += batchContentSize

        // 如果删除的数量少于批大小，说明没有更多数据了
        if (oldClipboards.length < remainingToDelete) {
          hasMore = false
        }
      }
    } catch (error) {
      result.errors.push(`按数量清理失败: ${error instanceof Error ? error.message : String(error)}`)
    }

    return result
  }

  /**
   * 获取清理统计信息
   */
  async getCleanupStats(options: CleanupOptions = {}): Promise<CleanupStats> {
    const opts = { ...this.defaultOptions, ...options }
    
    try {
      const stats = await clipboardService.getStats()
      
      // 计算符合清理条件的候选项数量
      let candidatesForCleanup = 0

      // 按年龄计算候选项
      if (opts.maxAge > 0) {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - opts.maxAge)
        
        const ageCandidates = await clipboardService.getClipboardsForCleanup({
          olderThan: cutoffDate,
          limit: 1000 // 限制查询数量以提高性能
        })
        candidatesForCleanup = Math.max(candidatesForCleanup, ageCandidates.length)
      }

      // 按大小计算候选项
      if (opts.maxTotalSize > 0 && stats.totalContentSize > opts.maxTotalSize) {
        // 简化计算：假设平均大小来估算需要删除的数量
        const avgSize = stats.totalClipboards > 0 ? stats.totalContentSize / stats.totalClipboards : 0
        if (avgSize > 0) {
          const excessSize = stats.totalContentSize - opts.maxTotalSize
          const estimatedCandidates = Math.ceil(excessSize / avgSize)
          candidatesForCleanup = Math.max(candidatesForCleanup, estimatedCandidates)
        }
      }

      // 按数量计算候选项
      if (opts.maxCount > 0 && stats.totalClipboards > opts.maxCount) {
        const countCandidates = stats.totalClipboards - opts.maxCount
        candidatesForCleanup = Math.max(candidatesForCleanup, countCandidates)
      }

      return {
        totalClipboards: stats.totalClipboards,
        totalSize: stats.totalContentSize,
        oldestClipboard: stats.oldestClipboard,
        newestClipboard: stats.newestClipboard,
        candidatesForCleanup: Math.min(candidatesForCleanup, stats.totalClipboards)
      }
    } catch (error) {
      throw new Error(`获取清理统计信息失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 验证清理选项
   */
  validateOptions(options: CleanupOptions): string[] {
    const errors: string[] = []

    if (options.maxAge !== undefined && options.maxAge < 0) {
      errors.push('最大年龄不能为负数')
    }

    if (options.maxTotalSize !== undefined && options.maxTotalSize < 0) {
      errors.push('最大总大小不能为负数')
    }

    if (options.maxCount !== undefined && options.maxCount < 0) {
      errors.push('最大数量不能为负数')
    }

    if (options.batchSize !== undefined && (options.batchSize < 1 || options.batchSize > 1000)) {
      errors.push('批处理大小必须在 1-1000 之间')
    }

    return errors
  }
}

// 导出单例实例
export const cleanupService = new CleanupServiceImpl()

// 导出类，以便测试时可以创建新实例
export { CleanupServiceImpl }