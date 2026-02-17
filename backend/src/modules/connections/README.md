# Connections Module - Plug-in Architecture

## Overview

The Connections module is designed as a **self-contained plug-in** that can be:
- ✅ Registered/unregistered without side effects
- ✅ Run standalone or integrated with host
- ✅ Configured independently
- ✅ Removed without breaking the host system

## Architecture

```
modules/connections/
├── adapters/          # Port implementations
│   └── index.ts       # Adapter factory functions
├── api/               # REST API routes
├── config/            # Module configuration
│   └── connections.config.ts
├── jobs/              # Background jobs
│   ├── index.ts
│   ├── follow-graph.job.ts
│   ├── cluster-detection.job.ts
│   └── audience-quality.job.ts
├── ports/             # External dependency interfaces
│   └── index.ts       # IExchangePort, IOnchainPort, etc.
├── services/          # Business logic
├── engines/           # Core computation
├── models/            # Data models
├── index.ts           # Main entry point
└── module.ts          # Plug-in registration
```

## Quick Start

### Register Module (Recommended)

```typescript
import { registerConnectionsModule } from './modules/connections';

// With host services
await registerConnectionsModule(app, {
  db: mongoDb,
  ports: {
    exchange: exchangePort,
    onchain: onchainPort,
    sentiment: sentimentPort,
    price: pricePort,
  },
  config: {
    enabled: true,
    features: {
      clusterAttention: true,
      farmDetection: true,
    }
  }
});

// Standalone (no external dependencies)
await registerConnectionsModule(app, {
  db: mongoDb,
  // ports default to null implementations
});
```

### Unregister Module

```typescript
import { unregisterConnectionsModule } from './modules/connections';

await unregisterConnectionsModule(app);
// Module removed, no side effects
```

## Ports (External Dependencies)

The module communicates with external services **only through ports**:

### IExchangePort
```typescript
interface IExchangePort {
  getFundingRate(symbol: string): Promise<{...} | null>;
  getLongShortRatio(symbol: string): Promise<{...} | null>;
  getVolume(symbol: string, period: '1h' | '4h' | '24h'): Promise<{...} | null>;
  getOpenInterest(symbol: string): Promise<{...} | null>;
}
```

### IOnchainPort
```typescript
interface IOnchainPort {
  getWhaleMovements(token: string, hours: number): Promise<{...} | null>;
  getHolderDistribution(token: string): Promise<{...} | null>;
  getDexVolume(token: string, period: '1h' | '24h'): Promise<{...} | null>;
}
```

### ISentimentPort
```typescript
interface ISentimentPort {
  getSentimentScore(token: string): Promise<{...} | null>;
  getSocialVolume(token: string, hours: number): Promise<{...} | null>;
  getTrendingStatus(token: string): Promise<{...} | null>;
}
```

### IPricePort
```typescript
interface IPricePort {
  getCurrentPrice(symbol: string): Promise<{...} | null>;
  getPriceHistory(symbol: string, hours: number): Promise<{...} | null>;
  getMarketCap(symbol: string): Promise<{...} | null>;
}
```

## Collections (Namespaced)

All collections use `connections_` prefix:

| Collection | Purpose |
|------------|---------|
| `connections_actors` | Actor profiles |
| `connections_unified_accounts` | Unified Twitter accounts |
| `connections_follow_graph` | Follow relationships |
| `connections_events` | Event capture |
| `connections_ips_predictions` | IPS predictions |
| `connections_clusters` | Detected clusters |
| `connections_audience_quality` | Audience quality reports |
| `connections_bot_farms` | Detected bot farms |
| `connections_taxonomy_groups` | Taxonomy groups |
| `connections_verdicts` | Reality verdicts |
| `connections_alt_patterns` | Alt patterns |

## Configuration

```typescript
const config: ConnectionsModuleConfig = {
  enabled: true,
  
  database: {
    collectionPrefix: 'connections_',
  },
  
  twitter: {
    parserUrl: 'http://localhost:5001',
    parserEnabled: true,
    maxRequestsPerMinute: 30,
  },
  
  jobs: {
    followGraphIntervalMinutes: 30,
    clusterDetectionIntervalMinutes: 60,
    narrativeEngineIntervalMinutes: 15,
    audienceQualityIntervalMinutes: 120,
  },
  
  features: {
    clusterAttention: true,
    farmDetection: true,
    narrativeEngine: true,
    walletAttribution: true,
    altPatterns: true,
  },
};
```

## Rules

### Rule #1: No Direct Host Imports
```typescript
// ❌ WRONG
import { ExchangeService } from '../../exchange';

// ✅ CORRECT
import { IExchangePort } from '../ports';
const data = await exchangePort.getFundingRate(symbol);
```

### Rule #2: Namespaced Collections
```typescript
// ❌ WRONG
db.collection('actors')

// ✅ CORRECT
import { COLLECTIONS } from '../config';
db.collection(COLLECTIONS.ACTORS) // 'connections_actors'
```

### Rule #3: Self-Contained Lifecycle
```typescript
// Module registers its own:
// - Routes
// - Jobs
// - Adapters

// Host only calls:
await registerConnectionsModule(app, options);
```

## Internal Components

### 1. Twitter Logic
- Parser client
- Score engine
- Graph builder
- Cluster detection
- Narrative engine
- Audience quality

### 2. IPS Layer (Influencer Prediction System)
- Event capture
- Time windows
- Outcome builder
- Probability engine

### 3. Taxonomy
- Groups
- Presets
- Memberships

### 4. Reality Layer
- Verdict calculation
- Credibility
- Trust multiplier

### 5. Alt Pattern Logic
- Pattern registry
- Alt scoring
- Pattern similarity engine

## What's NOT Inside

The module does NOT include:
- ❌ Exchange feature calculation
- ❌ Onchain raw analysis
- ❌ Sentiment raw analysis
- ❌ Macro calculation
- ❌ ML training of other modules

These are accessed via Ports only.

## Smoke Test

```typescript
// Can register
await registerConnectionsModule(app, { db });
assert(isConnectionsModuleInitialized() === true);

// Can unregister
await unregisterConnectionsModule(app);
assert(isConnectionsModuleInitialized() === false);

// Host still works
const health = await fetch('/api/health');
assert(health.ok === true);
```
