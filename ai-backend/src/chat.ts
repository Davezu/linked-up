import { Redis } from "@upstash/redis";
import { createChatSystemPrompt } from './rules/chatRules';
import { retry } from "./utils/retry";

const GROQ_TIMEOUT_MS = 10_000;
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.CHAT_RATE_LIMIT_PER_MINUTE ?? 10);

const RATE_LIMIT_WINDOW_SECONDS = 60;

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export class RateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`Rate limit exceeded. Try again in ${retryAfterSeconds}s.`);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Redis-based fixed window rate limiter.
 * Identifier can be IP address or user ID.
 */
export async function checkRateLimit(identifier: string, routeKey: string = "chat"): Promise<void> {
  const key = `rate:${routeKey}:${identifier.replace(/[^a-zA-Z0-9:.]/g, "_")}`;

  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
  }

  if (count > RATE_LIMIT_MAX_REQUESTS) {
    const ttl = await redis.ttl(key);
    throw new RateLimitError(ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS);
  }
}
/* Chat */

const MAX_QUESTION_LENGTH = 500

export async function chatWithLibrary(question: string, library: any[] = [], notes: any[] = []): Promise<any> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not set')
  }

  const trimmedQuestion = (question ?? '').trim().slice(0, MAX_QUESTION_LENGTH)
  if (!trimmedQuestion) {
    throw new Error('question is required')
  }

  const qLower = trimmedQuestion.toLowerCase()
  const keywords = qLower.split(/\s+/).filter((w: string) => w.length > 3)

  // Score & filter library items
  const scoredLibrary = (library ?? []).map((item: any) => {
    const text = `${item.title} ${item.summary} ${(item.tags ?? []).join(' ')} ${item.category}`.toLowerCase()
    const score = keywords.reduce((s: number, kw: string) => s + (text.includes(kw) ? 1 : 0), 0)
    return { item, score }
  })
  const relevantLibrary = scoredLibrary
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 15)
    .filter((x: any) => x.score > 0 || library.length <= 15)
    .map((x: any) => x.item)
  const finalLibrarySet = relevantLibrary.length > 0 ? relevantLibrary : (library ?? []).slice(0, 15)

  // Score & filter notes
  const scoredNotes = (notes ?? []).map((item: any) => {
    const text = `${item.title} ${item.content} ${(item.tags ?? []).join(' ')} ${item.folder ?? ''}`.toLowerCase()
    const score = keywords.reduce((s: number, kw: string) => s + (text.includes(kw) ? 1 : 0), 0)
    return { item, score }
  })
  const relevantNotes = scoredNotes
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 15)
    .filter((x: any) => x.score > 0 || notes.length <= 15)
    .map((x: any) => x.item)
  const finalNotesSet = relevantNotes.length > 0 ? relevantNotes : (notes ?? []).slice(0, 15)

  const libraryContext = finalLibrarySet.map((item: any, i: number) =>
    `[L${i + 1}]\nTitle: ${sanitizeField(item.title)}\nCategory: ${sanitizeField(item.category)}\nSummary: ${sanitizeField(item.summary)}\nTags: ${(item.tags ?? []).map(sanitizeField).join(', ')}\nURL: ${sanitizeField(item.url)}`
  ).join('\n\n')

  const notesContext = finalNotesSet.map((item: any, i: number) =>
    `[N${i + 1}]\nTitle: ${sanitizeField(item.title)}\nFolder: ${sanitizeField(item.folder ?? 'General')}\nContent: ${sanitizeField(item.content)}\nTags: ${(item.tags ?? []).map(sanitizeField).join(', ')}`
  ).join('\n\n')

  const fullContext = `=== SAVED LINKS ===\n${libraryContext || 'No saved links.'}\n\n=== SAVED NOTES ===\n${notesContext || 'No saved notes.'}`

  const systemPrompt = createChatSystemPrompt(fullContext)

  const res = await retry(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: trimmedQuestion },
          ],
          temperature: 0.3,
          max_tokens: 1200,
        }),
      });

      if (!response.ok) {
        const err = new Error(`Groq API error: ${response.status}`);
        (err as any).status = response.status;
        throw err;
      }

      return response;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Groq request timed out. Please try again.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  });

  const data = await res.json() as any
  const answer = data.choices?.[0]?.message?.content ?? 'No response generated.'

  // Gather cited sources from links [L1], [L2], etc. and notes [N1], [N2], etc.
  const linkSources = finalLibrarySet.map((item: any, i: number) => {
    const cited = new RegExp(`\\[L${i + 1}\\]|\\[${i + 1}\\]`, 'i').test(answer)
    return cited ? { ...item, type: 'link' } : null
  })
  const noteSources = finalNotesSet.map((item: any, i: number) => {
    const cited = new RegExp(`\\[N${i + 1}\\]`, 'i').test(answer)
    return cited ? { id: item.id || `note-${i}`, title: item.title, content: item.content, category: item.folder || 'Note', type: 'note' } : null
  })

  const sources = [...linkSources, ...noteSources].filter(Boolean)

  return { answer, sources }
}

/* Strip characters that could be used to break out of the delimited block structure */
function sanitizeField(value: unknown): string {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').slice(0, 300)
}