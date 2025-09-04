'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface NetworkError {
  message: string
  status?: number
  code?: string
  retryable?: boolean
}

interface NetworkErrorHandlerProps {
  error: NetworkError
  onRetry: () => Promise<void>
  onCancel?: () => void
  maxRetries?: number
  retryDelay?: number
  showDetails?: boolean
}

export default function NetworkErrorHandler({
  error,
  onRetry,
  onCancel,
  maxRetries = 3,
  retryDelay = 1000,
  showDetails = false
}: NetworkErrorHandlerProps) {
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [retryError, setRetryError] = useState<string | null>(null)

  const handleRetry = useCallback(async () => {
    if (retryCount >= maxRetries) {
      return
    }

    setIsRetrying(true)
    setRetryError(null)

    try {
      // 添加延迟
      if (retryDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }

      await onRetry()
      setRetryCount(0) // 重置重试计数
    } catch (err) {
      setRetryCount(prev => prev + 1)
      setRetryError(err instanceof Error ? err.message : '重试失败')
    } finally {
      setIsRetrying(false)
    }
  }, [onRetry, retryCount, maxRetries, retryDelay])

  const getErrorIcon = () => {
    if (error.status && error.status >= 500) {
      return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
    
    if (error.status === 404) {
      return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )
    }

    return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }

  const getErrorTitle = () => {
    if (error.status && error.status >= 500) {
      return '服务器错误'
    }
    
    if (error.status === 404) {
      return '资源未找到'
    }
    
    if (error.status === 400) {
      return '请求错误'
    }
    
    if (!navigator.onLine) {
      return '网络连接断开'
    }

    return '网络错误'
  }

  const getErrorDescription = () => {
    if (!navigator.onLine) {
      return '请检查您的网络连接并重试'
    }
    
    if (error.status && error.status >= 500) {
      return '服务器暂时无法处理请求，请稍后重试'
    }
    
    if (error.status === 404) {
      return '请求的资源不存在'
    }
    
    return error.message || '网络请求失败，请检查网络连接'
  }

  const canRetry = error.retryable !== false && retryCount < maxRetries && (
    !error.status || 
    error.status >= 500 || 
    error.status === 408 || 
    error.status === 429 ||
    !navigator.onLine
  )

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
          {getErrorIcon()}
          {getErrorTitle()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-slate-600 dark:text-slate-300">
          <p>{getErrorDescription()}</p>
          
          {retryError && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
              重试失败: {retryError}
            </div>
          )}
          
          {retryCount > 0 && (
            <div className="mt-2 text-sm text-amber-600 dark:text-amber-400">
              已重试 {retryCount} 次
            </div>
          )}
        </div>

        {showDetails && error.status && (
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
              错误详情
            </summary>
            <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">
              <div>状态码: {error.status}</div>
              {error.code && <div>错误代码: {error.code}</div>}
              <div>错误信息: {error.message}</div>
            </div>
          </details>
        )}

        <div className="flex gap-2 pt-2">
          {canRetry && (
            <Button 
              onClick={handleRetry} 
              disabled={isRetrying}
              variant="outline"
              className="flex-1"
            >
              {isRetrying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  重试中...
                </>
              ) : (
                `重试 (${maxRetries - retryCount})`
              )}
            </Button>
          )}
          
          {onCancel && (
            <Button 
              onClick={onCancel}
              variant={canRetry ? "ghost" : "default"}
              className={canRetry ? "" : "flex-1"}
            >
              {canRetry ? "取消" : "确定"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Hook for handling network errors
export function useNetworkErrorHandler() {
  const [networkError, setNetworkError] = useState<NetworkError | null>(null)

  const handleNetworkError = useCallback((error: unknown, retryable: boolean = true) => {
    let networkError: NetworkError

    if (error instanceof Error) {
      // 检查是否是网络错误
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        networkError = {
          message: '网络连接失败',
          retryable: true
        }
      } else {
        networkError = {
          message: error.message,
          retryable
        }
      }
    } else if (typeof error === 'object' && error !== null) {
      const err = error as any
      networkError = {
        message: err.message || '未知错误',
        status: err.status,
        code: err.code,
        retryable: retryable && (err.retryable !== false)
      }
    } else {
      networkError = {
        message: String(error),
        retryable
      }
    }

    setNetworkError(networkError)
  }, [])

  const clearNetworkError = useCallback(() => {
    setNetworkError(null)
  }, [])

  return {
    networkError,
    handleNetworkError,
    clearNetworkError
  }
}