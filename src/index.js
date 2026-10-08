const DEFAULT_MODEL = '@cf/openai/gpt-oss-120b';
const FALLBACK_MODEL = '@cf/nvidia/nemotron-3-120b-a12b';
const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 12000;
const MAX_TOTAL_CHARS = 90000;
const MAX_TOOL_ROUNDS = 2;

const SYSTEM_PROMPT = `تو Auxy AI هستی؛ دستیار هوشمند داخل Auxy.
هویت: باهوش، سریع، طبیعی، فارسی‌محور و Gen Z؛ ولی هرگز مصنوعی، تکراری یا cringe نباش.

قواعد مهم:
- قبل از پاسخ معنی واقعی پیام را بفهم و context گفتگو را حفظ کن.
- برای گفت‌وگوی معمولی، سلام، شوخی، ایده‌پردازی، برنامه‌نویسی، توضیح و محاسبه از ابزار فیلم استفاده نکن.
- وقتی کاربر واقعاً درباره فیلم/سریال، پیشنهاد فیلم، عنوان مشخص، ژانر، بازیگر، فیلم مشابه یا مقایسه فیلم سؤال دارد، در صورت نیاز از search_movies استفاده کن.
- اگر از search_movies داده گرفتی، فقط بر اساس همان داده‌ها درباره فیلم‌ها ادعا کن؛ اطلاعات فیلمی را که در نتیجه نیست جعل نکن.
- وقتی سؤال ناقص است از context قبلی کمک بگیر و بی‌جهت سؤال تکراری نپرس.
- پاسخ‌ها را با Markdown تمیز بنویس.
- برای سؤال ساده کوتاه جواب بده؛ برای سؤال پیچیده مرحله‌بندی و استدلال روشن داشته باش.
- لحن Gen Z طبیعی و امروزی باشد، نه پر از اسلنگ.
- اگر چیزی را نمی‌دانی، صادقانه بگو.
- در مقایسه‌ها یک نتیجه‌گیری روشن بده.`;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-max-age': '86400',
  };
}

function normalizeMessages(input) {
  const source = Array.isArray(input) ? input : [];
  const cleaned = source
    .filter((message) =>
      message &&
      ['user', 'assistant', 'system'].includes(message.role) &&
      typeof message.content === 'string' &&
      message.content.trim()
    )
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, MAX_MESSAGE_CHARS),
    }))
    .slice(-MAX_MESSAGES);

  let total = cleaned.reduce((sum, message) => sum + message.content.length, 0);
  while (total > MAX_TOTAL_CHARS && cleaned.length > 4) {
    const removed = cleaned.shift();
    total -= removed.content.length;
  }
  return cleaned;
}

function movieTool() {
  return {
    name: 'search_movies',
    description:
      'Search the Auxy movie catalog. Use only when the user asks for movie recommendations, a specific movie, similar movies, genres, actors, ratings, or comparisons.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'A concise search query in Persian or English. Include title, actor, genre, mood, year, or similarity intent.',
        },
        limit: {
          type: 'number',
          description: 'How many results to return, from 1 to 12.',
        },
      },
      required: ['query'],
    },
  };
}

async function searchMovies(env, request, query, limit = 8) {
  const q = String(query || '').trim().slice(0, 180);
  const count = Math.max(1, Math.min(Number(limit) || 8, 12));
  if (!q) return [];

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return { error: 'Supabase movie search is not configured.' };
  }

  const auth = request.headers.get('authorization');
  const headers = {
    apikey: env.SUPABASE_ANON_KEY,
    Authorization: auth || `Bearer ${env.SUPABASE_ANON_KEY}`,
    'content-type': 'application/json',
  };

  try {
    const rpc = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/auxy_ai_search_movies`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_query: q, p_limit: count }),
    });
    if (rpc.ok) {
      const data = await rpc.json();
      if (Array.isArray(data)) return data.slice(0, count);
    }
  } catch (_) {
    // Fall through to direct table search.
  }

  try {
    const endpoint = new URL(`${env.SUPABASE_URL}/rest/v1/movies`);
    endpoint.searchParams.set('select', '*');
    endpoint.searchParams.set('title', `ilike.*${q}*`);
    endpoint.searchParams.set('limit', String(count));

    const table = await fetch(endpoint, { headers });
    if (!table.ok) return { error: `Movie search failed with HTTP ${table.status}.` };
    const data = await table.json();
    return Array.isArray(data) ? data.slice(0, count) : [];
  } catch (error) {
    return { error: error?.message || 'Movie search failed.' };
  }
}

function extractToolCalls(result) {
  if (Array.isArray(result?.tool_calls)) return result.tool_calls;
  const nested = result?.choices?.[0]?.message?.tool_calls;
  return Array.isArray(nested) ? nested : [];
}

function toolName(call) {
  return String(call?.name || call?.function?.name || '');
}

function toolArguments(call) {
  const raw = call?.arguments ?? call?.function?.arguments ?? {};
  if (raw && typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw || '{}'));
  } catch {
    return {};
  }
}

function modelText(result) {
  const direct = result?.response;
  if (typeof direct === 'string') return direct.trim();
  const nested = result?.choices?.[0]?.message?.content;
  return typeof nested === 'string' ? nested.trim() : '';
}

async function runModel(env, model, options) {
  if (!env.AI || typeof env.AI.run !== 'function') {
    throw new Error('Workers AI binding `AI` is not available.');
  }
  return env.AI.run(model, options);
}

async function runWithFallback(env, options) {
  const requestedModel = String(env.AUXY_AI_MODEL || DEFAULT_MODEL);
  try {
    return {
      model: requestedModel,
      result: await runModel(env, requestedModel, options),
    };
  } catch (primaryError) {
    if (requestedModel === FALLBACK_MODEL) throw primaryError;
    try {
      return {
        model: FALLBACK_MODEL,
        result: await runModel(env, FALLBACK_MODEL, options),
      };
    } catch (fallbackError) {
      const primary = primaryError instanceof Error ? primaryError.message : String(primaryError);
      const fallback = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`Primary model failed: ${primary} | Fallback failed: ${fallback}`);
    }
  }
}

async function answer(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'بدنه درخواست JSON معتبر نیست.' }, 400);
  }

  const conversation = normalizeMessages(body?.messages);
  if (!conversation.length) {
    return json({ error: 'پیام خالی است.' }, 400);
  }

  const baseMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversation,
  ];

  const options = {
    messages: baseMessages,
    tools: [movieTool()],
    stream: false,
    max_tokens: Math.min(Math.max(Number(env.AUXY_AI_MAX_TOKENS) || 2400, 256), 4096),
    temperature: 0.65,
    top_p: 0.95,
  };

  let currentMessages = baseMessages;
  let movies = [];
  let usedMovieTool = false;
  let selectedModel = env.AUXY_AI_MODEL || DEFAULT_MODEL;
  let result;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const run = await runWithFallback(env, {
      ...options,
      messages: currentMessages,
      tools: [movieTool()],
    });
    selectedModel = run.model;
    result = run.result;

    const calls = extractToolCalls(result);
    if (!calls.length) break;

    usedMovieTool = true;

    // Cloudflare's traditional function-calling flow feeds the tool result
    // back as a `role: tool` message, then asks the model to continue.
    currentMessages = [...currentMessages];

    for (const call of calls) {
      if (toolName(call) !== 'search_movies') {
        currentMessages.push({
          role: 'tool',
          name: toolName(call) || 'unknown_tool',
          content: JSON.stringify({ error: 'Unknown tool.' }),
        });
        continue;
      }

      const args = toolArguments(call);
      const data = await searchMovies(env, request, args.query, args.limit);
      if (Array.isArray(data)) movies = data.slice(0, 12);
      currentMessages.push({
        role: 'tool',
        name: 'search_movies',
        content: JSON.stringify(data),
      });
    }
  }

  // One final pass without tools makes the UI response deterministic and prevents tool loops.
  if (usedMovieTool) {
    const finalRun = await runWithFallback(env, {
      messages: currentMessages,
      stream: false,
      max_tokens: Math.min(Math.max(Number(env.AUXY_AI_MAX_TOKENS) || 2400, 256), 4096),
      temperature: 0.65,
      top_p: 0.95,
      tool_choice: 'none',
    });
    selectedModel = finalRun.model;
    result = finalRun.result;
  }

  const text = modelText(result);
  return json({
    text: text || 'یه لحظه ذهنم پرید 😅 دوباره بفرست.',
    movies,
    model: selectedModel,
    usedMovieTool,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === '/api/health') {
      const payload = {
        ok: true,
        ai: Boolean(env.AI && typeof env.AI.run === 'function'),
        model: env.AUXY_AI_MODEL || DEFAULT_MODEL,
        movieSearch: Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY),
      };
      return json(payload, 200, corsHeaders());
    }

    if (url.pathname === '/api/ai') {
      if (request.method !== 'POST') {
        return json({ error: 'Method not allowed' }, 405, corsHeaders());
      }
      try {
        const response = await answer(request, env);
        const headers = new Headers(response.headers);
        Object.entries(corsHeaders()).forEach(([key, value]) => headers.set(key, value));
        return new Response(response.body, { status: response.status, headers });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return json({ error: `Workers AI error: ${detail}` }, 500, corsHeaders());
      }
    }

    return env.ASSETS.fetch(request);
  },
};
