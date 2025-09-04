import { NextResponse } from 'next/server'
import { ApiResponse } from '@/types/clipboard'
import { Prisma } from '@prisma/client'

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  CONTENT_TOO_LARGE = 'CONTENT_TOO_LARGE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION'
}

export interface ApiError {
  code: ErrorCode
  message: string
  details?: any
  statusCode: number
  requestId?: string
  timestamp: string
}

export class ApiErrorClass extends Error implements ApiError {
  code: ErrorCode
  statusCode: number
  details?: any
  requestId?: string
  timestamp: string

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: any,
    requestId?: string
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
    this.requestId = requestId || ApiErrorHandler.generateRequestId()
    this.timestamp = new Date().toISOString()
  }
}

export class ApiErrorHandler {
  static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  }

  static createError(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: any,
    requestId?: string
  ): ApiError {
    return new ApiErrorClass(code, message, statusCode, details, requestId)
  }

  static validationError(message: string, details?: any): ApiError {
    return this.createError(ErrorCode.VALIDATION_ERROR, message, 400, details)
  }

  static notFoundError(message: string = '资源未找到'): ApiError {
    return this.createError(ErrorCode.NOT_FOUND, message, 404)
  }

  static databaseError(message: string = '数据库操作失败', details?: any): ApiError {
    return this.createError(ErrorCode.DATABASE_ERROR, message, 500, details)
  }

  static internalServerError(message: string = '服务器内部错误', details?: any): ApiError {
    return this.createError(ErrorCode.INTERNAL_SERVER_ERROR, message, 500, details)
  }

  static invalidRequestError(message: string = '请求格式无效'): ApiError {
    return this.createError(ErrorCode.INVALID_REQUEST, message, 400)
  }

  static contentTooLargeError(message: string = '内容长度超过限制'): ApiError {
    return this.createError(ErrorCode.CONTENT_TOO_LARGE, message, 413)
  }

  static rateLimitError(message: string = '请求频率超过限制'): ApiError {
    return this.createError(ErrorCode.RATE_LIMIT_EXCEEDED, message, 429)
  }

  static networkError(message: string = '网络连接错误'): ApiError {
    return this.createError(ErrorCode.NETWORK_ERROR, message, 503)
  }

  static timeoutError(message: string = '请求超时'): ApiError {
    return this.createError(ErrorCode.TIMEOUT_ERROR, message, 408)
  }

  static concurrentModificationError(message: string = '数据已被其他用户修改，请刷新后重试'): ApiError {
    return this.createError(ErrorCode.CONCURRENT_MODIFICATION, message, 409)
  }

  static handleError(error: unknown, requestId?: string): ApiError {
    // 记录错误到控制台和日志系统
    ApiLogger.logError('ERROR_HANDLER', 'Unknown', error, requestId)

    if (error instanceof ApiErrorClass) {
      return error
    }

    // 处理 Prisma 特定错误
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaError(error, requestId)
    }

    if (error instanceof Prisma.PrismaClientUnknownRequestError) {
      return this.createError(
        ErrorCode.DATABASE_ERROR,
        '数据库请求失败',
        500,
        { prismaError: 'Unknown request error' },
        requestId
      )
    }

    if (error instanceof Prisma.PrismaClientRustPanicError) {
      return this.createError(
        ErrorCode.DATABASE_ERROR,
        '数据库引擎错误',
        500,
        { prismaError: 'Rust panic error' },
        requestId
      )
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return this.createError(
        ErrorCode.DATABASE_ERROR,
        '数据库连接失败',
        503,
        { prismaError: 'Initialization error' },
        requestId
      )
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return this.createError(
        ErrorCode.VALIDATION_ERROR,
        '数据验证失败',
        400,
        { prismaError: 'Validation error' },
        requestId
      )
    }

    if (error instanceof Error) {
      // 检查是否是网络相关错误
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        return this.networkError('网络连接失败')
      }

      // 检查是否是超时错误
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        return this.timeoutError('操作超时，请重试')
      }

      // 检查是否是并发修改错误
      if (error.message.includes('concurrent') || error.message.includes('conflict')) {
        return this.concurrentModificationError()
      }

      // 检查是否是验证错误
      if (error.message.includes('validation') || error.message.includes('invalid')) {
        return this.validationError(error.message)
      }

      return this.createError(
        ErrorCode.INTERNAL_SERVER_ERROR,
        process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
        500,
        {
          originalError: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        requestId
      )
    }

    return this.createError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      '未知错误',
      500,
      undefined,
      requestId
    )
  }

  private static handlePrismaError(error: Prisma.PrismaClientKnownRequestError, requestId?: string): ApiError {
    switch (error.code) {
      case 'P2002':
        // 唯一约束违反
        return this.createError(
          ErrorCode.VALIDATION_ERROR,
          '数据已存在，请使用不同的标识符',
          409,
          { field: error.meta?.target },
          requestId
        )
      
      case 'P2025':
        // 记录未找到
        return this.createError(
          ErrorCode.NOT_FOUND,
          '请求的资源不存在',
          404,
          undefined,
          requestId
        )
      
      case 'P2003':
        // 外键约束违反
        return this.createError(
          ErrorCode.VALIDATION_ERROR,
          '数据关联错误',
          400,
          { field: error.meta?.field_name },
          requestId
        )
      
      case 'P2034':
        // 事务冲突
        return this.concurrentModificationError()
      
      default:
        return this.createError(
          ErrorCode.DATABASE_ERROR,
          '数据库操作失败',
          500,
          { 
            prismaCode: error.code,
            prismaMessage: error.message 
          },
          requestId
        )
    }
  }

  static createResponse<T = any>(error: ApiError): NextResponse<ApiResponse<T>> {
    const response: ApiResponse<T> = {
      success: false,
      error: error.message,
      code: error.code,
      timestamp: error.timestamp,
      requestId: error.requestId,
      ...(error.details && process.env.NODE_ENV === 'development' && { details: error.details })
    }

    // 设置错误响应头
    const headers = new Headers()
    headers.set('X-Request-ID', error.requestId || '')
    headers.set('X-Error-Code', error.code)

    return NextResponse.json(response, { 
      status: error.statusCode,
      headers
    })
  }

  static createSuccessResponse<T>(data: T, statusCode: number = 200, requestId?: string): NextResponse<ApiResponse<T>> {
    const response: ApiResponse<T> = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      requestId: requestId || this.generateRequestId()
    }

    // 设置成功响应头
    const headers = new Headers()
    headers.set('X-Request-ID', response.requestId!)

    return NextResponse.json(response, { 
      status: statusCode,
      headers
    })
  }
}

// 请求验证工具
export class RequestValidator {
  static validateString(value: any, fieldName: string, options?: {
    required?: boolean
    minLength?: number
    maxLength?: number
    pattern?: RegExp
  }): string {
    const { required = true, minLength, maxLength, pattern } = options || {}

    if (required && (value === undefined || value === null)) {
      throw ApiErrorHandler.validationError(`${fieldName} 是必需的`)
    }

    if (value !== undefined && value !== null && typeof value !== 'string') {
      throw ApiErrorHandler.validationError(`${fieldName} 必须是字符串类型`)
    }

    const str = String(value || '')

    if (required && str.trim().length === 0) {
      throw ApiErrorHandler.validationError(`${fieldName} 不能为空`)
    }

    if (minLength !== undefined && str.length < minLength) {
      throw ApiErrorHandler.validationError(`${fieldName} 长度不能少于 ${minLength} 个字符`)
    }

    if (maxLength !== undefined && str.length > maxLength) {
      throw ApiErrorHandler.validationError(`${fieldName} 长度不能超过 ${maxLength} 个字符`)
    }

    if (pattern && !pattern.test(str)) {
      throw ApiErrorHandler.validationError(`${fieldName} 格式不正确`)
    }

    return str
  }

  static validateContentSize(content: string, maxSize: number = 1048576): string {
    if (content.length > maxSize) {
      throw ApiErrorHandler.contentTooLargeError(`内容长度超过限制 (${Math.round(maxSize / 1024)} KB)`)
    }
    return content
  }

  static async validateJsonBody(request: Request): Promise<any> {
    try {
      const body = await request.json()
      return body
    } catch (error) {
      throw ApiErrorHandler.invalidRequestError('请求体必须是有效的 JSON 格式')
    }
  }
}

// 日志记录工具
export class ApiLogger {
  private static formatLogMessage(level: string, method: string, url: string, message?: string, data?: any): string {
    const timestamp = new Date().toISOString()
    const baseMessage = `[${timestamp}] [${level}] ${method} ${url}`
    
    if (message) {
      return `${baseMessage} - ${message}`
    }
    
    return baseMessage
  }

  static logRequest(method: string, url: string, params?: any, body?: any, requestId?: string) {
    const logData = {
      requestId,
      params,
      body: body ? this.sanitizeBody(body) : undefined,
      timestamp: new Date().toISOString()
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(this.formatLogMessage('REQUEST', method, url), logData)
    }

    // 在生产环境中，这里可以集成外部日志服务
    if (process.env.NODE_ENV === 'production') {
      // TODO: 集成外部日志服务 (如 Winston, Pino 等)
      this.writeToLogFile('request', method, url, logData)
    }
  }

  static logResponse(method: string, url: string, statusCode: number, responseTime?: number, requestId?: string) {
    const logData = {
      requestId,
      statusCode,
      responseTime,
      timestamp: new Date().toISOString()
    }

    const message = `${statusCode}${responseTime ? ` (${responseTime}ms)` : ''}`
    
    if (process.env.NODE_ENV === 'development') {
      console.log(this.formatLogMessage('RESPONSE', method, url, message), logData)
    }

    if (process.env.NODE_ENV === 'production') {
      this.writeToLogFile('response', method, url, logData)
    }
  }

  static logError(method: string, url: string, error: unknown, requestId?: string) {
    const errorData = {
      requestId,
      error: this.serializeError(error),
      timestamp: new Date().toISOString()
    }

    // 错误日志始终记录
    console.error(this.formatLogMessage('ERROR', method, url), errorData)

    // 在生产环境中记录到文件或外部服务
    if (process.env.NODE_ENV === 'production') {
      this.writeToLogFile('error', method, url, errorData)
    }
  }

  static logWarning(method: string, url: string, message: string, data?: any, requestId?: string) {
    const logData = {
      requestId,
      data,
      timestamp: new Date().toISOString()
    }

    console.warn(this.formatLogMessage('WARNING', method, url, message), logData)

    if (process.env.NODE_ENV === 'production') {
      this.writeToLogFile('warning', method, url, logData)
    }
  }

  private static sanitizeBody(body: any): any {
    if (typeof body === 'string') {
      // 截断长字符串
      return body.length > 200 ? body.substring(0, 200) + '...' : body
    }
    
    if (typeof body === 'object' && body !== null) {
      // 移除敏感字段
      const sanitized = { ...body }
      const sensitiveFields = ['password', 'token', 'secret', 'key']
      
      sensitiveFields.forEach(field => {
        if (field in sanitized) {
          sanitized[field] = '[REDACTED]'
        }
      })
      
      return sanitized
    }
    
    return body
  }

  private static serializeError(error: unknown): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    }
    
    return { error: String(error) }
  }

  private static writeToLogFile(level: string, method: string, url: string, data: any) {
    // 这里可以实现文件日志记录或发送到外部日志服务
    // 例如：写入到文件系统、发送到 Elasticsearch、CloudWatch 等
    
    // 简单的控制台输出作为占位符
    if (level === 'error') {
      console.error(`[LOG FILE] ${level.toUpperCase()}:`, {
        method,
        url,
        ...data
      })
    }
  }

  // 性能监控
  static startTimer(): () => number {
    const start = Date.now()
    return () => Date.now() - start
  }

  // 记录数据库查询性能
  static logDatabaseQuery(query: string, duration: number, requestId?: string) {
    const logData = {
      requestId,
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      duration,
      timestamp: new Date().toISOString()
    }

    if (duration > 1000) { // 超过1秒的查询记录为警告
      console.warn('[DB SLOW QUERY]', logData)
    } else if (process.env.NODE_ENV === 'development') {
      console.log('[DB QUERY]', logData)
    }
  }
}