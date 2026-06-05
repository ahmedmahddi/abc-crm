# Architecture

## Overview

```txt
Browser / PWA
  ↓
Next.js web app
  ↓ HTTP-only cookies + API calls
NestJS API
  ↓
Prisma ORM
  ↓
Supabase PostgreSQL

NestJS API
  ↓ server-side validation
Supabase Storage
```

## Boundary rules

- The frontend never uses Supabase service-role credentials.
- The backend owns authorization and storage access.
- Prisma schema is the single source of truth for relational data.
- Shared enums and schemas live in `packages/shared`.

## Suggested deployment

```txt
Next.js: Vercel
NestJS: Railway / Render / Fly.io / VPS
Database: Supabase Postgres
Storage: Supabase Storage
Redis later: Upstash
```
