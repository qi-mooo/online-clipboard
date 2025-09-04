#!/bin/bash

# 在线剪切板统一部署脚本
# 融合了构建、部署、验证和管理功能
set -e

# 加载配置文件
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/deploy.config.sh" ]; then
    source "$SCRIPT_DIR/deploy.config.sh"
    init_config
else
    echo "Warning: deploy.config.sh not found, using default settings"
    # 默认配置
    export APP_NAME="online-clipboard"
    export SCRIPT_VERSION="1.0.0"
    export DEFAULT_PORT=3000
    export HEALTH_CHECK_TIMEOUT=60
    export BACKUP_DIR="./backups"
fi

SCRIPT_NAME="Online Clipboard Unified Deployment"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ️  [$(date '+%H:%M:%S')] $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ [$(date '+%H:%M:%S')] $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  [$(date '+%H:%M:%S')] $1${NC}"
}

log_error() {
    echo -e "${RED}❌ [$(date '+%H:%M:%S')] $1${NC}"
}

log_step() {
    echo -e "\n${PURPLE}🔄 Step $1: $2${NC}"
}

log_header() {
    echo -e "\n${CYAN}=== $1 ===${NC}"
}

# 显示横幅
show_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║              Online Clipboard Deployment Tool               ║"
    echo "║                     Version $SCRIPT_VERSION                        ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 检查系统依赖
check_dependencies() {
    log_header "System Dependencies Check"
    
    local missing_deps=()
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("Node.js")
    else
        log_success "Node.js $(node --version) found"
    fi
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    else
        log_success "npm $(npm --version) found"
    fi
    
    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        missing_deps+=("Docker")
    else
        log_success "Docker $(docker --version | cut -d' ' -f3 | cut -d',' -f1) found"
    fi
    
    # 检查 Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        missing_deps+=("Docker Compose")
    else
        log_success "Docker Compose $(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1) found"
    fi
    
    # 检查 curl
    if ! command -v curl &> /dev/null; then
        log_warning "curl not found (optional for health checks)"
    else
        log_success "curl found"
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        echo ""
        echo "Please install the missing dependencies:"
        for dep in "${missing_deps[@]}"; do
            echo "  - $dep"
        done
        exit 1
    fi
    
    log_success "All required dependencies are installed"
}

# 环境配置检查
check_environment() {
    log_header "Environment Configuration"
    
    # 检查 .env 文件
    if [ ! -f ".env" ]; then
        log_warning "No .env file found"
        if [ -f ".env.example" ]; then
            log_info "Copying .env.example to .env"
            cp .env.example .env
            log_warning "Please edit .env file to configure your settings"
            echo ""
            echo "Key settings to configure:"
            echo "  - NEXT_PUBLIC_APP_URL: Your application URL"
            echo "  - NEXT_PUBLIC_DOMAIN: Your domain name"
            echo "  - PORT: Application port (default: 3000)"
            echo ""
            read -p "Press Enter to continue after editing .env, or Ctrl+C to exit..."
        else
            log_error ".env.example file not found"
            exit 1
        fi
    else
        log_success ".env file found"
    fi
    
    # 验证关键环境变量
    source .env 2>/dev/null || true
    
    if [ -z "$NEXT_PUBLIC_APP_URL" ]; then
        log_warning "NEXT_PUBLIC_APP_URL not set in .env"
    else
        log_success "App URL: $NEXT_PUBLIC_APP_URL"
    fi
    
    if [ -z "$PORT" ]; then
        log_info "PORT not set, using default: $DEFAULT_PORT"
        export PORT=$DEFAULT_PORT
    else
        log_success "Port: $PORT"
    fi
}

# 本地构建
build_application() {
    log_header "Building Application"
    
    log_step "1" "Installing dependencies"
    npm ci
    
    log_step "2" "Generating Prisma client"
    npx prisma generate
    
    log_step "3" "Building Next.js application"
    npm run build
    
    log_success "Application build completed"
    
    # 显示构建信息
    echo ""
    log_info "Build artifacts:"
    echo "  - .next/standalone/ - Standalone server files"
    echo "  - .next/static/ - Static assets"
    echo "  - public/ - Public files"
    
    # 检查构建产物
    if [ ! -d ".next/standalone" ]; then
        log_error "Standalone build not found. Check Next.js configuration."
        exit 1
    fi
    
    log_success "Build verification passed"
}

# Docker 操作
docker_build() {
    log_header "Docker Build"
    
    log_step "1" "Building Docker image"
    docker build -t online-clipboard:latest .
    
    log_step "2" "Tagging image with timestamp"
    local timestamp=$(date +%Y%m%d-%H%M%S)
    docker tag online-clipboard:latest online-clipboard:$timestamp
    
    log_success "Docker image built successfully"
    log_info "Available tags:"
    echo "  - online-clipboard:latest"
    echo "  - online-clipboard:$timestamp"
}



# 部署服务
deploy_services() {
    log_header "Deploying Services"
    
    log_step "1" "Stopping existing containers"
    docker-compose down || true
    
    log_step "2" "Starting new containers"
    docker-compose up -d
    
    log_step "3" "Waiting for containers to start"
    sleep 10
    
    # 检查容器状态
    log_info "Container status:"
    docker-compose ps
    
    log_success "Services deployed successfully"
}

# 健康检查
health_check() {
    log_header "Health Check"
    
    local app_url="http://localhost:${PORT:-$DEFAULT_PORT}"
    local elapsed=0
    
    log_step "1" "Waiting for service to respond"
    
    while [ $elapsed -lt $HEALTH_CHECK_TIMEOUT ]; do
        if curl -f -s "$app_url/api/health" >/dev/null 2>&1; then
            log_success "Service is responding (took ${elapsed}s)"
            break
        fi
        
        log_info "Waiting for service... (${elapsed}s elapsed)"
        sleep 5
        elapsed=$((elapsed + 5))
    done
    
    if [ $elapsed -ge $HEALTH_CHECK_TIMEOUT ]; then
        log_error "Service failed to respond within ${HEALTH_CHECK_TIMEOUT}s"
        return 1
    fi
    
    log_step "2" "Running comprehensive health checks"
    
    # 测试健康端点
    if response=$(curl -f -s "$app_url/api/health" 2>/dev/null); then
        if echo "$response" | grep -q '"status":"healthy"' 2>/dev/null; then
            log_success "Health endpoint: OK"
        else
            log_warning "Health endpoint: Response unclear"
        fi
    else
        log_error "Health endpoint: Failed"
        return 1
    fi
    
    # 测试主页
    if curl -f -s "$app_url/" >/dev/null 2>&1; then
        log_success "Homepage: OK"
    else
        log_error "Homepage: Failed"
        return 1
    fi
    
    # 测试 API
    local test_code="test-$(date +%s)"
    if curl -f -s -X POST "$app_url/api/generate-code" >/dev/null 2>&1; then
        log_success "API endpoints: OK"
    else
        log_warning "API endpoints: Some issues detected"
    fi
    
    log_success "Health check completed"
    return 0
}

# 数据备份
backup_data() {
    log_header "Data Backup"
    
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_file="$BACKUP_DIR/clipboard-backup-$timestamp.tar.gz"
    
    # 创建备份目录
    mkdir -p "$BACKUP_DIR"
    
    log_step "1" "Creating data backup"
    
    if docker volume ls | grep -q clipboard-data; then
        docker run --rm \
            -v clipboard-data:/data \
            -v "$(pwd)/$BACKUP_DIR":/backup \
            alpine tar czf "/backup/clipboard-backup-$timestamp.tar.gz" -C /data .
        
        log_success "Backup created: $backup_file"
        
        # 显示备份信息
        local backup_size=$(du -h "$backup_file" | cut -f1)
        log_info "Backup size: $backup_size"
        
        # 清理旧备份（保留最近5个）
        log_step "2" "Cleaning old backups"
        ls -t "$BACKUP_DIR"/clipboard-backup-*.tar.gz 2>/dev/null | tail -n +6 | xargs rm -f || true
        
        local backup_count=$(ls "$BACKUP_DIR"/clipboard-backup-*.tar.gz 2>/dev/null | wc -l)
        log_info "Keeping $backup_count recent backups"
    else
        log_warning "No data volume found to backup"
    fi
}

# 数据恢复
restore_data() {
    log_header "Data Restore"
    
    if [ -z "$1" ]; then
        log_info "Available backups:"
        ls -la "$BACKUP_DIR"/clipboard-backup-*.tar.gz 2>/dev/null || {
            log_warning "No backups found in $BACKUP_DIR"
            return 1
        }
        echo ""
        echo "Usage: $0 restore <backup-file>"
        return 1
    fi
    
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi
    
    log_warning "This will replace all current data. Are you sure? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        log_info "Restore cancelled"
        return 0
    fi
    
    log_step "1" "Stopping services"
    docker-compose down
    
    log_step "2" "Restoring data"
    docker run --rm \
        -v clipboard-data:/data \
        -v "$(pwd)":/backup \
        alpine sh -c "rm -rf /data/* && tar xzf /backup/$backup_file -C /data"
    
    log_step "3" "Restarting services"
    docker-compose up -d
    
    log_success "Data restored from: $backup_file"
}

# 查看日志
view_logs() {
    log_header "Application Logs"
    
    local follow=${1:-false}
    local lines=${2:-50}
    
    if [ "$follow" = "true" ]; then
        log_info "Following logs (Ctrl+C to exit)..."
        docker-compose logs -f --tail=$lines
    else
        log_info "Showing last $lines lines..."
        docker-compose logs --tail=$lines
    fi
}

# 服务管理
manage_services() {
    local action=$1
    
    case "$action" in
        "start")
            log_info "Starting services..."
            docker-compose up -d
            log_success "Services started"
            ;;
        "stop")
            log_info "Stopping services..."
            docker-compose down
            log_success "Services stopped"
            ;;
        "restart")
            log_info "Restarting services..."
            docker-compose restart
            log_success "Services restarted"
            ;;
        "status")
            log_info "Service status:"
            docker-compose ps
            ;;
        *)
            log_error "Unknown action: $action"
            echo "Available actions: start, stop, restart, status"
            return 1
            ;;
    esac
}

# 清理资源
cleanup() {
    log_header "Cleanup"
    
    log_warning "This will remove all containers, images, and volumes. Are you sure? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        log_info "Cleanup cancelled"
        return 0
    fi
    
    log_step "1" "Stopping and removing containers"
    docker-compose down -v --rmi all
    
    log_step "2" "Cleaning Docker system"
    docker system prune -f
    
    log_step "3" "Removing build artifacts"
    rm -rf .next node_modules/.cache
    
    log_success "Cleanup completed"
}

# 显示状态
show_status() {
    log_header "System Status"
    
    # 容器状态
    echo "Container Status:"
    docker-compose ps
    echo ""
    
    # 数据卷状态
    echo "Data Volumes:"
    docker volume ls | grep clipboard || echo "No clipboard volumes found"
    echo ""
    
    # 镜像状态
    echo "Docker Images:"
    docker images | grep online-clipboard || echo "No online-clipboard images found"
    echo ""
    
    # 端口状态
    local port=${PORT:-$DEFAULT_PORT}
    echo "Port Status:"
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        echo "  Port $port: LISTENING"
    else
        echo "  Port $port: NOT LISTENING"
    fi
    echo ""
    
    # 应用状态
    local app_url="http://localhost:$port"
    echo "Application Status:"
    if curl -f -s "$app_url/api/health" >/dev/null 2>&1; then
        echo "  Health Check: PASS"
        echo "  URL: $app_url"
    else
        echo "  Health Check: FAIL"
    fi
}

# 显示帮助
show_help() {
    echo "$SCRIPT_NAME v$SCRIPT_VERSION"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  deploy              Full deployment (build + docker + health check)"
    echo "  build               Build application only"
    echo "  docker              Build Docker image only"
    echo "  start               Start services"
    echo "  stop                Stop services"
    echo "  restart             Restart services"
    echo "  status              Show system status"
    echo "  logs [follow] [n]   Show logs (follow=true for live, n=number of lines)"
    echo "  health              Run health check"
    echo "  backup              Create data backup"
    echo "  restore <file>      Restore data from backup"
    echo "  cleanup             Clean up all resources"
    echo "  help                Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 deploy           # Full deployment"
    echo "  $0 logs true 100    # Follow logs, show 100 lines"
    echo "  $0 backup           # Create backup"
    echo "  $0 restore backup.tar.gz  # Restore from backup"
    echo ""
    echo "Environment Variables:"
    echo "  PORT                Application port (default: 3000)"
    echo "  HEALTH_CHECK_TIMEOUT Timeout for health checks (default: 60s)"
}

# 主函数
main() {
    local command=${1:-help}
    
    # 显示横幅（除了 help 命令）
    if [ "$command" != "help" ]; then
        show_banner
    fi
    
    case "$command" in
        "deploy")
            check_dependencies
            check_environment
            backup_data
            build_application
            docker_build
            deploy_services
            if health_check; then
                log_success "🎉 Deployment completed successfully!"
                echo ""
                log_info "Application is available at: http://localhost:${PORT:-$DEFAULT_PORT}"
                log_info "Use '$0 logs true' to follow logs"
                log_info "Use '$0 status' to check system status"
            else
                log_error "Deployment completed but health check failed"
                log_info "Use '$0 logs' to check for errors"
                exit 1
            fi
            ;;
        "build")
            check_dependencies
            check_environment
            build_application
            ;;
        "docker")
            check_dependencies
            docker_build
            ;;
        "start")
            manage_services "start"
            ;;
        "stop")
            manage_services "stop"
            ;;
        "restart")
            manage_services "restart"
            ;;
        "status")
            show_status
            ;;
        "logs")
            view_logs "${2:-false}" "${3:-50}"
            ;;
        "health")
            health_check
            ;;
        "backup")
            backup_data
            ;;
        "restore")
            restore_data "$2"
            ;;
        "cleanup")
            cleanup
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"