# Samasama Monorepo

Initial monorepo scaffold for the Samasama platform.

## Stack

- `apps/api`: Node.js + TypeScript + Express
- `apps/voice-analysis`: Python 3.11 + FastAPI
- `apps/mobile`: React Native Expo + TypeScript
- `packages/db`: Prisma client and schema
- `packages/shared`: shared placeholder enums and types
- PostgreSQL 16 via Docker Compose

## Prerequisites

- Node.js 20+
- npm 10+
- Python 3.11
- Docker with `docker compose`

## Startup

1. Install JavaScript dependencies:

```bash
npm install
```

2. Copy environment templates:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp packages/db/.env.example packages/db/.env
cp apps/mobile/.env.example apps/mobile/.env
```

3. Start PostgreSQL:

```bash
docker compose up -d
```

4. Generate the Prisma client:

```bash
npm run db:generate
```

5. Apply database migrations:

```bash
npm run db:migrate
```

6. Seed demo data:

```bash
npm run db:seed
```

7. Set up the Python virtual environment and install voice-analysis dependencies:

```bash
npm run voice-analysis:venv
npm run voice-analysis:install
```

## Run services

API:

```bash
npm run api:dev
```

API health check:

```bash
curl http://localhost:3001/health
```

API auth tests:

```bash
npm run api:test
```

Voice analysis:

```bash
npm run voice-analysis:dev
```

Voice-analysis health check:

```bash
curl http://localhost:8001/health
```

Mobile Expo app:

```bash
npm run mobile:dev
```

For physical device testing with Expo Go, set the mobile API URL to the host
machine IP address, not `localhost`:

```bash
EXPO_PUBLIC_API_URL="http://192.168.178.47:3001"
```

The phone and development machine must be on the same network, and the API must
be running on port `3001`.

### Mobile troubleshooting

`localhost` does not work from a physical phone because it points to the phone
itself, not your development machine. Use the development machine's LAN IP, such
as `http://192.168.178.47:3001`, so Expo Go can reach the API over Wi-Fi.

## Workspace scripts

- `npm run api:dev`: Start the API in watch mode on port `3001`
- `npm run api:start`: Start the compiled API
- `npm run api:test`: Run the API route tests
- `npm run voice-analysis:venv`: Create the Python virtual environment
- `npm run voice-analysis:install`: Install FastAPI dependencies into the virtual environment
- `npm run voice-analysis:dev`: Start FastAPI with reload on port `8001`
- `npm run voice-analysis:start`: Start FastAPI without reload
- `npm run mobile:dev`: Start the Expo development server
- `npm run db:generate`: Generate the Prisma client
- `npm run db:migrate`: Apply committed Prisma migrations
- `npm run db:seed`: Seed demo curriculum and user data

## Notes

- No business logic, auth, scoring, or face analysis is included yet.
- PostgreSQL credentials are intentionally local-development defaults.
- PostgreSQL is exposed on local port `5433` to avoid conflicts with any existing host Postgres on `5432`.
- API auth env vars are documented in `apps/api/.env.example`.
- A Bruno auth collection is available in `apps/api/bruno/samasama-auth`.
- The seeded demo login is `demo@samasama.local` / `password123`.
