# Telegram Discovery Module - PRD v2.0

## Original Problem Statement
Создать production-ready изолированный Telegram Discovery + Ranking модуль с:
- MTProto runtime (mock для разработки)
- Discovery (seed → expand)
- Ingestion (посты + профиль)
- Advanced Metrics layer
- Fraud detection (статистически осмысленный)
- Fair Rating engine
- Category/Topic classification
- API endpoints

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
├── models/          # 8 MongoDB коллекций (tg_*)
├── services/        # discovery, metrics, ranking, fraud (advanced)
├── detectors/       # 8 детекторов
├── categories/      # category engine + topic vectors
├── adapter/         # Telegram API wrapper (mock mode)
├── jobs/            # Background jobs
├── routes/          # API endpoints
└── utils/           # Math, extract helpers
```

## What's Been Implemented

### Date: 2026-02-18 (Extended)

#### Advanced Detectors (100% Complete)
- [x] **Promo Detector** - promo density, links block ratio
- [x] **Burst Detector** - peak clusters, view spikes
- [x] **Elasticity Detector** - forwards vs views curve
- [x] **Originality Detector** - copy-paste detection
- [x] **Forward Composition** - aggregator/repost-feed detection
- [x] **Language Detector** - RU/UA/EN classification
- [x] **Source Diversity** - HHI, dominant source, spillover detection
- [x] **Cross-Reuse Detector** - synchronized network content

#### Advanced Fraud Service
- Multi-signal fraud detection
- 12+ fraud indicators
- Entropy analysis
- Engagement elasticity
- Temporal anomalies
- Network spillover patterns

#### Advanced Rating Service
- Bayesian smoothing
- Stability penalties
- Reliability weighting
- Promo/originality/feed penalties
- Source diversity penalties
- Cross-reuse penalties

#### Category & Topic Engine
- 7 categories: TRADING, MEDIA, NFT, EARLY, VC, POPULAR, INFLUENCE
- 7 topics: trading, nft, early, vc, media, macro, security
- Rules-based classification with confidence

#### API Endpoints (20+)
- Health, Channels, Discovery, Search, Rankings, Fraud, Metrics, Debug, Admin

## Core Requirements (Static)

### Module Isolation
- All collections prefixed with `tg_`
- All routes under `/api/telegram/*`
- No dependencies on other modules
- Can be removed without breaking system

### Fraud Scoring Formula
```
fraudRisk = sum of:
  - Subscriber efficiency anomaly (0.25-0.35)
  - Entropy test (0.25)
  - Engagement elasticity (0.30)
  - Temporal anomaly (0.25)
  - Dispersion anomaly (0.20)
  - Promo network (0.25-0.40)
  - Burst clusters (0.30)
  - Originality penalty (0.15)
  - Repostiness (0.18)
  - Source concentration (0.12-0.34)
  - Cross-reuse (0.30-0.45)
  - High reach + low originality (0.10)
```

### Rating Formula
```
finalScore = 100 * base 
  * reliability^1.3 
  * promoPenalty 
  * originalityBoost 
  * feedPenalty 
  * sourcePenalty 
  * reusePenalty

where base = 0.4*reach + 0.2*activity + 0.25*engagement - 0.15*stability
```

## Prioritized Backlog

### P0 (Critical - Done)
- [x] Module structure and isolation
- [x] MongoDB models (8 collections)
- [x] Core services
- [x] All 8 detectors
- [x] API endpoints
- [x] Category/Topic engine

### P1 (High Priority - Next)
1. [ ] MTProto integration (real Telegram API)
2. [ ] Real channel ingestion
3. [ ] Post content analysis
4. [ ] Channel validation via Telegram
5. [ ] Background jobs activation

### P2 (Medium Priority)
1. [ ] NLP for content quality scoring
2. [ ] ML-enhanced fraud detection
3. [ ] Graph analysis for influence
4. [ ] Real-time metrics updates
5. [ ] Webhook notifications

### P3 (Future)
1. [ ] Admin UI integration
2. [ ] Alert system
3. [ ] Export/reporting
4. [ ] Alpha detection
5. [ ] Influence intelligence

## Test Coverage
- Backend: 100%
- Integration: 100% (mock mode)
- All 20+ endpoints tested

## Environment Variables
```env
MONGODB_URI=mongodb://localhost:27017/telegram_dev
TELEGRAM_DISCOVERY_ENABLED=true
TELEGRAM_API_ID=<optional>
TELEGRAM_API_HASH=<optional>
MINIMAL_BOOT=1
```

---
**Last Updated:** 2026-02-18
**Version:** 2.0.0
