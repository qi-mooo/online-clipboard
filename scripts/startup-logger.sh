#!/bin/sh

# 容器启动日志记录脚本
# 记录容器启动过程中的详细信息

set -e

# 日志文件路径
LOG_DIR="/app/logs"
STARTUP_LOG="$LOG_DIR/startup.log"
ERROR_LOG="$LOG_DIR/error.log"

# 创建日志目录
mkdir -p "$LOG_DIR"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日志函数
log_with_timestamp() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # 输出到控制台
    case $level in
        "INFO")
            echo -e "${BLUE}[INFO]${NC} $timestamp - $message"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} $timestamp - $message"
            ;;
        "WARNING")
            echo -e "${YELLOW}[WARNING]${NC} $timestamp - $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $timestamp - $message"
            ;;
        "DEBUG")
            echo -e "${PURPLE}[DEBUG]${NC} $timestamp - $message"
            ;;
        *)
            echo -e "${CYAN}[$level]${NC} $timestamp - $message"
            ;;
    esac
    
    # 写入日志文件
    echo "[$level] $timestamp - $message" >> "$STARTUP_LOG"
    
    # 错误日志单独记录
    if [ "$level" = "ERROR" ]; then
        echo "[$level] $timestamp - $message" >> "$ERROR_LOG"
    fi
}

# 记录系统信息
log_system_info() {
    log_with_timestamp "INFO" "=== Container Startup Information ==="
    
    # 基本系统信息
    log_with_timestamp "INFO" "Container ID: $(hostname)"
    log_with_timestamp "INFO" "Operating System: $(uname -s)"
    log_with_timestamp "INFO" "Kernel Version: $(uname -r)"
    log_with_timestamp "INFO" "Architecture: $(uname -m)"
    
    # Node.js 信息
    if command -v node >/dev/null 2>&1; then
        log_with_timestamp "INFO" "Node.js Version: $(node --version)"
    fi
    
    if command -v npm >/dev/null 2>&1; then
        log_with_timestamp "INFO" "NPM Version: $(npm --version)"
    fi
    
    # 内存信息
    if [ -f /proc/meminfo ]; then
        TOTAL_MEM=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        AVAILABLE_MEM=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
        log_with_timestamp "INFO" "Total Memory: ${TOTAL_MEM} kB"
        log_with_timestamp "INFO" "Available Memory: ${AVAILABLE_MEM} kB"
    fi
    
    # 磁盘信息
    log_with_timestamp "INFO" "Disk Usage:"
    df -h | while read line; do
        log_with_timestamp "INFO" "  $line"
    done
    
    # 网络信息
    if command -v ip >/dev/null 2>&1; then
        log_with_timestamp "INFO" "Network Interfaces:"
        ip addr show | grep -E "inet|link" | while read line; do
            log_with_timestamp "INFO" "  $line"
        done
    fi
}

# 记录环境变量
log_environment_variables() {
    log_with_timestamp "INFO" "=== Environment Variables ==="
    
    # 安全地记录环境变量 (隐藏敏感信息)
    env | grep -E "^(NODE_ENV|PORT|DATABASE_URL|HOSTNAME|NEXT_|CLEANUP_|MAX_)" | while read var; do
        # 隐藏敏感信息
        if echo "$var" | grep -q "SECRET\|PASSWORD\|TOKEN\|KEY"; then
            var_name=$(echo "$var" | cut -d'=' -f1)
            log_with_timestamp "INFO" "  $var_name=***HIDDEN***"
        else
            log_with_timestamp "INFO" "  $var"
        fi
    done
}

# 记录应用配置
log_application_config() {
    log_with_timestamp "INFO" "=== Application Configuration ==="
    
    # 检查配置文件
    if [ -f "/app/package.json" ]; then
        APP_NAME=$(grep '"name"' /app/package.json | cut -d'"' -f4)
        APP_VERSION=$(grep '"version"' /app/package.json | cut -d'"' -f4)
        log_with_timestamp "INFO" "Application Name: $APP_NAME"
        log_with_timestamp "INFO" "Application Version: $APP_VERSION"
    fi
    
    # 检查 Next.js 配置
    if [ -f "/app/next.config.js" ]; then
        log_with_timestamp "INFO" "Next.js config file found"
    fi
    
    # 检查 Prisma 配置
    if [ -f "/app/prisma/schema.prisma" ]; then
        log_with_timestamp "INFO" "Prisma schema file found"
    fi
    
    # 检查数据目录
    if [ -d "/app/data" ]; then
        DATA_SIZE=$(du -sh /app/data 2>/dev/null | cut -f1)
        log_with_timestamp "INFO" "Data directory size: $DATA_SIZE"
    fi
}

# 记录启动步骤
log_startup_step() {
    local step=$1
    local description=$2
    log_with_timestamp "INFO" "STEP $step: $description"
}

# 记录启动完成
log_startup_complete() {
    local start_time=$1
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_with_timestamp "SUCCESS" "=== Container Startup Complete ==="
    log_with_timestamp "SUCCESS" "Startup Duration: ${duration} seconds"
    log_with_timestamp "SUCCESS" "Application is ready to serve requests"
    log_with_timestamp "INFO" "Logs are available at:"
    log_with_timestamp "INFO" "  - Startup log: $STARTUP_LOG"
    log_with_timestamp "INFO" "  - Error log: $ERROR_LOG"
}

# 记录错误信息
log_startup_error() {
    local error_message=$1
    local exit_code=${2:-1}
    
    log_with_timestamp "ERROR" "=== Container Startup Failed ==="
    log_with_timestamp "ERROR" "Error: $error_message"
    log_with_timestamp "ERROR" "Exit Code: $exit_code"
    log_with_timestamp "ERROR" "Check logs for more details: $ERROR_LOG"
    
    exit $exit_code
}

# 监控启动过程
monitor_startup() {
    local pid=$1
    local timeout=${2:-300}  # 5分钟超时
    local count=0
    
    log_with_timestamp "INFO" "Monitoring startup process (PID: $pid, Timeout: ${timeout}s)"
    
    while [ $count -lt $timeout ]; do
        if ! kill -0 $pid 2>/dev/null; then
            log_with_timestamp "WARNING" "Startup process terminated unexpectedly"
            return 1
        fi
        
        # 检查应用是否响应
        if curl -f http://localhost:${PORT:-3000}/api/health >/dev/null 2>&1; then
            log_with_timestamp "SUCCESS" "Application is responding to health checks"
            return 0
        fi
        
        sleep 5
        count=$((count + 5))
        
        if [ $((count % 30)) -eq 0 ]; then
            log_with_timestamp "INFO" "Still waiting for application to start... (${count}s elapsed)"
        fi
    done
    
    log_with_timestamp "ERROR" "Startup timeout reached (${timeout}s)"
    return 1
}

# 清理旧日志
cleanup_old_logs() {
    local max_age_days=${LOG_RETENTION_DAYS:-7}
    
    log_with_timestamp "INFO" "Cleaning up logs older than $max_age_days days"
    
    find "$LOG_DIR" -name "*.log" -type f -mtime +$max_age_days -delete 2>/dev/null || true
    
    # 限制日志文件大小
    local max_size=${MAX_LOG_SIZE:-10485760}  # 10MB
    
    for log_file in "$STARTUP_LOG" "$ERROR_LOG"; do
        if [ -f "$log_file" ] && [ $(stat -f%z "$log_file" 2>/dev/null || stat -c%s "$log_file" 2>/dev/null || echo "0") -gt $max_size ]; then
            tail -n 1000 "$log_file" > "${log_file}.tmp"
            mv "${log_file}.tmp" "$log_file"
            log_with_timestamp "INFO" "Truncated log file: $log_file"
        fi
    done
}

# 函数已定义，可以在当前脚本中使用
# 注意：Alpine sh 不支持 export -f，所以我们不导出函数

# 如果直接运行此脚本
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    START_TIME=$(date +%s)
    
    # 清理旧日志
    cleanup_old_logs
    
    # 记录启动信息
    log_system_info
    log_environment_variables
    log_application_config
    
    log_with_timestamp "INFO" "Startup logging initialized"
fi