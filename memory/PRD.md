# Telegram Intelligence Platform - PRD v4.0

## Original Problem Statement
Создать production-ready изолированный Telegram Intelligence модуль с многофазной архитектурой:
- **Phase 1:** Production-hardened MTProto runtime ✅
- **Phase 2:** Windowed analytics pipeline (7d/30d/90d) ✅
- **Phase 3:** Alpha & Credibility Engine (Complete ✅)
- **Phase 4:** Explainability + Governance (Complete ✅)

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
├── alpha/                      # Phase 3 v2
│   ├── token_extractor.ts
│   ├── mentions.service.ts
│   ├── track_record.service.ts    # NEW
│   ├── alpha_scoring_v2.service.ts # NEW - Institutional
│   └── price_evaluation.service.ts
├── credibility/                # Phase 3 Step 4 NEW
│   ├── decay.ts
│   ├── stats.ts
│   └── credibility.service.ts
├── ranking/                    # Phase 3 Step 5 NEW
│   ├── ranking_snapshot.service.ts
│   └── intel_ranking.service.ts
├── governance/                 # Phase 4 NEW
│   ├── governance.model.ts
│   └── governance.service.ts
├── explain/                    # Phase 4 NEW
│   └── explain.service.ts
├── routes/
│   ├── alpha.routes.ts
│   ├── alpha_price.routes.ts
│   ├── alpha_scoring.routes.ts
│   ├── alpha_scoring_v2.routes.ts # NEW
│   ├── credibility.routes.ts      # NEW
│   ├── intel_ranking.routes.ts    # NEW
│   ├── governance.routes.ts       # NEW
│   └── explain.routes.ts          # NEW
└── models/
    ├── tg.token_mention.model.ts
    ├── tg.price_cache.model.ts
    ├── tg.channel_track_record.model.ts # NEW
    ├── tg.alpha_score.model.ts          # NEW
    ├── tg.credibility.model.ts          # NEW
    └── tg.intel_ranking.model.ts        # NEW
```

## What's Been Implemented

### Phase 3 v2: Institutional Alpha Scoring ✅ (2026-02-18)
- [x] **TrackRecordService** - historical performance stats
- [x] **AlphaScoringServiceV2** - institutional grade scoring
  - Bayesian hit rates (Beta posterior)
  - Risk-adjusted returns (Sharpe-lite)
  - Earlyness approximation
  - Stability factor
  - Spam penalty
  - Drawdown penalty
  - Sample confidence

**Formula:**
```
alphaScore = 100 ×
  (0.30 × BayesianSuccess7d +
   0.20 × RiskAdjustedReturn +
   0.15 × Earlyness +
   0.15 × Stability +
   0.10 × Hit24h +
   0.10 × Consistency)
  × SampleConfidence
  × (1 − Penalty)
```

### Phase 3 Step 4: Credibility Engine ✅
- [x] **CredibilityService**
  - Recency decay weighting (exp decay)
  - Beta posterior for hit rate
  - Credible interval (95% CI)
  - Trend detection (improving/flat/deteriorating)
  - Tier assignment (AAA/AA/A/BBB/BB/B/C/D)

### Phase 3 Step 5: Intel Ranking ✅
- [x] **IntelRankingService** - unified score (0..100)
  - Combines: BaseScore + AlphaEffective + Credibility
  - Fraud penalty (kill switch at 0.75)
  - Low credibility penalty
  - Low sample penalty
  - Tier assignment (S/A/B/C/D)

### Phase 4: Explainability + Governance ✅
- [x] **GovernanceService**
  - Versioned scoring configs
  - Override management (ALLOWLIST/BLOCKLIST)
  - Forced tier/score
  - Fraud risk override
  - Penalty multiplier
- [x] **ExplainService**
  - Human-readable bullet points
  - Full snapshot of all scores

## API Endpoints

### Alpha v2 (Institutional)
- `POST /api/admin/telegram-intel/alpha/v2/compute/channel`
- `POST /api/admin/telegram-intel/alpha/v2/compute/batch`
- `GET /api/admin/telegram-intel/alpha/v2/leaderboard`
- `GET /api/admin/telegram-intel/alpha/v2/score/:username`
- `GET /api/admin/telegram-intel/alpha/v2/stats`

### Credibility
- `POST /api/admin/telegram-intel/credibility/channel`
- `POST /api/admin/telegram-intel/credibility/batch`
- `GET /api/admin/telegram-intel/credibility/:username`
- `GET /api/admin/telegram-intel/credibility/leaderboard`

### Intel Ranking
- `POST /api/admin/telegram-intel/intel/compute/channel`
- `POST /api/admin/telegram-intel/intel/recompute`
- `GET /api/telegram-intel/intel/top` (public)
- `GET /api/telegram-intel/intel/:username` (public)

### Governance
- `GET /api/admin/telegram-intel/governance/config/active`
- `GET /api/admin/telegram-intel/governance/config/list`
- `POST /api/admin/telegram-intel/governance/config/activate`
- `POST /api/admin/telegram-intel/governance/override`
- `GET /api/admin/telegram-intel/governance/override/:username`
- `GET /api/admin/telegram-intel/governance/overrides`

### Explainability
- `GET /api/telegram-intel/intel/explain/:username` (public)

## Testing

### Test Results
- **Phase 1-2:** 100% ✅
- **Phase 3 v2 + Step 4 + Step 5 + Phase 4:** 100% (27/27) ✅

## Prioritized Backlog

### P0 (Critical - Done ✅)
- [x] Secure secrets management
- [x] MTProto runtime
- [x] Ingestion & metrics pipeline
- [x] Token extractor + mention storage
- [x] Price layer with CoinGecko + cache
- [x] Institutional Alpha Scoring v2
- [x] Credibility Engine with Beta posterior
- [x] Unified Intel Ranking
- [x] Governance (config + overrides)
- [x] Explainability API

### P1 (High Priority - Next)
1. [ ] **Temporal Ranking** - score evolution chart over time
2. [ ] **Network Alpha Detection** - cross-channel earliness (who mentions first)
3. [ ] **Frontend Integration** - UI for leaderboard & channel scores
4. [ ] **CoinGecko API Key** - получить для production

### P2 (Medium Priority)
1. [ ] Taxonomy Layer
2. [ ] Advanced earliness (pre-mention window analysis)
3. [ ] Alerting on high-alpha channels

---
**Last Updated:** 2026-02-18
**Version:** 4.0.0
**Status:** Phase 1-4 Complete - Institutional Intelligence Platform Ready
