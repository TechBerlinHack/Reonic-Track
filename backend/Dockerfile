# Build context: repo root (so pnpm workspace files are visible)
# Build from repo root: docker build -f backend/Dockerfile -t backend .

FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate
WORKDIR /app

# Workspace manifest + lockfile
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY backend/package.json ./backend/

# Install backend + its workspace dependencies only
RUN pnpm install --frozen-lockfile --filter backend...

# Copy backend source and build
COPY backend ./backend
RUN pnpm --filter backend run build

# Produce a self-contained deployable directory with prod-only node_modules
RUN pnpm --filter backend --prod deploy /deploy

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=builder /deploy /app

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/main.js"]
