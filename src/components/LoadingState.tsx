'use client'

import { ReactNode, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface LoadingStateProps {
  isLoading: boolean
  children: ReactNode
  loadingText?: string
  loadingComponent?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  overlay?: boolean
}

export default function LoadingState({
  isLoading,
  children,
  loadingText = '加载中...',
  loadingComponent,
  size = 'md',
  overlay = false
}: LoadingStateProps) {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-4 w-4'
      case 'lg':
        return 'h-8 w-8'
      default:
        return 'h-6 w-6'
    }
  }

  const getTextSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-sm'
      case 'lg':
        return 'text-lg'
      default:
        return 'text-base'
    }
  }

  const defaultLoadingComponent = (
    <div className="flex flex-col items-center justify-center space-y-4 p-8">
      <div className={`animate-spin rounded-full border-b-2 border-blue-600 ${getSizeClasses()}`}></div>
      <p className={`text-slate-600 dark:text-slate-300 ${getTextSizeClasses()}`}>
        {loadingText}
      </p>
    </div>
  )

  if (!isLoading) {
    return <>{children}</>
  }

  if (overlay) {
    return (
      <div className="relative">
        {children}
        <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50">
          {loadingComponent || defaultLoadingComponent}
        </div>
      </div>
    )
  }

  return loadingComponent || defaultLoadingComponent
}

// 专门用于页面级别的加载状态
export function PageLoadingState({ 
  loadingText = '页面加载中...', 
  size = 'lg' 
}: { 
  loadingText?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center px-4 safe-area-padding">
      <div className="text-center space-y-4 max-w-sm w-full">
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 px-4">{loadingText}</p>
      </div>
    </div>
  )
}

// 用于卡片内的加载状态
export function CardLoadingState({ 
  title = '加载中', 
  loadingText = '正在获取数据...',
  size = 'md'
}: { 
  title?: string
  loadingText?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <LoadingState isLoading={true} loadingText={loadingText} size={size}>
          <div />
        </LoadingState>
      </CardContent>
    </Card>
  )
}

// 用于按钮的加载状态
export function ButtonLoadingState({ 
  isLoading, 
  loadingText, 
  children 
}: { 
  isLoading: boolean
  loadingText?: string
  children: ReactNode
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
        {loadingText && <span>{loadingText}</span>}
      </div>
    )
  }

  return <>{children}</>
}

// 用于内联加载状态
export function InlineLoadingState({ 
  isLoading, 
  loadingText = '加载中...', 
  children 
}: { 
  isLoading: boolean
  loadingText?: string
  children: ReactNode
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span className="text-sm">{loadingText}</span>
      </div>
    )
  }

  return <>{children}</>
}

// Hook for managing loading states
export function useLoadingState(initialState: boolean = false) {
  const [isLoading, setIsLoading] = useState(initialState)

  const startLoading = useCallback(() => setIsLoading(true), [])
  const stopLoading = useCallback(() => setIsLoading(false), [])
  const toggleLoading = useCallback(() => setIsLoading(prev => !prev), [])

  return {
    isLoading,
    startLoading,
    stopLoading,
    toggleLoading,
    setIsLoading
  }
}

