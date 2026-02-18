# Telegram Intelligence Platform - PRD v3.3

## Original Problem Statement
Создать production-ready изолированный Telegram Intelligence модуль с многофазной архитектурой:
- **Phase 1:** Production-hardened MTProto runtime ✅
- **Phase 2:** Windowed analytics pipeline (7d/30d/90d) ✅
- **Phase 3:** Alpha & Credibility Engine (Step 1-3 Complete ✅)
- **Phase 4 (Future):** Taxonomy, Governance, Explainability

## Architecture

### Module Structure
```
modules/telegram-intel/
├── telegram_intel.plugin.ts
├── runtime/                    # Phase 1
│   ├── telegram.runtime.ts
│   ├── secrets.service.ts
│   ├── rate_limiter.ts
│   └── retry.ts
├── price/                      # Phase 3 Step 2
│   ├── price.provider.ts
│   ├── coingecko.adapter.ts
│   ├── price.cache.model.ts
│   └── price.service.ts
├── alpha/                      # Phase 3 Step 1-3
│   ├── token_extractor.ts
│   ├── mentions.service.ts
│   ├── price_evaluation.service.ts
│   └── alpha_scoring.service.ts  # Step 3 NEW
├── routes/
│   ├── alpha.routes.ts
│   ├── alpha_price.routes.ts
│   └── alpha_scoring.routes.ts   # Step 3 NEW
├── ingestion/
├── metrics/
├── fraud/
├── ranking/
└── models/
    ├── tg.token_mention.model.ts
    ├── tg.price_cache.model.ts
    └── tg.channel_alpha.model.ts  # Step 3 NEW
```

## What's Been Implemented

### Phase 3 Step 3: Alpha Scoring Engine ✅ (2026-02-18)
- [x] **AlphaScoringService** (`alpha_scoring.service.ts`)
  - successRate: % mentions с ростом >10% за 7d
  - avgReturn7d/30d: средний ROI
  - earlynessFactor: насколько рано канал упоминает токены
  - consistency: стабильность результатов (inverse CoV)
  - hitRate: % с любым положительным return
  - **alphaScore formula (0..100)**:
    ```
    alphaScore = successRate*35 + normalizedReturn*25 + 
                 earlynessFactor*20 + consistency*15 + hitRate*5
    ```
- [x] **TgChannelAlpha Model** - хранение скоров каналов
- [x] **API Routes** (`alpha_scoring.routes.ts`)
  - POST `/api/admin/telegram-intel/alpha/score/channel`
  - POST `/api/admin/telegram-intel/alpha/score/batch`
  - GET `/api/admin/telegram-intel/alpha/leaderboard`
  - GET `/api/admin/telegram-intel/alpha/score/:username`
  - GET `/api/admin/telegram-intel/alpha/scoring-stats`

### Phase 3 Step 2: Price Layer ✅
- AlphaPriceProvider Interface
- CoinGecko Adapter (rate limiting, retry, cache)
- Price Evaluation Service

### Phase 3 Step 1: Token Extractor ✅
- Token extraction ($TOKEN, #TOKEN, PAIR/USDT)
- Mention storage with idempotency

### Phase 1-2 ✅
- Secure secrets management
- MTProto runtime
- Cursor-based ingestion
- Window metrics (7d/30d/90d)
- Fraud signals & ranking

## Environment Variables

```env
# Telegram Intel
TG_SECRETS_KEY=<fernet-key>
TELEGRAM_INTEL_ENABLED=true

# Price Layer (optional)
COINGECKO_API_KEY=<your-api-key>
```

## Testing

### Test Results
- **Phase 1-2:** 100% (22/22) ✅
- **Phase 3 Step 1:** 97% (29/30) ✅
- **Phase 3 Step 2:** 88% (15/17) ✅
- **Phase 3 Step 3:** 100% (15/15) ✅

## Prioritized Backlog

### P0 (Critical - Done ✅)
- [x] Secure secrets management
- [x] MTProto runtime
- [x] Ingestion & metrics pipeline
- [x] Token extractor + mention storage
- [x] Price layer with CoinGecko + cache
- [x] Alpha Scoring Engine

### P1 (High Priority - Next)
1. [ ] **Credibility Engine** - межканальное скрещивание данных
2. [ ] **Frontend Integration** - UI для leaderboard
3. [ ] **CoinGecko API Key** - получить для production

### P2 (Medium Priority)
1. [ ] Taxonomy Layer
2. [ ] Explainability Layer
3. [ ] Advanced earliness calculation (cross-channel)

---
**Last Updated:** 2026-02-18
**Version:** 3.3.0
**Status:** Phase 1-2 Complete, Phase 3 Steps 1-3 Complete
