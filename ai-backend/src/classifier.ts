export interface ClassificationResult {
  category: string;
  summary: string;
  tags: string[];
  provider: string;
}

const CLASSIFICATION_PROMPT = (title: string, description: string, url: string) => `
You are an AI knowledge organizer. Analyze the following saved link and return a JSON object with three fields:
1. "category": A broad, high-level grouping that fits this link, prepended with a single relevant emoji. Be creative but consistent. (Examples: "🧠 AI & ML", "🍜 Recipes", "✈️ Travel", "💻 Development", "📰 News")
2. "summary": A concise, one-sentence summary of what this link is actually about, ignoring generic marketing copy.
3. "tags": An array of 2 to 4 short, specific lowercase tags.

Respond ONLY with valid JSON. Do not include markdown code blocks (no \`\`\`json).

Title: ${title}
Description: ${description}
URL: ${url}
`.trim()

/* Securely parse the AI JSON response */
function parseAIResponse(raw: string): Omit<ClassificationResult, 'provider'> {
  try {
    // Strip markdown code blocks if the AI accidentally included them
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      category: typeof parsed.category === 'string' && parsed.category ? parsed.category : '📎 Other',
      summary: typeof parsed.summary === 'string' && parsed.summary ? parsed.summary : '',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4).map(String) : [],
    }
  } catch (e) {
    console.error('[classifier] Failed to parse JSON from AI:', raw);
    return {
      category: ' Uncategorized',
      summary: 'Could not generate summary.',
      tags: [],
    }
  }
}

/* groq (llama 3) */
async function classifyWithGroq(
  title: string,
  description: string,
  url: string
): Promise<Omit<ClassificationResult, 'provider'>> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not set');
  }

  const body = {
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'user', content: CLASSIFICATION_PROMPT(title, description, url) }
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 150,
  };

  const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  }, 10000);

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Groq API error: ${res.status} ${errorBody}`);
  }

  const data = await res.json() as any;
  const rawText = data.choices?.[0]?.message?.content ?? '{}';
  return parseAIResponse(rawText);
}

/* Main classifier — uses Groq only */
export async function classifyLink(
  title: string,
  description: string,
  url: string
): Promise<ClassificationResult> {
  try {
    const result = await classifyWithGroq(title, description, url);
    return { ...result, provider: 'groq' };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error('[classifier] Groq failed:', errorMsg);

    return {
      category: ' Unclassified',
      summary: `API Error: ${errorMsg.slice(0, 100)}`,
      tags: ['error'],
      provider: 'fallback',
    };
  }
}

/* Helper: fetch with timeout */
async function fetchWithTimeout(url: string, options: RequestInit, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}
