'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ClipboardData, ApiResponse } from '@/types/clipboard'
import LazyTextEditor from '@/components/LazyTextEditor'
import { useNetworkErrorHandler } from '@/components/NetworkErrorHandler'
import NetworkErrorHandler from '@/components/NetworkErrorHandler'
import { PageLoadingState } from '@/components/LoadingState'
import ErrorMessage from '@/components/ErrorMessage'
import Footer from '@/components/Footer'

interface ClipboardPageProps {
  code: string
}

export default function ClipboardPage({ code }: ClipboardPageProps) {
  const [clipboardData, setClipboardData] = useState<ClipboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const router = useRouter()
  const { networkError, handleNetworkError, clearNetworkError } = useNetworkErrorHandler()

  // 获取剪切板数据
  const fetchClipboardData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      clearNetworkError()

      const response = await fetch(`/api/clipboard/${encodeURIComponent(code)}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: 获取剪切板数据失败`)
      }

      const result: ApiResponse<ClipboardData> = await response.json()

      if (!result.success) {
        throw new Error(result.error || '获取剪切板数据失败')
      }

      if (result.data) {
        setClipboardData(result.data)
      }
    } catch (err) {
      console.error('获取剪切板数据失败:', err)
      handleNetworkError(err, true)
      setError(err instanceof Error ? err.message : '获取数据时发生未知错误')
    } finally {
      setIsLoading(false)
    }
  }, [code, handleNetworkError, clearNetworkError])

  // 客户端挂载检查
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // 页面加载时获取数据
  useEffect(() => {
    fetchClipboardData()
  }, [code, fetchClipboardData])

  // 处理保存内容 - 静默保存版本
  const handleSave = async (content: string) => {
    try {
      const response = await fetch(`/api/clipboard/${encodeURIComponent(code)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      })

      const result: ApiResponse<ClipboardData> = await response.json()

      if (!result.success) {
        throw new Error(result.error || '保存失败')
      }

      // 静默更新数据，不触发重新渲染编辑器
      if (result.data) {
        setClipboardData(prevData => {
          // 只有内容真正变化时才更新
          if (!prevData || prevData.content !== result.data!.content || 
              prevData.updatedAt !== result.data!.updatedAt) {
            return result.data!
          }
          return prevData
        })
      }
    } catch (err) {
      console.error('保存失败:', err)
      throw err // 重新抛出错误让TextEditor组件处理
    }
  }

  // 复制链接到剪贴板
  const copyLink = async () => {
    try {
      // 检查是否在客户端环境且已挂载
      if (isMounted && typeof window !== 'undefined' && navigator.clipboard) {
        const url = `${window.location.origin}/${encodeURIComponent(code)}`
        await navigator.clipboard.writeText(url)
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
      }
    } catch (err) {
      console.error('复制链接失败:', err)
      handleNetworkError(new Error('复制链接失败，请手动复制'), false)
    }
  }

  // 返回首页
  const goHome = () => {
    router.push('/')
  }

  if (isLoading) {
    return <PageLoadingState loadingText="加载剪切板数据中..." />
  }

  if (networkError) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <NetworkErrorHandler
              error={networkError}
              onRetry={fetchClipboardData}
              onCancel={goHome}
              showDetails={true}
            />
          </div>
        </div>
      </main>
    )
  }

  if (error && !networkError) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="text-red-600 dark:text-red-400">加载失败</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ErrorMessage
                  type="server"
                  message={error}
                  actions={[
                    {
                      label: '重试',
                      onClick: fetchClipboardData,
                      variant: 'outline'
                    },
                    {
                      label: '返回首页',
                      onClick: goHome
                    }
                  ]}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col">
      <main className="flex-1">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* 页面头部 */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 break-all">
                剪切板: <span className="text-blue-600 dark:text-blue-400">{code}</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                {clipboardData?.updatedAt && (
                  <>最后更新: {new Date(clipboardData.updatedAt).toLocaleString('zh-CN')}</>
                )}
              </p>
            </div>
            
            <div className="flex flex-row sm:flex-row gap-2 shrink-0">
              <Button 
                onClick={copyLink} 
                variant="outline" 
                size="sm"
                className={`flex-1 sm:flex-none h-9 text-sm ${copySuccess ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400' : ''}`}
              >
                {copySuccess ? '已复制!' : '复制链接'}
              </Button>
              <Button 
                onClick={goHome} 
                variant="outline" 
                size="sm"
                className="flex-1 sm:flex-none h-9 text-sm"
              >
                返回首页
              </Button>
            </div>
          </div>
        </div>

        {/* 文本编辑器 */}
        <div className="w-full">
          <LazyTextEditor
            key={`editor-${code}`} // 使用key确保编辑器正确初始化
            initialContent={clipboardData?.content || ''}
            onSave={handleSave}
          />
        </div>

        {/* 页面底部信息 */}
        <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 px-4">
          <p className="break-all">
            通过此链接访问剪切板: <code className="bg-slate-200 dark:bg-slate-700 px-1.5 sm:px-2 py-1 rounded text-xs sm:text-sm">
              {code}
            </code>
          </p>
        </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}