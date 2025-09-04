import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CleanupServiceImpl, cleanupService } from '../cleanup-service'
import { clipboardService } from '../clipboard-service'

// Mock clipboard service
vi.mock('../clipboard-service', () => ({
  clipboardService: {
    getStats: vi.fn(),
    getClipboardsForCleanup: vi.fn(),
    deleteClipboards: vi.fn(),
  }
}))

const mockClipboardService = clipboardService as any

describe('CleanupService', () => {
  let service: CleanupServiceImpl

  beforeEach(() => {
    service = new CleanupServiceImpl()
    vi.clearAllMocks()
  })

  describe('cleanup', () => {
    it('should return empty result when no clipboards exist', async () => {
      mockClipboardService.getStats.mockResolvedValue({
        totalClipboards: 0,
        totalContentSize: 0,
        oldestClipboard: undefined,
        newestClipboard: undefined
      })

      const result = await service.cleanup()

      expect(result).toEqual({
        deletedCount: 0,
        freedSpace: 0,
        totalProcessed: 0,
        errors: [],
        dryRun: false
      })
    })

    it('should cleanup old clipboards by age', async () => {
      const oldClipboards = [
        {
          id: '1',
          code: 'old1',
          content: 'content1',
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          lastAccessed: new Date('2023-01-01')
        },
        {
          id: '2',
          code: 'old2',
          content: 'content2',
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02'),
          lastAccessed: new Date('2023-01-02')
        }
      ]

      mockClipboardService.getStats.mockResolvedValue({
        totalClipboards: 2,
        totalContentSize: 16,
        oldestClipboard: new Date('2023-01-01'),
        newestClipboard: new Date('2023-01-02')
      })

      mockClipboardService.getClipboardsForCleanup.mockResolvedValue(oldClipboards)
      mockClipboardService.deleteClipboards.mockResolvedValue(2)

      const result = await service.cleanup({ maxAge: 30 })

      expect(result.deletedCount).toBe(2)
      expect(result.freedSpace).toBe(16) // content1 + content2
      expect(result.errors).toHaveLength(0)
      expect(mockClipboardService.deleteClipboards).toHaveBeenCalledWith(['old1', 'old2'])
    })

    it('should perform dry run without deleting', async () => {
      const oldClipboards = [
        {
          id: '1',
          code: 'old1',
          content: 'content1',
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          lastAccessed: new Date('2023-01-01')
        }
      ]

      mockClipboardService.getStats.mockResolvedValue({
        totalClipboards: 1,
        totalContentSize: 8,
        oldestClipboard: new Date('2023-01-01'),
        newestClipboard: new Date('2023-01-01')
      })

      mockClipboardService.getClipboardsForCleanup.mockResolvedValue(oldClipboards)

      const result = await service.cleanup({ maxAge: 30, dryRun: true })

      expect(result.deletedCount).toBe(1)
      expect(result.freedSpace).toBe(8)
      expect(result.dryRun).toBe(true)
      expect(mockClipboardService.deleteClipboards).not.toHaveBeenCalled()
    })

    it('should cleanup by total size limit', async () => {
      const clipboards = [
        {
          id: '1',
          code: 'clip1',
          content: 'a'.repeat(1000), // 1KB
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          lastAccessed: new Date('2023-01-01')
        },
        {
          id: '2',
          code: 'clip2',
          content: 'b'.repeat(1000), // 1KB
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02'),
          lastAccessed: new Date('2023-01-02')
        }
      ]

      mockClipboardService.getStats.mockResolvedValue({
        totalClipboards: 2,
        totalContentSize: 2000, // 2KB
        oldestClipboard: new Date('2023-01-01'),
        newestClipboard: new Date('2023-01-02')
      })

      mockClipboardService.getClipboardsForCleanup.mockResolvedValue(clipboards)
      mockClipboardService.deleteClipboards.mockResolvedValue(2)

      const result = await service.cleanup({ 
        maxTotalSize: 1500, // 1.5KB limit
        maxAge: 0, // Disable age cleanup
        maxCount: 0 // Disable count cleanup
      })

      expect(result.deletedCount).toBe(2)
      expect(result.freedSpace).toBe(2000)
      expect(mockClipboardService.deleteClipboards).toHaveBeenCalledWith(['clip1', 'clip2'])
    })

    it('should cleanup by count limit', async () => {
      const clipboards = [
        {
          id: '1',
          code: 'clip1',
          content: 'content1',
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          lastAccessed: new Date('2023-01-01')
        }
      ]

      mockClipboardService.getStats.mockResolvedValue({
        totalClipboards: 3,
        totalContentSize: 24,
        oldestClipboard: new Date('2023-01-01'),
        newestClipboard: new Date('2023-01-03')
      })

      mockClipboardService.getClipboardsForCleanup.mockResolvedValue(clipboards)
      mockClipboardService.deleteClipboards.mockResolvedValue(1)

      const result = await service.cleanup({ 
        maxCount: 2, // Keep only 2
        maxAge: 0, // Disable age cleanup
        maxTotalSize: 0 // Disable size cleanup
      })

      expect(result.deletedCount).toBe(1)
      expect(result.freedSpace).toBe(8) // content1
      expect(mockClipboardService.deleteClipboards).toHaveBeenCalledWith(['clip1'])
    })
  }) 
 describe('getCleanupStats', () => {
    it('should return cleanup statistics', async () => {
      const mockStats = {
        totalClipboards: 100,
        totalContentSize: 50000,
        oldestClipboard: new Date('2023-01-01'),
        newestClipboard: new Date('2024-01-01')
      }

      const oldClipboards = Array.from({ length: 20 }, (_, i) => ({
        id: `${i + 1}`,
        code: `old${i + 1}`,
        content: `content${i + 1}`,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        lastAccessed: new Date('2023-01-01')
      }))

      mockClipboardService.getStats.mockResolvedValue(mockStats)
      mockClipboardService.getClipboardsForCleanup.mockResolvedValue(oldClipboards)

      const result = await service.getCleanupStats({ maxAge: 30 })

      expect(result).toEqual({
        totalClipboards: 100,
        totalSize: 50000,
        oldestClipboard: new Date('2023-01-01'),
        newestClipboard: new Date('2024-01-01'),
        candidatesForCleanup: 20
      })
    })

    it('should calculate candidates by size limit', async () => {
      const mockStats = {
        totalClipboards: 10,
        totalContentSize: 10000, // 10KB total
        oldestClipboard: new Date('2023-01-01'),
        newestClipboard: new Date('2024-01-01')
      }

      mockClipboardService.getStats.mockResolvedValue(mockStats)
      mockClipboardService.getClipboardsForCleanup.mockResolvedValue([])

      const result = await service.getCleanupStats({ maxTotalSize: 5000 }) // 5KB limit

      expect(result.candidatesForCleanup).toBe(5) // Need to delete ~5 items (avg 1KB each)
    })

    it('should calculate candidates by count limit', async () => {
      const mockStats = {
        totalClipboards: 100,
        totalContentSize: 50000,
        oldestClipboard: new Date('2023-01-01'),
        newestClipboard: new Date('2024-01-01')
      }

      mockClipboardService.getStats.mockResolvedValue(mockStats)
      mockClipboardService.getClipboardsForCleanup.mockResolvedValue([])

      const result = await service.getCleanupStats({ maxCount: 80 })

      expect(result.candidatesForCleanup).toBe(20) // Need to delete 20 items
    })
  })

  describe('validateOptions', () => {
    it('should return no errors for valid options', () => {
      const errors = service.validateOptions({
        maxAge: 30,
        maxTotalSize: 1000000,
        maxCount: 1000,
        batchSize: 100,
        dryRun: false
      })

      expect(errors).toHaveLength(0)
    })

    it('should return errors for invalid options', () => {
      const errors = service.validateOptions({
        maxAge: -1,
        maxTotalSize: -1000,
        maxCount: -100,
        batchSize: 0
      })

      expect(errors).toContain('最大年龄不能为负数')
      expect(errors).toContain('最大总大小不能为负数')
      expect(errors).toContain('最大数量不能为负数')
      expect(errors).toContain('批处理大小必须在 1-1000 之间')
    })

    it('should validate batch size upper limit', () => {
      const errors = service.validateOptions({
        batchSize: 1001
      })

      expect(errors).toContain('批处理大小必须在 1-1000 之间')
    })
  })

  describe('error handling', () => {
    it('should handle errors gracefully during cleanup', async () => {
      mockClipboardService.getStats.mockRejectedValue(new Error('Database error'))

      const result = await service.cleanup()

      expect(result.errors).toContain('清理过程中发生错误: Database error')
      expect(result.deletedCount).toBe(0)
      expect(result.freedSpace).toBe(0)
    })

    it('should handle errors in age cleanup', async () => {
      mockClipboardService.getStats.mockResolvedValue({
        totalClipboards: 1,
        totalContentSize: 100,
        oldestClipboard: new Date('2023-01-01'),
        newestClipboard: new Date('2024-01-01')
      })

      mockClipboardService.getClipboardsForCleanup.mockRejectedValue(new Error('Query failed'))

      const result = await service.cleanup({ maxAge: 30 })

      expect(result.errors).toContain('按年龄清理失败: Query failed')
    })

    it('should handle errors in getCleanupStats', async () => {
      mockClipboardService.getStats.mockRejectedValue(new Error('Stats error'))

      await expect(service.getCleanupStats()).rejects.toThrow('获取清理统计信息失败: Stats error')
    })
  })

  describe('batch processing', () => {
    it('should process clipboards in batches', async () => {
      const batch1 = Array.from({ length: 2 }, (_, i) => ({
        id: `${i + 1}`,
        code: `clip${i + 1}`,
        content: `content${i + 1}`,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        lastAccessed: new Date('2023-01-01')
      }))

      const batch2 = [
        {
          id: '3',
          code: 'clip3',
          content: 'content3',
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          lastAccessed: new Date('2023-01-01')
        }
      ]

      mockClipboardService.getStats.mockResolvedValue({
        totalClipboards: 3,
        totalContentSize: 24,
        oldestClipboard: new Date('2023-01-01'),
        newestClipboard: new Date('2023-01-01')
      })

      mockClipboardService.getClipboardsForCleanup
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2)

      mockClipboardService.deleteClipboards
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)

      const result = await service.cleanup({ 
        maxAge: 30, 
        batchSize: 2,
        maxTotalSize: 0, // Disable size cleanup
        maxCount: 0 // Disable count cleanup
      })

      expect(result.deletedCount).toBe(3)
      expect(mockClipboardService.getClipboardsForCleanup).toHaveBeenCalledTimes(2)
      expect(mockClipboardService.deleteClipboards).toHaveBeenCalledTimes(2)
    })
  })

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(cleanupService).toBeInstanceOf(CleanupServiceImpl)
    })
  })
})