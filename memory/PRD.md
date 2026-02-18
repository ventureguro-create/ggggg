# Telegram Intelligence Platform - PRD v3.0

## Original Problem Statement
Создать production-ready изолированный Telegram Intelligence модуль с многофазной архитектурой:
- **Phase 1:** Production-hardened MTProto runtime
- **Phase 2:** Windowed analytics pipeline (7d/30d/90d)
- **Phase 3 (Future):** Alpha & Credibility Engine
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
│   ├── retry.ts               # Exponential backoff
│   └── entity_cache.ts        # LRU cache
├── ingestion/
│   ├── ingestion.service.ts   # Channel ingestion
│   └── fingerprint.ts         # Content hashing
├── jobs/
│   ├── ingestion.job.ts       # Batch ingestion
│   ├── metrics_pipeline.job.ts # Analytics pipeline
│   └── job_lock.service.ts    # Concurrency control
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
    └── tg.job_lock.model.ts
```

## What's Been Implemented

### Date: 2026-02-18

#### Phase 1: Production Hardening ✅
- [x] **Secure Secrets Management**
  - Fernet encryption for credentials (secrets.enc)
  - TG_SECRETS_KEY env variable
  - Pyrogram → GramJS session conversion
  - No plaintext credentials in code/git
  
- [x] **StringSession-only Mode**
  - No interactive authorization
  - Session loaded from encrypted file
  - Automatic base64url conversion
  
- [x] **MTProto Runtime**
  - Rate limiting (global + per-method RPS)
  - Exponential backoff with retry
  - FLOOD_WAIT handling
  - Entity cache (LRU, 800 items)
  - Safe shutdown

#### Phase 2: Analytics Pipeline ✅
- [x] **Cursor-based Incremental Ingestion**
  - lastMessageId tracking per channel
  - Cooldown protection (1 hour default)
  - Profile refresh (12 hours default)
  - Batch limit (150 messages)
  
- [x] **Window-based Metrics (7d/30d/90d)**
  - postsCount, postsPerDay
  - medianViews, p90Views
  - viewDispersion, viewGrowthSlope
  - forwardRate, replyRate
  - activeDaysRatio
  
- [x] **Fraud Signal Snapshots**
  - subscriberEfficiency
  - irregularPosting
  - spikeRatio
  - elasticity
  - Combined fraudRisk score
  
- [x] **Ranking Snapshots**
  - Computed score
  - Trust level assignment

## API Endpoints

### Admin Endpoints (telegram-intel)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/telegram-intel/health` | GET | Health check with runtime status |
| `/api/admin/telegram-intel/ingestion/run` | POST | Batch ingestion |
| `/api/admin/telegram-intel/ingestion/channel` | POST | Single channel ingestion |
| `/api/admin/telegram-intel/pipeline/run` | POST | Run full metrics pipeline |
| `/api/admin/telegram-intel/pipeline/channel` | POST | Pipeline for single channel |
| `/api/admin/telegram-intel/state/:username` | GET | Get channel state (cursor) |
| `/api/admin/telegram-intel/metrics/:username` | GET | Get window metrics |
| `/api/admin/telegram-intel/fraud/:username` | GET | Get fraud signals |

## Database Collections

### telegram-intel module
- **tg_channel_states** - Ingestion cursors and profile state
- **tg_metrics_windows** - 7d/30d/90d metric snapshots
- **tg_fraud_signals** - Fraud risk assessments
- **tg_rankings** - Computed channel scores
- **tg_job_locks** - Job concurrency control

### telegram-discovery module (legacy)
- **tg_channels** - Channel profiles
- **tg_posts** - Raw post data
- **tg_seeds** - Seed channels
- **tg_metrics** - Basic metrics

## Environment Variables

```env
# Required for telegram-intel
TG_SECRETS_KEY=<fernet-key>           # Decryption key for secrets.enc
TELEGRAM_INTEL_ENABLED=true           # Enable module

# Optional tuning
TG_RPS_GLOBAL=2                       # Global rate limit
TG_RPS_RESOLVE=1                      # Resolve rate limit
TG_RPS_HISTORY=2                      # History rate limit
TG_MAX_RETRIES=6                      # Max retry attempts
TG_RETRY_BASE_MS=750                  # Base retry delay
TG_PROFILE_REFRESH_HOURS=12           # Profile refresh interval
TG_INGEST_COOLDOWN_MIN=60             # Cooldown between ingests
TG_INGEST_BATCH_LIMIT=150             # Max messages per batch
```

## Security

### Credentials Storage
1. **secrets.enc** - Fernet-encrypted JSON file
2. **TG_SECRETS_KEY** - Decryption key in env variable
3. **No plaintext** in code, logs, or git
4. **.gitignore** protects `.secrets/` directory

### Session Format
- Pyrogram StringSession auto-converted to GramJS format
- DC-to-IP mapping for Telegram production servers
- Session held in memory only

## Testing

### Test Results (iteration_4.json)
- **Success Rate:** 100% (22/22 tests passed)
- **Test Channel:** @durov (472 posts ingested)
- **Fraud Score:** 0.15
- **Ranking Score:** 29.35

## Prioritized Backlog

### P0 (Critical - Done ✅)
- [x] Secure secrets management
- [x] StringSession-only runtime
- [x] Cursor-based ingestion
- [x] Window metrics (7d/30d/90d)
- [x] Fraud signals
- [x] Basic ranking

### P1 (High Priority - Next)
1. [ ] **Phase 3: Alpha Engine**
   - Token mention extraction ($TOKEN)
   - Price feed integration (CoinGecko)
   - Alpha score calculation
   - Channel track record

### P2 (Medium Priority)
1. [ ] Taxonomy Layer (categories, topics, languages)
2. [ ] Explainability Layer (score breakdown API)
3. [ ] Governance Layer (admin UI for overrides)
4. [ ] Cross-channel reuse detection

### P3 (Future)
1. [ ] ML-enhanced fraud detection
2. [ ] Graph analysis for influence
3. [ ] Real-time metrics updates
4. [ ] Webhook notifications

---
**Last Updated:** 2026-02-18
**Version:** 3.0.0
**Status:** Phase 1-2 Complete, Production Ready
