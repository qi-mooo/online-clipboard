import { cleanupService, CleanupOptions } from './cleanup-service'

export interface ScheduledCleanupConfig {
  enabled: boolean
  schedule: {
    intervalHours: number // 清理间隔（小时）
    maxAge: number // 最大年龄（天）
    maxTotalSize: number // 最大总大小（字节）
    maxCount: number // 最大数量
  }
  logging: {
    enabled: boolean
    logLevel: 'info' | 'warn' | 'error'
  }
}

export interface CleanupLog {
  timestamp: Date
  type: 'scheduled' | 'manual'
  result: {
    deletedCount: number
    freedSpace: number
    totalProcessed: number
    errors: string[]
    dryRun: boolean
  }
  duration: number // 执行时间（毫秒）
}

class ScheduledCleanupImpl {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private logs: CleanupLog[] = []
  private readonly maxLogs = 100 // 最多保留 100 条日志

  private readonly defaultConfig: ScheduledCleanupConfig = {
    enabled: false,
    schedule: {
      intervalHours: 24, // 每天执行一次
      maxAge: 30, // 30 天
      maxTotalSize: 100 * 1024 * 1024, // 100MB
      maxCount: 10000 // 10,000 个剪切板
    },
    logging: {
      enabled: true,
      logLevel: 'info'
    }
  }

  /**
   * 启动定时清理
   */
  start(config: Partial<ScheduledCleanupConfig> = {}): void {
    const fullConfig = { ...this.defaultConfig, ...config }

    if (!fullConfig.enabled) {
      this.log('warn', '定时清理已禁用')
      return
    }

    if (this.intervalId) {
      this.log('warn', '定时清理已在运行中')
      return
    }

    const intervalMs = fullConfig.schedule.intervalHours * 60 * 60 * 1000

    this.intervalId = setInterval(async () => {
      await this.executeScheduledCleanup(fullConfig)
    }, intervalMs)

    this.log('info', `定时清理已启动，间隔: ${fullConfig.schedule.intervalHours} 小时`)

    // 立即执行一次清理（可选）
    // this.executeScheduledCleanup(fullConfig)
  }

  /**
   * 停止定时清理
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      this.log('info', '定时清理已停止')
    }
  }

  /**
   * 执行定时清理
   */
  private async executeScheduledCleanup(config: ScheduledCleanupConfig): Promise<void> {
    if (this.isRunning) {
      this.log('warn', '清理任务已在运行中，跳过本次执行')
      return
    }

    this.isRunning = true
    const startTime = Date.now()

    try {
      this.log('info', '开始执行定时清理')

      const cleanupOptions: CleanupOptions = {
        maxAge: config.schedule.maxAge,
        maxTotalSize: config.schedule.maxTotalSize,
        maxCount: config.schedule.maxCount,
        batchSize: 100,
        dryRun: false
      }

      const result = await cleanupService.cleanup(cleanupOptions)
      const duration = Date.now() - startTime

      // 记录日志
      this.addLog({
        timestamp: new Date(),
        type: 'scheduled',
        result,
        duration
      })

      if (result.errors.length > 0) {
        this.log('warn', `清理完成但有错误: ${result.errors.join(', ')}`)
      } else {
        this.log('info', `清理完成: 删除 ${result.deletedCount} 个剪切板，释放 ${this.formatBytes(result.freedSpace)} 空间`)
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      this.addLog({
        timestamp: new Date(),
        type: 'scheduled',
        result: {
          deletedCount: 0,
          freedSpace: 0,
          totalProcessed: 0,
          errors: [errorMessage],
          dryRun: false
        },
        duration
      })

      this.log('error', `定时清理失败: ${errorMessage}`)
    } finally {
      this.isRunning = false
    }
  }

  /**
   * 手动执行清理
   */
  async executeManualCleanup(options: CleanupOptions = {}): Promise<CleanupLog> {
    const startTime = Date.now()

    try {
      this.log('info', '开始执行手动清理')

      const result = await cleanupService.cleanup(options)
      const duration = Date.now() - startTime

      const log: CleanupLog = {
        timestamp: new Date(),
        type: 'manual',
        result,
        duration
      }

      this.addLog(log)

      if (result.errors.length > 0) {
        this.log('warn', `手动清理完成但有错误: ${result.errors.join(', ')}`)
      } else {
        this.log('info', `手动清理完成: 删除 ${result.deletedCount} 个剪切板，释放 ${this.formatBytes(result.freedSpace)} 空间`)
      }

      return log
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      const log: CleanupLog = {
        timestamp: new Date(),
        type: 'manual',
        result: {
          deletedCount: 0,
          freedSpace: 0,
          totalProcessed: 0,
          errors: [errorMessage],
          dryRun: false
        },
        duration
      }

      this.addLog(log)
      this.log('error', `手动清理失败: ${errorMessage}`)

      throw error
    }
  }

  /**
   * 获取清理日志
   */
  getLogs(limit?: number): CleanupLog[] {
    const logs = [...this.logs].reverse() // 最新的在前
    return limit ? logs.slice(0, limit) : logs
  }

  /**
   * 清空日志
   */
  clearLogs(): void {
    this.logs = []
    this.log('info', '清理日志已清空')
  }

  /**
   * 获取运行状态
   */
  getStatus(): {
    isScheduled: boolean
    isRunning: boolean
    nextRun?: Date
    totalLogs: number
  } {
    return {
      isScheduled: this.intervalId !== null,
      isRunning: this.isRunning,
      nextRun: this.intervalId ? new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined, // 简化计算
      totalLogs: this.logs.length
    }
  }

  /**
   * 添加日志记录
   */
  private addLog(log: CleanupLog): void {
    this.logs.push(log)

    // 保持日志数量在限制内
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }
  }

  /**
   * 记录日志
   */
  private log(level: 'info' | 'warn' | 'error', message: string): void {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] [CLEANUP] ${message}`

    switch (level) {
      case 'info':
        console.log(logMessage)
        break
      case 'warn':
        console.warn(logMessage)
        break
      case 'error':
        console.error(logMessage)
        break
    }
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

// 导出单例实例
export const scheduledCleanup = new ScheduledCleanupImpl()

// 导出类，以便测试时可以创建新实例
export { ScheduledCleanupImpl }