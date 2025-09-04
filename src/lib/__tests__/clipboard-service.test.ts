import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { ClipboardServiceImpl, clipboardService } from '../clipboard-service'
import { prisma } from '../db'
import { Prisma } from '@prisma/client'

// Mock Prisma client
vi.mock('../db', () => ({
  prisma: {
    clipboard: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  }
}))

const mockPrisma = prisma as any

describe('ClipboardService', () => {
  let service: ClipboardServiceImpl

  beforeEach(() => {
    service = new ClipboardServiceImpl()
    vi.clearAllMocks()
  })

  describe('getOrCreateClipboard', () => {
    it('should return existing clipboard and update access time', async () => {
      const existingClipboard = {
        id: '1',
        code: 'test123',
        content: 'existing content',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        lastAccessed: new Date('2024-01-01')
      }

      const updatedClipboard = {
        ...existingClipboard,
        lastAccessed: new Date('2024-01-02')
      }

      mockPrisma.clipboard.findUnique.mockResolvedValue(existingClipboard)
      mockPrisma.clipboard.update.mockResolvedValue(updatedClipboard)

      const result = await service.getOrCreateClipboard('test123')

      expect(mockPrisma.clipboard.findUnique).toHaveBeenCalledWith({
        where: { code: 'test123' }
      })
      expect(mockPrisma.clipboard.update).toHaveBeenCalledWith({
        where: { code: 'test123' },
        data: { lastAccessed: expect.any(Date) }
      })
      expect(result).toEqual(updatedClipboard)
    })

    it('should create new clipboard if not exists', async () => {
      const newClipboard = {
        id: '2',
        code: 'new123',
        content: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessed: new Date()
      }

      mockPrisma.clipboard.findUnique.mockResolvedValue(null)
      mockPrisma.clipboard.create.mockResolvedValue(newClipboard)

      const result = await service.getOrCreateClipboard('new123')

      expect(mockPrisma.clipboard.findUnique).toHaveBeenCalledWith({
        where: { code: 'new123' }
      })
      expect(mockPrisma.clipboard.create).toHaveBeenCalledWith({
        data: {
          code: 'new123',
          content: '',
          lastAccessed: expect.any(Date)
        }
      })
      expect(result).toEqual(newClipboard)
    })

    it('should handle concurrent creation conflicts', async () => {
      const existingClipboard = {
        id: '3',
        code: 'concurrent123',
        content: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessed: new Date()
      }

      const updatedClipboard = {
        ...existingClipboard,
        lastAccessed: new Date()
      }

      // First call returns null, create fails with unique constraint, second call finds existing
      mockPrisma.clipboard.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingClipboard)
      
      const uniqueConstraintError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '5.0.0' }
      )
      mockPrisma.clipboard.create.mockRejectedValue(uniqueConstraintError)
      mockPrisma.clipboard.update.mockResolvedValue(updatedClipboard)

      const result = await service.getOrCreateClipboard('concurrent123')

      expect(result).toEqual(updatedClipboard)
      expect(mockPrisma.clipboard.findUnique).toHaveBeenCalledTimes(2)
    })
  })

  describe('upsertClipboard', () => {
    it('should create or update clipboard successfully', async () => {
      const input = { code: 'test123', content: 'test content' }
      const clipboard = {
        id: '1',
        code: 'test123',
        content: 'test content',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessed: new Date()
      }

      mockPrisma.clipboard.upsert.mockResolvedValue(clipboard)

      const result = await service.upsertClipboard(input)

      expect(mockPrisma.clipboard.upsert).toHaveBeenCalledWith({
        where: { code: 'test123' },
        update: {
          content: 'test content',
          lastAccessed: expect.any(Date)
        },
        create: {
          code: 'test123',
          content: 'test content',
          lastAccessed: expect.any(Date)
        }
      })
      expect(result).toEqual(clipboard)
    })

    it('should throw error for content too large', async () => {
      const service = new ClipboardServiceImpl({ maxContentSize: 10 })
      const input = { code: 'test123', content: 'this content is too long' }

      await expect(service.upsertClipboard(input)).rejects.toThrow('内容大小超过限制')
    })
  })

  describe('updateClipboard', () => {
    it('should update clipboard successfully', async () => {
      const existingClipboard = {
        id: '1',
        code: 'test123',
        content: 'old content',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        lastAccessed: new Date('2024-01-01')
      }

      const updatedClipboard = {
        ...existingClipboard,
        content: 'new content',
        updatedAt: new Date('2024-01-02'),
        lastAccessed: new Date('2024-01-02')
      }

      mockPrisma.clipboard.findUnique.mockResolvedValue(existingClipboard)
      mockPrisma.clipboard.update.mockResolvedValue(updatedClipboard)

      const result = await service.updateClipboard('test123', { content: 'new content' })

      expect(mockPrisma.clipboard.findUnique).toHaveBeenCalledWith({
        where: { code: 'test123' }
      })
      expect(mockPrisma.clipboard.update).toHaveBeenCalledWith({
        where: { 
          code: 'test123',
          updatedAt: existingClipboard.updatedAt
        },
        data: {
          content: 'new content',
          lastAccessed: expect.any(Date)
        }
      })
      expect(result).toEqual(updatedClipboard)
    })

    it('should throw NOT_FOUND error if clipboard does not exist', async () => {
      mockPrisma.clipboard.findUnique.mockResolvedValue(null)

      await expect(service.updateClipboard('nonexistent', { content: 'test' }))
        .rejects.toThrow('剪切板不存在')
    })

    it('should handle version conflicts with optimistic locking', async () => {
      const existingClipboard = {
        id: '1',
        code: 'test123',
        content: 'old content',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
        lastAccessed: new Date('2024-01-01')
      }

      mockPrisma.clipboard.findUnique.mockResolvedValue(existingClipboard)

      const wrongVersion = new Date('2024-01-01T09:00:00Z').getTime()
      
      await expect(service.updateClipboard('test123', { 
        content: 'new content', 
        version: wrongVersion 
      })).rejects.toThrow('剪切板已被其他用户修改')
    })

    it('should retry on concurrent update conflicts', async () => {
      const existingClipboard = {
        id: '1',
        code: 'test123',
        content: 'old content',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        lastAccessed: new Date('2024-01-01')
      }

      const updatedClipboard = {
        ...existingClipboard,
        content: 'new content',
        updatedAt: new Date('2024-01-02')
      }

      // Mock findUnique to return the existing clipboard for both attempts
      mockPrisma.clipboard.findUnique
        .mockResolvedValueOnce(existingClipboard)
        .mockResolvedValueOnce(existingClipboard)
      
      const recordNotFoundError = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: '5.0.0' }
      )
      
      mockPrisma.clipboard.update
        .mockRejectedValueOnce(recordNotFoundError)
        .mockResolvedValueOnce(updatedClipboard)

      const result = await service.updateClipboard('test123', { content: 'new content' })

      expect(mockPrisma.clipboard.findUnique).toHaveBeenCalledTimes(2)
      expect(mockPrisma.clipboard.update).toHaveBeenCalledTimes(2)
      expect(result).toEqual(updatedClipboard)
    })
  })

  describe('deleteClipboard', () => {
    it('should delete clipboard successfully', async () => {
      mockPrisma.clipboard.delete.mockResolvedValue({})

      await service.deleteClipboard('test123')

      expect(mockPrisma.clipboard.delete).toHaveBeenCalledWith({
        where: { code: 'test123' }
      })
    })

    it('should throw NOT_FOUND error if clipboard does not exist', async () => {
      const recordNotFoundError = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: '5.0.0' }
      )
      
      mockPrisma.clipboard.delete.mockRejectedValue(recordNotFoundError)

      await expect(service.deleteClipboard('nonexistent'))
        .rejects.toThrow('剪切板不存在')
    })
  })

  describe('codeExists', () => {
    it('should return true if code exists', async () => {
      mockPrisma.clipboard.count.mockResolvedValue(1)

      const result = await service.codeExists('test123')

      expect(mockPrisma.clipboard.count).toHaveBeenCalledWith({
        where: { code: 'test123' }
      })
      expect(result).toBe(true)
    })

    it('should return false if code does not exist', async () => {
      mockPrisma.clipboard.count.mockResolvedValue(0)

      const result = await service.codeExists('nonexistent')

      expect(result).toBe(false)
    })
  })

  describe('getStats', () => {
    it('should return clipboard statistics', async () => {
      const mockStats = {
        _min: { createdAt: new Date('2024-01-01') },
        _max: { createdAt: new Date('2024-01-31') }
      }

      const mockClipboards = [
        { content: 'Hello World' }, // 11 characters
        { content: 'Test content' }, // 12 characters  
        { content: 'Another test' }, // 12 characters
        { content: '' }, // 0 characters
        { content: 'Final test content' } // 18 characters
      ]

      mockPrisma.clipboard.count.mockResolvedValue(5)
      mockPrisma.clipboard.aggregate.mockResolvedValue(mockStats)
      mockPrisma.clipboard.findMany.mockResolvedValue(mockClipboards)

      const result = await service.getStats()

      expect(result).toEqual({
        totalClipboards: 5,
        totalContentSize: 53, // 11 + 12 + 12 + 0 + 18 = 53
        oldestClipboard: new Date('2024-01-01'),
        newestClipboard: new Date('2024-01-31')
      })
    })
  })

  describe('getClipboardsForCleanup', () => {
    it('should return clipboards older than specified date', async () => {
      const oldDate = new Date('2024-01-01')
      const mockClipboards = [
        {
          id: '1',
          code: 'old1',
          content: 'content1',
          createdAt: new Date('2023-12-01'),
          updatedAt: new Date('2023-12-01'),
          lastAccessed: new Date('2023-12-01')
        },
        {
          id: '2',
          code: 'old2',
          content: 'content2',
          createdAt: new Date('2023-11-01'),
          updatedAt: new Date('2023-11-01'),
          lastAccessed: new Date('2023-11-01')
        }
      ]

      mockPrisma.clipboard.findMany.mockResolvedValue(mockClipboards)

      const result = await service.getClipboardsForCleanup({
        olderThan: oldDate,
        limit: 10,
        orderBy: 'lastAccessed'
      })

      expect(mockPrisma.clipboard.findMany).toHaveBeenCalledWith({
        where: {
          lastAccessed: { lt: oldDate }
        },
        orderBy: { lastAccessed: 'asc' },
        take: 10
      })
      expect(result).toEqual(mockClipboards)
    })

    it('should return all clipboards if no date filter', async () => {
      const mockClipboards = [{ id: '1', code: 'test' }]
      mockPrisma.clipboard.findMany.mockResolvedValue(mockClipboards)

      const result = await service.getClipboardsForCleanup()

      expect(mockPrisma.clipboard.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { lastAccessed: 'asc' },
        take: undefined
      })
      expect(result).toEqual(mockClipboards)
    })
  })

  describe('deleteClipboards', () => {
    it('should delete multiple clipboards and return count', async () => {
      mockPrisma.clipboard.deleteMany.mockResolvedValue({ count: 3 })

      const result = await service.deleteClipboards(['code1', 'code2', 'code3'])

      expect(mockPrisma.clipboard.deleteMany).toHaveBeenCalledWith({
        where: {
          code: { in: ['code1', 'code2', 'code3'] }
        }
      })
      expect(result).toBe(3)
    })
  })

  describe('updateAccessTime', () => {
    it('should update access time successfully', async () => {
      mockPrisma.clipboard.update.mockResolvedValue({})

      await service.updateAccessTime('test123')

      expect(mockPrisma.clipboard.update).toHaveBeenCalledWith({
        where: { code: 'test123' },
        data: { lastAccessed: expect.any(Date) }
      })
    })

    it('should not throw error if update fails', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockPrisma.clipboard.update.mockRejectedValue(new Error('Update failed'))

      await expect(service.updateAccessTime('test123')).resolves.toBeUndefined()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('更新访问时间失败'),
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('transaction', () => {
    it('should execute transaction successfully', async () => {
      const mockResult = { success: true }
      const mockOperation = vi.fn().mockResolvedValue(mockResult)
      
      mockPrisma.$transaction.mockImplementation((fn: any) => fn(mockPrisma))

      const result = await service.transaction(mockOperation)

      expect(mockPrisma.$transaction).toHaveBeenCalledWith(mockOperation)
      expect(mockOperation).toHaveBeenCalledWith(mockPrisma)
      expect(result).toEqual(mockResult)
    })

    it('should throw DATABASE_ERROR if transaction fails', async () => {
      const mockError = new Error('Transaction failed')
      mockPrisma.$transaction.mockRejectedValue(mockError)

      await expect(service.transaction(() => Promise.resolve()))
        .rejects.toThrow('事务执行失败')
    })
  })

  describe('error handling', () => {
    it('should create proper error objects', async () => {
      mockPrisma.clipboard.findUnique.mockRejectedValue(new Error('Database error'))

      try {
        await service.getOrCreateClipboard('test')
      } catch (error: any) {
        expect(error.code).toBe('DATABASE_ERROR')
        expect(error.message).toBe('获取或创建剪切板失败')
        expect(error.details).toBeInstanceOf(Error)
      }
    })
  })

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(clipboardService).toBeInstanceOf(ClipboardServiceImpl)
    })
  })
})