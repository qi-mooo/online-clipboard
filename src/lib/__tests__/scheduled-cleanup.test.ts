import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ScheduledCleanupImpl, scheduledCleanup } from '../scheduled-cleanup'
import { cleanupService } from '../cleanup-service'

// Mock cleanup service
vi.mock('../cleanup-service', () => ({
  cleanupService: {
    cleanup: vi.fn(),
  }
}))

const mockCleanupService = cleanupService as any

// Mock timers
vi.useFakeTimers()

describe('ScheduledCleanup', () => {
  let service: ScheduledCleanupImpl
  let consoleSpy: any

  beforeEach(() => {
    service = new ScheduledCleanupImpl()
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {})
    }
    vi.clearAllMocks()
  })

  afterEach(() => {
    service.stop()
    consoleSpy.log.mockRestore()
    consoleSpy.warn.mockRestore()
    consoleSpy.error.mockRestore()
    vi.clearAllTimers()
  })

  describe('start and stop', () => {
    it('should not start when disabled', () => {
      service.start({ enabled: false })

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('定时清理已禁用')
      )

      const status = service.getStatus()
      expect(status.isScheduled).toBe(false)
    })

    it('should start scheduled cleanup when enabled', () => {
      service.start({ 
        enabled: true,
        schedule: { intervalHours: 1, maxAge: 30, maxTotalSize: 1000000, maxCount: 1000 }
      })

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('定时清理已启动，间隔: 1 小时')
      )

      const status = service.getStatus()
      expect(status.isScheduled).toBe(true)
    })

    it('should not start if already running', () => {
      service.start({ enabled: true })
      service.start({ enabled: true })

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('定时清理已在运行中')
      )
    })

    it('should stop scheduled cleanup', () => {
      service.start({ enabled: true })
      service.stop()

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('定时清理已停止')
      )

      const status = service.getStatus()
      expect(status.isScheduled).toBe(false)
    })
  })

  describe('executeManualCleanup', () => {
    it('should execute manual cleanup successfully', async () => {
      const mockResult = {
        deletedCount: 5,
        freedSpace: 1024,
        totalProcessed: 100,
        errors: [],
        dryRun: false
      }

      mockCleanupService.cleanup.mockResolvedValue(mockResult)

      const log = await service.executeManualCleanup({ maxAge: 30 })

      expect(log.type).toBe('manual')
      expect(log.result).toEqual(mockResult)
      expect(log.duration).toBeGreaterThanOrEqual(0)
      expect(mockCleanupService.cleanup).toHaveBeenCalledWith({ maxAge: 30 })

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('手动清理完成: 删除 5 个剪切板，释放 1 KB 空间')
      )
    })

    it('should handle cleanup errors', async () => {
      const error = new Error('Cleanup failed')
      mockCleanupService.cleanup.mockRejectedValue(error)

      await expect(service.executeManualCleanup()).rejects.toThrow('Cleanup failed')

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('手动清理失败: Cleanup failed')
      )

      const logs = service.getLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].result.errors).toContain('Cleanup failed')
    })

    it('should handle cleanup with warnings', async () => {
      const mockResult = {
        deletedCount: 3,
        freedSpace: 512,
        totalProcessed: 50,
        errors: ['Warning: Some files could not be deleted'],
        dryRun: false
      }

      mockCleanupService.cleanup.mockResolvedValue(mockResult)

      const log = await service.executeManualCleanup()

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('手动清理完成但有错误: Warning: Some files could not be deleted')
      )
    })
  })

  describe('scheduled execution', () => {
    it('should execute cleanup on schedule', async () => {
      const mockResult = {
        deletedCount: 2,
        freedSpace: 256,
        totalProcessed: 20,
        errors: [],
        dryRun: false
      }

      mockCleanupService.cleanup.mockResolvedValue(mockResult)

      service.start({ 
        enabled: true,
        schedule: { intervalHours: 1, maxAge: 30, maxTotalSize: 1000000, maxCount: 1000 }
      })

      // Fast-forward time to trigger the scheduled cleanup
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000) // 1 hour

      expect(mockCleanupService.cleanup).toHaveBeenCalledWith({
        maxAge: 30,
        maxTotalSize: 1000000,
        maxCount: 1000,
        batchSize: 100,
        dryRun: false
      })

      const logs = service.getLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].type).toBe('scheduled')
    })

    it('should skip execution if already running', async () => {
      // Mock a long-running cleanup
      mockCleanupService.cleanup.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          deletedCount: 1,
          freedSpace: 100,
          totalProcessed: 10,
          errors: [],
          dryRun: false
        }), 2000))
      )

      service.start({ 
        enabled: true,
        schedule: { intervalHours: 1, maxAge: 30, maxTotalSize: 1000000, maxCount: 1000 }
      })

      // Trigger first execution
      vi.advanceTimersByTime(60 * 60 * 1000)
      
      // Trigger second execution while first is still running
      vi.advanceTimersByTime(60 * 60 * 1000)

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('清理任务已在运行中，跳过本次执行')
      )
    })
  })

  describe('logs management', () => {
    it('should store and retrieve logs', async () => {
      const mockResult = {
        deletedCount: 1,
        freedSpace: 100,
        totalProcessed: 10,
        errors: [],
        dryRun: false
      }

      mockCleanupService.cleanup.mockResolvedValue(mockResult)

      await service.executeManualCleanup()
      await service.executeManualCleanup()

      const logs = service.getLogs()
      expect(logs).toHaveLength(2)
      expect(logs[0].timestamp).toBeInstanceOf(Date)
      expect(logs[1].timestamp).toBeInstanceOf(Date)
      // Logs should be in reverse chronological order (newest first)
      expect(logs[0].timestamp.getTime()).toBeGreaterThanOrEqual(logs[1].timestamp.getTime())
    })

    it('should limit number of logs', async () => {
      const mockResult = {
        deletedCount: 1,
        freedSpace: 100,
        totalProcessed: 10,
        errors: [],
        dryRun: false
      }

      mockCleanupService.cleanup.mockResolvedValue(mockResult)

      // Execute more cleanups than the log limit (100)
      for (let i = 0; i < 105; i++) {
        await service.executeManualCleanup()
      }

      const logs = service.getLogs()
      expect(logs.length).toBeLessThanOrEqual(100)
    })

    it('should clear logs', async () => {
      const mockResult = {
        deletedCount: 1,
        freedSpace: 100,
        totalProcessed: 10,
        errors: [],
        dryRun: false
      }

      mockCleanupService.cleanup.mockResolvedValue(mockResult)

      await service.executeManualCleanup()
      expect(service.getLogs()).toHaveLength(1)

      service.clearLogs()
      expect(service.getLogs()).toHaveLength(0)

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('清理日志已清空')
      )
    })

    it('should limit returned logs', async () => {
      const mockResult = {
        deletedCount: 1,
        freedSpace: 100,
        totalProcessed: 10,
        errors: [],
        dryRun: false
      }

      mockCleanupService.cleanup.mockResolvedValue(mockResult)

      await service.executeManualCleanup()
      await service.executeManualCleanup()
      await service.executeManualCleanup()

      const limitedLogs = service.getLogs(2)
      expect(limitedLogs).toHaveLength(2)
    })
  })

  describe('status reporting', () => {
    it('should report correct status when not scheduled', () => {
      const status = service.getStatus()

      expect(status).toEqual({
        isScheduled: false,
        isRunning: false,
        nextRun: undefined,
        totalLogs: 0
      })
    })

    it('should report correct status when scheduled', () => {
      service.start({ enabled: true })

      const status = service.getStatus()

      expect(status.isScheduled).toBe(true)
      expect(status.isRunning).toBe(false)
      expect(status.nextRun).toBeInstanceOf(Date)
      expect(status.totalLogs).toBe(0)
    })
  })

  describe('utility methods', () => {
    it('should format bytes correctly', async () => {
      const mockResults = [
        { deletedCount: 1, freedSpace: 0, totalProcessed: 1, errors: [], dryRun: false },
        { deletedCount: 1, freedSpace: 1024, totalProcessed: 1, errors: [], dryRun: false },
        { deletedCount: 1, freedSpace: 1024 * 1024, totalProcessed: 1, errors: [], dryRun: false },
        { deletedCount: 1, freedSpace: 1024 * 1024 * 1024, totalProcessed: 1, errors: [], dryRun: false }
      ]

      for (const result of mockResults) {
        mockCleanupService.cleanup.mockResolvedValueOnce(result)
        await service.executeManualCleanup()
      }

      // Check that the log messages contain properly formatted byte sizes
      const logCalls = consoleSpy.log.mock.calls.filter(call => 
        call[0].includes('手动清理完成')
      )

      expect(logCalls[0][0]).toContain('0 B')
      expect(logCalls[1][0]).toContain('1 KB')
      expect(logCalls[2][0]).toContain('1 MB')
      expect(logCalls[3][0]).toContain('1 GB')
    })
  })

  describe('error handling in scheduled execution', () => {
    it('should handle errors in scheduled cleanup', async () => {
      const error = new Error('Scheduled cleanup failed')
      mockCleanupService.cleanup.mockRejectedValue(error)

      service.start({ 
        enabled: true,
        schedule: { intervalHours: 1, maxAge: 30, maxTotalSize: 1000000, maxCount: 1000 }
      })

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('定时清理失败: Scheduled cleanup failed')
      )

      const logs = service.getLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].result.errors).toContain('Scheduled cleanup failed')
    })
  })

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(scheduledCleanup).toBeInstanceOf(ScheduledCleanupImpl)
    })
  })
})