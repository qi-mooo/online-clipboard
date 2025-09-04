#!/bin/bash

# 快速部署脚本 - 简化版本
# 用于快速部署和常用操作

set -e

# 基本配置
APP_NAME="online-clipboard"
DEFAULT_PORT=3000

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 简单日志
info() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

# 快速检查
quick_check() {
    # 检查必要工具
    for cmd in node npm docker docker-compose; do
        if ! command -v $cmd &> /dev/null; then
            error "$cmd not found"
            exit 1
        fi
    done
    info "All tools available"
    
    # 检查 .env
    if [ ! -f ".env" ] && [ -f ".env.example" ]; then
        warn "Copying .env.example to .env"
        cp .env.example .env
    fi
}

# 快速构建
quick_build() {
    info "Building application..."
    npm ci --silent
    npx prisma generate
    npm run build --silent
    info "Build completed"
}

# 快速部署
quick_deploy() {
    info "Deploying with Docker Compose..."
    docker-compose down --remove-orphans 2>/dev/null || true
    docker-compose up -d --build
    
    # 等待启动
    info "Waiting for service..."
    sleep 15
    
    # 简单健康检查
    local port=${PORT:-$DEFAULT_PORT}
    if curl -f -s "http://localhost:$port/api/health" >/dev/null 2>&1; then
        info "Service is running at http://localhost:$port"
    else
        warn "Service may not be ready yet"
    fi
}

# 主要命令
case "${1:-deploy}" in
    "deploy"|"d")
        quick_check
        quick_build
        quick_deploy
        ;;
    "build"|"b")
        quick_check
        quick_build
        ;;
    "start"|"up")
        docker-compose up -d
        info "Services started"
        ;;
    "stop"|"down")
        docker-compose down
        info "Services stopped"
        ;;
    "restart"|"r")
        docker-compose restart
        info "Services restarted"
        ;;
    "logs"|"l")
        docker-compose logs -f --tail=50
        ;;
    "status"|"s")
        docker-compose ps
        ;;
    "clean"|"c")
        docker-compose down -v --rmi local 2>/dev/null || true
        docker system prune -f
        info "Cleaned up"
        ;;
    "help"|"h")
        echo "Quick Deploy Commands:"
        echo "  deploy, d    - Full deployment (default)"
        echo "  build, b     - Build only"
        echo "  start, up    - Start services"
        echo "  stop, down   - Stop services"
        echo "  restart, r   - Restart services"
        echo "  logs, l      - Show logs"
        echo "  status, s    - Show status"
        echo "  clean, c     - Clean up"
        echo "  help, h      - Show help"
        ;;
    *)
        error "Unknown command: $1"
        echo "Use '$0 help' for available commands"
        exit 1
        ;;
esac