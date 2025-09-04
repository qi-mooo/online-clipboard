#!/bin/sh

# 容器健康检查脚本
# 用于 Docker 健康检查和监控

set -e

# 配置
HEALTH_ENDPOINT="http://localhost:${PORT:-3000}/api/health"
TIMEOUT=${HEALTH_CHECK_TIMEOUT:-10}
MAX_RETRIES=${HEALTH_CHECK_RETRIES:-3}

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1"
}

log_success() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${RED}[ERROR]${NC} $1"
}

# 检查网络连接
check_network() {
    log_info "Checking network connectivity..."
    
    if command -v curl >/dev/null 2>&1; then
        if curl -s --max-time 5 http://localhost:${PORT:-3000} >/dev/null; then
            log_success "Network connectivity OK"
            return 0
        else
            log_error "Network connectivity failed"
            return 1
        fi
    else
        log_warning "curl not available, skipping network check"
        return 0
    fi
}

# 检查端口监听
check_port() {
    local port=${PORT:-3000}
    log_info "Checking if port $port is listening..."
    
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        log_success "Port $port is listening"
        return 0
    else
        log_error "Port $port is not listening"
        return 1
    fi
}

# 检查进程
check_process() {
    log_info "Checking application process..."
    
    if pgrep -f "node.*server.js" >/dev/null 2>&1; then
        log_success "Application process is running"
        return 0
    else
        log_error "Application process not found"
        return 1
    fi
}

# 检查数据库
check_database() {
    log_info "Checking database connectivity..."
    
    if [ -f "/app/data/clipboard.db" ]; then
        if sqlite3 /app/data/clipboard.db "SELECT 1;" >/dev/null 2>&1; then
            log_success "Database is accessible"
            return 0
        else
            log_error "Database query failed"
            return 1
        fi
    else
        log_error "Database file not found"
        return 1
    fi
}

# 检查磁盘空间
check_disk_space() {
    log_info "Checking disk space..."
    
    # 检查数据目录磁盘使用率
    DISK_USAGE=$(df /app/data | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$DISK_USAGE" -gt 90 ]; then
        log_error "Disk usage is critical: ${DISK_USAGE}%"
        return 1
    elif [ "$DISK_USAGE" -gt 80 ]; then
        log_warning "Disk usage is high: ${DISK_USAGE}%"
    else
        log_success "Disk usage is normal: ${DISK_USAGE}%"
    fi
    
    return 0
}

# 检查内存使用
check_memory() {
    log_info "Checking memory usage..."
    
    if [ -f /proc/meminfo ]; then
        TOTAL_MEM=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        AVAILABLE_MEM=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
        
        if [ "$TOTAL_MEM" -gt 0 ]; then
            MEMORY_USAGE=$((100 - (AVAILABLE_MEM * 100 / TOTAL_MEM)))
            
            if [ "$MEMORY_USAGE" -gt 90 ]; then
                log_error "Memory usage is critical: ${MEMORY_USAGE}%"
                return 1
            elif [ "$MEMORY_USAGE" -gt 80 ]; then
                log_warning "Memory usage is high: ${MEMORY_USAGE}%"
            else
                log_success "Memory usage is normal: ${MEMORY_USAGE}%"
            fi
        fi
    fi
    
    return 0
}

# 健康检查端点测试
check_health_endpoint() {
    log_info "Checking health endpoint: $HEALTH_ENDPOINT"
    
    local retry=0
    while [ $retry -lt $MAX_RETRIES ]; do
        if command -v curl >/dev/null 2>&1; then
            if curl -f -s --max-time $TIMEOUT "$HEALTH_ENDPOINT" >/dev/null; then
                log_success "Health endpoint responded successfully"
                return 0
            fi
        elif command -v wget >/dev/null 2>&1; then
            if wget -q --timeout=$TIMEOUT --tries=1 -O /dev/null "$HEALTH_ENDPOINT"; then
                log_success "Health endpoint responded successfully"
                return 0
            fi
        else
            log_warning "Neither curl nor wget available for health check"
            return 0
        fi
        
        retry=$((retry + 1))
        if [ $retry -lt $MAX_RETRIES ]; then
            log_warning "Health check attempt $retry failed, retrying..."
            sleep 2
        fi
    done
    
    log_error "Health endpoint check failed after $MAX_RETRIES attempts"
    return 1
}

# 详细健康检查
detailed_health_check() {
    log_info "=== Detailed Health Check ==="
    
    local checks_passed=0
    local total_checks=6
    
    # 执行各项检查
    if check_process; then
        checks_passed=$((checks_passed + 1))
    fi
    
    if check_port; then
        checks_passed=$((checks_passed + 1))
    fi
    
    if check_network; then
        checks_passed=$((checks_passed + 1))
    fi
    
    if check_database; then
        checks_passed=$((checks_passed + 1))
    fi
    
    if check_disk_space; then
        checks_passed=$((checks_passed + 1))
    fi
    
    if check_memory; then
        checks_passed=$((checks_passed + 1))
    fi
    
    log_info "Health check summary: $checks_passed/$total_checks checks passed"
    
    if [ $checks_passed -eq $total_checks ]; then
        log_success "All health checks passed"
        return 0
    elif [ $checks_passed -ge $((total_checks * 2 / 3)) ]; then
        log_warning "Most health checks passed ($checks_passed/$total_checks)"
        return 0
    else
        log_error "Too many health checks failed ($checks_passed/$total_checks)"
        return 1
    fi
}

# 快速健康检查
quick_health_check() {
    log_info "=== Quick Health Check ==="
    
    # 只检查关键项目
    if check_health_endpoint; then
        log_success "Quick health check passed"
        return 0
    else
        log_error "Quick health check failed"
        return 1
    fi
}

# 主函数
main() {
    local check_type=${1:-quick}
    
    case "$check_type" in
        "quick")
            quick_health_check
            ;;
        "detailed")
            detailed_health_check
            ;;
        "endpoint")
            check_health_endpoint
            ;;
        "database")
            check_database
            ;;
        "process")
            check_process
            ;;
        "port")
            check_port
            ;;
        *)
            echo "Usage: $0 [quick|detailed|endpoint|database|process|port]"
            echo "  quick    - Quick health check (default)"
            echo "  detailed - Comprehensive health check"
            echo "  endpoint - Check health endpoint only"
            echo "  database - Check database connectivity"
            echo "  process  - Check application process"
            echo "  port     - Check port listening"
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"