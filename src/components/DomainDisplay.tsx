'use client'

import React, { useState, useEffect } from 'react'

export default function DomainDisplay() {
  const [domain, setDomain] = useState<string>('')
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)

    if (typeof window !== 'undefined') {
      const envDomain = process.env.NEXT_PUBLIC_DOMAIN
      const currentHost = window.location.host
      const nodeEnv = process.env.NODE_ENV

      // 调试信息
      console.log('DomainDisplay Debug:', {
        envDomain,
        currentHost,
        nodeEnv,
        hasEnvDomain: !!envDomain,
        isProduction: nodeEnv === 'production'
      })

      // 直接使用当前访问的域名，确保一致性
      setDomain(currentHost)
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