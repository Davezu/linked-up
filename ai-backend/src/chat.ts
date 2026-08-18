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

export async function chatWithLibrary(question: string, library: any[]): Promise<any> {
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

  const scored = library.map((item: any) => {
    const text = `${item.title} ${item.summary} ${(item.tags ?? []).join(' ')} ${item.category}`.toLowerCase()
    const score = keywords.reduce((s: number, kw: string) => s + (text.includes(kw) ? 1 : 0), 0)
    return { item, score }
  })

  const relevant = scored
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 15)
    .filter((x: any) => x.score > 0 || library.length <= 15)
    .map((x: any) => x.item)

  const finalSet = relevant.length > 0 ? relevant : library.slice(0, 15)

  // Library content (title/summary/tags) is scraped from arbitrary third-party
  // webpages - it is UNTRUSTED input, same as the user's question. Wrapping each
  // field in a clearly delimited block, and keeping instructions only in the
  // system message, makes it much harder for text hidden in a saved page to be
  // interpreted as a command rather than data.
  const libraryContext = finalSet.map((item: any, i: number) =>
    `[${i + 1}]\nTitle: ${sanitizeField(item.title)}\nCategory: ${sanitizeField(item.category)}\nSummary: ${sanitizeField(item.summary)}\nTags: ${(item.tags ?? []).map(sanitizeField).join(', ')}\nURL: ${sanitizeField(item.url)}`
  ).join('\n\n')

  const systemPrompt = createChatSystemPrompt(libraryContext)

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

  const citedIndices = [...answer.matchAll(/\[(\d+)\]/g)]
    .map((m: RegExpMatchArray) => parseInt(m[1]) - 1)
    .filter((i: number) => i >= 0 && i < finalSet.length)
  const uniqueIndices = [...new Set(citedIndices)]
  const sources = uniqueIndices.map((i: number) => finalSet[i])

  return { answer, sources }
}

/* Strip characters that could be used to break out of the delimited block structure */
function sanitizeField(value: unknown): string {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').slice(0, 300)
}