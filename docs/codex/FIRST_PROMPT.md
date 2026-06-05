# First Codex Prompt

Set up dependencies and make the scaffold run locally. Respect AGENTS.md.

Tasks:

1. Run install and check all package scripts.
2. Fix any TypeScript, NestJS, Next.js, or workspace issues caused by version differences.
3. Keep the visual system aligned with the ABC palette.
4. Do not add random placeholder data.
5. After the setup runs, implement the auth vertical slice first.

Acceptance criteria:

- `pnpm typecheck` passes.
- `pnpm lint` passes.
- `pnpm dev` starts web and api.
- `/` renders the app shell.
- `/login` renders the login page.
- `/health` returns API health.
