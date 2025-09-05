'use client'

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { debounce, throttle } from '@/lib/performance-utils'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { validateContent, getContentStats } from '@/lib/content-utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'

interface EnhancedTextEditorProps {
  initialContent?: string
  onSave: (content: string) => Promise<void>
  autoSave?: boolean
  autoSaveDelay?: number
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type ViewMode = 'edit' | 'preview' | 'split'

// Memoized content stats component
const ContentStats = memo(({ stats }: { 
  stats: { 
    length: number; 
    lines: number; 
    words: number; 
    characters: number; 
    charactersNoSpaces: number; 
  } 
}) => (
  <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
    <span>字符: {stats.characters.toLocaleString()}</span>
    <span>行数: {stats.lines.toLocaleString()}</span>
    <span>单词: {stats.words.toLocaleString()}</span>
    {stats.characters > 0 && (
      <span>大小: {(stats.characters / 1024).toFixed(1)} KB</span>
    )}
  </div>
))

ContentStats.displayName = 'ContentStats'

// Line numbers component
const LineNumbers = memo(({ lineCount, textareaRef }: { 
  lineCount: number
  textareaRef: React.RefObject<HTMLTextAreaElement>
}) => {
  const [scrollTop, setScrollTop] = useState(0)
  
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    
    const handleScroll = () => {
      setScrollTop(textarea.scrollTop)
    }
    
    textarea.addEventListener('scroll', handleScroll)
    return () => textarea.removeEventListener('scroll', handleScroll)
  }, [textareaRef])
  
  return (
    <div 
      className="flex flex-col text-right pr-2 py-2 text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 font-mono leading-relaxed select-none"
      style={{ 
        transform: `translateY(-${scrollTop}px)`,
        minWidth: '40px',
        fontSize: '14px',
        lineHeight: '1.5'
      }}
    >
      {Array.from({ length: Math.max(lineCount, 1) }, (_, i) => (
        <div key={i + 1} className="h-[21px] flex items-center justify-end">
          {i + 1}
        </div>
      ))}
    </div>
  )
})

LineNumbers.displayName = 'LineNumbers'

// Markdown preview component
const MarkdownPreview = memo(({ content }: { content: string }) => (
  <div className="prose prose-sm sm:prose max-w-none dark:prose-invert p-4 overflow-auto h-[300px] sm:h-[400px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight, rehypeRaw]}
      components={{
        code: ({ className, children, ...props }) => {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          )
        },
        pre: ({ className, children, ...props }) => {
          return (
            <pre className={className} {...props}>
              {children}
            </pre>
          )
        }
      }}
    >
      {content || '*预览区域为空*'}
    </ReactMarkdown>
  </div>
))

MarkdownPreview.displayName = 'MarkdownPreview'

export default function EnhancedTextEditor({
  initialContent = '',
  onSave,
  autoSave = true,
  autoSaveDelay = 500
}: EnhancedTextEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [contentStats, setContentStats] = useState(getContentStats(initialContent))
  const [isInitialized, setIsInitialized] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('edit')
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastSavedContentRef = useRef(initialContent)

  // Calculate line count
  const lineCount = useMemo(() => {
    return content.split('\n').length
  }, [content])

  // Save content function
  const saveContent = useCallback(async (contentToSave: string, isManualSave = false) => {
    if (contentToSave === lastSavedContentRef.current) {
      return
    }

    try {
      if (isManualSave) {
        setSaveStatus('saving')
      }
      setSaveError(null)
      
      await onSave(contentToSave)
      
      if (isManualSave) {
        setSaveStatus('saved')
        setTimeout(() => {
          setSaveStatus('idle')
        }, 1500)
      } else {
        setSaveStatus('idle')
      }
      
      setHasUnsavedChanges(false)
      lastSavedContentRef.current = contentToSave
      
    } catch (error) {
      console.error('保存失败:', error)
      setSaveStatus('error')
      setSaveError(error instanceof Error ? error.message : '保存失败')
      setHasUnsavedChanges(true)
    }
  }, [onSave])

  // Debounced save function
  const debouncedSave = useMemo(() => {
    return debounce((contentToSave: string) => {
      saveContent(contentToSave, false)
    }, autoSaveDelay, {
      leading: false,
      trailing: true,
      maxWait: autoSaveDelay * 3
    })
  }, [saveContent, autoSaveDelay])

  // Throttled stats update
  const throttledUpdateStats = useMemo(() => {
    return throttle((text: string) => {
      const newStats = getContentStats(text)
      setContentStats(prevStats => {
        if (prevStats.characters !== newStats.characters || 
            prevStats.lines !== newStats.lines || 
            prevStats.words !== newStats.words) {
          return newStats
        }
        return prevStats
      })
    }, 500)
  }, [])

  // Handle content change
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setContent(newContent)
    
    const hasChanges = newContent !== lastSavedContentRef.current
    
    setHasUnsavedChanges(prevHasChanges => {
      if (prevHasChanges !== hasChanges) {
        return hasChanges
      }
      return prevHasChanges
    })
    
    throttledUpdateStats(newContent)
    
    if (autoSave && hasChanges) {
      debouncedSave(newContent)
    }
  }, [autoSave, debouncedSave, throttledUpdateStats])

  // Manual save
  const handleManualSave = useCallback(() => {
    debouncedSave.cancel()
    saveContent(content, true)
  }, [content, debouncedSave, saveContent])

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      handleManualSave()
    }
    
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      
      const newContent = content.substring(0, start) + '\t' + content.substring(end)
      setContent(newContent)
      
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1
      }, 0)
    }
  }

  // Initialize content
  useEffect(() => {
    if (!isInitialized) {
      setContent(initialContent)
      setContentStats(getContentStats(initialContent))
      lastSavedContentRef.current = initialContent
      setHasUnsavedChanges(false)
      setIsInitialized(true)
    } else if (initialContent !== lastSavedContentRef.current) {
      const currentHasChanges = content !== lastSavedContentRef.current
      if (!currentHasChanges) {
        setContent(initialContent)
        setContentStats(getContentStats(initialContent))
        lastSavedContentRef.current = initialContent
        setHasUnsavedChanges(false)
      }
    }
  }, [initialContent, content, isInitialized])

  // Client mount check
  useEffect(() => {
    setIsMounted(true)
    setContentStats(getContentStats(initialContent))
  }, [initialContent])

  // Cleanup
  useEffect(() => {
    return () => {
      debouncedSave.cancel()
      throttledUpdateStats.cancel()
    }
  }, [debouncedSave, throttledUpdateStats])

  const validation = validateContent(content)

  // Save status indicator
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
        return null
    }
  }

  return (
    <Card className="w-full shadow-lg border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base sm:text-lg">文本编辑器</CardTitle>
            
            <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
              {getSaveStatusIndicator()}
              
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

          {/* View mode controls */}
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden">
              <Button
                onClick={() => setViewMode('edit')}
                variant={viewMode === 'edit' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none h-8 text-xs px-3"
              >
                编辑
              </Button>
              <Button
                onClick={() => setViewMode('preview')}
                variant={viewMode === 'preview' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none h-8 text-xs px-3"
              >
                预览
              </Button>
              <Button
                onClick={() => setViewMode('split')}
                variant={viewMode === 'split' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none h-8 text-xs px-3"
              >
                分屏
              </Button>
            </div>
            
            {(viewMode === 'edit' || viewMode === 'split') && (
              <Button
                onClick={() => setShowLineNumbers(!showLineNumbers)}
                variant="ghost"
                size="sm"
                className="h-8 text-xs px-3"
              >
                {showLineNumbers ? '隐藏行号' : '显示行号'}
              </Button>
            )}
          </div>
          
          {saveError && (
            <div className="text-xs sm:text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 sm:p-3 rounded">
              {saveError}
            </div>
          )}
          
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
        {/* Editor and preview area */}
        <div className="relative">
          {viewMode === 'edit' && (
            <div className="flex border border-slate-200 dark:border-slate-700 rounded overflow-hidden">
              {showLineNumbers && (
                <LineNumbers lineCount={lineCount} textareaRef={textareaRef} />
              )}
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={content}
                  onChange={handleContentChange}
                  onKeyDown={handleKeyDown}
                  placeholder="在此输入您的文本内容..."
                  className="min-h-[300px] sm:min-h-[400px] resize-y font-mono text-sm leading-relaxed border-0 rounded-none focus:ring-0"
                  disabled={saveStatus === 'saving'}
                  style={{
                    fontSize: '14px',
                    lineHeight: '1.5',
                    paddingLeft: showLineNumbers ? '8px' : '12px'
                  }}
                />
              </div>
            </div>
          )}
          
          {viewMode === 'preview' && (
            <MarkdownPreview content={content} />
          )}
          
          {viewMode === 'split' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="flex border border-slate-200 dark:border-slate-700 rounded overflow-hidden">
                {showLineNumbers && (
                  <LineNumbers lineCount={lineCount} textareaRef={textareaRef} />
                )}
                <div className="flex-1 relative">
                  <Textarea
                    ref={textareaRef}
                    value={content}
                    onChange={handleContentChange}
                    onKeyDown={handleKeyDown}
                    placeholder="在此输入您的文本内容..."
                    className="min-h-[300px] sm:min-h-[400px] resize-y font-mono text-sm leading-relaxed border-0 rounded-none focus:ring-0"
                    disabled={saveStatus === 'saving'}
                    style={{
                      fontSize: '14px',
                      lineHeight: '1.5',
                      paddingLeft: showLineNumbers ? '8px' : '12px'
                    }}
                  />
                </div>
              </div>
              <MarkdownPreview content={content} />
            </div>
          )}
          
          {/* Keyboard shortcut hint */}
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div className="hidden sm:block absolute bottom-2 right-2 text-xs text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-2 py-1 rounded shadow-sm">
              Ctrl+S 保存
            </div>
          )}
        </div>
        
        {/* Content stats and actions */}
        <div className="flex flex-col gap-3 sm:gap-4 pt-3 sm:pt-4 border-t">
          <ContentStats stats={contentStats} />
          
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
                  if (isMounted && typeof window !== 'undefined' && navigator.clipboard) {
                    await navigator.clipboard.writeText(content)
                  }
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
              onClick={async () => {
                if (isMounted && typeof window !== 'undefined' && window.confirm('确定要清空所有内容吗？')) {
                  const emptyContent = ''
                  setContent(emptyContent)
                  setContentStats(getContentStats(emptyContent))
                  setHasUnsavedChanges(true)
                  
                  try {
                    if (autoSave) {
                      debouncedSave.cancel()
                      await saveContent(emptyContent, false)
                    }
                  } catch (error) {
                    console.error('清空保存失败:', error)
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
        
        {autoSave && (
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center px-2">
            自动保存已启用
          </div>
        )}
      </CardContent>
    </Card>
  )
}