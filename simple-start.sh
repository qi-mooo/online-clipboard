#!/bin/sh

# Simple startup script for the container
set -e

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Online Clipboard..."

# Ensure data directory exists
mkdir -p /app/data
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Data directory ready"

# Run Prisma migrations
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running database migrations..."
./node_modules/.bin/prisma migrate deploy

# Generate Prisma client (should already be generated, but ensure it's up to date)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Verifying Prisma client..."
./node_modules/.bin/prisma generate

# Verify database connection
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Verifying database connection..."
if echo "SELECT 1;" | ./node_modules/.bin/prisma db execute --stdin > /dev/null 2>&1; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Database connection verified"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: Database connection test failed, but continuing..."
fi

# Start the application
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Next.js server on port ${PORT:-3000}..."
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health check will be available at http://localhost:${PORT:-3000}/api/health"

exec node server.js