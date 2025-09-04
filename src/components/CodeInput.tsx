'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { validateCodeFormat } from '@/lib/code-utils'
import { useNetworkErrorHandler } from '@/components/NetworkErrorHandler'
import ErrorMessage from '@/components/ErrorMessage'
import { ButtonLoadingState } from '@/components/LoadingState'

interface CodeInputProps {
  onSubmit?: (code: string) => void
  onRandomGenerate?: () => void
  isLoading?: boolean
}

export default function CodeInput({ 
  onSubmit, 
  onRandomGenerate, 
  isLoading = false 
}: CodeInputProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const router = useRouter()
  const { networkError, handleNetworkError, clearNetworkError } = useNetworkErrorHandler()
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!code.trim()) {
      setError('请输入代码')
      return
    }

    const validation = validateCodeFormat(code.trim())
    if (!validation.isValid) {
      setError(validation.error || '代码格式无效')
      return
    }

    setError('')
    
    if (onSubmit) {
      onSubmit(code.trim())
    } else {
      router.push(`/${encodeURIComponent(code.trim())}`)
    }
  }

  const handleRandomGenerate = async () => {
    setIsGenerating(true)
    setError('')
    clearNetworkError()
    
    try {
      const response = await fetch('/api/generate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: 生成随机代码失败`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || '生成随机代码失败')
      }
      
      if (onRandomGenerate) {
        onRandomGenerate()
      } else {
        router.push(`/${data.data.code}`)
      }
    } catch (err) {
      console.error('生成随机代码失败:', err)
      handleNetworkError(err, true)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setCode(value)
    
    // 清除之前的验证定时器
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current)
    }
    
    // 如果输入为空，立即清除错误
    if (!value.trim()) {
      setError('')
      return
    }
    
    // 延迟验证，减少输入时的闪烁
    validationTimeoutRef.current = setTimeout(() => {
      const validation = validateCodeFormat(value.trim())
      if (!validation.isValid) {
        setError(validation.error || '代码格式无效')
      } else {
        setError('')
      }
    }, 500) // 增加延迟时间到500ms
  }, [])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current)
      }
    }
  }, [])

  return (
    <Card className="w-full max-w-md shadow-lg border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg sm:text-xl">访问剪切板</CardTitle>
        <CardDescription className="text-sm sm:text-base">
          输入自定义代码或生成随机代码来创建/访问剪切板
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="输入自定义代码"
              value={code}
              onChange={handleInputChange}
              disabled={isLoading || isGenerating}
              className={`text-base sm:text-sm h-11 sm:h-10 ${error ? 'border-red-500' : ''}`}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
            />
            {error && (
              <ErrorMessage
                type="validation"
                message={error}
                dismissible
                onDismiss={() => setError('')}
                className="text-sm"
              />
            )}
          </div>
          
          {networkError && (
            <ErrorMessage
              type="network"
              message={networkError.message}
              actions={[
                {
                  label: '重试',
                  onClick: handleRandomGenerate,
                  disabled: isGenerating
                }
              ]}
              dismissible
              onDismiss={clearNetworkError}
            />
          )}
          
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
            <Button 
              type="submit" 
              disabled={isLoading || isGenerating || !code.trim()}
              className="flex-1 h-11 sm:h-10 text-base sm:text-sm font-medium"
              size="lg"
            >
              <ButtonLoadingState isLoading={isLoading} loadingText="跳转中...">
                访问剪切板
              </ButtonLoadingState>
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={handleRandomGenerate}
              disabled={isLoading || isGenerating}
              className="flex-1 h-11 sm:h-10 text-base sm:text-sm font-medium"
              size="lg"
            >
              <ButtonLoadingState isLoading={isGenerating} loadingText="生成中...">
                随机代码
              </ButtonLoadingState>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}