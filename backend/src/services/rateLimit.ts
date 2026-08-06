import { Redis } from '@upstash/redis'
import { HttpError } from '../utils/errors'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL as string,
    token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
})

const LOGIN_LIMIT = Number(process.env.LOGIN_RATE_LIMIT_PER_MINUTE ?? 5)
const WINDOW_SECONDS = 60

/* Rate Limit */
export async function enforceLoginRateLimit(ip: string): Promise<void> {
    const key = `rate:login:${ip}`
    const count = await redis.incr(key)

    if (count === 1) {
        await redis.expire(key, WINDOW_SECONDS)
    }

    if (count > LOGIN_LIMIT) {
        throw new HttpError(429, 'Too many login attempts. Try again in a minute.')
    }
}