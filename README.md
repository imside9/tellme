# tellme-mvp

Anonymous one-line messenger reply generator MVP.

## Local setup (Windows PowerShell)

```bash
cd C:\Users\옥\myfiles\tellme
npm.cmd install
Copy-Item .dev.vars.example .dev.vars
```

Fill `.dev.vars` with Gemini key settings.
Primary key name is `GEMINI_API_KEY`.
Aliases `GOOGLE_API_KEY` and `GEMINI_KEY` are also accepted.

## Frontend only

```bash
npm.cmd run dev
```

Open `http://localhost:5173`.

## Full local test with API (recommended)

```bash
npm.cmd run dev:pages
```

Open `http://localhost:8788`.

## `.dev.vars` example

```env
GEMINI_API_KEY=your_gemini_api_key
# Optional aliases:
# GOOGLE_API_KEY=your_gemini_api_key
# GEMINI_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

## Deploy

1. Push to GitHub.
2. Cloudflare Pages -> Create project -> connect repository.
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Add secret env var: `GEMINI_API_KEY`
   - Alias names `GOOGLE_API_KEY` / `GEMINI_KEY` are also supported.
6. (Optional) Add `GEMINI_MODEL`
7. Deploy

## Cloudflare Pages checklist

If `POST /api/generate` returns HTML (`<!DOCTYPE ...`) instead of JSON:

1. Confirm `Root directory` is `tellme`.
2. Confirm `Build command` is `npm run build`.
3. Confirm `Build output directory` is `dist` (not `/dist`).
4. Confirm `GEMINI_API_KEY` (or alias) exists in Production vars.
5. Confirm `_worker.js` advanced mode is not overriding `functions/` routes.
6. Clear build cache and redeploy.

## Verify after deploy

```bash
curl -i -X POST https://<your-domain>/api/generate \
  -H "content-type: application/json" \
  --data "{\"situation\":\"test\",\"tone\":\"polite\"}"
```

## API

- `POST /api/generate`
- body: `{ situation: string, tone: "polite" | "cool" | "funny" }`
- response: `{ lines: string[] }`