# JARVIS - Personal AI Assistant

## Prerequisites
- Node.js 18+
- Docker and Docker Compose
- TypeScript

## Setup
1. Clone the repository
2. Run `npm install`
3. Copy `.env.example` to `.env`
4. Start the infrastructure (PostgreSQL and Redis):
   ```bash
   cd infra
   docker-compose up -d
   ```
5. Apply database schema:
   ```bash
   npm run db:push
   ```
6. Generate Prisma client:
   ```bash
   npm run db:generate
   ```

## Running the API
To start the API in development mode:
```bash
npm run dev:api
```
The server will start on port 3000 (or the port defined in `.env`).

## Verification Commands
To test the health check endpoint, run:
```bash
curl http://localhost:3000/api/v1/health
```
You should receive a `{ "status": "ok", "timestamp": "..." }` response.

## Milestones
- [x] M1 - Foundation
- [x] M2 - Identity & Configuration
- [ ] M3 - LLM Provider
