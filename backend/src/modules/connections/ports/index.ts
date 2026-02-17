/**
 * Connections Module - Port Interfaces
 * 
 * External dependencies accessed ONLY through these ports.
 * No direct imports from host modules allowed.
 * 
 * VERSION: 1.0
 */

// ============================================
// PORT VERSION CONTRACT
// ============================================
export const PORTS_VERSION = '1.0' as const;

export interface PortMetadata {
  version: typeof PORTS_VERSION;
  name: string;
}

// ============================================
// EXCHANGE PORT
// ============================================
export interface IExchangePort extends PortMetadata {
  name: 'exchange';
  
  /**
   * Get funding rate for a symbol
   */
  getFundingRate(symbol: string): Promise<{
    rate: number;
    timestamp: Date;
  } | null>;

  /**
   * Get long/short ratio
   */
  getLongShortRatio(symbol: string): Promise<{
    longRatio: number;
    shortRatio: number;
    timestamp: Date;
  } | null>;

  /**
   * Get volume data
   */
  getVolume(symbol: string, period: '1h' | '4h' | '24h'): Promise<{
    volume: number;
    volumeChange: number;
    timestamp: Date;
  } | null>;

  /**
   * Get open interest
   */
  getOpenInterest(symbol: string): Promise<{
    openInterest: number;
    oiChange: number;
    timestamp: Date;
  } | null>;
}

// ============================================
// ONCHAIN PORT
// ============================================
export interface IOnchainPort extends PortMetadata {
  name: 'onchain';
  
  /**
   * Get whale movements for a token
   */
  getWhaleMovements(token: string, hours: number): Promise<{
    inflows: number;
    outflows: number;
    netFlow: number;
    transactions: number;
  } | null>;

  /**
   * Get holder distribution
   */
  getHolderDistribution(token: string): Promise<{
    top10Pct: number;
    top50Pct: number;
    uniqueHolders: number;
  } | null>;

  /**
   * Get DEX volume
   */
  getDexVolume(token: string, period: '1h' | '24h'): Promise<{
    volume: number;
    trades: number;
  } | null>;
}

// ============================================
// SENTIMENT PORT
// ============================================
export interface ISentimentPort extends PortMetadata {
  name: 'sentiment';
  
  /**
   * Get sentiment score for a token
   */
  getSentimentScore(token: string): Promise<{
    score: number; // -1 to 1
    confidence: number;
    sampleSize: number;
  } | null>;

  /**
   * Get social volume
   */
  getSocialVolume(token: string, hours: number): Promise<{
    mentions: number;
    uniqueAuthors: number;
    engagementTotal: number;
  } | null>;

  /**
   * Get trending status
   */
  getTrendingStatus(token: string): Promise<{
    isTrending: boolean;
    rank: number | null;
    velocity: number;
  } | null>;
}

// ============================================
// PRICE PORT
// ============================================
export interface IPricePort extends PortMetadata {
  name: 'price';
  
  /**
   * Get current price
   */
  getCurrentPrice(symbol: string): Promise<{
    price: number;
    change24h: number;
    timestamp: Date;
  } | null>;

  /**
   * Get price history
   */
  getPriceHistory(symbol: string, hours: number): Promise<{
    prices: Array<{ time: Date; price: number }>;
    high: number;
    low: number;
  } | null>;

  /**
   * Get market cap
   */
  getMarketCap(symbol: string): Promise<{
    marketCap: number;
    fdv: number;
    rank: number;
  } | null>;
}

// ============================================
// TELEGRAM PORT (for notifications)
// ============================================
export interface ITelegramPort extends PortMetadata {
  name: 'telegram';
  
  /**
   * Send message to chat
   */
  sendMessage(chatId: string, message: string): Promise<boolean>;
  
  /**
   * Check if connection exists
   */
  isConnected(chatId: string): Promise<boolean>;
}

// ============================================
// TWITTER PARSER PORT (for raw data access)
// ============================================
export interface ITwitterParserPort extends PortMetadata {
  name: 'twitter_parser';
  
  /**
   * Get parsed tweets
   */
  getParsedTweets(actorId: string, limit: number): Promise<any[]>;
  
  /**
   * Get follow edges
   */
  getFollowEdges(actorId: string): Promise<any[]>;
  
  /**
   * Get follower edges
   */
  getFollowerEdges(actorId: string): Promise<any[]>;
}

// ============================================
// TWITTER LIVE PORT (for real-time Twitter data)
// ============================================
export interface ITwitterLivePort extends PortMetadata {
  name: 'twitter_live';
  
  /**
   * Check data availability for Twitter live features
   */
  checkDataAvailability(): Promise<{
    available: boolean;
    lastUpdate: Date | null;
    status: 'READY' | 'STALE' | 'UNAVAILABLE';
  }>;
  
  /**
   * Get recent mentions for a symbol/token
   */
  getRecentMentions(symbol: string, hours?: number): Promise<{
    mentions: any[];
    count: number;
    authors: string[];
  }>;
  
  /**
   * Get quick diff summary
   */
  getQuickDiffSummary(): Promise<{
    newTweets: number;
    newAccounts: number;
    period: string;
  }>;
  
  /**
   * Stream live events
   */
  streamEvents?(): AsyncIterable<any>;
}

// ============================================
// ALERT PORT (for sending alerts to host system)
// ============================================
export interface AlertPayload {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  data?: Record<string, any>;
  timestamp?: Date;
}

export interface IAlertPort extends PortMetadata {
  name: 'alert';
  
  /**
   * Send alert to host alert system
   */
  sendAlert(payload: AlertPayload): Promise<boolean>;
  
  /**
   * Emit alert candidate for processing
   */
  emitAlertCandidate(candidate: {
    actorId?: string;
    symbol?: string;
    type: string;
    score: number;
    data: any;
  }): Promise<void>;
  
  /**
   * Get alert policy status
   */
  getPolicyStatus(): Promise<{
    enabled: boolean;
    policies: string[];
  }>;
}

// ============================================
// NOTIFICATION PORT (for push notifications)
// ============================================
export interface INotificationPort extends PortMetadata {
  name: 'notification';
  
  /**
   * Push notification to users
   */
  pushNotification(data: {
    userId?: string;
    chatId?: string;
    type: string;
    title: string;
    body: string;
    payload?: any;
  }): Promise<boolean>;
  
  /**
   * Check notification channel status
   */
  checkChannel(channel: 'telegram' | 'email' | 'push'): Promise<{
    available: boolean;
    configured: boolean;
  }>;
}

// ============================================
// TAXONOMY PORT (for taxonomy data access)
// ============================================
export interface ITaxonomyPort extends PortMetadata {
  name: 'taxonomy';
  
  /**
   * Get taxonomy groups
   */
  getGroups(): Promise<{
    id: string;
    name: string;
    type: string;
    members: string[];
  }[]>;
  
  /**
   * Get group by ID
   */
  getGroup(groupId: string): Promise<any | null>;
  
  /**
   * Get taxonomy constants
   */
  getConstants(): Promise<Record<string, any>>;
}

// ============================================
// CONFIDENCE PORT (for confidence scoring)
// ============================================
export interface IConfidencePort extends PortMetadata {
  name: 'confidence';
  
  /**
   * Get confidence score for account
   */
  getAccountConfidence(actorId: string): Promise<{
    score: number;
    factors: Record<string, number>;
    grade: string;
  } | null>;
  
  /**
   * Batch get confidence scores
   */
  batchGetConfidence(actorIds: string[]): Promise<Map<string, number>>;
}

// ============================================
// COMBINED PORTS INTERFACE
// ============================================
export interface IConnectionsPorts {
  exchange: IExchangePort;
  onchain: IOnchainPort;
  sentiment: ISentimentPort;
  price: IPricePort;
  telegram?: ITelegramPort;
  twitterParser?: ITwitterParserPort;
  twitterLive?: ITwitterLivePort;
  alert?: IAlertPort;
  notification?: INotificationPort;
  taxonomy?: ITaxonomyPort;
  confidence?: IConfidencePort;
}

// ============================================
// NULL IMPLEMENTATIONS (for standalone mode)
// ============================================
export const nullExchangePort: IExchangePort = {
  version: PORTS_VERSION,
  name: 'exchange',
  getFundingRate: async () => null,
  getLongShortRatio: async () => null,
  getVolume: async () => null,
  getOpenInterest: async () => null,
};

export const nullOnchainPort: IOnchainPort = {
  version: PORTS_VERSION,
  name: 'onchain',
  getWhaleMovements: async () => null,
  getHolderDistribution: async () => null,
  getDexVolume: async () => null,
};

export const nullSentimentPort: ISentimentPort = {
  version: PORTS_VERSION,
  name: 'sentiment',
  getSentimentScore: async () => null,
  getSocialVolume: async () => null,
  getTrendingStatus: async () => null,
};

export const nullPricePort: IPricePort = {
  version: PORTS_VERSION,
  name: 'price',
  getCurrentPrice: async () => null,
  getPriceHistory: async () => null,
  getMarketCap: async () => null,
};

export const nullTelegramPort: ITelegramPort = {
  version: PORTS_VERSION,
  name: 'telegram',
  sendMessage: async () => {
    console.warn('[Connections] Telegram port not configured, message not sent');
    return false;
  },
  isConnected: async () => false,
};

export const nullTwitterParserPort: ITwitterParserPort = {
  version: PORTS_VERSION,
  name: 'twitter_parser',
  getParsedTweets: async () => [],
  getFollowEdges: async () => [],
  getFollowerEdges: async () => [],
};

export const nullTwitterLivePort: ITwitterLivePort = {
  version: PORTS_VERSION,
  name: 'twitter_live',
  checkDataAvailability: async () => ({
    available: false,
    lastUpdate: null,
    status: 'UNAVAILABLE' as const,
  }),
  getRecentMentions: async () => ({
    mentions: [],
    count: 0,
    authors: [],
  }),
  getQuickDiffSummary: async () => ({
    newTweets: 0,
    newAccounts: 0,
    period: '24h',
  }),
};

export const nullAlertPort: IAlertPort = {
  version: PORTS_VERSION,
  name: 'alert',
  sendAlert: async () => {
    console.warn('[Connections] Alert port not configured, alert not sent');
    return false;
  },
  emitAlertCandidate: async () => {
    console.warn('[Connections] Alert port not configured, candidate not emitted');
  },
  getPolicyStatus: async () => ({
    enabled: false,
    policies: [],
  }),
};

export const nullNotificationPort: INotificationPort = {
  version: PORTS_VERSION,
  name: 'notification',
  pushNotification: async () => {
    console.warn('[Connections] Notification port not configured');
    return false;
  },
  checkChannel: async () => ({
    available: false,
    configured: false,
  }),
};

export const nullTaxonomyPort: ITaxonomyPort = {
  version: PORTS_VERSION,
  name: 'taxonomy',
  getGroups: async () => [],
  getGroup: async () => null,
  getConstants: async () => ({}),
};

export const nullConfidencePort: IConfidencePort = {
  version: PORTS_VERSION,
  name: 'confidence',
  getAccountConfidence: async () => null,
  batchGetConfidence: async () => new Map(),
};

export const nullPorts: IConnectionsPorts = {
  exchange: nullExchangePort,
  onchain: nullOnchainPort,
  sentiment: nullSentimentPort,
  price: nullPricePort,
  telegram: nullTelegramPort,
  twitterParser: nullTwitterParserPort,
  twitterLive: nullTwitterLivePort,
  alert: nullAlertPort,
  notification: nullNotificationPort,
  taxonomy: nullTaxonomyPort,
  confidence: nullConfidencePort,
};

// ============================================
// PORT VALIDATION
// ============================================
export function validatePort<T extends PortMetadata>(port: T | undefined, portName: string): T {
  if (!port) {
    console.warn(`[Connections] Port '${portName}' not provided, using null implementation`);
    return (nullPorts as any)[portName] as T;
  }
  
  if (port.version !== PORTS_VERSION) {
    console.warn(`[Connections] Port '${portName}' version mismatch: expected ${PORTS_VERSION}, got ${port.version}`);
  }
  
  return port;
}

/**
 * Validate all ports and return safe defaults
 */
export function validatePorts(ports: Partial<IConnectionsPorts> = {}): IConnectionsPorts {
  return {
    exchange: validatePort(ports.exchange, 'exchange'),
    onchain: validatePort(ports.onchain, 'onchain'),
    sentiment: validatePort(ports.sentiment, 'sentiment'),
    price: validatePort(ports.price, 'price'),
    telegram: validatePort(ports.telegram, 'telegram'),
    twitterParser: validatePort(ports.twitterParser, 'twitterParser'),
    twitterLive: validatePort(ports.twitterLive, 'twitterLive'),
    alert: validatePort(ports.alert, 'alert'),
    notification: validatePort(ports.notification, 'notification'),
    taxonomy: validatePort(ports.taxonomy, 'taxonomy'),
    confidence: validatePort(ports.confidence, 'confidence'),
  };
}
