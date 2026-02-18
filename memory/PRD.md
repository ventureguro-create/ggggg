# Telegram Intelligence Platform - PRD v4.3

## Original Problem Statement
Создать production-ready изолированный Telegram Intelligence модуль с многофазной архитектурой:
- **Phase 1:** Production-hardened MTProto runtime ✅
- **Phase 2:** Windowed analytics pipeline (7d/30d/90d) ✅
- **Phase 3:** Alpha & Credibility Engine (Complete ✅)
- **Phase 4:** Explainability + Governance + NetworkAlpha + Temporal ✅
- **Phase 5:** Frontend Intelligence Dashboard (In Progress)

## Architecture

### Module Structure
```
modules/telegram-intel/
├── telegram_intel.plugin.ts
├── runtime/                    # Phase 1
├── price/                      # Phase 3 Step 2
├── alpha/                      # Phase 3 v2
│   ├── track_record.service.ts
│   ├── alpha_scoring_v2.service.ts
│   └── mentions.service.ts     # Enhanced with getChannelMentionsWithReturns
├── credibility/                # Phase 3 Step 4
│   ├── decay.ts
│   ├── stats.ts
│   └── credibility.service.ts
├── ranking/                    # Phase 3 Step 5 + 4.2
│   └── intel_ranking.service.ts  # Now with NetworkAlpha!
├── network-alpha/              # Cross-channel earliness
│   ├── network_alpha.config.ts
│   └── network_alpha.service.ts
├── temporal/                   # Score evolution
│   ├── temporal_snapshot.service.ts
│   └── temporal_trend.service.ts
├── governance/                 # Phase 4
│   ├── governance.model.ts
│   └── governance.service.ts
├── explain/                    # Phase 4
│   └── explain.service.ts
├── routes/
│   ├── alpha.routes.ts         # +public mentions endpoint
│   ├── network_alpha.routes.ts
│   ├── temporal.routes.ts
│   └── ... (all previous)
└── models/
    ├── tg.network_alpha_channel.model.ts
    ├── tg.network_alpha_token.model.ts
    ├── tg.score_snapshot.model.ts
    ├── tg.token_mention.model.ts
    └── ... (all previous)
```

### Frontend Components
```
frontend/src/
├── pages/
│   └── TelegramIntelPage.jsx   # Main dashboard
├── components/telegram/
│   ├── ChannelHeader.jsx
│   ├── FiltersBar.jsx
│   ├── LeaderboardTable.jsx
│   ├── ScoreChart.jsx
│   ├── StatsBar.jsx
│   └── TokenMentionsTable.jsx  # NEW: Token mentions with returns
└── api/
    └── telegramIntel.api.js    # API client
```

## What's Been Implemented

### Network Alpha Detection (Killer Feature) ✅
Cross-channel earliness detection - determines who mentions successful tokens first:

**For each qualified token (+20% in 7d, 5+ mentions):**
- Ranks all channels by mention time
- Computes earlyness percentile (0 = first, 1 = last)
- Quality-weighted earliness (bigger gains = more weight)

**Channel Score (0..100):**
```
networkAlphaScore = 
  0.45 × earlyHitRate +           # % of tokens where channel was in top 10%
  0.25 × earlyPercentileGoodness + # 1 - avgEarlyPercentile
  0.20 × qualityWeightedEarliness +
  0.10 × coverageScore
```

**Token-level Data:**
- firstMentions[] with delay hours
- p50/p90 mention delay statistics

### Phase 4.2: NetworkAlpha in IntelScore ✅
IntelScore now includes networkAlpha with credibility gating:

```
// Config weights: base=0.40, alpha=0.25, cred=0.25, netAlpha=0.10

// Cred-gated network alpha (prevents boosting garbage channels)
credGate = 0.25 + 0.75 × (credibilityScore / 100)
networkAlphaEffective = networkAlphaScore × credGate

// Updated raw score
raw = wBase×base + wAlpha×alphaEffective + wCred×cred + wNet×networkAlphaEffective
```

### Temporal Ranking (Score Evolution) ✅
Daily snapshots of all channel scores for trend analysis:

**Snapshot includes:**
- intelScore, alphaScore, credibilityScore, networkAlphaScore, fraudRisk
- Tier information (intel, credibility, networkAlpha)
- Config version (for audit after weight changes)

**Top Movers API:**
- Get channels with biggest score changes over N days
- Supports all metrics: intelScore, alpha, cred, netAlpha, fraud

## API Endpoints

### Network Alpha
- `POST /api/admin/telegram-intel/network-alpha/run` - compute
- `GET /api/telegram-intel/network-alpha/top` - channel leaderboard
- `GET /api/telegram-intel/network-alpha/channel/:username`
- `GET /api/telegram-intel/network-alpha/token/:token` - firstMentions timeline

### Temporal
- `POST /api/admin/telegram-intel/temporal/snapshot/run` - batch snapshot
- `GET /api/telegram-intel/temporal/:username?days=90` - score history
- `GET /api/telegram-intel/temporal/top-movers?days=7&metric=intelScore`

### Channel Token Mentions (Public)
- `GET /api/telegram-intel/channel/:username/mentions` - token mentions with returns
  - Query params: `days` (default: 90), `limit` (default: 100), `evaluated` (boolean)
  - Returns: mentions list with returns data, top tokens summary, hit rate, avg return

### Network Evidence (Block UI-4)
- `GET /api/telegram-intel/channel/:username/network-evidence` - tokens where channel was early
  - Query params: `limit` (default: 25)
  - Returns: items[] with earlyRank, cohortSize, delayHours, percentile, return7d, isHit

### Compare Panel (Block UI-5)
- `GET /api/telegram-intel/channel/:username/compare` - position in network
  - Returns: position (rank, total, percentile), gaps (up, down, toTierS), neighbors, peerContext

## Frontend Components (Phase 5)

### Implemented ✅
1. **TelegramIntelPage** - Main dashboard with:
   - Stats cards (Token Mentions, Unique Tokens, Top Channels, Module Status)
   - Channel search functionality
   - Channel actions (Ingest, Scan Tokens, Pipeline)
   - Integration of all detail panels

2. **TokenMentionsTable** (Block UI-3) ✅ - Display channel token mentions with:
   - Summary stats (total, evaluated, avg 7d return, hit rate)
   - Top tokens badges with performance
   - Sortable table (by token, date, returns)
   - Filter by token
   - Return badges with visual indicators

3. **NetworkEvidenceTable** (Block UI-4) ✅ - Network Alpha Evidence:
   - Shows tokens where channel was an early source
   - Early Rank, Delay, Percentile, 7d ROI, Cohort size
   - First place highlighting with award icon
   - Summary: totalTokens, firstPlaces, avgPercentile
   - Sorting by percentile, return, rank

4. **ComparePanel** (Block UI-5) ✅ - Position in Network:
   - Global rank and percentile
   - Distance to Tier S
   - Gap to higher/lower rank
   - Nearby channels (prev/next)
   - Tier context (peers count, tier average, vs average)

### Upcoming
5. **Leaderboard Page** (Block UI-1) - IntelScore rankings with filters, sparklines
6. **Channel Detail Page** (Block UI-2) - Dedicated route with ScoreChart
7. **Movers Page** (Block UI-6) - Top movers by score change

## Testing

### Test Results
- **Phase 1-2:** 100% ✅
- **Phase 3 v2 + Step 4 + Step 5 + Phase 4:** 100% (27/27) ✅
- **Network Alpha + 4.2 + Temporal:** 92.6% ✅

## Prioritized Backlog

### P0 (Critical - Done ✅)
All core backend features complete.

### P1 (High Priority - Complete ✅)
1. [x] **Token Mentions API** - public endpoint with returns data
2. [x] **TokenMentionsTable Component** - UI for channel detail page
3. [x] **Network Alpha Evidence API** - GET /channel/:username/network-evidence
4. [x] **NetworkEvidenceTable Component** - shows where channel was early
5. [x] **Compare API** - GET /channel/:username/compare
6. [x] **ComparePanel Component** - position in network

### P1 (High Priority - Next)
1. [ ] **Leaderboard Page** (Block UI-1) - full IntelScore rankings with filters
2. [ ] **Dedicated Channel Page** (Block UI-2) - /telegram/[username] route

### P2 (Medium Priority)
1. [ ] **Movers Page** (Block UI-6) - top movers by score change
2. [ ] Temporal Aggregation Optimization (MongoDB aggregation pipeline)
3. [ ] Weekly/Monthly rollups for historical charts
4. [ ] Advanced earliness (pre-mention window analysis)

---
**Last Updated:** 2026-02-18
**Version:** 4.4.0
**Status:** Phase 1-4 Backend Complete + Frontend UI Blocks 3-5 Complete
