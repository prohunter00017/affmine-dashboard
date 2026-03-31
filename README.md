<div align="center">

# AffMine Publisher Dashboard

**A modern, full-stack affiliate marketing dashboard for the AffMine Publisher API**

Manage campaigns, analyze performance, and export data — all from a sleek dark-themed interface.

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-Monorepo-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-22C55E?style=flat-square)](#license)

</div>

---

## Overview

AffMine Publisher Dashboard is a full-stack web application that connects to the [AffMine affiliate network](https://www.affmine.com/r/43326) Publisher API and presents campaign data through an intuitive, real-time dashboard. Built as a **pnpm monorepo** with a React frontend and Express backend, it gives affiliate publishers the tools they need to browse campaigns, analyze performance metrics, and manage their workflow efficiently.

---

## Features

- **Real-Time Campaign Data** — Fetches live campaign data directly from the AffMine Publisher API
- **Advanced Filtering** — Filter campaigns by status, platform, category, country, and incentive type; searchable comboboxes and multi-select country picker
- **Favorites** — Star any campaign to save it; toggle a Favorites-only view with a single click; count badge shown in the sidebar
- **Saved Filter Presets** — Name and save any combination of active filters; reload or delete presets at any time
- **LLM Export** — Export all visible campaigns as Markdown (`.md`) or JSON (`.json`) for AI-assisted analysis
- **CSV Export** — Export all filtered campaigns to CSV with a single click
- **Campaign Browser** — Paginated table with 20 rows per page and full-detail dialog per campaign
- **Analytics Dashboard** — Visual breakdowns by category, platform, country, and payout statistics
- **Dark Theme with Green Accent** — Professional UI built with Tailwind CSS and shadcn/ui
- **Local Credential Storage** — API credentials stored in browser localStorage and sent only to your proxy server
- **Docker Deployment** — One-command deployment with `docker compose up --build` or the guided `install.py` script
- **Type-Safe Architecture** — End-to-end TypeScript with auto-generated API clients via Orval

---

## Screenshots

| Dashboard Overview | Campaign Browser |
|:--:|:--:|
| ![Dashboard](docs/screenshots/dashboard.jpg) | ![Campaigns](docs/screenshots/campaigns.jpg) |

| Analytics & Charts | Settings |
|:--:|:--:|
| ![Analytics](docs/screenshots/analytics.jpg) | ![Settings](docs/screenshots/settings.jpg) |

---

## Quick Start with Docker

The fastest way to get running. Requires [Docker](https://docs.docker.com/get-docker/) (with Compose).

### Option A — committed Docker files (recommended for developers)

```bash
git clone https://github.com/prohunter00017/affmine-dashboard.git
cd affmine-dashboard

# 1. Create your credentials file
cp .env.example .env
# Edit .env and set AFF_ID and API_KEY

# 2. Build and start all containers
docker compose up --build
```

Open **http://localhost:3000** in your browser.

```bash
docker compose down       # Stop all containers
docker compose logs -f    # Follow logs
```

### Option B — guided installer (recommended for non-developers)

Requires Python 3.6+. Automatically detects your OS, scans for free ports, and prompts for credentials.

```bash
python install.py

python install.py --status   # Check container status
python install.py --stop     # Stop all containers
```

> Don't have AffMine credentials yet? [Sign up for a free AffMine publisher account](https://www.affmine.com/r/43326) to get your `aff_id` and `api_key`.

---

## Manual Development Setup

For local development without Docker.

### Prerequisites

- **Node.js** 20 or later (Node.js 24 recommended)
- **pnpm** 9 or later (`corepack enable && corepack prepare pnpm@latest --activate`)

### Installation

```bash
# Clone the repository
git clone https://github.com/prohunter00017/affmine-dashboard.git
cd affmine-dashboard

# Install all dependencies
pnpm install

# Start the API server (port 8080)
PORT=8080 pnpm --filter @workspace/api-server run dev

# In a separate terminal, start the dashboard (port 5173)
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/affmine-dashboard run dev
```

Open **http://localhost:5173**, navigate to **Settings**, and enter your AffMine `aff_id` and `api_key`. Credentials are entered in-app — no `.env` file is needed for local development.

### Useful Commands

```bash
pnpm run typecheck                              # Type-check all packages
pnpm --filter @workspace/api-server run build    # Build API server (esbuild)
pnpm --filter @workspace/affmine-dashboard run build  # Build dashboard (Vite)
pnpm --filter @workspace/api-spec run codegen    # Regenerate API client from OpenAPI spec
```

---

## Project Structure

<details>
<summary>View full directory tree</summary>

```
affmine-dashboard/
├── artifacts/
│   ├── affmine-dashboard/        # React + Vite frontend (dark theme, green accent)
│   │   └── src/
│   │       ├── pages/            # Dashboard, Campaigns, Analytics, Settings
│   │       ├── components/       # Layout, credential banner, shadcn/ui components
│   │       └── hooks/            # useCredentials, useFavorites, useSavedFilters
│   └── api-server/               # Express 5 backend (API proxy)
│       └── src/
│           └── routes/           # Campaign, stats, filter-options, health endpoints
├── lib/
│   ├── api-spec/                 # OpenAPI 3.1 specification + Orval codegen config
│   ├── api-client-react/         # Auto-generated React Query hooks + fetch client
│   ├── api-zod/                  # Auto-generated Zod validation schemas
│   └── db/                       # Drizzle ORM schema + database connection
├── Dockerfile                    # Multi-stage Docker build (builder / api / dashboard)
├── docker-compose.yml            # Orchestrates api, dashboard, and postgres containers
├── .env.example                  # Template for required environment variables
├── install.py                    # Guided Docker installer (cross-platform)
├── package.json                  # Monorepo root
├── pnpm-workspace.yaml           # Workspace configuration
└── tsconfig.base.json            # Shared TypeScript configuration
```

</details>

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite 6, Tailwind CSS 4, shadcn/ui |
| **State & Data** | React Query (TanStack Query v5), Orval-generated hooks |
| **Backend** | Express 5, Node.js 20+ |
| **Language** | TypeScript 5.9 (end-to-end) |
| **Validation** | Zod v4 (auto-generated from OpenAPI spec) |
| **API Spec** | OpenAPI 3.1 |
| **Build** | esbuild (API server), Vite (dashboard) |
| **Monorepo** | pnpm workspaces |
| **Deployment** | Docker, Docker Compose, nginx |

---

## Dashboard Pages

<details>
<summary>View page descriptions</summary>

### Dashboard (`/`)

The overview page displays key performance indicators at a glance:

- **Total Campaigns** — Number of active campaigns available
- **Average Payout** — Mean payout across all campaigns
- **Top Category** — Most common campaign category
- **Top Platform** — Most popular target platform
- **Recent Campaigns** — Quick-access table of the latest campaigns

### Campaign Browser (`/campaigns`)

A full-featured campaign management interface:

- Filter by **status**, **platform**, **category**, **country**, and **incentive** type
- Searchable category combobox and multi-select country filter with search
- **Favorites** — Star campaigns to save them; toggle Favorites-only view with a chip; starred count shown as a badge in the sidebar
- **Saved Filter Presets** — Save and name any active filter combination, then load or delete it from the Presets dropdown
- **Export for LLM** — One-click Markdown (`.md`) export of all visible campaigns; dropdown also offers JSON (`.json`) for structured data pipelines
- **CSV Export** — Export all campaigns matching current filters
- Client-side pagination with 20 campaigns per page
- Click any campaign to open a **detail dialog** with full information, tracking link copy, and a star toggle

### Analytics (`/stats`)

Visual analytics for data-driven decisions:

- **Category bar chart** — Campaign distribution across categories
- **Platform donut chart** — Breakdown by target platform
- **Country grid** — Geographic distribution of campaigns
- **Payout statistics** — Min, max, average, and median payout cards

### Settings (`/settings`)

Credential management and system status:

- Enter and validate your AffMine `aff_id` and `api_key`
- Live validation against the AffMine API
- Proxy server health check indicator
- Credentials stored in browser localStorage

</details>

---

## API Reference

The backend exposes a RESTful API that proxies and normalizes data from the AffMine Publisher API.

<details>
<summary>View endpoint documentation</summary>

### `GET /api/healthz`

Health check endpoint for the proxy server.

**Response:** `200 OK` with `{ "status": "ok" }`

### `GET /api/campaigns`

Retrieve a list of campaigns with optional filters.

| Parameter | Type | Description |
|-----------|------|-------------|
| `aff_id` | string | **Required.** Your AffMine affiliate ID |
| `api_key` | string | **Required.** Your AffMine API key |
| `offer_status` | string | Filter by status (e.g., `active`, `paused`) |
| `platform` | string | Filter by platform (e.g., `Android`, `iOS`, `Desktop`) |
| `category` | string | Filter by campaign category |
| `countries` | string | Filter by country code(s) |
| `incentive` | string | Filter by incentive type |
| `start_row` | number | Pagination offset (default: `0`) |
| `limit_row` | number | Number of campaigns per page (default: `500`) |

### `GET /api/campaigns/stats`

Retrieve aggregated statistics across all campaigns.

| Parameter | Type | Description |
|-----------|------|-------------|
| `aff_id` | string | **Required.** Your AffMine affiliate ID |
| `api_key` | string | **Required.** Your AffMine API key |

**Response includes:** payout statistics, category breakdown, platform breakdown, country breakdown.

### `GET /api/campaigns/filter-options`

Retrieve available filter values for building the filter UI.

| Parameter | Type | Description |
|-----------|------|-------------|
| `aff_id` | string | **Required.** Your AffMine affiliate ID |
| `api_key` | string | **Required.** Your AffMine API key |

**Response includes:** list of distinct countries and categories across all campaigns.

</details>

---

## Get Your API Keys

To use the AffMine Publisher Dashboard, you need an `aff_id` and `api_key` from the AffMine affiliate network.

### How to get your credentials:

1. **[Sign up for a free AffMine publisher account](https://www.affmine.com/r/43326)**
2. Log in to the AffMine publisher portal
3. Navigate to your **account settings** or **API** section
4. Copy your **Affiliate ID** (`aff_id`) and **API Key** (`api_key`)
5. Enter them in the dashboard **Settings** page or provide them during Docker setup

> AffMine is a global affiliate network offering thousands of campaigns across mobile, desktop, and web platforms. [Join AffMine today](https://www.affmine.com/r/43326) and start monetizing your traffic.

---

## Configuration

<details>
<summary>View environment variables and storage details</summary>

### Environment Variables

Copy `.env.example` to `.env` and fill in your credentials. The `install.py` script also generates this file automatically via an interactive prompt.

| Variable | Description | Default |
|----------|-------------|---------|
| `DASHBOARD_PORT` | Port for the dashboard UI | `3000` |
| `API_PORT` | Port for the API server | `5000` |
| `POSTGRES_PORT` | Port for PostgreSQL | `5432` |
| `AFF_ID` | Your AffMine affiliate ID | *(required)* |
| `API_KEY` | Your AffMine API key | *(required)* |

### Browser Storage

In development mode (without Docker), credentials and user preferences are stored in **browser localStorage**:

| Key | Description |
|-----|-------------|
| `affmine_aff_id` | Your affiliate ID |
| `affmine_api_key` | Your API key |
| `affmine_favorites` | JSON array of starred campaign IDs |
| `affmine_saved_filters` | JSON array of named filter presets |

These values are sent only to your local proxy server, which forwards credentials to the official AffMine API. No third-party services receive your credentials. Favorites and filter presets stay entirely in your browser.

</details>

---

## Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/my-feature`)
3. **Commit** your changes (`git commit -m 'Add my feature'`)
4. **Push** to your branch (`git push origin feature/my-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Run `pnpm run typecheck` before submitting — all packages must pass with zero errors
- Follow existing code style and TypeScript conventions
- Add JSDoc comments to new exported functions
- Test your changes with real AffMine API credentials when possible
- Questions? Reach out on [LinkedIn](https://www.linkedin.com/in/don7amza/)

---

## License

This project is licensed under the MIT License.

---

<div align="center">

**Built for the [AffMine](https://www.affmine.com/r/43326) publisher community**

[Get Your API Keys](https://www.affmine.com/r/43326) | [Report a Bug](https://www.linkedin.com/in/don7amza/) | [Request a Feature](https://www.linkedin.com/in/don7amza/) | [Contact](https://www.linkedin.com/in/don7amza/)

</div>
