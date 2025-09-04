import { NextRequest, NextResponse } from 'next/server'
import { generateUniqueCode } from '@/lib/code-utils'
import { ApiResponse, GenerateCodeResponse } from '@/types/clipboard'
import { ApiErrorHandler, ApiLogger } from '@/lib/api-error-handler'
import { optimizedClipboardService } from '@/lib/optimized-clipboard-service'

// POST /api/generate-code - 生成唯一的随机代码
export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<GenerateCodeResponse>>> {
  const timer = ApiLogger.startTimer()
  const url = request.url
  const requestId = request.headers.get('x-request-id') || undefined
  
  try {
    ApiLogger.logRequest('POST', url, undefined, undefined, requestId)
    
    // 生成唯一的随机代码
    const code = await generateUniqueCode()

    const responseTime = timer()
    ApiLogger.logResponse('POST', url, 200, responseTime, requestId)
    return ApiErrorHandler.createSuccessResponse({ code }, 200, requestId)

  } catch (error) {
    ApiLogger.logError('POST', url, error, requestId)
    
    // 如果生成失败，尝试使用时间戳作为后备方案
    try {
      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substring(2, 6)
      const fallbackCode = `clip_${timestamp}_${random}`
      
      ApiLogger.logWarning('POST', url, '使用后备代码生成方案', { fallbackCode }, requestId)
      
      const responseTime = timer()
      ApiLogger.logResponse('POST', url, 200, responseTime, requestId)
      return ApiErrorHandler.createSuccessResponse({ code: fallbackCode }, 200, requestId)
    } catch (fallbackError) {
      ApiLogger.logError('POST', url, fallbackError, requestId)
      
      const apiError = ApiErrorHandler.internalServerError('无法生成随机代码，请稍后重试')
      return ApiErrorHandler.createResponse(apiError)
    }
  }
}