'use client'

import React, { useState, useEffect } from 'react'

export default function DomainDisplay() {
  const [domain, setDomain] = useState<string>('')
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    
    if (typeof window !== 'undefined') {
      // 在开发环境中，优先使用当前域名以保持一致性
      // 在生产环境中，使用环境变量或当前域名
      const envDomain = process.env.NEXT_PUBLIC_DOMAIN
      const currentHost = window.location.host
      
      // 如果是生产环境且有配置的域名，使用配置的域名
      // 否则使用当前访问的域名，确保与实际访问地址一致
      if (envDomain && process.env.NODE_ENV === 'production') {
        setDomain(envDomain)
      } else {
        setDomain(currentHost)
      }
    }
  }, [])

  // 在服务端渲染时显示环境变量或占位符
  const displayDomain = isMounted 
    ? domain 
    : (process.env.NEXT_PUBLIC_DOMAIN || 'localhost:3000')

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