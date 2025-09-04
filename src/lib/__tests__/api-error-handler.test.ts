import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { 
  ApiErrorHandler, 
  RequestValidator, 
  ApiLogger, 
  ErrorCode 
} from '../api-error-handler'

// Mock console methods
const mockConsole = {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}

vi.stubGlobal('console', mockConsole)

describe('ApiErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createError', () => {
    it('should create error with all required fields', () => {
      const error = ApiErrorHandler.createError(
        ErrorCode.VALIDATION_ERROR,
        'Test error',
        400,
        { field: 'test' },
        'req_123'
      )

      expect(error).toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Test error',
        statusCode: 400,
        details: { field: 'test' },
        requestId: 'req_123'
      })
      expect(error.timestamp).toBeDefined()
    })

    it('should generate requestId if not provided', () => {
      const error = ApiErrorHandler.createError(
        ErrorCode.VALIDATION_ERROR,
        'Test error'
      )

      expect(error.requestId).toMatch(/^req_\d+_[a-z0-9]+$/)
    })
  })

  describe('handleError', () => {
    it('should handle Prisma unique constraint error', () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '4.0.0',
          meta: { target: ['code'] }
        }
      )

      const result = ApiErrorHandler.handleError(prismaError)

      expect(result.code).toBe(ErrorCode.VALIDATION_ERROR)
      expect(result.message).toBe('数据已存在，请使用不同的标识符')
      expect(result.statusCode).toBe(409)
    })

    it('should handle Prisma record not found error', () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        {
          code: 'P2025',
          clientVersion: '4.0.0'
        }
      )

      const result = ApiErrorHandler.handleError(prismaError)

      expect(result.code).toBe(ErrorCode.NOT_FOUND)
      expect(result.message).toBe('请求的资源不存在')
      expect(result.statusCode).toBe(404)
    })

    it('should handle network errors', () => {
      const networkError = new Error('ECONNREFUSED connection failed')

      const result = ApiErrorHandler.handleError(networkError)

      expect(result.code).toBe(ErrorCode.NETWORK_ERROR)
      expect(result.message).toBe('网络连接失败')
      expect(result.statusCode).toBe(503)
    })

    it('should handle timeout errors', () => {
      const timeoutError = new Error('Operation timeout occurred')

      const result = ApiErrorHandler.handleError(timeoutError)

      expect(result.code).toBe(ErrorCode.TIMEOUT_ERROR)
      expect(result.message).toBe('操作超时，请重试')
      expect(result.statusCode).toBe(408)
    })

    it('should handle concurrent modification errors', () => {
      const concurrentError = new Error('concurrent modification detected')

      const result = ApiErrorHandler.handleError(concurrentError)

      expect(result.code).toBe(ErrorCode.CONCURRENT_MODIFICATION)
      expect(result.message).toBe('数据已被其他用户修改，请刷新后重试')
      expect(result.statusCode).toBe(409)
    })

    it('should handle unknown errors', () => {
      const unknownError = 'Some unknown error'

      const result = ApiErrorHandler.handleError(unknownError)

      expect(result.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR)
      expect(result.message).toBe('未知错误')
      expect(result.statusCode).toBe(500)
    })
  })

  describe('createResponse', () => {
    it('should create error response with proper structure', () => {
      const error = ApiErrorHandler.validationError('Test validation error')
      const response = ApiErrorHandler.createResponse(error)

      expect(response.status).toBe(400)
      
      // Check headers
      const headers = response.headers
      expect(headers.get('X-Request-ID')).toBe(error.requestId)
      expect(headers.get('X-Error-Code')).toBe(ErrorCode.VALIDATION_ERROR)
    })

    it('should create success response with proper structure', () => {
      const data = { test: 'data' }
      const response = ApiErrorHandler.createSuccessResponse(data, 200, 'req_123')

      expect(response.status).toBe(200)
      
      // Check headers
      const headers = response.headers
      expect(headers.get('X-Request-ID')).toBe('req_123')
    })
  })
})

describe('RequestValidator', () => {
  describe('validateString', () => {
    it('should validate required string successfully', () => {
      const result = RequestValidator.validateString('test', '测试字段', {
        required: true,
        minLength: 2,
        maxLength: 10
      })

      expect(result).toBe('test')
    })

    it('should throw error for missing required field', () => {
      expect(() => {
        RequestValidator.validateString(undefined, '测试字段', { required: true })
      }).toThrow('测试字段 是必需的')
    })

    it('should throw error for string too short', () => {
      expect(() => {
        RequestValidator.validateString('a', '测试字段', { minLength: 2 })
      }).toThrow('测试字段 长度不能少于 2 个字符')
    })

    it('should throw error for string too long', () => {
      expect(() => {
        RequestValidator.validateString('toolongstring', '测试字段', { maxLength: 5 })
      }).toThrow('测试字段 长度不能超过 5 个字符')
    })

    it('should validate pattern matching', () => {
      const pattern = /^[a-z]+$/
      
      expect(() => {
        RequestValidator.validateString('Test123', '测试字段', { pattern })
      }).toThrow('测试字段 格式不正确')

      const result = RequestValidator.validateString('test', '测试字段', { pattern })
      expect(result).toBe('test')
    })
  })

  describe('validateContentSize', () => {
    it('should validate content within size limit', () => {
      const content = 'test content'
      const result = RequestValidator.validateContentSize(content, 100)
      expect(result).toBe(content)
    })

    it('should throw error for content too large', () => {
      const largeContent = 'x'.repeat(1000)
      
      expect(() => {
        RequestValidator.validateContentSize(largeContent, 500)
      }).toThrow('内容长度超过限制')
    })
  })

  describe('validateJsonBody', () => {
    it('should parse valid JSON body', async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({ test: 'data' })
      } as unknown as Request

      const result = await RequestValidator.validateJsonBody(mockRequest)
      expect(result).toEqual({ test: 'data' })
    })

    it('should throw error for invalid JSON', async () => {
      const mockRequest = {
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as unknown as Request

      await expect(RequestValidator.validateJsonBody(mockRequest))
        .rejects.toThrow('请求体必须是有效的 JSON 格式')
    })
  })
})

describe('ApiLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock NODE_ENV
    vi.stubEnv('NODE_ENV', 'development')
  })

  describe('logRequest', () => {
    it('should log request in development mode', () => {
      ApiLogger.logRequest('GET', '/api/test', { id: '123' }, { data: 'test' }, 'req_123')

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[REQUEST] GET /api/test'),
        expect.objectContaining({
          requestId: 'req_123',
          params: { id: '123' },
          body: { data: 'test' }
        })
      )
    })

    it('should sanitize sensitive data in body', () => {
      const bodyWithSensitiveData = {
        content: 'test',
        password: 'secret123',
        token: 'abc123'
      }

      ApiLogger.logRequest('POST', '/api/test', {}, bodyWithSensitiveData)

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.objectContaining({
            content: 'test',
            password: '[REDACTED]',
            token: '[REDACTED]'
          })
        })
      )
    })
  })

  describe('logError', () => {
    it('should always log errors', () => {
      const error = new Error('Test error')
      ApiLogger.logError('POST', '/api/test', error, 'req_123')

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] POST /api/test'),
        expect.objectContaining({
          requestId: 'req_123',
          error: expect.objectContaining({
            name: 'Error',
            message: 'Test error'
          })
        })
      )
    })
  })

  describe('logDatabaseQuery', () => {
    it('should log slow queries as warnings', () => {
      ApiLogger.logDatabaseQuery('SELECT * FROM clipboards WHERE code = ?', 1500, 'req_123')

      expect(mockConsole.warn).toHaveBeenCalledWith(
        '[DB SLOW QUERY]',
        expect.objectContaining({
          requestId: 'req_123',
          duration: 1500
        })
      )
    })

    it('should log normal queries in development', () => {
      ApiLogger.logDatabaseQuery('SELECT * FROM clipboards WHERE code = ?', 100, 'req_123')

      expect(mockConsole.log).toHaveBeenCalledWith(
        '[DB QUERY]',
        expect.objectContaining({
          requestId: 'req_123',
          duration: 100
        })
      )
    })
  })

  describe('startTimer', () => {
    it('should return a function that calculates elapsed time', () => {
      const timer = ApiLogger.startTimer()
      
      // Wait a bit
      setTimeout(() => {
        const elapsed = timer()
        expect(elapsed).toBeGreaterThan(0)
      }, 10)
    })
  })
})