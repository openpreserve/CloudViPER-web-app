#!/bin/bash

# Test runner for new logging features
# This script runs all the tests for the enhanced logging functionality

echo "🧪 Running Enhanced Logging Feature Tests"
echo "========================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to run a specific test and capture results
run_test() {
    local test_file=$1
    local test_name=$2
    
    echo -e "${BLUE}📋 Running: ${test_name}${NC}"
    
    if npm test -- --testPathPattern="$test_file" --verbose; then
        echo -e "${GREEN}✅ PASSED: ${test_name}${NC}"
        return 0
    else
        echo -e "${RED}❌ FAILED: ${test_name}${NC}"
        return 1
    fi
}

# Initialize counters
total_tests=0
passed_tests=0
failed_tests=0

echo -e "${YELLOW}📊 Starting test execution...${NC}"
echo ""

# Test 1: Logger Configuration Tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
((total_tests++))
if run_test "test/unit/config/logger.test.ts" "Logger Configuration"; then
    ((passed_tests++))
else
    ((failed_tests++))
fi
echo ""

# Test 2: Account Logging Tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
((total_tests++))
if run_test "test/unit/logging/accountLogging.test.ts" "Account Route Logging"; then
    ((passed_tests++))
else
    ((failed_tests++))
fi
echo ""

# Test 3: Service Logging Tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
((total_tests++))
if run_test "test/unit/logging/serviceLogging.test.ts" "Service Route Logging"; then
    ((passed_tests++))
else
    ((failed_tests++))
fi
echo ""

# Test 4: Log Viewer Component Tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
((total_tests++))
if run_test "test/unit/components/logViewer.test.ts" "Log Viewer Component"; then
    ((passed_tests++))
else
    ((failed_tests++))
fi
echo ""

# Summary
echo "🎯 TEST EXECUTION SUMMARY"
echo "========================="
echo -e "Total Tests: ${BLUE}$total_tests${NC}"
echo -e "Passed: ${GREEN}$passed_tests${NC}"
echo -e "Failed: ${RED}$failed_tests${NC}"

if [ $failed_tests -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All logging feature tests passed successfully!${NC}"
    echo -e "${GREEN}✨ The enhanced logging system is ready for production.${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}⚠️  Some tests failed. Please review the output above.${NC}"
    echo -e "${YELLOW}🔧 Fix the failing tests before deploying the logging features.${NC}"
    exit 1
fi
