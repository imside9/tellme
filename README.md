# tellme-mvp

익명 기반 상황별 한 줄 멘트 검색기 MVP.

## 로컬 테스트 세팅 (Windows PowerShell)

```bash
cd C:\Users\옥\myfiles\tellme
npm.cmd install
Copy-Item .dev.vars.example .dev.vars
```

`.dev.vars`를 열어서 `OPENAI_API_KEY` 값을 실제 키로 바꿔 주세요.

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
OPENAI_API_KEY=your_openai_api_key
```

## 배포

1. GitHub 저장소에 푸시
2. Cloudflare Pages > Create project > 해당 저장소 연결
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Environment Variables에 `OPENAI_API_KEY` 추가
6. Deploy

## API

- `POST /api/generate`
- body: `{ situation: string, tone: "polite" | "cool" | "funny" }`
- response: `{ lines: string[] }`
