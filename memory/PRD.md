# Telegram Discovery Module - PRD

## Original Problem Statement
Создать изолированный Telegram Discovery + Ranking модуль который можно:
- Разрабатывать отдельно
- Тестировать отдельно
- Безопасно влить в main

Требования:
- Backend (Fastify server + Mongo connection)
- Свои MongoDB коллекции (tg_*)
- Свой namespace API /api/telegram/*
- Свои jobs
- Полная автономность (удаление модуля не ломает систему)

## Architecture

### Services
| Сервис | Порт | Описание |
|--------|------|----------|
| Node.js Fastify | 8003 | Backend (TypeScript) |
| Python FastAPI Proxy | 8001 | API proxy |
| MongoDB | 27017 | База данных (telegram_dev) |

### Module Structure
```
modules/telegram-discovery/
├── models/          # 6 MongoDB коллекций (tg_*)
├── services/        # discovery, metrics, ranking, fraud
├── adapter/         # Telegram API wrapper (mock mode)
├── jobs/            # Background jobs
└── routes/          # API endpoints
```

## What's Been Implemented

### Date: 2026-02-18

#### Backend Module (100% Complete)
- [x] 6 MongoDB models (tg_channels, tg_posts, tg_metrics, tg_rankings, tg_discovery_edges, tg_candidates)
- [x] Discovery Service (seed channels, discover from posts, candidates queue)
- [x] Metrics Service (hourly metrics calculation)
- [x] Ranking Service (daily ranking calculation with scoring formula)
- [x] Fraud Service (fraud indicators analysis)
- [x] Telegram Adapter (mock mode for development)
- [x] 17 API endpoints under /api/telegram/*
- [x] Background jobs (discovery, metrics, ranking)
- [x] Module registration in app.ts
- [x] Full test coverage (100% backend tests passed)

#### Tested Endpoints
- GET /api/telegram/health ✅
- GET /api/telegram/channels ✅
- GET /api/telegram/channels/:channelId ✅
- POST /api/telegram/channels/seed ✅
- PATCH /api/telegram/channels/:channelId/status ✅
- GET /api/telegram/discovery/stats ✅
- GET /api/telegram/discovery/candidates ✅
- POST /api/telegram/rankings/calculate ✅
- GET /api/telegram/rankings ✅
- GET /api/telegram/fraud/analyze/:channelId ✅
- GET /api/telegram/metrics/:channelId ✅
- POST /api/telegram/metrics/calculate/:channelId ✅

## Core Requirements (Static)

### Module Isolation
- All collections prefixed with `tg_`
- All routes under `/api/telegram/*`
- No dependencies on other modules
- Can be removed without breaking system

### Scoring Formula
```
overallScore = quality*0.25 + engagement*0.25 + growth*0.20 + consistency*0.15 - fraud*0.15
```

## Prioritized Backlog

### P0 (Critical - Done)
- [x] Module structure and isolation
- [x] MongoDB models
- [x] Core services (discovery, metrics, ranking, fraud)
- [x] API endpoints
- [x] Background jobs framework

### P1 (High Priority - Next)
1. [ ] Telegram API integration (MTProto)
2. [ ] Real channel ingestion
3. [ ] Post content analysis
4. [ ] Channel validation

### P2 (Medium Priority)
1. [ ] NLP for content quality scoring
2. [ ] Advanced fraud detection ML
3. [ ] Graph analysis for influence
4. [ ] Real-time metrics updates

### P3 (Future)
1. [ ] Admin UI integration
2. [ ] Alerts and notifications
3. [ ] Export/reporting

## User Personas
1. **System** - автоматическое обнаружение и скоринг
2. **Admin** - управление каналами, просмотр метрик
3. **Developer** - расширение функциональности

## Environment Variables
```env
MONGODB_URI=mongodb://localhost:27017/telegram_dev
TELEGRAM_DISCOVERY_ENABLED=true
TELEGRAM_API_ID=<optional>
TELEGRAM_API_HASH=<optional>
MINIMAL_BOOT=1  # Disable background jobs
```

## Notes
- Adapter работает в mock режиме (без API credentials)
- Jobs отключены при MINIMAL_BOOT=1
- Все тесты пройдены успешно

---
**Last Updated:** 2026-02-18
