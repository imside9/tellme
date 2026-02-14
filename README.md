# tellme-mvp

익명 기반 상황별 한 줄 멘트 검색기 MVP.

## 로컬 테스트 세팅 (Windows PowerShell)

```bash
cd C:\Users\옥\myfiles\tellme
npm.cmd install
Copy-Item .dev.vars.example .dev.vars
```

`.dev.vars`를 열어서 Gemini API Key 값을 채워 주세요.

## 프론트만 확인

```bash
npm.cmd run dev
```

브라우저에서 `http://localhost:5173` 접속.

## API 포함 전체 로컬 테스트 (권장)

```bash
npm.cmd run dev:pages
```

브라우저에서 `http://localhost:8788` 접속.

## `.dev.vars` 예시

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

## 배포

1. GitHub 저장소에 푸시
2. Cloudflare Pages > Create project > 해당 저장소 연결
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Environment Variables에 `GEMINI_API_KEY` 추가 (Secret)
6. (선택) Environment Variables에 `GEMINI_MODEL` 추가
7. Deploy

## Cloudflare Pages 점검 체크리스트

`POST /api/generate`가 JSON이 아닌 HTML(`<!DOCTYPE ...`)을 반환하면 아래를 확인하세요.

1. Pages 프로젝트의 `Root directory`가 `tellme`인지 확인
2. `Build command`가 `npm run build`인지 확인
3. `Build output directory`가 `dist`인지 확인 (`/dist` 아님)
4. `GEMINI_API_KEY`가 Production 환경변수에 있는지 확인
5. `Settings > Functions`에서 Advanced mode(`_worker.js`)가 `functions/` 라우팅을 덮어쓰지 않는지 확인
6. `Clear build cache` 후 재배포

배포 후 검증:

```bash
curl -i -X POST https://<your-domain>/api/generate \
  -H "content-type: application/json" \
  --data "{\"situation\":\"테스트\",\"tone\":\"polite\"}"
```

## API

- `POST /api/generate`
- body: `{ situation: string, tone: "polite" | "cool" | "funny" }`
- response: `{ lines: string[] }`
