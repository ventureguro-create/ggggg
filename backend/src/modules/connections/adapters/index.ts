/**
 * Connections Module - Adapters Index
 * 
 * Adapters implement the port interfaces using concrete external services.
 * They are injected during module registration.
 */

// Re-export port types
export type {
  IExchangePort,
  IOnchainPort,
  ISentimentPort,
  IPricePort,
  IConnectionsPorts,
} from '../ports/index.js';

// Re-export null implementations
export {
  nullExchangePort,
  nullOnchainPort,
  nullSentimentPort,
  nullPricePort,
  nullPorts,
} from '../ports/index.js';

/**
 * Create exchange adapter from host service
 */
export function createExchangeAdapter(hostExchangeService: any): import('../ports/index.js').IExchangePort {
  return {
    getFundingRate: async (symbol) => {
      try {
        const data = await hostExchangeService?.getFundingRate?.(symbol);
        return data || null;
      } catch {
        return null;
      }
    },
    getLongShortRatio: async (symbol) => {
      try {
        const data = await hostExchangeService?.getLongShortRatio?.(symbol);
        return data || null;
      } catch {
        return null;
      }
    },
    getVolume: async (symbol, period) => {
      try {
        const data = await hostExchangeService?.getVolume?.(symbol, period);
        return data || null;
      } catch {
        return null;
      }
    },
    getOpenInterest: async (symbol) => {
      try {
        const data = await hostExchangeService?.getOpenInterest?.(symbol);
        return data || null;
      } catch {
        return null;
      }
    },
  };
}

/**
 * Create onchain adapter from host service
 */
export function createOnchainAdapter(hostOnchainService: any): import('../ports/index.js').IOnchainPort {
  return {
    getWhaleMovements: async (token, hours) => {
      try {
        const data = await hostOnchainService?.getWhaleMovements?.(token, hours);
        return data || null;
      } catch {
        return null;
      }
    },
    getHolderDistribution: async (token) => {
      try {
        const data = await hostOnchainService?.getHolderDistribution?.(token);
        return data || null;
      } catch {
        return null;
      }
    },
    getDexVolume: async (token, period) => {
      try {
        const data = await hostOnchainService?.getDexVolume?.(token, period);
        return data || null;
      } catch {
        return null;
      }
    },
  };
}

/**
 * Create sentiment adapter from host service
 */
export function createSentimentAdapter(hostSentimentService: any): import('../ports/index.js').ISentimentPort {
  return {
    getSentimentScore: async (token) => {
      try {
        const data = await hostSentimentService?.getSentimentScore?.(token);
        return data || null;
      } catch {
        return null;
      }
    },
    getSocialVolume: async (token, hours) => {
      try {
        const data = await hostSentimentService?.getSocialVolume?.(token, hours);
        return data || null;
      } catch {
        return null;
      }
    },
    getTrendingStatus: async (token) => {
      try {
        const data = await hostSentimentService?.getTrendingStatus?.(token);
        return data || null;
      } catch {
        return null;
      }
    },
  };
}

/**
 * Create price adapter from host service
 */
export function createPriceAdapter(hostPriceService: any): import('../ports/index.js').IPricePort {
  return {
    getCurrentPrice: async (symbol) => {
      try {
        const data = await hostPriceService?.getCurrentPrice?.(symbol);
        return data || null;
      } catch {
        return null;
      }
    },
    getPriceHistory: async (symbol, hours) => {
      try {
        const data = await hostPriceService?.getPriceHistory?.(symbol, hours);
        return data || null;
      } catch {
        return null;
      }
    },
    getMarketCap: async (symbol) => {
      try {
        const data = await hostPriceService?.getMarketCap?.(symbol);
        return data || null;
      } catch {
        return null;
      }
    },
  };
}
