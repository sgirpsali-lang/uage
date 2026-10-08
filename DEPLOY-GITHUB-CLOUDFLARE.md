# Deploy Auxy to Cloudflare Workers + Workers AI + web.auxy.ir

## 1) Authenticate Wrangler
```bash
npx wrangler login
```

## 2) Deploy
```bash
npx wrangler deploy
```

The project declares the Workers AI binding as `AI` in `wrangler.toml`, so the Worker receives it as `env.AI`. The same config declares `web.auxy.ir` as a Custom Domain.

## 3) Verify
```bash
curl -i https://web.auxy.ir/api/health
```

## Important
`web.auxy.ir` must be a hostname in an active Cloudflare zone in the same Cloudflare account, and it cannot already have a conflicting CNAME/DNS setup. Custom Domains are created by Cloudflare and DNS/certificates are managed for you.

## 4) Push to GitHub
```bash
git add .
git commit -m "Deploy Auxy on Cloudflare Workers AI"
git push origin main
```

Then connect `sgirpsali-lang/uage` to the Worker in Workers Builds. Set deploy command to `npx wrangler deploy`. Subsequent pushes to `main` can deploy automatically.
