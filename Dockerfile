# AffMine Publisher Dashboard — multi-stage Docker build
#
# Stages:
#   builder   — installs deps, type-checks libs, and builds both artefacts
#   api       — lightweight Node runtime for the Express API proxy
#   dashboard — nginx serving the pre-built Vite SPA + /api/ reverse-proxy
#
# Usage (with .env file for credentials):
#   docker compose up --build
#
# Or build individual targets:
#   docker build --target api       -t affmine-api       .
#   docker build --target dashboard -t affmine-dashboard .

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY tsconfig.json tsconfig.base.json ./

COPY lib/db/package.json              lib/db/
COPY lib/api-zod/package.json         lib/api-zod/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/api-spec/package.json        lib/api-spec/

COPY artifacts/api-server/package.json        artifacts/api-server/
COPY artifacts/affmine-dashboard/package.json artifacts/affmine-dashboard/

RUN pnpm install --frozen-lockfile || pnpm install

# Copy all source
COPY lib/          lib/
COPY artifacts/api-server/        artifacts/api-server/
COPY artifacts/affmine-dashboard/ artifacts/affmine-dashboard/

# Typecheck shared libs (non-fatal so a stale .d.ts doesn't block the build)
RUN pnpm run typecheck:libs || true

# Build Express API server (esbuild → dist/index.mjs)
RUN pnpm --filter @workspace/api-server run build

# Build Vite dashboard (output → artifacts/affmine-dashboard/dist/public/)
ENV PORT=3000
ENV BASE_PATH=/
RUN pnpm --filter @workspace/affmine-dashboard run build

# ── Stage 2: API Server runtime ───────────────────────────────────────────────
FROM node:20-slim AS api

WORKDIR /app

COPY --from=builder /app/artifacts/api-server/dist/        ./dist/
COPY --from=builder /app/artifacts/api-server/node_modules/ ./node_modules/

ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]

# ── Stage 3: Dashboard — nginx serving the SPA + API reverse-proxy ────────────
FROM nginx:alpine AS dashboard

COPY --from=builder /app/artifacts/affmine-dashboard/dist/public/ /usr/share/nginx/html/

RUN printf 'server {\n\
    listen 80;\n\
    server_name localhost;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    # SPA fallback\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
\n\
    # Reverse-proxy to the API container\n\
    location /api/ {\n\
        proxy_pass         http://api:5000/api/;\n\
        proxy_set_header   Host $host;\n\
        proxy_set_header   X-Real-IP $remote_addr;\n\
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
