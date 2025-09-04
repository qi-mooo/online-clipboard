# 使用官方 Node.js 18 Alpine 镜像作为运行时基础镜像
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

# 复制本地构建的产物（需要先在本地运行 npm run build）
COPY --chown=nextjs:nodejs .next/standalone ./
COPY --chown=nextjs:nodejs .next/static ./.next/static
COPY --chown=nextjs:nodejs public ./public

# 复制 Prisma 相关文件
COPY --chown=nextjs:nodejs prisma ./prisma
COPY --chown=nextjs:nodejs node_modules/.prisma ./node_modules/.prisma
COPY --chown=nextjs:nodejs node_modules/@prisma ./node_modules/@prisma

# 复制脚本文件
COPY --chown=nextjs:nodejs scripts ./scripts
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh scripts/*.sh

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
CMD ["./docker-entrypoint.sh"]