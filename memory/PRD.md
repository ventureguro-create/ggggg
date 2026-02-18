# Telegram Intelligence Platform - PRD v3.2

## Original Problem Statement
Создать production-ready изолированный Telegram Intelligence модуль с многофазной архитектурой:
- **Phase 1:** Production-hardened MTProto runtime ✅
- **Phase 2:** Windowed analytics pipeline (7d/30d/90d) ✅
- **Phase 3:** Alpha & Credibility Engine (Step 1-2 Complete ✅)
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
├── price/                      # Phase 3 Step 2 NEW
│   ├── price.provider.ts       # Interface
│   ├── coingecko.adapter.ts    # CoinGecko adapter with rate limit
│   ├── price.cache.model.ts    # MongoDB cache
│   └── price.service.ts        # Service with caching
├── alpha/                      # Phase 3 Step 1
│   ├── token_extractor.ts      
│   ├── mentions.service.ts     
│   └── price_evaluation.service.ts  # Step 2 NEW
├── routes/
│   ├── alpha.routes.ts         # Mentions API
│   └── alpha_price.routes.ts   # Price API NEW
├── ingestion/
├── metrics/
├── fraud/
├── ranking/
└── models/
    ├── tg.token_mention.model.ts
    └── tg.price_cache.model.ts  # Step 2 NEW
```

## What's Been Implemented

### Phase 3 Step 2: Price Layer ✅ (2026-02-18)
- [x] **AlphaPriceProvider Interface** - abstraction for price sources
- [x] **CoinGecko Adapter** (`coingecko.adapter.ts`)
  - Rate limiting (2s between requests)
  - Retry with backoff (max 3 retries)
  - 401/404 fail-fast (no retry)
  - Optional API key support (`COINGECKO_API_KEY`)
  - Symbol → CoinID resolution with caching
- [x] **Price Cache** (`tg_price_cache` collection)
  - One price per token per day
  - TTL index (90 days auto-cleanup)
- [x] **Price Service** (`price.service.ts`)
  - `getHistoricalPriceUSD(token, date)` - with caching
  - `getCurrentPriceUSD(token)`
  - `getPriceWithReturns(token, mentionedAt)` - 24h/7d/30d returns
- [x] **Price Evaluation Service**
  - `evaluateBatch(limit)` - batch evaluation job
  - `reevaluateIncomplete(limit)` - update missing returns
  - `getStats()` - evaluation statistics
- [x] **API Routes** (`alpha_price.routes.ts`)
  - GET `/api/admin/telegram-intel/alpha/price/:token`
  - GET `/api/admin/telegram-intel/alpha/price/:token/history?date=YYYY-MM-DD`
  - GET `/api/admin/telegram-intel/alpha/price-cache-stats`
  - GET `/api/admin/telegram-intel/alpha/evaluation-stats`
  - POST `/api/admin/telegram-intel/alpha/evaluate`
  - POST `/api/admin/telegram-intel/alpha/reevaluate`

### Phase 3 Step 1: Token Extractor ✅
- Token extraction ($TOKEN, #TOKEN, PAIR/USDT)
- Mention storage with idempotency
- Scan and query APIs

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
COINGECKO_API_KEY=<your-api-key>  # For CoinGecko Pro/Demo tier
```

## Testing

### Test Results
- **Phase 1-2:** 100% (22/22) ✅
- **Phase 3 Step 1:** 97% (29/30) ✅
- **Phase 3 Step 2:** 88% (15/17) ✅
  - 2 tests skipped due to CoinGecko 401 (requires API key)
  - All local logic working correctly

## Prioritized Backlog

### P0 (Critical - Done ✅)
- [x] Secure secrets management
- [x] MTProto runtime
- [x] Ingestion & metrics pipeline
- [x] Token extractor + mention storage
- [x] Price layer with CoinGecko + cache

### P1 (High Priority - Next)
1. [ ] **Phase 3 Step 3: Alpha Scoring**
   - successRate calculation
   - avgReturn, earlynessFactor, consistency
   - alphaScore formula (0..100)
   - Channel track record storage

2. [ ] **CoinGecko API Key** - получить для production

### P2 (Medium Priority)
1. [ ] Credibility Engine
2. [ ] Taxonomy Layer
3. [ ] Explainability Layer

---
**Last Updated:** 2026-02-18
**Version:** 3.2.0
**Status:** Phase 1-2 Complete, Phase 3 Step 1-2 Complete
