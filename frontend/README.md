# Prompt Market — frontend

Next.js (App Router) + Tailwind CSS v4 + shadcn/ui-style components (`src/components/ui`).

```bash
npm install
npm run dev          # http://localhost:3000  (needs the API on :8000, see ../README.md)
npm run build && npm start
```

`next.config.ts` proxies `/api/*` to the FastAPI backend (`BACKEND_URL`, default `http://localhost:8000`),
so the browser only ever talks to one origin and the httpOnly auth cookie stays first-party.

Routes: `/` landing · `/login` · `/market` · `/market/[id]` · `/cart` · `/workspace` (sellers) · `/pricing` · `/profile` · `/admin` (admins).
Copy lives in `src/lib/i18n.ts` (EN + TH).
