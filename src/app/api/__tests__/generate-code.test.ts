import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { POST } from '../generate-code/route'
import { NextRequest } from 'next/server'
import * as codeUtils from '@/lib/code-utils'

// Mock code-utils
vi.mock('@/lib/code-utils', () => ({
  generateUniqueCode: vi.fn(),
}))

const mockCodeUtils = vi.mocked(codeUtils)

describe('/api/generate-code', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST', () => {
    it('should generate unique code successfully', async () => {
      const mockCode = 'abc123XY'
      mockCodeUtils.generateUniqueCode.mockResolvedValue(mockCode)

      const request = new NextRequest('http://localhost/api/generate-code', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.code).toBe(mockCode)
      expect(mockCodeUtils.generateUniqueCode).toHaveBeenCalledOnce()
    })

    it('should use fallback code generation when primary fails', async () => {
      mockCodeUtils.generateUniqueCode.mockRejectedValue(new Error('Database error'))

      // Mock Date.now to get predictable timestamp
      const mockTimestamp = 1234567890
      vi.spyOn(Date, 'now').mockReturnValue(mockTimestamp)
      
      // Mock Math.random to get predictable random string
      vi.spyOn(Math, 'random').mockReturnValue(0.123456789)

      const request = new NextRequest('http://localhost/api/generate-code', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.code).toMatch(/^clip_[a-z0-9]+_[a-z0-9]+$/)
    })

    it('should handle fallback gracefully', async () => {
      mockCodeUtils.generateUniqueCode.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost/api/generate-code', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.code).toMatch(/^clip_[a-z0-9]+_[a-z0-9]+$/)
    })

    it('should handle various code formats', async () => {
      const testCodes = ['a1B2c3', 'XyZ789', 'test123ABC']
      
      for (const testCode of testCodes) {
        mockCodeUtils.generateUniqueCode.mockResolvedValue(testCode)

        const request = new NextRequest('http://localhost/api/generate-code', {
          method: 'POST'
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.code).toBe(testCode)
      }
    })
  })
})