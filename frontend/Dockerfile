# Build context: repo root (so pnpm workspace files are visible)
# Build from repo root: docker build -f frontend/Dockerfile -t frontend .

FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY frontend/package.json ./frontend/

RUN pnpm install --frozen-lockfile --filter frontend...

COPY frontend ./frontend
RUN pnpm --filter frontend run build

FROM nginx:alpine AS runtime
RUN apk add --no-cache apache2-utils gettext
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf.template
COPY frontend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
