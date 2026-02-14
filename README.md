# tellme-mvp

익명 기반 상황별 한 줄 멘트 검색기 MVP.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속.

## Cloudflare Pages Functions 포함 로컬 실행

1. `.dev.vars` 파일 생성
2. 아래 값 추가

```env
OPENAI_API_KEY=your_openai_api_key
```

3. 실행

```bash
npm install
npm run dev:pages
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
