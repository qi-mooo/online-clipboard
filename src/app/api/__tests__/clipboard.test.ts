import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { GET, POST, PUT } from '../clipboard/[code]/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    clipboard: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

const mockPrisma = prisma as any

describe('/api/clipboard/[code]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET', () => {
    it('should return existing clipboard and update lastAccessed', async () => {
      const mockClipboard = {
        id: '1',
        code: 'test123',
        content: 'Hello World',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessed: new Date(),
      }

      const updatedClipboard = { ...mockClipboard, lastAccessed: new Date() }

      mockPrisma.clipboard.findUnique.mockResolvedValue(mockClipboard)
      mockPrisma.clipboard.update.mockResolvedValue(updatedClipboard)

      const request = new NextRequest('http://localhost/api/clipboard/test123')
      const response = await GET(request, { params: { code: 'test123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.code).toBe('test123')
      expect(mockPrisma.clipboard.findUnique).toHaveBeenCalledWith({
        where: { code: 'test123' }
      })
      expect(mockPrisma.clipboard.update).toHaveBeenCalledWith({
        where: { code: 'test123' },
        data: { lastAccessed: expect.any(Date) }
      })
    })

    it('should create new clipboard if not exists', async () => {
      const newClipboard = {
        id: '2',
        code: 'newcode',
        content: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessed: new Date(),
      }

      mockPrisma.clipboard.findUnique.mockResolvedValue(null)
      mockPrisma.clipboard.create.mockResolvedValue(newClipboard)

      const request = new NextRequest('http://localhost/api/clipboard/newcode')
      const response = await GET(request, { params: { code: 'newcode' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.code).toBe('newcode')
      expect(data.data.content).toBe('')
      expect(mockPrisma.clipboard.create).toHaveBeenCalledWith({
        data: {
          code: 'newcode',
          content: '',
          lastAccessed: expect.any(Date)
        }
      })
    })

    it('should return 400 for invalid code', async () => {
      const request = new NextRequest('http://localhost/api/clipboard/')
      const response = await GET(request, { params: { code: '' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('代码 不能为空')
    })

    it('should handle database errors', async () => {
      mockPrisma.clipboard.findUnique.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost/api/clipboard/test123')
      const response = await GET(request, { params: { code: 'test123' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('服务器内部错误')
    })
  })

  describe('POST', () => {
    it('should create new clipboard with content', async () => {
      const newClipboard = {
        id: '3',
        code: 'test456',
        content: 'New content',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessed: new Date(),
      }

      mockPrisma.clipboard.upsert.mockResolvedValue(newClipboard)

      const request = new NextRequest('http://localhost/api/clipboard/test456', {
        method: 'POST',
        body: JSON.stringify({ content: 'New content' }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request, { params: { code: 'test456' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.content).toBe('New content')
      expect(mockPrisma.clipboard.upsert).toHaveBeenCalledWith({
        where: { code: 'test456' },
        update: {
          content: 'New content',
          lastAccessed: expect.any(Date)
        },
        create: {
          code: 'test456',
          content: 'New content',
          lastAccessed: expect.any(Date)
        }
      })
    })

    it('should return 400 for invalid content', async () => {
      const request = new NextRequest('http://localhost/api/clipboard/test456', {
        method: 'POST',
        body: JSON.stringify({ content: 123 }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request, { params: { code: 'test456' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('内容 必须是字符串类型')
    })

    it('should return 400 for content exceeding size limit', async () => {
      const largeContent = 'a'.repeat(1048577) // 1MB + 1 byte

      const request = new NextRequest('http://localhost/api/clipboard/test456', {
        method: 'POST',
        body: JSON.stringify({ content: largeContent }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request, { params: { code: 'test456' } })
      const data = await response.json()

      expect(response.status).toBe(413)
      expect(data.success).toBe(false)
      expect(data.error).toBe('内容长度超过限制 (1024 KB)')
    })
  })

  describe('PUT', () => {
    it('should update existing clipboard', async () => {
      const updatedClipboard = {
        id: '4',
        code: 'test789',
        content: 'Updated content',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessed: new Date(),
      }

      mockPrisma.clipboard.upsert.mockResolvedValue(updatedClipboard)

      const request = new NextRequest('http://localhost/api/clipboard/test789', {
        method: 'PUT',
        body: JSON.stringify({ content: 'Updated content' }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PUT(request, { params: { code: 'test789' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.content).toBe('Updated content')
      expect(mockPrisma.clipboard.upsert).toHaveBeenCalledWith({
        where: { code: 'test789' },
        update: {
          content: 'Updated content',
          lastAccessed: expect.any(Date)
        },
        create: {
          code: 'test789',
          content: 'Updated content',
          lastAccessed: expect.any(Date)
        }
      })
    })

    it('should create new clipboard if not exists', async () => {
      const newClipboard = {
        id: 'new-id',
        code: 'nonexistent',
        content: 'Some content',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessed: new Date(),
      }

      mockPrisma.clipboard.upsert.mockResolvedValue(newClipboard)

      const request = new NextRequest('http://localhost/api/clipboard/nonexistent', {
        method: 'PUT',
        body: JSON.stringify({ content: 'Some content' }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PUT(request, { params: { code: 'nonexistent' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.content).toBe('Some content')
    })
  })
})