/**
 * 简单的内存缓存服务
 * 用于缓存频繁访问的剪切板数据
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

interface CacheOptions {
  defaultTTL?: number // 默认缓存时间（毫秒）
  maxSize?: number    // 最大缓存条目数
  cleanupInterval?: number // 清理间隔（毫秒）
}

class CacheService<T = any> {
  private cache = new Map<string, CacheEntry<T>>()
  private readonly defaultTTL: number
  private readonly maxSize: number
  private cleanupTimer?: NodeJS.Timeout

  constructor(options: CacheOptions = {}) {
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000 // 5分钟
    this.maxSize = options.maxSize || 1000
    
    // 定期清理过期缓存
    const cleanupInterval = options.cleanupInterval || 60 * 1000 // 1分钟
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, cleanupInterval)
  }

  /**
   * 设置缓存
   */
  set(key: string, data: T, ttl?: number): void {
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    })
  }

  /**
   * 获取缓存
   */
  get(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * 检查缓存是否存在且未过期
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    size: number
    maxSize: number
    hitRate?: number
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key))
  }

  /**
   * 销毁缓存服务
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    this.clear()
  }
}

// 创建剪切板数据缓存实例
export const clipboardCache = new CacheService({
  defaultTTL: 2 * 60 * 1000, // 2分钟
  maxSize: 500,
  cleanupInterval: 30 * 1000 // 30秒清理一次
})

// 创建代码存在性检查缓存实例
export const codeExistsCache = new CacheService<boolean>({
  defaultTTL: 30 * 1000, // 30秒
  maxSize: 1000,
  cleanupInterval: 15 * 1000 // 15秒清理一次
})

export { CacheService }
export type { CacheOptions }