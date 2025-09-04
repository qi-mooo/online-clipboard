'use client'

import React, { useState, useEffect } from 'react'

export default function DomainDisplay() {
  const [domain, setDomain] = useState<string>('')
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    
    // 优先使用环境变量中的域名
    const envDomain = process.env.NEXT_PUBLIC_DOMAIN
    if (envDomain) {
      setDomain(envDomain)
    } else if (typeof window !== 'undefined') {
      // 如果没有环境变量，使用当前域名
      setDomain(window.location.host)
    }
  }, [])

  // 在服务端渲染时显示环境变量或占位符
  const displayDomain = isMounted 
    ? domain 
    : (process.env.NEXT_PUBLIC_DOMAIN || 'your-domain.com')

  return (
    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 px-4">
      通过{' '}
      <code className="bg-slate-200 dark:bg-slate-700 px-1.5 sm:px-2 py-1 rounded text-xs sm:text-sm break-all">
        {displayDomain}/代码
      </code>{' '}
      格式快速访问您的剪切板
    </p>
  )
}