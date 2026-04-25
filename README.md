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

### frontend

No required env vars. In production behind a single domain, the frontend hits `/api/*` on its own origin (configure your load balancer / reverse proxy or frontend nginx accordingly).

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
│   └── nginx.conf              # SPA fallback to index.html
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── viewer.html              # legacy static prototype (untouched)
├── DATA_MODELS.md           # legacy data model docs (untouched)
└── README-discovery.md      # legacy hackathon README (untouched)
```

---

## Deploy to Google Cloud Run

Both services target Cloud Run. Each Dockerfile is built **from the repo root** so it can see the pnpm workspace files.

### One-time GCP setup

```bash
# pick your project + region
export GCP_PROJECT=your-project-id
export GCP_REGION=europe-west1
export AR_REPO=renewable-design

gcloud config set project "$GCP_PROJECT"
gcloud auth login
gcloud auth configure-docker "$GCP_REGION-docker.pkg.dev"

# enable APIs
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com

# create an Artifact Registry repo to host images
gcloud artifacts repositories create "$AR_REPO" \
  --repository-format=docker \
  --location="$GCP_REGION" \
  --description="Renewable Design Studio images"
```

Store the Gemini key in Secret Manager (recommended) so the backend doesn't need it baked into the image:

```bash
gcloud services enable secretmanager.googleapis.com
printf '%s' 'YOUR_GEMINI_KEY' | gcloud secrets create google-generative-ai-api-key --data-file=-

# allow the default Cloud Run service account to read it
PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT" --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding google-generative-ai-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor
```

### Deploy the backend

From the repo root:

```bash
# build + push
gcloud builds submit \
  --tag "$GCP_REGION-docker.pkg.dev/$GCP_PROJECT/$AR_REPO/backend:latest" \
  --file backend/Dockerfile \
  .

# deploy
gcloud run deploy backend \
  --image "$GCP_REGION-docker.pkg.dev/$GCP_PROJECT/$AR_REPO/backend:latest" \
  --region "$GCP_REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-secrets GOOGLE_GENERATIVE_AI_API_KEY=google-generative-ai-api-key:latest \
  --set-env-vars FRONTEND_ORIGIN=https://YOUR-FRONTEND-URL.run.app
```

Capture the resulting URL for the frontend's CORS origin and (optionally) for a reverse proxy.

### Deploy the frontend

```bash
gcloud builds submit \
  --tag "$GCP_REGION-docker.pkg.dev/$GCP_PROJECT/$AR_REPO/frontend:latest" \
  --file frontend/Dockerfile \
  .

gcloud run deploy frontend \
  --image "$GCP_REGION-docker.pkg.dev/$GCP_PROJECT/$AR_REPO/frontend:latest" \
  --region "$GCP_REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080
```

After the first backend deploy, redeploy the backend with the real frontend URL set on `FRONTEND_ORIGIN`.

### Wire frontend → backend in production

The dev-time Vite proxy doesn't exist in production. Pick one:

1. **Single domain (recommended)** — put both Cloud Run services behind a Google Cloud Load Balancer with path-based routing: `/api/*` → backend, everything else → frontend. The frontend keeps calling `/api/*` unchanged.
2. **Two domains** — extend the frontend to read a build-time `VITE_API_BASE_URL` and prepend it to fetch / `useChat` calls. Pass it via `--build-arg` in the frontend Dockerfile.

### Local Docker smoke test

```bash
docker build -f backend/Dockerfile -t backend:local .
docker run --rm -p 8080:8080 -e GOOGLE_GENERATIVE_AI_API_KEY=$YOUR_KEY backend:local

docker build -f frontend/Dockerfile -t frontend:local .
docker run --rm -p 8081:8080 frontend:local
```

---

## API surface

All endpoints live in [backend/src/api.controller.ts](backend/src/api.controller.ts).

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/health` | — | Liveness probe |
| POST | `/api/installer/submit` | `ProjectInput` (see [DATA_MODELS.md](DATA_MODELS.md)) | Returns a stub `DesignRecommendation` until the sizing engine from `viewer.html` is ported |
| POST | `/api/chat` | `{ messages: UIMessage[] }` | Streams the Mastra `homeowner-advisor` agent in the AI-SDK data-stream protocol; consumed by `useChat` from `@ai-sdk/react` |
