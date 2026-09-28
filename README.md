# wedding-website

General Wedding Website — a whitelabel, multi-tenant wedding site (pnpm + Turborepo monorepo).

## Requirements

- Node 22 (`nvm use`)
- pnpm 10 (`corepack enable`)

## Getting started

```sh
pnpm install
pnpm lint        # eslint across all workspaces
pnpm typecheck   # tsc --noEmit across all workspaces
pnpm test        # vitest across all workspaces
pnpm format      # prettier --write
```

## Layout

| Path              | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| `packages/config` | Shared tsconfig, ESLint flat config and Prettier config    |
| `packages/env`    | `createEnv` — zod-validated, fail-fast environment loading |

Planning and the merge ledger live in [TASKS.md](TASKS.md).
