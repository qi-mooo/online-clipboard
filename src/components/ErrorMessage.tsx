'use client'

import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type ErrorType = 'network' | 'validation' | 'server' | 'client' | 'unknown'

interface ErrorMessageProps {
  type?: ErrorType
  title?: string
  message: string
  details?: string
  actions?: Array<{
    label: string
    onClick: () => void
    variant?: 'default' | 'outline' | 'ghost'
    disabled?: boolean
  }>
  showIcon?: boolean
  dismissible?: boolean
  onDismiss?: () => void
  className?: string
}

export default function ErrorMessage({
  type = 'unknown',
  title,
  message,
  details,
  actions,
  showIcon = true,
  dismissible = false,
  onDismiss,
  className = ''
}: ErrorMessageProps) {
  const getErrorConfig = () => {
    switch (type) {
      case 'network':
        return {
          title: title || '网络错误',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          ),
          colorClass: 'text-orange-600 dark:text-orange-400',
          bgClass: 'bg-orange-50 dark:bg-orange-900/20',
          borderClass: 'border-orange-200 dark:border-orange-800'
        }
      case 'validation':
        return {
          title: title || '输入错误',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          ),
          colorClass: 'text-amber-600 dark:text-amber-400',
          bgClass: 'bg-amber-50 dark:bg-amber-900/20',
          borderClass: 'border-amber-200 dark:border-amber-800'
        }
      case 'server':
        return {
          title: title || '服务器错误',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          colorClass: 'text-red-600 dark:text-red-400',
          bgClass: 'bg-red-50 dark:bg-red-900/20',
          borderClass: 'border-red-200 dark:border-red-800'
        }
      case 'client':
        return {
          title: title || '客户端错误',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          colorClass: 'text-blue-600 dark:text-blue-400',
          bgClass: 'bg-blue-50 dark:bg-blue-900/20',
          borderClass: 'border-blue-200 dark:border-blue-800'
        }
      default:
        return {
          title: title || '错误',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          ),
          colorClass: 'text-slate-600 dark:text-slate-400',
          bgClass: 'bg-slate-50 dark:bg-slate-900/20',
          borderClass: 'border-slate-200 dark:border-slate-800'
        }
    }
  }

  const config = getErrorConfig()

  return (
    <div className={`rounded-lg border p-3 sm:p-4 ${config.bgClass} ${config.borderClass} ${className}`}>
      <div className="flex items-start gap-2 sm:gap-3">
        {showIcon && (
          <div className={`flex-shrink-0 ${config.colorClass} mt-0.5`}>
            {config.icon}
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className={`text-sm font-medium ${config.colorClass} break-words`}>
                {config.title}
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 break-words">
                {message}
              </p>
              
              {details && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 touch-manipulation">
                    查看详情
                  </summary>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded break-all">
                    {details}
                  </div>
                </details>
              )}
            </div>
            
            {dismissible && onDismiss && (
              <button
                onClick={onDismiss}
                className="flex-shrink-0 ml-2 p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 touch-manipulation"
                style={{ minWidth: '44px', minHeight: '44px' }}
              >
                <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          {actions && actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((action, index) => (
                <Button
                  key={index}
                  onClick={action.onClick}
                  variant={action.variant || 'outline'}
                  size="sm"
                  disabled={action.disabled}
                  className="h-9 text-xs sm:text-sm px-3 touch-manipulation"
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 简化的错误消息组件
export function SimpleErrorMessage({ 
  message, 
  onRetry, 
  onDismiss 
}: { 
  message: string
  onRetry?: () => void
  onDismiss?: () => void
}) {
  const actions = []
  
  if (onRetry) {
    actions.push({
      label: '重试',
      onClick: onRetry,
      variant: 'outline' as const
    })
  }
  
  return (
    <ErrorMessage
      type="unknown"
      message={message}
      actions={actions.length > 0 ? actions : undefined}
      dismissible={!!onDismiss}
      onDismiss={onDismiss}
    />
  )
}