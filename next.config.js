/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker 构建优化
  output: 'standalone',
  
  // 性能优化配置
  experimental: {
    // 优化服务器组件
    serverComponentsExternalPackages: ['prisma'],
  },
  
  // 跳过类型检查以加快构建
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 跳过 ESLint 检查以加快构建
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // 编译优化
  compiler: {
    // 移除 console.log (仅在生产环境)
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false,
  },
  
  // 图片优化
  images: {
    // 启用图片优化
    formats: ['image/webp', 'image/avif'],
    // 图片域名白名单
    domains: [],
    // 图片尺寸配置
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // 压缩配置
  compress: true,
  
  // 静态文件优化
  assetPrefix: process.env.NODE_ENV === 'production' ? '' : '',
  
  // 构建优化
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // 生产环境优化
    if (!dev && !isServer) {
      // 代码分割优化
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: -10,
            chunks: 'all',
          },
          common: {
            name: 'common',
            minChunks: 2,
            priority: -30,
            chunks: 'all',
            reuseExistingChunk: true,
          },
        },
      }
      
      // 添加 Bundle Analyzer (可选)
      if (process.env.ANALYZE === 'true') {
        const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            openAnalyzer: false,
          })
        )
      }
    }
    
    return config
  },
  
  // 头部优化
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // 安全头部
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          // 性能头部
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          // API 缓存头部
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          // 静态资源缓存
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  
  // 重定向优化
  async redirects() {
    return []
  },
  
  // 重写优化
  async rewrites() {
    return []
  },
}

module.exports = nextConfig