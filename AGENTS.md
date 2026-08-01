# Agent Instructions (OpenCode compatibility)

Claude Code reads `CLAUDE.md` and `.claude/rules/*.md` natively. This file exists so OpenCode (and other agent tools) can find them too.

## External file loading

When you see a file reference like `@.claude/rules/general.md`, use your Read tool to load it. Lazy — load based on what the current task actually needs, not preemptively. Loaded content is mandatory instruction.

Always-loaded rules are declared in `opencode.json` (`instructions` field). The rules below are topical — load them when relevant.

## Rules library

- `@.claude/rules/general.md` — general practices
- `@.claude/rules/comments.md` — when a comment is justified
- `@.claude/rules/config-and-env.md` — environment variables and secrets
- `@.claude/rules/workflow.md` — issue, branch, PR flow
- `@.claude/rules/worktrees.md` — parallel worktrees
- `@.claude/rules/testing.md` — testing conventions
- `@.claude/rules/ts-style.md` — TypeScript conventions
- `@.claude/rules/blank-lines.md` — blank lines between phases
- `@.claude/rules/models.md` — domain model placement
- `@.claude/rules/hono-patterns.md` — `apps/api` clean-architecture split
- `@.claude/rules/frontend-structure.md` — `apps/client` directory layout
- `@.claude/rules/frontend-implementation.md` — suspense-first TanStack Query
- `@.claude/rules/ui-components.md` — shadcn/ui on Base UI
- `@.claude/rules/pnpm.md` — workspace commands
- `@.claude/rules/pnpm-security.md` — supply-chain settings
- `@.claude/rules/ci.md` — GitHub Actions
- `@.claude/rules/security.md` — dependency scanning

