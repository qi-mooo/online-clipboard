# 在线剪切板

[![CI](https://github.com/qi-mooo/online-clipboard/actions/workflows/ci.yml/badge.svg)](https://github.com/qi-mooo/online-clipboard/actions/workflows/ci.yml)
[![Docker](https://github.com/qi-mooo/online-clipboard/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/qi-mooo/online-clipboard/actions/workflows/docker-publish.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

一个简单易用的在线剪切板应用，支持快速创建和分享文本内容。

🔗 **项目地址**: https://github.com/qi-mooo/online-clipboard  
🐳 **Docker 镜像**: https://github.com/qi-mooo/online-clipboard/pkgs/container/online-clipboard

## 功能特点

- 🚀 **快速访问** - 通过自定义代码或随机生成代码快速访问
- 📝 **文本编辑** - 支持富文本编辑和自动保存
- 🎨 **响应式设计** - 完美适配桌面和移动设备
- 🌙 **深色模式** - 支持明暗主题切换
- 💾 **数据持久化** - 使用 SQLite 数据库存储
- 🐳 **Docker 部署** - 支持容器化部署

## 快速开始

### 开发环境

1. 克隆项目
```bash
git clone https://github.com/qi-mooo/online-clipboard.git
cd online-clipboard
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
```bash
cp .env.example .env
```

4. 初始化数据库
```bash
npm run db:generate
npm run db:migrate
```

5. 启动开发服务器
```bash
npm run dev
```

访问 http://localhost:3000 开始使用。

### Docker 部署

#### 方式一：使用预构建镜像（推荐）

```bash
# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，设置你的域名和配置

# 使用生产环境配置部署
docker-compose -f docker-compose.prod.yml up -d
```

#### 方式二：本地构建部署

```bash
# 快速部署
./deploy quick

# 完整部署（包含健康检查、备份等）
./deploy full

# 交互式选择
./deploy
```

#### 方式三：手动部署

```bash
# 拉取最新镜像
docker pull ghcr.io/qi-mooo/online-clipboard:latest

# 启动服务
docker-compose up -d
```

## 使用方法

1. **创建剪切板**
   - 访问首页，输入自定义代码或点击随机生成
   - 点击"创建剪切板"按钮

2. **编辑内容**
   - 在编辑器中输入或粘贴文本内容
   - 支持自动保存（默认1秒延迟）

3. **分享访问**
   - 通过 `域名/代码` 格式分享给他人
   - 例如：`https://your-domain.com/abc123`

## 技术栈

- **前端**: Next.js 14, React 18, TypeScript
- **样式**: Tailwind CSS, Radix UI
- **数据库**: SQLite + Prisma ORM
- **测试**: Vitest + Testing Library
- **部署**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **镜像仓库**: GitHub Container Registry

## 项目结构

```
├── src/
│   ├── app/           # Next.js 应用路由
│   ├── components/    # React 组件
│   ├── lib/          # 工具函数和配置
│   └── types/        # TypeScript 类型定义
├── prisma/           # 数据库模式和迁移
├── scripts/          # 部署和维护脚本
└── docker-compose.yml # Docker 编排配置
```

## 环境变量

主要配置项：

```bash
# 应用配置
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_DOMAIN=your-domain.com

# 自动保存配置
NEXT_PUBLIC_AUTO_SAVE_DELAY=1000
NEXT_PUBLIC_AUTO_SAVE_ENABLED=true

# 内容限制
MAX_CONTENT_SIZE=1048576
NEXT_PUBLIC_MAX_CONTENT_LENGTH=1048576
```

完整配置请参考 `.env.example` 文件。

## 开发命令

```bash
# 开发
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run start        # 启动生产服务器

# 数据库
npm run db:generate  # 生成 Prisma 客户端
npm run db:migrate   # 运行数据库迁移
npm run db:studio    # 打开数据库管理界面

# 测试
npm run test         # 运行测试
npm run test:ui      # 运行测试 UI

# Docker
npm run docker:up    # 启动 Docker 服务
npm run docker:down  # 停止 Docker 服务
npm run docker:logs  # 查看 Docker 日志
```

## 部署说明

详细的 Docker 部署指南请参考 [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md)。

## 许可证

MIT License