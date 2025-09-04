#!/bin/sh

# 数据库初始化脚本
# 用于容器启动时自动初始化数据库

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# 检查环境变量
check_environment() {
    log_info "Checking environment variables..."
    
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL environment variable is not set"
        exit 1
    fi
    
    log_success "Environment variables validated"
}

# 创建数据目录
create_data_directory() {
    log_info "Creating data directory..."
    
    DATA_DIR="/app/data"
    
    if [ ! -d "$DATA_DIR" ]; then
        mkdir -p "$DATA_DIR"
        log_success "Data directory created: $DATA_DIR"
    else
        log_info "Data directory already exists: $DATA_DIR"
    fi
    
    # 设置权限
    chown -R nextjs:nodejs "$DATA_DIR" 2>/dev/null || true
    chmod 755 "$DATA_DIR"
    
    log_success "Data directory permissions set"
}

# 检查数据库文件
check_database_file() {
    log_info "Checking database file..."
    
    DB_FILE="/app/data/clipboard.db"
    
    if [ -f "$DB_FILE" ]; then
        log_info "Database file exists: $DB_FILE"
        
        # 检查文件大小
        DB_SIZE=$(stat -f%z "$DB_FILE" 2>/dev/null || stat -c%s "$DB_FILE" 2>/dev/null || echo "0")
        log_info "Database file size: ${DB_SIZE} bytes"
        
        # 检查文件权限
        DB_PERMS=$(ls -la "$DB_FILE" | awk '{print $1}')
        log_info "Database file permissions: $DB_PERMS"
        
        return 0
    else
        log_warning "Database file does not exist: $DB_FILE"
        return 1
    fi
}

# 运行数据库迁移
run_migrations() {
    log_info "Running database migrations..."
    
    # 检查 Prisma 是否可用
    if ! command -v npx >/dev/null 2>&1; then
        log_error "npx command not found"
        exit 1
    fi
    
    # 生成 Prisma 客户端
    log_info "Generating Prisma client..."
    if npx prisma generate; then
        log_success "Prisma client generated successfully"
    else
        log_error "Failed to generate Prisma client"
        exit 1
    fi
    
    # 运行迁移
    log_info "Applying database migrations..."
    if npx prisma migrate deploy; then
        log_success "Database migrations applied successfully"
    else
        log_error "Failed to apply database migrations"
        exit 1
    fi
}

# 验证数据库连接
verify_database_connection() {
    log_info "Verifying database connection..."
    
    # 尝试连接数据库
    if echo "SELECT 1;" | npx prisma db execute --stdin >/dev/null 2>&1; then
        log_success "Database connection verified"
    else
        log_error "Database connection failed"
        exit 1
    fi
    
    # 检查表结构
    log_info "Checking database schema..."
    if echo "SELECT name FROM sqlite_master WHERE type='table';" | npx prisma db execute --stdin >/dev/null 2>&1; then
        log_success "Database schema validated"
    else
        log_warning "Database schema validation failed"
    fi
}

# 创建初始数据 (可选)
create_initial_data() {
    log_info "Checking for initial data..."
    
    # 检查是否需要创建示例数据
    if [ "$CREATE_SAMPLE_DATA" = "true" ]; then
        log_info "Creating sample clipboard data..."
        
        # 使用 Prisma 创建示例数据
        cat << EOF | npx prisma db execute --stdin
INSERT OR IGNORE INTO clipboards (id, code, content, createdAt, updatedAt, lastAccessed)
VALUES (
    'sample001',
    'welcome',
    'Welcome to Online Clipboard!\n\nThis is a sample clipboard. You can edit this content and it will be automatically saved.\n\nTry creating your own clipboard by visiting the homepage.',
    datetime('now'),
    datetime('now'),
    datetime('now')
);
EOF
        
        if [ $? -eq 0 ]; then
            log_success "Sample data created successfully"
        else
            log_warning "Failed to create sample data (may already exist)"
        fi
    else
        log_info "Skipping sample data creation"
    fi
}

# 设置数据库优化
optimize_database() {
    log_info "Optimizing database settings..."
    
    # SQLite 优化设置
    cat << EOF | npx prisma db execute --stdin
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 1000;
PRAGMA foreign_keys = ON;
PRAGMA temp_store = MEMORY;
EOF
    
    if [ $? -eq 0 ]; then
        log_success "Database optimization applied"
    else
        log_warning "Database optimization failed"
    fi
}

# 清理旧数据 (可选)
cleanup_old_data() {
    if [ "$CLEANUP_ON_START" = "true" ]; then
        log_info "Cleaning up old data..."
        
        CLEANUP_DAYS=${CLEANUP_INTERVAL_DAYS:-30}
        
        cat << EOF | npx prisma db execute --stdin
DELETE FROM clipboards 
WHERE lastAccessed < datetime('now', '-${CLEANUP_DAYS} days');
EOF
        
        if [ $? -eq 0 ]; then
            log_success "Old data cleanup completed"
        else
            log_warning "Old data cleanup failed"
        fi
    fi
}

# 主初始化函数
main() {
    log_info "Starting database initialization..."
    
    # 执行初始化步骤
    check_environment
    create_data_directory
    
    if check_database_file; then
        log_info "Database exists, checking for migrations..."
        run_migrations
    else
        log_info "Database does not exist, creating new database..."
        run_migrations
        create_initial_data
    fi
    
    verify_database_connection
    optimize_database
    cleanup_old_data
    
    log_success "Database initialization completed successfully"
    
    # 输出数据库信息
    log_info "Database information:"
    DB_FILE="/app/data/clipboard.db"
    if [ -f "$DB_FILE" ]; then
        DB_SIZE=$(stat -f%z "$DB_FILE" 2>/dev/null || stat -c%s "$DB_FILE" 2>/dev/null || echo "0")
        log_info "  - File: $DB_FILE"
        log_info "  - Size: ${DB_SIZE} bytes"
        log_info "  - URL: $DATABASE_URL"
    fi
}

# 错误处理
trap 'log_error "Database initialization failed"; exit 1' ERR

# 运行主函数
main "$@"