# Auxy A13.24 — GitHub → Cloudflare Workers AI

## What is configured
- Worker: `auxy-ai`
- AI binding: `AI`
- Primary model: `@cf/openai/gpt-oss-120b`
- Fallback model: `@cf/nvidia/nemotron-3-120b-a12b`
- Custom Domain: `web.auxy.ir`
- Assets: `public/`
- AI endpoint: `POST /api/ai`
- Health check: `GET /api/health`
- Movie tool: `search_movies` via Supabase

## 1. Put files at repository root
The repository must have `wrangler.toml`, `package.json`, `src/`, and `public/` directly in the repo root.

## 2. Commit to GitHub
```bash
git add .
git commit -m "Deploy Auxy A13.24 with Workers AI"
git push origin main
```

## 3. Connect GitHub in Cloudflare
Open Cloudflare Dashboard → Workers & Pages → `auxy-ai` → Settings/Builds and connect the GitHub repository:
`sgirpsali-lang/uage`

Production branch: `main`

Deploy command:
```bash
npx wrangler deploy
```

If Cloudflare asks for the Worker name, use `auxy-ai`.

## 4. Verify
```bash
curl -i https://web.auxy.ir/api/health
```

A healthy response should contain `"ai":true` and the model name.

## 5. Important
Workers AI Free is quota-limited (10,000 Neurons/day as of Oct 1, 2026). It is not unlimited. Some models require paid billing, but `@cf/openai/gpt-oss-120b` is an open-weight production reasoning model and can be used through the Workers AI binding without an external provider API key.
