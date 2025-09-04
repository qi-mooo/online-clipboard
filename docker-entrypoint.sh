#!/bin/sh

# Docker 容器启动脚本
# 用于初始化数据库和启动应用

set -e

# 记录启动时间
START_TIME=$(date +%s)

# 加载启动日志记录器
if [ -f "/app/scripts/startup-logger.sh" ]; then
    . /app/scripts/startup-logger.sh
else
    # 简单的日志函数作为后备
    log_with_timestamp() {
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$1] $2"
    }
fi

log_with_timestamp "INFO" "🚀 Starting Online Clipboard container..."

# 步骤 1: 系统信息记录
log_startup_step "1" "Recording system information"
log_system_info
log_environment_variables
log_application_config

# 步骤 2: 权限和目录设置
log_startup_step "2" "Setting up directories and permissions"

# 检查目录是否存在（目录应该在构建时已创建）
for dir in "/app/data" "/app/logs" "/app/tmp"; do
    if [ ! -d "$dir" ]; then
        log_with_timestamp "WARNING" "Directory not found: $dir (should be created during build)"
    else
        log_with_timestamp "INFO" "Directory exists: $dir"
    fi
done

# 确保目录权限正确（静默失败，因为可能已经是正确的用户）
chmod 755 /app/data /app/logs /app/tmp 2>/dev/null || true

log_with_timestamp "SUCCESS" "Directories and permissions configured"

# 步骤 3: 环境变量验证
log_startup_step "3" "Validating environment variables"

if [ -z "$DATABASE_URL" ]; then
    log_startup_error "DATABASE_URL environment variable is not set"
fi

if [ -z "$NODE_ENV" ]; then
    log_with_timestamp "WARNING" "NODE_ENV not set, defaulting to production"
    export NODE_ENV=production
fi

log_with_timestamp "SUCCESS" "Environment variables validated"

# 步骤 4: 数据库初始化
log_startup_step "4" "Initializing database"

# 运行数据库初始化脚本
if [ -f "/app/scripts/init-db.sh" ]; then
    log_with_timestamp "INFO" "Running database initialization script"
    chmod +x /app/scripts/init-db.sh
    /app/scripts/init-db.sh
else
    log_with_timestamp "WARNING" "Database initialization script not found, using fallback"
    
    # 后备数据库初始化
    if [ ! -f "/app/data/clipboard.db" ]; then
        log_with_timestamp "INFO" "Database not found, creating new database"
        npx prisma migrate deploy
    else
        log_with_timestamp "INFO" "Database found, applying migrations"
        npx prisma migrate deploy
    fi
    
    # 生成 Prisma 客户端
    log_with_timestamp "INFO" "Generating Prisma client"
    npx prisma generate
    
    # 验证数据库连接
    if echo "SELECT 1;" | npx prisma db execute --stdin > /dev/null 2>&1; then
        log_with_timestamp "SUCCESS" "Database connection verified"
    else
        log_startup_error "Database connection failed"
    fi
fi

# 步骤 5: 应用预检查
log_startup_step "5" "Performing application pre-checks"

# 检查端口可用性
PORT_TO_CHECK=${PORT:-3000}
if netstat -tuln 2>/dev/null | grep -q ":$PORT_TO_CHECK "; then
    log_with_timestamp "WARNING" "Port $PORT_TO_CHECK is already in use"
fi

# 检查必要文件
REQUIRED_FILES="/app/package.json /app/next.config.js"
for file in $REQUIRED_FILES; do
    if [ ! -f "$file" ]; then
        log_startup_error "Required file not found: $file"
    fi
done

log_with_timestamp "SUCCESS" "Application pre-checks completed"

# 步骤 6: 健康检查准备
log_startup_step "6" "Preparing health check endpoint"

# 确保健康检查端点存在
if [ ! -f "/app/src/app/api/health/route.ts" ]; then
    log_with_timestamp "WARNING" "Health check endpoint not found"
fi

# 步骤 7: 最终启动准备
log_startup_step "7" "Final startup preparation"

# 记录启动信息
log_with_timestamp "INFO" "📊 Container startup information:"
log_with_timestamp "INFO" "  - Node.js version: $(node --version)"
log_with_timestamp "INFO" "  - NPM version: $(npm --version)"
log_with_timestamp "INFO" "  - Database URL: $DATABASE_URL"
log_with_timestamp "INFO" "  - Port: ${PORT:-3000}"
log_with_timestamp "INFO" "  - Environment: ${NODE_ENV:-production}"
log_with_timestamp "INFO" "  - Hostname: ${HOSTNAME:-0.0.0.0}"

# 清理临时文件
rm -rf /app/tmp/* 2>/dev/null || true

# 记录启动完成
log_startup_complete "$START_TIME"

log_with_timestamp "SUCCESS" "🎯 All initialization steps completed, starting application..."

# 如果是启动应用服务器，则监控启动过程
if [ "$1" = "node" ] && [ "$2" = "server.js" ]; then
    log_with_timestamp "INFO" "Starting application server with monitoring"
    
    # 在后台启动应用
    exec "$@" &
    APP_PID=$!
    
    # 监控启动过程
    if monitor_startup "$APP_PID"; then
        log_with_timestamp "SUCCESS" "Application started successfully (PID: $APP_PID)"
        wait $APP_PID
    else
        log_startup_error "Application failed to start properly"
    fi
else
    # 直接执行命令
    log_with_timestamp "INFO" "Executing command: $*"
    exec "$@"
fi