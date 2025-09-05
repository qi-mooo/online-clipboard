# 多阶段构建 - 构建阶段
FROM node:18-alpine AS builder

# 安装构建依赖
RUN apk add --no-cache libc6-compat

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制 Prisma schema
COPY prisma ./prisma

# 生成 Prisma 客户端
RUN npx prisma generate

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 生产阶段
FROM node:18-alpine AS runner

# 安装必要的系统依赖
RUN apk add --no-cache libc6-compat dumb-init

# 设置工作目录
WORKDIR /app

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 创建必要的目录并设置权限
RUN mkdir -p /app/data /app/logs /app/tmp && \
    chown -R nextjs:nodejs /app/data /app/logs /app/tmp

# 从构建阶段复制构建产物
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 复制运行时需要的 node_modules（从构建阶段）
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# 复制 Prisma schema
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# 复制脚本文件
COPY --chown=nextjs:nodejs scripts ./scripts
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
COPY --chown=nextjs:nodejs simple-start.sh ./
RUN chmod +x docker-entrypoint.sh scripts/*.sh simple-start.sh

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 设置默认环境变量
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/data/clipboard.db"

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD /app/scripts/health-check.sh quick || exit 1

# 使用 dumb-init 启动应用以正确处理信号
ENTRYPOINT ["dumb-init", "--"]
CMD ["./simple-start.sh"]