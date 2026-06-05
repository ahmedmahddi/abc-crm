# ABC CRM

A production-oriented starter setup for a PWA CRM dedicated to bureau d'étude / consulting missions.

## Stack

- Next.js latest, TypeScript, Tailwind CSS, shadcn-ready UI structure
- NestJS API
- Supabase PostgreSQL
- Supabase Storage
- Prisma ORM
- Custom auth architecture with JWT + HTTP-only cookies
- Monorepo using pnpm workspaces and Turborepo

## Project structure

```txt
apps/web       Next.js PWA frontend
apps/api       NestJS backend API
packages/db    Prisma schema and database client
packages/shared shared constants, schemas, DTO helpers
docs           product, architecture, design and execution notes
obsidian       optional Obsidian vault starter
```

## First setup

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm dev
```

## Ports

```txt
Frontend: http://localhost:3000
Backend:  http://localhost:4000
```

## Implementation order

1. Environment and Supabase project setup
2. Prisma migrate
3. Custom auth vertical slice
4. Clients module
5. Consultants module
6. Missions + calendar module
7. Ordres de mission + PDF/print/export
8. File upload and document validation
9. OCR extraction for organigrammes later

## Design direction

The UI uses the ABC Consulting logo palette:

```txt
Primary blue: #125885
Primary dark: #0E476C
Logo gray:    #BDC3C7
Background:   #F7F9FB
Surface:      #FFFFFF
Text:         #0F1720
Border:       #D9E0E4
```

The goal is a calm, corporate and elegant CRM, not a generic AI dashboard.
