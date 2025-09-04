#!/bin/bash

# 部署配置文件
# 用于统一管理部署参数和设置

# 应用配置
export APP_NAME="online-clipboard"
export APP_VERSION="1.0.0"
export DEFAULT_PORT=3000

# Docker 配置
export DOCKER_IMAGE_NAME="online-clipboard"
export DOCKER_CONTAINER_NAME="online-clipboard"
export DOCKER_NETWORK_NAME="clipboard-network"

# 数据卷配置
export DATA_VOLUME_NAME="clipboard-data"
export LOGS_VOLUME_NAME="clipboard-logs"
export TMP_VOLUME_NAME="clipboard-tmp"

# 备份配置
export BACKUP_DIR="./backups"
export BACKUP_RETENTION_DAYS=30
export MAX_BACKUP_COUNT=10

# 健康检查配置
export HEALTH_CHECK_TIMEOUT=60
export HEALTH_CHECK_RETRIES=3
export HEALTH_CHECK_INTERVAL=30

# 性能配置
export BUILD_TIMEOUT=600
export DEPLOY_TIMEOUT=300
export STARTUP_TIMEOUT=120

# 日志配置
export LOG_LEVEL="info"
export LOG_MAX_SIZE="10m"
export LOG_MAX_FILES=3

# 安全配置
export ENABLE_SECURITY_HEADERS=true
export ENABLE_RATE_LIMITING=true
export MAX_CONTENT_SIZE=1048576

# 开发配置
export DEV_MODE=false
export DEBUG_MODE=false
export VERBOSE_LOGGING=false

# 环境检测
detect_environment() {
    if [ -f ".env" ]; then
        source .env
    fi
    
    # 检测是否为开发环境
    if [ "$NODE_ENV" = "development" ] || [ -f ".dev" ]; then
        export DEV_MODE=true
        export DEBUG_MODE=true
        export VERBOSE_LOGGING=true
        export LOG_LEVEL="debug"
    fi
    
    # 检测 CI/CD 环境
    if [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ] || [ -n "$GITLAB_CI" ]; then
        export CI_MODE=true
        export VERBOSE_LOGGING=true
    fi
}

# 验证配置
validate_config() {
    local errors=()
    
    # 检查端口范围
    if [ "$PORT" -lt 1024 ] || [ "$PORT" -gt 65535 ]; then
        errors+=("Invalid port number: $PORT")
    fi
    
    # 检查超时设置
    if [ "$HEALTH_CHECK_TIMEOUT" -lt 10 ]; then
        errors+=("Health check timeout too short: $HEALTH_CHECK_TIMEOUT")
    fi
    
    # 检查备份设置
    if [ "$MAX_BACKUP_COUNT" -lt 1 ]; then
        errors+=("Invalid backup count: $MAX_BACKUP_COUNT")
    fi
    
    if [ ${#errors[@]} -ne 0 ]; then
        echo "Configuration errors:"
        for error in "${errors[@]}"; do
            echo "  - $error"
        done
        return 1
    fi
    
    return 0
}

# 显示配置
show_config() {
    echo "Current Configuration:"
    echo "  App Name: $APP_NAME"
    echo "  Version: $APP_VERSION"
    echo "  Port: ${PORT:-$DEFAULT_PORT}"
    echo "  Environment: ${NODE_ENV:-production}"
    echo "  Dev Mode: $DEV_MODE"
    echo "  Debug Mode: $DEBUG_MODE"
    echo "  Docker Image: $DOCKER_IMAGE_NAME"
    echo "  Container Name: $DOCKER_CONTAINER_NAME"
    echo "  Backup Directory: $BACKUP_DIR"
    echo "  Health Check Timeout: ${HEALTH_CHECK_TIMEOUT}s"
    echo "  Log Level: $LOG_LEVEL"
}

# 初始化配置
init_config() {
    detect_environment
    
    # 设置默认值
    export PORT=${PORT:-$DEFAULT_PORT}
    export NODE_ENV=${NODE_ENV:-production}
    
    # 验证配置
    if ! validate_config; then
        exit 1
    fi
}

# 如果直接运行此脚本，显示配置
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    init_config
    show_config
fi