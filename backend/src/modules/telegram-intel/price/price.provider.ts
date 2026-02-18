/**
 * Alpha Price Provider Interface
 * Abstraction for price data source
 */
export interface AlphaPriceProvider {
  getHistoricalPriceUSD(token: string, at: Date): Promise<number | null>;
  getCurrentPriceUSD(token: string): Promise<number | null>;
}
