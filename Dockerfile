# Dockerfile padrão para projetos Node.js/TypeScript
# Multi-stage, non-root, otimizado para Windows Server 2025 (baixa RAM)
FROM node:20-alpine AS builder
WORKDIR /app

# Dependências primeiro (cache de camada)
COPY package.json package-lock.json* ./
RUN npm ci

# Build (se aplicável)
COPY . .
RUN npm run build 2>/dev/null || echo "No build script"

# Runtime stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Non-root user
RUN adduser -D -u 10000 appuser

# Apenas deps de produção
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copiar artefatos de build
COPY --from=builder /app/dist ./dist 2>/dev/null || true
COPY --from=builder /app/build ./build 2>/dev/null || true
COPY --from=builder /app/public ./public 2>/dev/null || true
COPY --from=builder /app/src ./src 2>/dev/null || true

# Healthcheck genérico
EXPOSE 3000

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health 2>/dev/null || \
        wget --no-verbose --tries=1 --spider http://localhost:3000/ 2>/dev/null || exit 1

CMD ["node", "dist/index.js"]