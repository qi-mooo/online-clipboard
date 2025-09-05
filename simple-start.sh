#!/bin/sh

# Simple startup script for the container
set -e

echo "Starting Online Clipboard..."

# Ensure data directory exists
mkdir -p /app/data

# Run Prisma migrations
echo "Running database migrations..."
./node_modules/.bin/prisma migrate deploy

# Generate Prisma client
echo "Generating Prisma client..."
./node_modules/.bin/prisma generate

# Start the application
echo "Starting Next.js server..."
exec node server.js