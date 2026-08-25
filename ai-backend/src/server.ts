import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import ogs from 'open-graph-scraper';
import { Redis } from '@upstash/redis';
import { classifyLink } from './classifier';
import { chatWithLibrary, checkRateLimit, RateLimitError } from './chat';
import { ChatSchema, ClassifySchema } from './schema';

const requiredEnvVars = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'GROQ_API_KEY'];
const missing = requiredEnvVars.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.FRONTEND_URL,
}));
app.use(express.json({ limit: '1mb' }));

interface OGMetaResult {
  title: string;
  description: string;
  image: string | null;
}

function getYouTubeThumbnail(urlStr: string): string | null {
  try {
    const url = new URL(urlStr);
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
      let videoId: string | null = null;
      if (url.hostname.includes('youtu.be')) {
        videoId = url.pathname.slice(1);
      } else if (url.pathname.includes('/shorts/')) {
        videoId = url.pathname.split('/shorts/')[1]?.split('/')[0] ?? null;
      } else if (url.pathname.includes('/watch')) {
        videoId = url.searchParams.get('v');
      }
      if (videoId) {
        videoId = videoId.replace(/[^a-zA-Z0-9_-]/g, '');
        if (videoId) return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      }
    }
  } catch {}
  return null;
}

async function fetchOEmbed(urlStr: string): Promise<OGMetaResult | null> {
  try {
    const url = new URL(urlStr);

    // YouTube oEmbed (Works for watch, shorts, and youtu.be without API key)
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(urlStr)}&format=json`;
      const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.title) {
          console.log(`[getOGMeta] YouTube oEmbed HIT: "${data.title}"`);
          return {
            title: String(data.title).slice(0, 300),
            description: `YouTube video by ${data.author_name || 'creator'}`,
            image: data.thumbnail_url || getYouTubeThumbnail(urlStr),
          };
        }
      }
    }

    // TikTok oEmbed
    if (url.hostname.includes('tiktok.com')) {
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(urlStr)}`;
      const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.title) {
          console.log(`[getOGMeta] TikTok oEmbed HIT: "${data.title}"`);
          return {
            title: String(data.title).slice(0, 300),
            description: `TikTok video by ${data.author_name || 'creator'}`,
            image: data.thumbnail_url || null,
          };
        }
      }
    }
  } catch (err) {
    console.warn(`[fetchOEmbed] Error fetching oEmbed for ${urlStr}:`, err);
  }
  return null;
}

async function getOGMeta(url: string): Promise<OGMetaResult> {
  const cacheKey = `og:${url}`;
  try {
    const cached = await redis.get<OGMetaResult>(cacheKey);
    if (cached) {
      console.log(`[getOGMeta] Cache HIT for: ${url}`);
      return cached;
    }
  } catch (err) {
    console.warn(`[getOGMeta] Redis lookup error:`, err);
  }

  // 1. Try fast oEmbed first for YouTube / TikTok
  const oembed = await fetchOEmbed(url);
  if (oembed) {
    redis.set(cacheKey, oembed, { ex: 86400 }).catch(() => {});
    return oembed;
  }

  // 2. Fallback to open-graph-scraper with custom browser User-Agent
  const ytThumb = getYouTubeThumbnail(url);
  try {
    const { result } = await ogs({
      url,
      timeout: 8, // seconds (not ms — ogs docs say "number of seconds")
      fetchOptions: {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.5',
          'accept-encoding': 'gzip, deflate, br',
          'cache-control': 'no-cache',
        },
      },
    });

    const title = (result.ogTitle ?? result.dcTitle ?? '').slice(0, 300);
    const meta: OGMetaResult = {
      title: title && title !== 'YouTube' ? title : `Link from ${new URL(url).hostname}`,
      description: (result.ogDescription ?? '').slice(0, 500),
      image: result.ogImage?.[0]?.url ?? ytThumb,
    };

    redis.set(cacheKey, meta, { ex: 86400 }).catch(() => {});
    return meta;
  } catch (error) {
    console.warn(`[getOGMeta] Failed to fetch OG meta for ${url}:`, error);
    let hostname = url;
    try { hostname = new URL(url).hostname; } catch { }
    return {
      title: `Link from ${hostname}`,
      description: 'Metadata could not be extracted (site may block scrapers).',
      image: ytThumb,
    };
  }
}

app.post('/api/classify', async (req, res) => {
  try {
    const parsed = ClassifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.issues,
      });
    }

    await checkRateLimit(req.ip ?? "unknown", "classify");

    const { url } = parsed.data;
    console.log(`[classify] Fetching metadata for: ${url}`);
    const meta = await getOGMeta(url);

    console.log(`[classify] Calling Groq AI...`);
    const aiResult = await classifyLink(meta.title, meta.description, url);

    res.json({
      url,
      title: meta.title || `Link from ${new URL(url).hostname}`,
      description: meta.description || '',
      image: meta.image ?? null,
      category: aiResult.category || '📎 Other',
      summary: aiResult.summary || '',
      tags: aiResult.tags || [],
      provider: aiResult.provider || 'groq',
    });
  } catch (e) {
    if (e instanceof RateLimitError) {
      console.warn(`[classify] Rate limit hit for ${req.ip}`);
      return res.status(429).json({
        error: e.message,
        retryAfterSeconds: e.retryAfterSeconds
      });
    }

    console.error('[classify] Error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fast endpoint: Returns title, description, and image URL immediately
app.post('/api/metadata', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    const meta = await getOGMeta(url);
    res.json(meta); // Returns { title, description, image }
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch metadata' });
  }
});


app.post('/api/chat', async (req, res) => {
  try {
    const parsed = ChatSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.issues,
      });
    }
    const { question, library, notes } = parsed.data;

    await checkRateLimit(req.ip ?? "unknown", "chat");

    console.log(`[chat] Processing question: "${question}" with library size: ${library.length}, notes size: ${notes.length}`);

    const { answer, sources } = await chatWithLibrary(question, library, notes);

    res.json({ answer, sources });

  } catch (e) {
    if (e instanceof RateLimitError) {
      console.warn(`[chat] Rate limit hit for ${req.ip}`);
      return res.status(429).json({
        error: e.message,
        retryAfterSeconds: e.retryAfterSeconds
      });
    }

    console.error('[chat] Error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Railway AI Backend running on http://localhost:${PORT}`);
});