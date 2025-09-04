import CodeInput from '@/components/CodeInput'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col">
      <main className="flex-1">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] sm:min-h-[70vh] space-y-6 sm:space-y-8">
            {/* 应用标题和说明 */}
            <div className="text-center space-y-3 sm:space-y-4 px-2">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent leading-tight">
                在线剪切板
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
                快速创建和分享文本内容，支持自定义代码或随机生成代码访问
              </p>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 px-4">
                通过 <code className="bg-slate-200 dark:bg-slate-700 px-1.5 sm:px-2 py-1 rounded text-xs sm:text-sm break-all">{process.env.NEXT_PUBLIC_DOMAIN || 'localhost:3000'}/代码</code> 格式快速访问您的剪切板
              </p>
            </div>

            {/* 代码输入组件 */}
            <div className="w-full max-w-sm sm:max-w-md px-4 sm:px-0">
              <CodeInput />
            </div>

            {/* 功能说明 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-4xl w-full mt-8 sm:mt-12 lg:mt-16 px-4 sm:px-0">
              <div className="text-center p-4 sm:p-6 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow duration-200">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2">自定义代码</h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  使用个性化的代码标识符来管理您的剪切板内容
                </p>
              </div>

              <div className="text-center p-4 sm:p-6 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow duration-200">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2">随机生成</h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  快速生成唯一的随机代码，无需思考命名
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}