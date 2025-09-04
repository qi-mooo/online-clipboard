import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { validateCodeFormat } from '@/lib/code-utils'
import ClipboardPage from './ClipboardPage'

interface PageProps {
  params: { code: string }
}

// 生成页面元数据
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = params
  
  // 解码URL参数
  const decodedCode = decodeURIComponent(code)
  
  // 验证代码格式
  const validation = validateCodeFormat(decodedCode)
  
  if (!validation.isValid) {
    return {
      title: '无效代码 - 在线剪切板',
      description: '您访问的剪切板代码格式无效',
    }
  }

  return {
    title: `剪切板 ${decodedCode} - 在线剪切板`,
    description: `访问和编辑剪切板 ${decodedCode} 的内容`,
    openGraph: {
      title: `剪切板 ${decodedCode}`,
      description: '在线剪切板 - 快速分享和编辑文本内容',
      type: 'website',
    },
    robots: {
      index: false, // 不索引剪切板内容以保护隐私
      follow: false,
    },
  }
}

export default function Page({ params }: PageProps) {
  const { code } = params
  
  // 解码URL参数
  const decodedCode = decodeURIComponent(code)
  
  // 验证代码格式
  const validation = validateCodeFormat(decodedCode)
  
  if (!validation.isValid) {
    // 如果代码格式无效，返回404
    notFound()
  }

  return <ClipboardPage code={decodedCode} />
}