#!/bin/bash

# 部署验证脚本
# 用于验证应用部署是否成功

set -e

# 配置
APP_URL=${1:-"http://localhost:3000"}
TIMEOUT=60
RETRY_INTERVAL=5

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# 等待服务启动
wait_for_service() {
    print_header "Waiting for Service to Start"
    
    local elapsed=0
    while [ $elapsed -lt $TIMEOUT ]; do
        if curl -f -s "$APP_URL/api/health" >/dev/null 2>&1; then
            print_success "Service is responding (took ${elapsed}s)"
            return 0
        fi
        
        print_info "Waiting for service... (${elapsed}s elapsed)"
        sleep $RETRY_INTERVAL
        elapsed=$((elapsed + RETRY_INTERVAL))
    done
    
    print_error "Service failed to start within ${TIMEOUT}s"
    return 1
}

# 测试健康检查端点
test_health_endpoint() {
    print_header "Testing Health Endpoint"
    
    local response
    if response=$(curl -f -s "$APP_URL/api/health"); then
        print_success "Health endpoint is working"
        
        # 解析响应
        if echo "$response" | grep -q '"status":"healthy"'; then
            print_success "Application reports healthy status"
        else
            print_warning "Application status is not healthy"
            echo "Response: $response"
        fi
        
        return 0
    else
        print_error "Health endpoint is not responding"
        return 1
    fi
}

# 测试主页
test_homepage() {
    print_header "Testing Homepage"
    
    if curl -f -s "$APP_URL/" >/dev/null; then
        print_success "Homepage is accessible"
        return 0
    else
        print_error "Homepage is not accessible"
        return 1
    fi
}

# 测试 API 端点
test_api_endpoints() {
    print_header "Testing API Endpoints"
    
    # 测试代码生成 API
    print_info "Testing code generation API..."
    if response=$(curl -f -s -X POST "$APP_URL/api/generate-code"); then
        if echo "$response" | grep -q '"code"'; then
            print_success "Code generation API is working"
        else
            print_warning "Code generation API response is unexpected"
            echo "Response: $response"
        fi
    else
        print_error "Code generation API is not working"
        return 1
    fi
    
    # 测试剪切板 API
    print_info "Testing clipboard API..."
    local test_code="test-$(date +%s)"
    local test_content="Test content for deployment verification"
    
    # 创建剪切板
    if curl -f -s -X POST "$APP_URL/api/clipboard/$test_code" \
        -H "Content-Type: application/json" \
        -d "{\"content\":\"$test_content\"}" >/dev/null; then
        print_success "Clipboard creation API is working"
    else
        print_error "Clipboard creation API is not working"
        return 1
    fi
    
    # 读取剪切板
    if response=$(curl -f -s "$APP_URL/api/clipboard/$test_code"); then
        if echo "$response" | grep -q "$test_content"; then
            print_success "Clipboard retrieval API is working"
        else
            print_warning "Clipboard retrieval API response is unexpected"
            echo "Response: $response"
        fi
    else
        print_error "Clipboard retrieval API is not working"
        return 1
    fi
    
    return 0
}

# 测试页面路由
test_page_routes() {
    print_header "Testing Page Routes"
    
    # 测试动态路由
    local test_code="test-page-$(date +%s)"
    
    print_info "Testing dynamic route: /$test_code"
    if curl -f -s "$APP_URL/$test_code" >/dev/null; then
        print_success "Dynamic route is working"
    else
        print_error "Dynamic route is not working"
        return 1
    fi
    
    return 0
}

# 测试数据库连接
test_database() {
    print_header "Testing Database Connection"
    
    # 通过健康检查端点验证数据库
    if response=$(curl -f -s "$APP_URL/api/health"); then
        if echo "$response" | grep -q '"database":"connected"'; then
            print_success "Database connection is working"
            return 0
        else
            print_warning "Database connection status is unclear"
            echo "Response: $response"
            return 1
        fi
    else
        print_error "Cannot verify database connection"
        return 1
    fi
}

# 性能测试
test_performance() {
    print_header "Basic Performance Test"
    
    print_info "Testing response time..."
    
    local start_time=$(date +%s%N)
    if curl -f -s "$APP_URL/" >/dev/null; then
        local end_time=$(date +%s%N)
        local response_time=$(((end_time - start_time) / 1000000))
        
        if [ $response_time -lt 1000 ]; then
            print_success "Response time is good: ${response_time}ms"
        elif [ $response_time -lt 3000 ]; then
            print_warning "Response time is acceptable: ${response_time}ms"
        else
            print_warning "Response time is slow: ${response_time}ms"
        fi
    else
        print_error "Performance test failed"
        return 1
    fi
    
    return 0
}

# 安全测试
test_security() {
    print_header "Basic Security Test"
    
    print_info "Testing security headers..."
    
    local headers
    if headers=$(curl -I -s "$APP_URL/"); then
        # 检查安全头部
        if echo "$headers" | grep -qi "x-frame-options"; then
            print_success "X-Frame-Options header is present"
        else
            print_warning "X-Frame-Options header is missing"
        fi
        
        if echo "$headers" | grep -qi "x-content-type-options"; then
            print_success "X-Content-Type-Options header is present"
        else
            print_warning "X-Content-Type-Options header is missing"
        fi
        
        return 0
    else
        print_error "Security test failed"
        return 1
    fi
}

# 生成测试报告
generate_report() {
    print_header "Deployment Verification Report"
    
    echo "Application URL: $APP_URL"
    echo "Test Date: $(date)"
    echo "Test Duration: ${SECONDS}s"
    echo ""
    
    if [ $TOTAL_TESTS -eq $PASSED_TESTS ]; then
        print_success "All tests passed ($PASSED_TESTS/$TOTAL_TESTS)"
        echo ""
        print_success "🎉 Deployment verification completed successfully!"
        print_info "Your application is ready to use at: $APP_URL"
    else
        print_warning "Some tests failed ($PASSED_TESTS/$TOTAL_TESTS passed)"
        echo ""
        print_warning "⚠️  Deployment verification completed with warnings"
        print_info "Please review the failed tests above"
    fi
}

# 运行测试
run_test() {
    local test_name=$1
    local test_function=$2
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if $test_function; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        return 1
    fi
}

# 主函数
main() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                 Deployment Verification Tool                 ║"
    echo "║                     Online Clipboard App                     ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # 初始化计数器
    TOTAL_TESTS=0
    PASSED_TESTS=0
    
    # 运行测试
    run_test "Service Startup" wait_for_service
    run_test "Health Endpoint" test_health_endpoint
    run_test "Homepage" test_homepage
    run_test "API Endpoints" test_api_endpoints
    run_test "Page Routes" test_page_routes
    run_test "Database Connection" test_database
    run_test "Performance" test_performance
    run_test "Security" test_security
    
    # 生成报告
    generate_report
    
    # 返回适当的退出码
    if [ $TOTAL_TESTS -eq $PASSED_TESTS ]; then
        exit 0
    else
        exit 1
    fi
}

# 显示帮助
show_help() {
    echo "Deployment Verification Tool"
    echo ""
    echo "Usage: $0 [APP_URL]"
    echo ""
    echo "Arguments:"
    echo "  APP_URL    Application URL to test (default: http://localhost:3000)"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Test localhost"
    echo "  $0 http://localhost:3000              # Test specific local URL"
    echo "  $0 https://your-domain.com            # Test production URL"
    echo ""
    echo "Environment Variables:"
    echo "  TIMEOUT         Timeout in seconds (default: 60)"
    echo "  RETRY_INTERVAL  Retry interval in seconds (default: 5)"
}

# 处理命令行参数
case "${1:-}" in
    -h|--help|help)
        show_help
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac