'use client'

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { debounce, throttle } from '@/lib/performance-utils'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { validateContent, getContentStats } from '@/lib/content-utils'

interface TextEditorProps {
  code: string
  initialContent?: string
  onSave: (content: string) => Promise<void>
  autoSave?: boolean
  autoSaveDelay?: number
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// Memoized content stats component to prevent unnecessary re-renders
const ContentStats = memo(({ stats }: { stats: { characters: number; lines: number; words: number } }) => (
  <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
    <span>字符: {stats.characters.toLocaleString()}</span>
    <span>行数: {stats.lines.toLocaleString()}</span>
    <span>单词: {stats.words.toLocaleString()}</span>
    {stats.characters > 0 && (
      <span>大小: {(stats.characters / 1024).toFixed(1)} KB</span>
    )}
  </div>
))

export default function TextEditor({
  code,
  initialContent = '',
  onSave,
  autoSave = process.env.NEXT_PUBLIC_AUTO_SAVE_ENABLED !== 'false',
  autoSaveDelay = parseInt(process.env.NEXT_PUBLIC_AUTO_SAVE_DELAY || '1000', 10)
}: TextEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [contentStats, setContentStats] = useState(getContentStats(initialContent))
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedContentRef = useRef(initialContent)

  // 更新内容统计 - 使用 useMemo 缓存结果
  const updateContentStats = useCallback((text: string) => {
    const stats = getContentStats(text)
    setContentStats(prevStats => {
      // 只有统计数据真正变化时才更新
      if (prevStats.characters !== stats.characters || 
          prevStats.lines !== stats.lines || 
          prevStats.words !== stats.words) {
        return stats
      }
      return prevStats
    })
  }, [])

  // 保存内容的函数
  const saveContent = useCallback(async (contentToSave: string) => {
    if (contentToSave === lastSavedContentRef.current) {
      return // 内容没有变化，不需要保存
    }

    try {
      setSaveStatus('saving')
      setSaveError(null)
      
      await onSave(contentToSave)
      
      setSaveStatus('saved')
      setHasUnsavedChanges(false)
      lastSavedContentRef.current = contentToSave
      
      // 2秒后重置保存状态
      setTimeout(() => {
        setSaveStatus('idle')
      }, 2000)
    } catch (error) {
      console.error('保存失败:', error)
      setSaveStatus('error')
      setSaveError(error instanceof Error ? error.message : '保存失败')
      setHasUnsavedChanges(true)
    }
  }, [onSave])

  // 优化的防抖保存函数
  const debouncedSave = useMemo(() => {
    return debounce((contentToSave: string) => {
      saveContent(contentToSave)
    }, autoSaveDelay, {
      leading: false,
      trailing: true,
      maxWait: autoSaveDelay * 3 // 最多等待3倍延迟时间
    })
  }, [saveContent, autoSaveDelay])

  // 节流的内容统计更新 - 减少更新频率
  const throttledUpdateStats = useMemo(() => {
    return throttle((text: string) => {
      setContentStats(getContentStats(text))
    }, 300) // 每300ms最多更新一次，减少闪烁
  }, [])

  // 处理内容变化
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setContent(newContent)
    
    // 延迟更新统计信息，避免输入时闪烁
    const hasChanges = newContent !== lastSavedContentRef.current
    setHasUnsavedChanges(hasChanges)
    
    // 只在停止输入后更新统计信息
    throttledUpdateStats(newContent)
    
    // 如果启用自动保存，则触发防抖保存
    if (autoSave && hasChanges) {
      debouncedSave(newContent)
    }
  }, [autoSave, debouncedSave, throttledUpdateStats])

  // 手动保存
  const handleManualSave = useCallback(() => {
    // 取消防抖保存并立即保存
    debouncedSave.cancel()
    saveContent(content)
  }, [content, debouncedSave, saveContent])

  // 处理快捷键
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+S 或 Cmd+S 保存
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      handleManualSave()
    }
    
    // Tab键插入制表符而不是切换焦点
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      
      const newContent = content.substring(0, start) + '\t' + content.substring(end)
      setContent(newContent)
      
      // 设置光标位置
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1
      }, 0)
    }
  }

  // 初始化内容
  useEffect(() => {
    if (initialContent !== content) {
      setContent(initialContent)
      updateContentStats(initialContent)
      lastSavedContentRef.current = initialContent
      setHasUnsavedChanges(false)
    }
  }, [initialContent, content, updateContentStats])

  // 清理防抖和节流函数
  useEffect(() => {
    return () => {
      debouncedSave.cancel()
      throttledUpdateStats.cancel()
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [debouncedSave, throttledUpdateStats])

  // 验证内容
  const validation = validateContent(content)

  // 获取保存状态指示器
  const getSaveStatusIndicator = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm">保存中...</span>
          </div>
        )
      case 'saved':
        return (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm">已保存</span>
          </div>
        )
      case 'error':
        return (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-sm">保存失败</span>
          </div>
        )
      default:
        return hasUnsavedChanges ? (
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <div className="w-2 h-2 bg-amber-600 dark:bg-amber-400 rounded-full"></div>
            <span className="text-sm">有未保存的更改</span>
          </div>
        ) : null
    }
  }

  return (
    <Card className="w-full shadow-lg border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base sm:text-lg">文本编辑器</CardTitle>
            
            <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
              {/* 保存状态指示器 */}
              <div className="flex-1 sm:flex-none">
                {getSaveStatusIndicator()}
              </div>
              
              {/* 手动保存按钮 */}
              <Button
                onClick={handleManualSave}
                disabled={saveStatus === 'saving' || !hasUnsavedChanges}
                size="sm"
                variant="outline"
                className="h-8 text-xs sm:text-sm px-3"
              >
                {saveStatus === 'saving' ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
          
          {/* 错误提示 */}
          {saveError && (
            <div className="text-xs sm:text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 sm:p-3 rounded">
              {saveError}
            </div>
          )}
          
          {/* 验证警告 */}
          {validation.warnings && validation.warnings.length > 0 && (
            <div className="text-xs sm:text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 sm:p-3 rounded">
              {validation.warnings.map((warning, index) => (
                <div key={index}>⚠️ {warning}</div>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 文本编辑区域 */}
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            placeholder="在此输入您的文本内容..."
            className="min-h-[300px] sm:min-h-[400px] resize-y font-mono text-sm sm:text-sm leading-relaxed touch-manipulation transition-none"
            disabled={saveStatus === 'saving'}
            style={{
              fontSize: '16px', // Prevent zoom on iOS
              WebkitAppearance: 'none',
              transition: 'none', // 禁用过渡效果防止闪烁
            }}
          />
          
          {/* 快捷键提示 - 隐藏在小屏幕上 */}
          <div className="hidden sm:block absolute bottom-2 right-2 text-xs text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-2 py-1 rounded shadow-sm">
            Ctrl+S 保存
          </div>
        </div>
        
        {/* 内容统计和功能区域 */}
        <div className="flex flex-col gap-3 sm:gap-4 pt-3 sm:pt-4 border-t">
          {/* 内容统计 */}
          <ContentStats stats={contentStats} />
          
          {/* 功能按钮 */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (textareaRef.current) {
                  textareaRef.current.select()
                }
              }}
              variant="ghost"
              size="sm"
              className="h-8 text-xs sm:text-sm px-3 flex-1 sm:flex-none min-w-0"
            >
              全选
            </Button>
            
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(content)
                  // 可以添加复制成功的提示
                } catch (err) {
                  console.error('复制失败:', err)
                }
              }}
              variant="ghost"
              size="sm"
              className="h-8 text-xs sm:text-sm px-3 flex-1 sm:flex-none min-w-0"
            >
              复制
            </Button>
            
            <Button
              onClick={() => {
                if (window.confirm('确定要清空所有内容吗？')) {
                  setContent('')
                  updateContentStats('')
                  setHasUnsavedChanges(true)
                  if (autoSave) {
                    debouncedSave('')
                  }
                }
              }}
              variant="ghost"
              size="sm"
              className="h-8 text-xs sm:text-sm px-3 flex-1 sm:flex-none min-w-0 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              清空
            </Button>
          </div>
        </div>
        
        {/* 自动保存设置提示 */}
        {autoSave && (
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center px-2">
            自动保存已启用，更改将在 {autoSaveDelay / 1000} 秒后自动保存
          </div>
        )}
      </CardContent>
    </Card>
  )
}