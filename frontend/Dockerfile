# syntax=docker/dockerfile:1
# ── Сборка SPA ───────────────────────────────────────────────────────────────
# Vite 7 требует Node ^20.19 || >=22.12.
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
# --ignore-scripts: install-скрипты пакетов не выполняются (так распространялся
# червь Shai-Hulud в npm, 2025). Сборке они не нужны.
RUN npm ci --ignore-scripts
COPY . .
ARG VITE_SENTRY_DSN=""
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
RUN npm run build

# ── Раздача статики ──────────────────────────────────────────────────────────
# nginx-unprivileged: мастер-процесс не от root, слушает 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
