# Renewable Design Studio

pnpm monorepo with two deployable services on Google Cloud Run:

- **backend** — NestJS, all endpoints in [backend/src/api.controller.ts](backend/src/api.controller.ts). LLM agent built with [Mastra](https://mastra.ai/) on Gemini 2.5 Flash via the Vercel AI SDK.
- **frontend** — Vite + React 18 + Tailwind + shadcn/ui SPA, three routes: `/`, `/installer`, `/homeowner`.

The original static prototype is preserved in [README-discovery.md](README-discovery.md), [viewer.html](viewer.html), [DATA_MODELS.md](DATA_MODELS.md), [Project Data/](Project%20Data/) and [Exp 3D-Modells/](Exp%203D-Modells/).

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 20 (`.nvmrc` pins 20) |
| pnpm | 10.15.1 (`packageManager` in root `package.json`) |
| Docker | only for image builds / Cloud Run deploys |
| `gcloud` CLI | only for deployment |

Enable pnpm via corepack if you don't have it:

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
```

---

## Setup

```bash
pnpm install
cp backend/.env.example backend/.env
# edit backend/.env and set GOOGLE_GENERATIVE_AI_API_KEY (from https://aistudio.google.com/apikey)
```

---

## Local development

Run both apps in parallel from the repo root:

```bash
pnpm dev
```

- Backend: http://localhost:8080 (`/api/health`, `/api/installer/submit`, `/api/chat`)
- Frontend: http://localhost:5173 (Vite proxies `/api/*` → `http://localhost:8080`)

Run them individually:

```bash
pnpm dev:backend
pnpm dev:frontend
```

Probe the API:

```bash
curl http://localhost:8080/api/health
```

---

## Build

```bash
pnpm build                  # builds both
pnpm build:backend          # → backend/dist/
pnpm build:frontend         # → frontend/dist/
```

Run the production backend bundle locally:

```bash
node backend/dist/main.js
```

Preview the production frontend bundle locally:

```bash
pnpm --filter frontend run preview
```

---

## Environment variables

### backend (`backend/.env`)

| Variable | Required | Notes |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | yes (for `/api/chat`) | Google AI Studio key, used by `@ai-sdk/google` |
| `PORT` | no | Defaults to `8080` (Cloud Run injects this automatically) |
| `FRONTEND_ORIGIN` | no | CORS origin, defaults to `http://localhost:5173` |

### frontend (runtime, injected into the Docker container — never committed)

| Variable | Required | Notes |
|---|---|---|
| `BACKEND_URL` | yes (production) | Full origin of the backend, e.g. `https://backend-573178651363.europe-west1.run.app`. Used by nginx to proxy `/api/*`. |
| `BASIC_AUTH_USER` | yes (production) | Basic-auth username served by nginx. |
| `BASIC_AUTH_PASS` | yes (production) | Basic-auth password served by nginx. |
| `INTERNAL_TOKEN` | yes (production) | Shared secret forwarded to the backend as `X-Internal-Token`. Must match the value set on the backend service. |

These are consumed by `frontend/entrypoint.sh` at container startup — they are never baked into the image.

---

## Repository layout

```
.
├── backend/                 # NestJS service
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   └── api.controller.ts   # all endpoints + Mastra agent
│   ├── Dockerfile              # multi-stage, pnpm deploy → node:20-alpine runtime
│   └── .env.example
├── frontend/                # Vite React SPA
│   ├── src/
│   │   ├── pages/{Home,Installer,Homeowner}.tsx
│   │   └── components/ui/      # shadcn/ui components
│   ├── Dockerfile              # multi-stage, nginx:alpine runtime
│   ├── nginx.conf              # basic auth + /api proxy + SPA fallback (template, envsubst at startup)
│   └── entrypoint.sh           # generates .htpasswd, runs envsubst on nginx.conf, starts nginx
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── viewer.html              # legacy static prototype (untouched)
├── DATA_MODELS.md           # legacy data model docs (untouched)
└── README-discovery.md      # legacy hackathon README (untouched)
```

---

## Live deployment

| Service | URL |
|---|---|
| Frontend | `https://frontend-573178651363.europe-west1.run.app` |
| Backend | `https://backend-573178651363.europe-west1.run.app` |

- **GCP project:** `bigberlin-hack26ber-3135`
- **Region:** `europe-west1`
- **Artifact Registry:** `europe-west1-docker.pkg.dev/bigberlin-hack26ber-3135/hackathon/`

The frontend is protected by HTTP basic auth. Credentials are **not stored in this repo** — they are injected as Cloud Run environment variables at deploy time (see [Deploy the frontend](#deploy-the-frontend) below).

---

## How the production wiring works

In production the Vite dev proxy is gone. Instead, the frontend nginx container proxies `/api/*` directly to the backend Cloud Run URL at runtime. The architecture is:

```
Browser → frontend Cloud Run (nginx, port 8080)
              ├── /*         → serves static React SPA
              └── /api/*     → proxy_pass to backend Cloud Run (HTTPS + SNI)
```

nginx reads env vars injected by Cloud Run at startup:

| Env var | Purpose |
|---|---|
| `BACKEND_URL` | Full backend origin, e.g. `https://backend-573178651363.europe-west1.run.app` |
| `BASIC_AUTH_USER` | Basic-auth username — **do not commit** |
| `BASIC_AUTH_PASS` | Basic-auth password — **do not commit** |
| `INTERNAL_TOKEN` | Shared secret added to every proxied request as `X-Internal-Token` — **do not commit** |

The backend validates `X-Internal-Token` on every endpoint except `GET /api/health`. Requests hitting the backend URL directly without the correct token get a `401`. The token is identical on both services and is never stored in the repo.

---

## Deploy to Google Cloud Run

All images must be built for `linux/amd64` (Cloud Run), even on Apple Silicon:

```bash
export DOCKER_BUILD_FLAGS="--platform=linux/amd64"
```

### One-time GCP setup

```bash
export GCP_PROJECT=bigberlin-hack26ber-3135
export GCP_REGION=europe-west1
export AR_HOST="$GCP_REGION-docker.pkg.dev"
export AR_REPO="$AR_HOST/$GCP_PROJECT/hackathon"

gcloud config set project "$GCP_PROJECT"
gcloud auth login
gcloud auth configure-docker "$AR_HOST"

gcloud services enable run.googleapis.com artifactregistry.googleapis.com
```

### Deploy the backend

```bash
# Build and push
docker build $DOCKER_BUILD_FLAGS -f backend/Dockerfile -t "$AR_REPO/backend:latest" .
docker push "$AR_REPO/backend:latest"

# Deploy
gcloud run deploy backend \
  --image "$AR_REPO/backend:latest" \
  --region "$GCP_REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "GOOGLE_GENERATIVE_AI_API_KEY=<your-gemini-key>,FRONTEND_ORIGIN=https://frontend-573178651363.europe-west1.run.app,INTERNAL_TOKEN=<same-random-token>" \
  --project "$GCP_PROJECT"
```

The backend URL is printed at the end (`Service URL: ...`). Note it — you need it for the frontend deploy.

### Deploy the frontend

The frontend container reads `BASIC_AUTH_USER`, `BASIC_AUTH_PASS`, and `BACKEND_URL` at startup — **never put real credentials in the `--set-env-vars` flag in shell history or CI logs**. Use Secret Manager or set them interactively:

```bash
# Build and push
docker build $DOCKER_BUILD_FLAGS -f frontend/Dockerfile -t "$AR_REPO/frontend:latest" .
docker push "$AR_REPO/frontend:latest"

# Deploy — substitute real values, do not commit them
gcloud run deploy frontend \
  --image "$AR_REPO/frontend:latest" \
  --region "$GCP_REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "BACKEND_URL=https://backend-573178651363.europe-west1.run.app,BASIC_AUTH_USER=<username>,BASIC_AUTH_PASS=<password>,INTERNAL_TOKEN=<same-random-token>" \
  --project "$GCP_PROJECT"
```

> **Keeping credentials out of history:** prefix the command with a space (zsh/bash `HISTCONTROL=ignorespace`) or use `--env-vars-file` pointing to a local file excluded by `.gitignore`.

### Updating a service

Rebuild and push the image, then re-run the same `gcloud run deploy` command — Cloud Run will roll out the new revision with zero downtime.

```bash
# Example: update the backend after code change
docker build $DOCKER_BUILD_FLAGS -f backend/Dockerfile -t "$AR_REPO/backend:latest" .
docker push "$AR_REPO/backend:latest"
gcloud run deploy backend \
  --image "$AR_REPO/backend:latest" \
  --region "$GCP_REGION" \
  --project "$GCP_PROJECT"
```

Cloud Run reuses the env vars from the existing service revision — you only need to pass `--set-env-vars` again if you're changing them.

### Local Docker smoke test

```bash
# Backend
docker build -f backend/Dockerfile -t backend:local .
docker run --rm -p 8080:8080 -e GOOGLE_GENERATIVE_AI_API_KEY=<your-key> backend:local

# Frontend (requires a running backend)
docker build -f frontend/Dockerfile -t frontend:local .
docker run --rm -p 8081:8080 \
  -e BACKEND_URL=http://host.docker.internal:8080 \
  -e BASIC_AUTH_USER=hackathon \
  -e BASIC_AUTH_PASS=berlin \
  frontend:local
# Open http://localhost:8081
```

---

## API surface

All endpoints live in [backend/src/api.controller.ts](backend/src/api.controller.ts).

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/health` | — | Liveness probe |
| POST | `/api/installer/submit` | `ProjectInput` (see [DATA_MODELS.md](DATA_MODELS.md)) | Returns a stub `DesignRecommendation` until the sizing engine from `viewer.html` is ported |
| POST | `/api/chat` | `{ messages: UIMessage[] }` | Streams the Mastra `homeowner-advisor` agent in the AI-SDK data-stream protocol; consumed by `useChat` from `@ai-sdk/react` |
