Prompt for Codex
# Overview

first the repo and database,
then contracts,
then auth and read APIs,
then the attempt loop,
then progression,
then the real analysis contract,
then the mobile flow.



# Ticket 1 — Monorepo skeleton and local dev bootstrap

Set up the initial Samasama monorepo.

Goal:
Create a runnable monorepo with:
- apps/api
- apps/voice-analysis
- apps/mobile
- packages/db
- packages/shared

Tech constraints:
- Node.js + TypeScript for api
- Python 3.11 for voice-analysis
- React Native Expo + TypeScript for mobile
- PostgreSQL 16 via docker compose
- Prisma in packages/db

Deliverables:
- root package.json with workspace scripts
- docker-compose.yml for postgres only
- apps/api package with a health route
- apps/voice-analysis FastAPI app with /health
- apps/mobile Expo app that starts
- packages/db with Prisma init
- packages/shared with placeholder enums/types
- .env.example files where needed
- README with exact startup commands

Acceptance criteria:
- `docker compose up -d` starts postgres
- api starts and GET /health returns 200
- voice-analysis starts and GET /health returns 200
- mobile app starts with Expo
- no fake business logic yet
- all scripts are documented

Out of scope:
- auth
- lesson logic
- real scoring
- face analysis





# Ticket 2
Database schema for curriculum, users, attempts, progression
Implement the initial Prisma schema for Samasama.

Goal:
Create a pragmatic V1 relational schema for:
- User
- RefreshToken
- Lesson
- Exercise
- LessonPrerequisite
- UserLessonProgress
- Attempt
- VoiceAnalysisResult
- SpriteState
- SpriteGrowthEvent

Requirements:
- curriculum must support spriteGrowthEvents for infant -> toddler only in V1
- attempts must be append-only
- analysis result must be separate from attempt
- progression state must not depend on deleting history
- include created_at / updated_at fields consistently
- use enums where appropriate

Deliverables:
- prisma schema
- initial migration
- seed script with 5 lessons and linked exercises
- seed one demo user
- seed one tamagotchi state for demo user
- seed data should be simple and explicit. Do not attempt English Language linguistic correctness.
- seed data to use clear placeholder names like:
        - "INFANT_VOWEL_A"
        - "SYLLABLE_BA"
        

Acceptance criteria:
- `npm run db:migrate` succeeds
- `npm run db:seed` succeeds
- demo lessons are queryable in postgres
- prerequisites are represented via junction table
- attempt and analysis tables are linked correctly

Out of scope:
- pass/fail logic
- auth routes
- real media storage



# Ticket 3
Create the shared contracts package for Samasama.

Goal:
Add a shared TypeScript package used by api and mobile.

Include:
- feedback_code enum placeholders
- lesson DTOs
- exercise DTOs
- attempt status enum
- sprite stage enum
- API response interfaces for:
  - auth
  - lessons list
  - lesson detail
  - create attempt
  - submit attempt result
  - progression snapshot

Requirements:
- all names must be explicit and future-proof
- do not add business logic
- structure for import by apps/api and apps/mobile

Acceptance criteria:
- package builds
- api imports at least one shared type
- mobile imports at least one shared type
- no circular dependencies




# Ticket 4 - Auth API: register, login, refresh, me

Implement Samasama auth in apps/api.

Goal:
Add auth routes:
- POST /auth/register
- POST /auth/login
- POST /auth/refresh
- GET /me

Stack constraints:
- Fastify
- JWT access token + refresh token pair
- Zod validation
- Prisma from packages/db

Requirements:
- password hashing
- refresh tokens stored server-side
- me route requires valid access token
- add Postman collection or Bruno collection
- document env vars in .env.example

Acceptance criteria:
- register creates user
- login returns access + refresh token
- refresh rotates refresh token
- /me returns current user
- invalid tokens are rejected
- basic route tests exist

Out of scope:
- social auth
- email verification
- password reset



# Ticket 5 — Curriculum read API

Implement curriculum read routes in apps/api.

Goal:
Expose V1 curriculum content for the mobile app.

Routes:
- GET /lessons
- GET /lessons/:lessonId

Requirements:
- return infant/toddler seeded lessons
- include exercises in lesson detail
- include prerequisite info
- include user's completion/unlock status if authenticated
- reuse shared DTO types

Acceptance criteria:
- lessons list works for anonymous and authenticated requests
- lesson detail includes exercises and unlock metadata
- tests cover missing lesson and basic happy path
- no write operations yet

Out of scope:
- content asset URLs
- real media signing
- progression mutations



# Ticket 6 — Attempt creation API and placeholder feedback pipeline

Implement attempt creation with placeholder scoring.

Goal:
Create the end-to-end attempt loop without real ML scoring yet.

Routes:
- POST /attempts
- GET /attempts/:attemptId

Behavior:
- authenticated user creates attempt for an exercise
- attempt row starts as PENDING
- a placeholder scoring service function runs
- attempt becomes SCORED
- voice analysis result row is created with mock values
- response includes feedback_code and basic metrics

Requirements:
- keep analysis logic behind an interface so real voice analysis can replace it later
- do not call external services yet
- keep media fields optional placeholders for now

Acceptance criteria:
- creating an attempt inserts Attempt + VoiceAnalysisResult
- attempt status transitions PENDING -> SCORED
- GET attempt returns structured result
- tests verify DB writes and transition

Out of scope:
- real audio upload
- face analysis
- progression unlock rules



# Ticket 7 — Progression service rules and transactional update

Implement progression evaluation and sprite update.

Goal:
When a scored attempt qualifies as a pass, update:
- UserLessonProgress
- SpriteState
- SpriteGrowthEvent when stage threshold crossed

Requirements:
- progression decision must be made in one transaction
- analysis result provides measurements only
- progression service decides pass/fail
- add a simple V1 rule:
  - exercise passes if pitchScore >= threshold and phonemeScore >= threshold
- if a lesson becomes complete, mark it complete once only
- avoid duplicate growth events on repeated processing

Acceptance criteria:
- passing attempt updates progress once
- reprocessing same attempt does not duplicate progression or growth
- failing attempt does not update lesson completion
- repository/service tests cover idempotency and transaction behavior

Out of scope:
- push notifications
- retry queue
- advanced pedagogy


# Ticket 8 — Voice analysis service skeleton with real file ingestion contract

Implement the first real voice-analysis service contract in apps/voice-analysis.

Goal:
Build a FastAPI service with:
- POST /analyze/voice
- GET /health
- OpenAPI docs

Input:
- exercise reference id
- uploaded audio file

Output:
- structured JSON with:
  - feedback_code
  - pitch_score
  - phoneme_score
  - confidence
  - notes
- values can still be mocked or heuristic, but the contract must be real

Requirements:
- define pydantic request/response models
- save uploaded file to temp location only for request lifecycle
- include shared feedback_code list in a constants file
- add tests for health route and analyze route

Acceptance criteria:
- /docs renders
- multipart audio upload is accepted
- response shape is stable and documented
- service starts on port 8001
- no permanent file storage

Out of scope:
- Whisper integration
- pyworld/librosa scoring
- production-grade DSP


# Ticket 9 — Mobile app shell: auth, lessons list, lesson detail

Implement the first usable mobile shell in apps/mobile.

Goal:
Build a minimal Expo app with:
- login screen
- lessons list screen
- lesson detail screen
- global auth state
- typed api client module

Requirements:
- TypeScript
- React Navigation
- Zustand for auth/app state
- theme.ts tokens file
- consume the api routes already created
- use mocked local images/placeholders where needed
- clean loading and error states

Acceptance criteria:
- user can log in
- user sees lessons list from API
- user can open lesson detail
- app compiles on Expo
- no attempt recording yet

Out of scope:
- Sprite animation
- audio recording
- push notifications


# Ticket 10 — Mobile attempt flow with stub recording UI and feedback view

Implement the first exercise interaction flow in apps/mobile.

Goal:
Create a LessonScreen / Exercise flow that lets the user:
- open an exercise
- tap a record button
- simulate sending an attempt
- receive structured feedback
- see progression snapshot after submission

Requirements:
- for this ticket, recording can be stubbed or use placeholder local audio
- the point is to prove the interaction flow
- map feedback_code to user-facing messages in one file
- keep UI mobile-native and simple
- document where real audio recording will plug in later

Acceptance criteria:
- exercise screen loads from API data
- pressing submit creates an attempt through the API
- feedback result renders correctly
- progression/tamagotchi summary area updates from returned data
- error state shown when API fails

Out of scope:
- real microphone capture
- face capture
- sprite animation system
