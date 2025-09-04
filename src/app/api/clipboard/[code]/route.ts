import { NextRequest, NextResponse } from 'next/server'
import { ApiResponse, ClipboardData, CreateClipboardRequest, UpdateClipboardRequest } from '@/types/clipboard'
import { ApiErrorHandler, RequestValidator, ApiLogger } from '@/lib/api-error-handler'
import { optimizedClipboardService } from '@/lib/optimized-clipboard-service'

// GET /api/clipboard/[code] - 获取剪切板内容
export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
): Promise<NextResponse<ApiResponse<ClipboardData>>> {
  const timer = ApiLogger.startTimer()
  const url = request.url
  const requestId = request.headers.get('x-request-id') || undefined
  
  try {
    ApiLogger.logRequest('GET', url, params, undefined, requestId)
    
    const { code } = params

    // 验证代码参数
    const validatedCode = RequestValidator.validateString(code, '代码', {
      required: true,
      minLength: 1,
      maxLength: 50
    })

    // 使用优化的服务获取或创建剪切板
    const dbTimer = ApiLogger.startTimer()
    const clipboard = await optimizedClipboardService.getOrCreateClipboard(validatedCode)
    ApiLogger.logDatabaseQuery(`getOrCreateClipboard code=${validatedCode}`, dbTimer(), requestId)

    const responseTime = timer()
    ApiLogger.logResponse('GET', url, 200, responseTime, requestId)
    return ApiErrorHandler.createSuccessResponse(clipboard, 200, requestId)

  } catch (error) {
    ApiLogger.logError('GET', url, error, requestId)
    const apiError = ApiErrorHandler.handleError(error, requestId)
    return ApiErrorHandler.createResponse(apiError)
  }
}

// POST /api/clipboard/[code] - 创建剪切板
export async function POST(
  request: NextRequest,
  { params }: { params: { code: string } }
): Promise<NextResponse<ApiResponse<ClipboardData>>> {
  const timer = ApiLogger.startTimer()
  const url = request.url
  const requestId = request.headers.get('x-request-id') || undefined
  
  try {
    const body = await RequestValidator.validateJsonBody(request)
    ApiLogger.logRequest('POST', url, params, body, requestId)
    
    const { code } = params

    // 验证代码参数
    const validatedCode = RequestValidator.validateString(code, '代码', {
      required: true,
      minLength: 1,
      maxLength: 50
    })

    // 验证内容参数 - POST方法仍然要求非空内容
    const validatedContent = RequestValidator.validateString(body.content, '内容', {
      required: true
    })

    // 检查内容长度限制
    RequestValidator.validateContentSize(validatedContent)

    // 使用优化的服务创建或更新剪切板
    const dbTimer = ApiLogger.startTimer()
    const clipboard = await optimizedClipboardService.upsertClipboard({
      code: validatedCode,
      content: validatedContent
    })
    ApiLogger.logDatabaseQuery(`upsertClipboard code=${validatedCode}`, dbTimer(), requestId)

    const responseTime = timer()
    ApiLogger.logResponse('POST', url, 200, responseTime, requestId)
    return ApiErrorHandler.createSuccessResponse(clipboard, 200, requestId)

  } catch (error) {
    ApiLogger.logError('POST', url, error, requestId)
    const apiError = ApiErrorHandler.handleError(error, requestId)
    return ApiErrorHandler.createResponse(apiError)
  }
}

// PUT /api/clipboard/[code] - 更新剪切板内容
export async function PUT(
  request: NextRequest,
  { params }: { params: { code: string } }
): Promise<NextResponse<ApiResponse<ClipboardData>>> {
  const timer = ApiLogger.startTimer()
  const url = request.url
  const requestId = request.headers.get('x-request-id') || undefined
  
  try {
    const body = await RequestValidator.validateJsonBody(request)
    ApiLogger.logRequest('PUT', url, params, body, requestId)
    
    const { code } = params

    // 验证代码参数
    const validatedCode = RequestValidator.validateString(code, '代码', {
      required: true,
      minLength: 1,
      maxLength: 50
    })

    // 验证内容参数 - PUT方法允许空内容，支持清空功能
    const validatedContent = RequestValidator.validateString(body.content, '内容', {
      required: false // 允许空内容
    })

    // 检查内容长度限制（只有非空内容才检查）
    if (validatedContent.length > 0) {
      RequestValidator.validateContentSize(validatedContent)
    }

    // 使用优化的服务更新剪切板
    const dbTimer = ApiLogger.startTimer()
    const clipboard = await optimizedClipboardService.upsertClipboard({
      code: validatedCode,
      content: validatedContent
    })
    ApiLogger.logDatabaseQuery(`upsertClipboard code=${validatedCode}`, dbTimer(), requestId)

    const responseTime = timer()
    ApiLogger.logResponse('PUT', url, 200, responseTime, requestId)
    return ApiErrorHandler.createSuccessResponse(clipboard, 200, requestId)

  } catch (error) {
    ApiLogger.logError('PUT', url, error, requestId)
    const apiError = ApiErrorHandler.handleError(error, requestId)
    return ApiErrorHandler.createResponse(apiError)
  }
}