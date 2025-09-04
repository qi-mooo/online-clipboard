# Docker 部署指南

本项目提供了多种部署脚本，支持从快速部署到完整的生产环境管理。

## 🚀 快速开始

### 统一入口（推荐）

```bash
# 交互式选择部署方式
./deploy

# 或直接指定方式
./deploy quick          # 快速部署
./deploy full           # 完整部署
./deploy legacy         # 传统方式
```

### 直接使用具体脚本

#### 方式一：快速部署（推荐开发环境）
```bash
./quick-deploy.sh
```

#### 方式二：完整部署（推荐生产环境）
```bash
./deploy-unified.sh deploy
```

#### 方式三：传统方式
```bash
./deploy.sh
```

## 📋 部署脚本说明

### 1. quick-deploy.sh - 快速部署脚本

适用于开发和测试环境，提供最简单的部署体验：

```bash
./quick-deploy.sh [command]

# 常用命令
./quick-deploy.sh deploy    # 完整部署（默认）
./quick-deploy.sh build     # 仅构建
./quick-deploy.sh start     # 启动服务
./quick-deploy.sh stop      # 停止服务
./quick-deploy.sh logs      # 查看日志
./quick-deploy.sh status    # 查看状态
./quick-deploy.sh clean     # 清理资源
```

### 2. deploy-unified.sh - 统一部署脚本

适用于生产环境，提供完整的部署和管理功能：

```bash
./deploy-unified.sh [command]

# 部署相关
./deploy-unified.sh deploy      # 完整部署流程
./deploy-unified.sh build       # 仅构建应用
./deploy-unified.sh docker      # 仅构建Docker镜像

# 服务管理
./deploy-unified.sh start       # 启动服务
./deploy-unified.sh stop        # 停止服务
./deploy-unified.sh restart     # 重启服务
./deploy-unified.sh status      # 查看系统状态

# 监控和日志
./deploy-unified.sh logs        # 查看日志
./deploy-unified.sh logs true   # 实时跟踪日志
./deploy-unified.sh health      # 健康检查

# 数据管理
./deploy-unified.sh backup      # 创建数据备份
./deploy-unified.sh restore <file>  # 恢复数据
./deploy-unified.sh cleanup     # 清理所有资源
```

### 3. 传统脚本

保留原有的部署脚本以确保兼容性：
- `deploy.sh` - 原始部署脚本
- `build.sh` - 构建脚本
- `docker-build.sh` - Docker构建脚本

## ⚙️ 环境准备

### 1. 系统要求

确保已安装以下工具：
- Node.js 18+
- npm 或 yarn
- Docker
- Docker Compose
- curl（用于健康检查）

### 2. 环境变量配置

复制环境变量模板：
```bash
cp .env.example .env
```

编辑 `.env` 文件，配置您的设置：
```bash
# 应用配置
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_DOMAIN=your-domain.com
PORT=3000

# 自动保存配置
NEXT_PUBLIC_AUTO_SAVE_DELAY=1000
NEXT_PUBLIC_AUTO_SAVE_ENABLED=true
```

### 3. 部署配置（可选）

编辑 `deploy.config.sh` 来自定义部署参数：
```bash
# 应用配置
export APP_NAME="online-clipboard"
export DEFAULT_PORT=3000

# 健康检查配置
export HEALTH_CHECK_TIMEOUT=60
export HEALTH_CHECK_RETRIES=3

# 备份配置
export BACKUP_DIR="./backups"
export MAX_BACKUP_COUNT=10
```

## 环境变量说明

### 基础配置
- `NODE_ENV`: 运行环境 (production/development)
- `PORT`: 应用端口 (默认: 3000)
- `DATABASE_URL`: 数据库连接字符串

### 域名配置
- `NEXT_PUBLIC_APP_URL`: 完整的应用 URL
- `NEXT_PUBLIC_DOMAIN`: 应用域名（用于显示）

### 自动保存配置
- `NEXT_PUBLIC_AUTO_SAVE_DELAY`: 自动保存延迟时间（毫秒，默认: 1000）
- `NEXT_PUBLIC_AUTO_SAVE_ENABLED`: 是否启用自动保存（true/false）

### 内容配置
- `MAX_CONTENT_SIZE`: 最大内容大小（字节）
- `NEXT_PUBLIC_MAX_CONTENT_LENGTH`: 前端最大内容长度限制
- `CLEANUP_INTERVAL_DAYS`: 清理间隔天数

### 性能配置
- `MAX_CLIPBOARDS`: 最大剪切板数量
- `CACHE_TTL`: 缓存生存时间（秒）

## 部署架构

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   本地构建      │───▶│   Docker 镜像    │───▶│   生产运行      │
│                 │    │                  │    │                 │
│ • npm ci        │    │ • 复制构建产物   │    │ • 独立运行      │
│ • prisma gen    │    │ • 设置权限       │    │ • 数据持久化    │
│ • npm run build │    │ • 健康检查       │    │ • 日志管理      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 优势

### 1. 性能优化
- 本地构建避免了容器内编译的资源消耗
- 使用 Next.js standalone 输出，减少镜像大小
- 优化的 Docker 分层，提高构建速度

### 2. 灵活配置
- 支持环境变量配置域名
- 可调整自动保存时间
- 支持主题和编辑器配置

### 3. 运维友好
- 数据持久化到 Docker 卷
- 健康检查和自动重启
- 结构化日志输出

## 常用命令

### 查看服务状态
```bash
docker-compose ps
```

### 查看日志
```bash
# 查看所有日志
docker-compose logs

# 实时查看日志
docker-compose logs -f

# 查看最近 50 行日志
docker-compose logs --tail=50
```

### 重启服务
```bash
docker-compose restart
```

### 停止服务
```bash
docker-compose down
```

### 更新部署
```bash
# 重新构建并部署
./deploy.sh

# 或手动执行
./build.sh
docker-compose build
docker-compose up -d
```

### 数据管理
```bash
# 备份数据
docker run --rm -v clipboard-data:/data -v $(pwd):/backup alpine tar czf /backup/clipboard-backup.tar.gz -C /data .

# 恢复数据
docker run --rm -v clipboard-data:/data -v $(pwd):/backup alpine tar xzf /backup/clipboard-backup.tar.gz -C /data
```

## 故障排除

### 1. 构建失败
检查 Node.js 版本和依赖：
```bash
node --version
npm --version
npm ci
```

### 2. 容器启动失败
检查端口占用和权限：
```bash
# 检查端口
netstat -tulpn | grep :3000

# 检查 Docker 权限
docker ps
```

### 3. 数据库问题
检查数据卷和权限：
```bash
# 查看数据卷
docker volume ls

# 检查容器内文件权限
docker-compose exec clipboard ls -la /app/data
```

### 4. 环境变量不生效
确保 `.env` 文件格式正确：
```bash
# 检查环境变量
docker-compose exec clipboard env | grep NEXT_PUBLIC
```

## 监控和维护

### 健康检查
应用内置健康检查端点，Docker 会自动监控：
```bash
# 手动检查健康状态
curl http://localhost:3000/api/health
```

### 日志轮转
建议配置日志轮转以避免日志文件过大：
```bash
# 在 docker-compose.yml 中添加
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### 定期备份
建议设置定期备份任务：
```bash
# 添加到 crontab
0 2 * * * /path/to/backup-script.sh
```