# Linked Up

A link and notes organizer with a browser extension for quick capture, an "Ask AI" chat for querying your saved items, and a web app for browsing and organizing everything.

## Features

- Save links and notes from anywhere via a browser extension (quick capture with Ctrl+Q)
- Organize and browse saved items in a web app
- Ask natural-language questions about your saved items via "Ask AI"
- Account-based storage, scoped per user
- Rate limiting and retry logic on API requests

## Tech Stack

| Layer | Technology |
|---|---|
| Durable storage | DynamoDB |
| Ephemeral/TTL storage | Redis (Upstash) |
| Auth | JWT |
| AI chat | Groq |
| Compute | AWS Lambda |
| API | API Gateway |
| Bundler | esbuild |

## Architecture

### Data storage

- **DynamoDB** stores account-owned data: accounts, links, and notes.
- **Redis (Upstash)** stores ephemeral/TTL data such as rate limiting counters.

### DynamoDB tables

- **`link-organizer-accounts`** — `accountId` (partition key), `codeHash`, `createdAt`
- **`link-organizer-item`** — combined links + notes table. `accountId` as partition key, `itemKey` as sort key, prefixed `LINK#` or `NOTE#` depending on item type.

### Authentication

- Login credential is a single combined string (prefix + accountId + secret code). On login, it's split apart for a DynamoDB lookup plus a bcrypt compare.
- Authenticated requests carry a JWT. Handlers require a valid JWT and scope all data access by the `accountId` embedded in the verified token — never by an `accountId` passed in the request body.

### AI chat ("Ask AI")

- Uses Groq for the chat completion.
- Retrieval currently uses simple keyword scoring done in code (no vector search yet).

### API routing

- API Gateway uses a wildcard route (`ANY /link-organizer/{proxy+}`) so all sub-paths (e.g. `/auth/register`) reach the Lambda.
- The Lambda is bundled with esbuild to a root-level `handler.js` (`--format=cjs`).

## Project Structure

```
backend/
  src/
    auth/       # login, JWT verification
    handlers/   # request handlers per resource
    services/   # business logic
    utils/      # shared helpers
frontend/
  App.tsx       # main app: links view, notes view, theme toggle, Ask AI
extension/
  ...           # browser extension for quick capture
```

## Frontend Notes

- Optimistic link insert: a fast metadata prefetch runs before the full AI classify call, so links appear immediately while classification finishes in the background.
- Includes a theme toggle and separate views for links and notes.

## Roadmap

The project is organized into four phases: Deployment, Accounts, Notes, and Extension.
