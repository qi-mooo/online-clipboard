import { clipboardService, ClipboardServiceImpl, ClipboardServiceOptions } from './clipboard-service'
import { clipboardCache, codeExistsCache } from './cache-service'
import { ClipboardData } from '@/types/clipboard'

/**
 * 优化的剪切板服务，添加了缓存和性能优化
 */
class OptimizedClipboardService extends ClipboardServiceImpl {
  constructor(options: ClipboardServiceOptions = {}) {
    super(options)
  }

  /**
   * 获取剪切板（带缓存）
   */
  async getOrCreateClipboard(code: string): Promise<ClipboardData> {
    // 首先检查缓存
    const cached = clipboardCache.get(code)
    if (cached) {
      // 异步更新访问时间，不阻塞响应
      this.updateAccessTimeAsync(code)
      return cached
    }

    // 缓存未命中，从数据库获取
    const clipboard = await super.getOrCreateClipboard(code)
    
    // 缓存结果
    clipboardCache.set(code, clipboard)
    
    return clipboard
  }

  /**
   * 更新剪切板内容（带缓存失效）
   */
  async updateClipboard(code: string, input: { content: string; version?: number }): Promise<ClipboardData> {
    const updated = await super.updateClipboard(code, input)
    
    // 更新缓存
    clipboardCache.set(code, updated)
    
    return updated
  }

  /**
   * 创建或更新剪切板（带缓存）
   */
  async upsertClipboard(input: { code: string; content: string }): Promise<ClipboardData> {
    const clipboard = await super.upsertClipboard(input)
    
    // 更新缓存
    clipboardCache.set(input.code, clipboard)
    codeExistsCache.set(input.code, true)
    
    return clipboard
  }

  /**
   * 检查代码是否存在（带缓存）
   */
  async codeExists(code: string): Promise<boolean> {
    // 首先检查缓存
    const cached = codeExistsCache.get(code)
    if (cached !== null) {
      return cached
    }

    // 检查剪切板缓存
    if (clipboardCache.has(code)) {
      codeExistsCache.set(code, true)
      return true
    }

    // 缓存未命中，查询数据库
    const exists = await super.codeExists(code)
    
    // 缓存结果
    codeExistsCache.set(code, exists)
    
    return exists
  }

  /**
   * 删除剪切板（带缓存清理）
   */
  async deleteClipboard(code: string): Promise<void> {
    await super.deleteClipboard(code)
    
    // 清理缓存
    clipboardCache.delete(code)
    codeExistsCache.delete(code)
  }

  /**
   * 批量删除剪切板（带缓存清理）
   */
  async deleteClipboards(codes: string[]): Promise<number> {
    const count = await super.deleteClipboards(codes)
    
    // 清理缓存
    codes.forEach(code => {
      clipboardCache.delete(code)
      codeExistsCache.delete(code)
    })
    
    return count
  }

  /**
   * 异步更新访问时间（不阻塞主要操作）
   */
  private updateAccessTimeAsync(code: string): void {
    // 使用 setTimeout 确保不阻塞当前操作
    setTimeout(async () => {
      try {
        await super.updateAccessTime(code)
        
        // 如果缓存中有数据，更新缓存中的访问时间
        const cached = clipboardCache.get(code)
        if (cached) {
          const updated = { ...cached, lastAccessed: new Date() }
          clipboardCache.set(code, updated)
        }
      } catch (error) {
        // 访问时间更新失败不应该影响主要功能
        console.warn(`异步更新访问时间失败 (code: ${code}):`, error)
      }
    }, 0)
  }

  /**
   * 预热缓存 - 预加载热门剪切板
   */
  async warmupCache(codes: string[]): Promise<void> {
    const promises = codes.map(async (code) => {
      try {
        if (!clipboardCache.has(code)) {
          const clipboard = await super.getOrCreateClipboard(code)
          clipboardCache.set(code, clipboard)
        }
      } catch (error) {
        console.warn(`预热缓存失败 (code: ${code}):`, error)
      }
    })

    await Promise.allSettled(promises)
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    clipboardCache: ReturnType<typeof clipboardCache.getStats>
    codeExistsCache: ReturnType<typeof codeExistsCache.getStats>
  } {
    return {
      clipboardCache: clipboardCache.getStats(),
      codeExistsCache: codeExistsCache.getStats()
    }
  }

  /**
   * 清理所有缓存
   */
  clearCache(): void {
    clipboardCache.clear()
    codeExistsCache.clear()
  }
}

// 导出优化的服务实例
export const optimizedClipboardService = new OptimizedClipboardService()

// 为了向后兼容，也导出原始服务
export { clipboardService }
export { OptimizedClipboardService }