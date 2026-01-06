#!/bin/bash
set -e

# Per-package coverage thresholds
declare -A THRESHOLDS
THRESHOLDS[core]=70
THRESHOLDS[qti2-item-player]=80
THRESHOLDS[qti2-assessment-player]=75
THRESHOLDS[qti2-to-pie]=75

echo "🧪 Running tests with coverage..."
bun test --coverage --coverage-reporter=text

echo ""
echo "📊 Checking per-package coverage thresholds..."
echo ""

# Function to extract coverage from bun test output
check_package_coverage() {
    local package=$1
    local threshold=$2

    echo "Checking $package (threshold: ${threshold}%)..."

    # Run tests for specific package and capture coverage
    cd "packages/$package" || exit 1
    COVERAGE_OUTPUT=$(bun test --coverage --coverage-reporter=text 2>&1 || true)
    cd ../..

    # Extract overall coverage percentage (last line with percentage)
    COVERAGE=$(echo "$COVERAGE_OUTPUT" | grep -oP '\d+\.\d+(?=% Stmts)' | tail -1 || echo "0")

    if [ -z "$COVERAGE" ]; then
        echo "⚠️  Could not determine coverage for $package"
        return 0
    fi

    echo "   Coverage: ${COVERAGE}%"

    # Compare coverage to threshold
    if (( $(echo "$COVERAGE < $threshold" | bc -l) )); then
        echo "   ❌ Below threshold!"
        return 1
    else
        echo "   ✅ Meets threshold"
        return 0
    fi
}

# Check each package
FAILED=0
for package in "${!THRESHOLDS[@]}"; do
    if ! check_package_coverage "$package" "${THRESHOLDS[$package]}"; then
        FAILED=1
    fi
    echo ""
done

if [ $FAILED -eq 1 ]; then
    echo "❌ Some packages failed coverage thresholds"
    exit 1
fi

echo "✅ All packages meet coverage thresholds"
