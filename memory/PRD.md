# Telegram Intelligence Platform - PRD v3.1

## Original Problem Statement
Создать production-ready изолированный Telegram Intelligence модуль с многофазной архитектурой:
- **Phase 1:** Production-hardened MTProto runtime ✅
- **Phase 2:** Windowed analytics pipeline (7d/30d/90d) ✅
- **Phase 3:** Alpha & Credibility Engine (Step 1 Complete ✅)
- **Phase 4 (Future):** Taxonomy, Governance, Explainability

## Architecture

### Services
| Сервис | Порт | Описание |
|--------|------|----------|
| Node.js Fastify | 8003 | Backend (TypeScript) |
| Python FastAPI Proxy | 8001 | API proxy |
| MongoDB | 27017 | База данных (telegram_dev) |

### Module Structure
```
modules/telegram-intel/
├── telegram_intel.plugin.ts   # Main plugin with routes
├── runtime/
│   ├── telegram.runtime.ts    # MTProto client
│   ├── secrets.service.ts     # Secure credentials
│   ├── rate_limiter.ts        # RPS control
│   └── retry.ts               # Exponential backoff
├── alpha/                     # Phase 3 NEW
│   ├── token_extractor.ts     # Token extraction from text
│   └── mentions.service.ts    # Mention storage & queries
├── routes/
│   └── alpha.routes.ts        # Alpha API endpoints
├── ingestion/
│   └── ingestion.service.ts   # Channel ingestion
├── metrics/
│   └── window_metrics.service.ts
├── fraud/
│   └── fraud_snapshot.service.ts
├── ranking/
│   └── ranking_snapshot.service.ts
└── models/
    ├── tg.channel_state.model.ts
    ├── tg.metrics_window.model.ts
    ├── tg.fraud_signal.model.ts
    └── tg.token_mention.model.ts  # Phase 3 NEW
```

### Frontend
```
frontend/src/
├── pages/
│   └── TelegramIntelPage.jsx  # Main Telegram dashboard
├── api/
│   └── telegramIntel.api.js   # API client
└── components/
    └── Sidebar.jsx            # Added "Telegram" nav item
```

## What's Been Implemented

### Date: 2026-02-18

#### Phase 1: Production Hardening ✅
- [x] Secure Secrets Management (Fernet encryption)
- [x] StringSession-only Mode (Pyrogram → GramJS conversion)
- [x] MTProto Runtime (rate limiting, retry, FLOOD_WAIT)

#### Phase 2: Analytics Pipeline ✅
- [x] Cursor-based Incremental Ingestion
- [x] Window-based Metrics (7d/30d/90d)
- [x] Fraud Signal Snapshots
- [x] Ranking Snapshots

#### Phase 3 Step 1: Token Extractor + Mention Storage ✅
- [x] **Token Extractor** (`token_extractor.ts`)
  - $TOKEN cashtags (confidence ~0.82)
  - #TOKEN hashtags (confidence ~0.64)
  - PAIR/USDT exchange pairs (confidence ~0.58)
  - Context boost for keywords (+0.06 each)
  - Min confidence threshold: 0.35
  
- [x] **Mention Storage** (`mentions.service.ts`)
  - Scan channel posts for tokens
  - Idempotent storage (duplicate key handling)
  - Aggregate stats (topTokens, topChannels)
  
- [x] **Alpha API Routes**
  - POST `/api/admin/telegram-intel/alpha/scan/channel`
  - POST `/api/admin/telegram-intel/alpha/scan/batch`
  - GET `/api/admin/telegram-intel/alpha/mentions/:username`
  - GET `/api/admin/telegram-intel/alpha/stats`

- [x] **Frontend Page** (`/telegram`)
  - Telegram Intelligence dashboard
  - Channel search & actions
  - Metrics, fraud, token mentions display
  - Sidebar navigation added

## API Endpoints

### Alpha Engine (Phase 3)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/telegram-intel/alpha/scan/channel` | POST | Scan channel for token mentions |
| `/api/admin/telegram-intel/alpha/scan/batch` | POST | Batch scan multiple channels |
| `/api/admin/telegram-intel/alpha/mentions/:username` | GET | Get mentions for channel |
| `/api/admin/telegram-intel/alpha/stats` | GET | Aggregate stats across all mentions |

### Core (Phase 1-2)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/telegram-intel/health` | GET | Health check |
| `/api/admin/telegram-intel/ingestion/channel` | POST | Ingest single channel |
| `/api/admin/telegram-intel/pipeline/channel` | POST | Run metrics pipeline |
| `/api/admin/telegram-intel/metrics/:username` | GET | Get window metrics |
| `/api/admin/telegram-intel/fraud/:username` | GET | Get fraud signals |

## Database Collections

### Phase 3 (Alpha)
- **tg_token_mentions** - Token mentions extracted from posts
  - Indexes: `postId+token` (unique), `username+mentionedAt`, `evaluated+mentionedAt`

### Phase 1-2 (Core)
- **tg_channel_states** - Ingestion cursors
- **tg_metrics_windows** - 7d/30d/90d snapshots
- **tg_fraud_signals** - Fraud assessments
- **tg_rankings** - Channel scores

## Testing

### Test Results
- **Phase 1-2:** 100% (22/22 tests) ✅
- **Phase 3 Step 1:** 97% (29/30 tests) ✅
  - Fixed: batch scan URL normalization

## Prioritized Backlog

### P0 (Critical - Done ✅)
- [x] Secure secrets management
- [x] StringSession-only runtime
- [x] Cursor-based ingestion
- [x] Window metrics (7d/30d/90d)
- [x] Fraud signals & ranking
- [x] Token extractor + mention storage

### P1 (High Priority - Next)
1. [ ] **Phase 3 Step 2: Price Feed + Evaluation**
   - CoinGecko price integration
   - priceAtMention capture
   - Returns calculation (24h/7d/30d)
   - Evaluation job

2. [ ] **Phase 3 Step 3: Alpha Scoring**
   - successRate calculation
   - avgReturn, earlynessFactor
   - alphaScore formula
   - Channel track record

### P2 (Medium Priority)
1. [ ] Credibility Engine
2. [ ] Taxonomy Layer
3. [ ] Explainability Layer
4. [ ] Governance Layer

---
**Last Updated:** 2026-02-18
**Version:** 3.1.0
**Status:** Phase 1-2 Complete, Phase 3 Step 1 Complete
