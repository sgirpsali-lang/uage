# Auxy · GitHub → Cloudflare Workers AI

این نسخه برای اتصال مستقیم یک repository گیت‌هاب به **Cloudflare Workers Builds** آماده شده است. Cloudflare می‌تواند با هر push روی branch تولیدی، Worker را build/deploy کند. فایل `wrangler.toml` نیز Workers AI binding را با نام `AI` تعریف کرده است؛ در Worker از `env.AI.run()` استفاده می‌شود.

## معماری

- `public/` سایت فعلی Auxy
- `src/index.js` Worker و درگاه `/api/ai`
- `wrangler.toml` شامل Static Assets + Workers AI binding
- `.github/workflows/deploy.yml` برای GitHub Actions به‌عنوان روش جایگزین
- بدون OpenAI/GapGPT API key

## مدل پیش‌فرض

مدل اصلی: `@cf/zai-org/glm-5.3-flash` — مدل 320B total / 18B active، با reasoning و function calling. این مدل در Workers AI نیازمند Workers Paid یا prepaid AI Gateway credits است. در صورت خطای inference، Worker یک بار مدل `@cf/zai-org/glm-4.7-flash` را fallback می‌کند.

## اتصال GitHub به Cloudflare

1. این پروژه را داخل repository `sgirpsali-lang/uage` قرار بده و commit/push کن.
2. در Cloudflare → Workers & Pages → Create application → Get started کنار **Import a repository** برو.
3. GitHub را authorize کن و repository را انتخاب کن.
4. Root directory را روی `/` بگذار.
5. Build command را خالی بگذار و Deploy command را روی `npx wrangler deploy` بگذار.
6. Cloudflare بعد از deploy، Worker را روی `workers.dev` در اختیار می‌گذارد.

Cloudflare می‌گوید هنگام Git integration، نام Worker در dashboard باید با `name` داخل `wrangler.toml` هماهنگ باشد؛ این پروژه هر دو را `auxy-ai` گذاشته است.

## متغیرهای Worker

در Cloudflare Worker → Settings → Variables برای جستجوی فیلم این دو مقدار را اضافه کن:

- `SUPABASE_URL` = `https://realtoiyrtvjfohovoda.supabase.co`
- `SUPABASE_ANON_KEY` = کلید publishable فعلی پروژه

این دو مقدار secret نیستند اگر همان publishable/anon key پروژه باشند. توکن session کاربر از مرورگر به Worker فرستاده می‌شود تا RPC جستجوی فیلم با مجوز کاربر اجرا شود.

برای عوض کردن مدل، variable `AUXY_AI_MODEL` را تنظیم کن.

## Workers AI binding

داخل `wrangler.toml`:

```toml
[ai]
binding = "AI"
```

و داخل کد:

```js
await env.AI.run('@cf/zai-org/glm-5.3-flash', { messages })
```

## روش جایگزین: GitHub Actions

اگر به‌جای Workers Builds می‌خواهی خود GitHub deploy را انجام دهد، secretهای GitHub زیر را بساز:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

فایل `.github/workflows/deploy.yml` آماده است.
