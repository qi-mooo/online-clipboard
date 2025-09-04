'use client'

import { lazy, Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InlineLoadingState } from '@/components/LoadingState'

// Lazy load the TextEditor component
const TextEditor = lazy(() => import('./TextEditor'))

interface LazyTextEditorProps {
  code: string
  initialContent?: string
  onSave: (content: string) => Promise<void>
  autoSave?: boolean
  autoSaveDelay?: number
}

// Loading fallback component for TextEditor
function TextEditorSkeleton() {
  return (
    <Card className="w-full shadow-lg border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base sm:text-lg">文本编辑器</CardTitle>
            <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
              <div className="flex-1 sm:flex-none">
                <InlineLoadingState isLoading={true} loadingText="加载编辑器...">
                  <div />
                </InlineLoadingState>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="relative">
          <div className="min-h-[300px] sm:min-h-[400px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md animate-pulse">
            <div className="p-4">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function LazyTextEditor(props: LazyTextEditorProps) {
  return (
    <Suspense fallback={<TextEditorSkeleton />}>
      <TextEditor {...props} />
    </Suspense>
  )
}