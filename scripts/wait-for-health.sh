#!/bin/sh

# 等待健康检查端点可用的脚本
# 用于 CI/CD 测试

set -e

HOST=${1:-localhost}
PORT=${2:-3000}
TIMEOUT=${3:-300}  # 5 分钟超时
INTERVAL=${4:-10}  # 每 10 秒检查一次

HEALTH_URL="http://${HOST}:${PORT}/api/health"

echo "Waiting for health check endpoint: $HEALTH_URL"
echo "Timeout: ${TIMEOUT}s, Check interval: ${INTERVAL}s"

elapsed=0
while [ $elapsed -lt $TIMEOUT ]; do
    if curl -f -s "$HEALTH_URL" > /dev/null 2>&1; then
        echo "✅ Health check passed after ${elapsed}s"
        
        # 显示健康检查响应
        echo "Health check response:"
        curl -s "$HEALTH_URL" | head -10
        exit 0
    fi
    
    echo "⏳ Waiting... (${elapsed}s/${TIMEOUT}s)"
    sleep $INTERVAL
    elapsed=$((elapsed + INTERVAL))
done

echo "❌ Health check failed after ${TIMEOUT}s timeout"
exit 1