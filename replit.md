# AffMine Publisher Dashboard

## Overview

Full-stack dashboard for the AffMine Publisher API, built as a pnpm workspace monorepo. The backend proxies requests to the AffMine API and normalises the response; the frontend displays campaign data across four pages.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Frontend**: React 19 + Vite, Tailwind CSS, shadcn/ui (dark theme, green accent)
- **Data fetching**: React Query (via Orval-generated hooks)
- **Validation**: Zod (`zod/v4`)
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (API server), Vite (dashboard)

## Structure

```text
artifacts/
├── affmine-dashboard/     # React + Vite dashboard (dark theme, green accent)
├── api-server/            # Express 5 API proxy server
└── mockup-sandbox/        # Design preview sandbox (platform-managed)
lib/
├── api-spec/              # OpenAPI 3.1 spec + Orval codegen config
├── api-client-react/      # Generated React Query hooks + fetch client
├── api-zod/               # Generated Zod schemas from OpenAPI
└── db/                    # Drizzle ORM schema + DB connection (unused)
scripts/                   # Utility scripts package
```

## Dashboard Pages

- **Dashboard** (`/`) — KPI cards (total campaigns, avg payout, top category, top platform) + recent campaigns table
- **Campaign Browser** (`/campaigns`) — Full campaign list with filters (status, platform, category, country, incentive), client-side pagination (20 rows/page), CSV export, and detail dialog
- **Analytics** (`/stats`) — Bar chart (categories), donut chart (platforms), country grid, payout stats cards
- **Settings** (`/settings`) — Credential form with live validation and proxy server health check

## Key Features

- **Credentials**: Stored in localStorage (`affmine_aff_id`, `affmine_api_key`); managed by `useCredentials` hook using `useSyncExternalStore` for cross-component reactivity
- **Filtering**: Status, platform, category (searchable combobox), country (multi-select with search), incentive
- **CSV Export**: Exports all campaigns matching current filters (not just current page)
- **Pagination**: Server-side via `fetchAllCampaigns` + client-side 20-row pages

## API Endpoints

All routes are mounted under `/api`:

- `GET /api/healthz` — Proxy server health check
- `GET /api/campaigns` — List campaigns with filters (`aff_id`, `api_key`, `offer_status`, `countries`, `platform`, `category`, `incentive`, `start_row`, `limit_row`)
- `GET /api/campaigns/stats` — Aggregated statistics (payout stats, category/country/platform breakdowns)
- `GET /api/campaigns/filter-options` — Available filter values (distinct countries + categories)

## AffMine API Integration

- Upstream: `https://network.affmine.com/api/v1/getCampaigns`
- Response format: JSON (with `offer_feed` wrapper); XML fallback supported
- Key field mappings: `offer_id` → `id`, `price_format` → `payout_type`, `preview` → `preview_url`, `url` → `tracking_url`, `allowed_platform` → `platforms`, `converts_on` used as category fallback
- Country parsing handles: arrays, single objects, nested `{ country: {...} }` wrappers, comma-separated strings

## TypeScript & Build

- Every package extends `tsconfig.base.json` (`composite: true`)
- Typecheck: `pnpm run typecheck` (root — builds full dependency graph)
- API server bundle: `pnpm --filter @workspace/api-server run build` (esbuild)
- Dashboard dev: `pnpm --filter @workspace/affmine-dashboard run dev` (Vite)
- Codegen: `pnpm --filter @workspace/api-spec run codegen`
