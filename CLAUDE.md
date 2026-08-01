# clothes

Monorepo. `apps/client` is a React SPA (TanStack Router + TanStack Query, Vite, shadcn/ui on Base UI, suspense-first data fetching). `apps/api` is a Hono API on Cloudflare Workers with D1 (SQLite) via Drizzle, clean-architecture split, typed end to end through Hono RPC.

Rules load from `.claude/rules/`, which `milky-kit:new` populated with symlinks into `~/.claude/kit/`. See the kit's README for the full set.

## Project-specific

<!-- Project-owned. milky-kit's upgrade skill never touches this section. -->

`docs/brief.md` is the source of truth for the garment this project is about (掛襟シャツ — a modified jinbei top). It predates the code and is not derived from it.
