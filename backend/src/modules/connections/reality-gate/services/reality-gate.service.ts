/**
 * Reality Gate Service
 * 
 * E2: Core logic for filtering alerts based on on-chain reality.
 * 
 * Twitter говорит, On-chain подтверждает, Alerts верят только фактам.
 */

import { 
  TwitterEventInput, 
  RealityGateResult, 
  GateDecision,
  RealityGatePolicy,
  DEFAULT_GATE_POLICY 
} from '../contracts/reality-gate.types.js';
import { RealityGateConfigStore } from './reality-gate-config.store.js';
import { RealityEvaluatorService } from '../../reality/services/reality-evaluator.service.js';
import { RealityLedgerStore } from '../../reality/storage/reality-ledger.store.js';
import { InfluenceHistoryStore } from '../../influence-adjustment/storage/influence-history.store.js';
import { ActorTrustService } from '../../influence-adjustment/services/actor-trust.service.js';
import { buildNeutralEventFromTwitter } from '../../reality/services/neutral-event.builder.js';
import { RealityVerdict } from '../../reality/contracts/reality-ledger.types.js';

export class RealityGateService {
  constructor(
    private readonly configStore: RealityGateConfigStore,
    private readonly realityEvaluator: RealityEvaluatorService,
    private readonly historyStore: InfluenceHistoryStore,
    private readonly trustService: ActorTrustService
  ) {}

  /**
   * Calculate Reality Score from verdict
   * 
   * CONFIRMS = 1.0
   * NO_DATA = 0.6
   * CONTRADICTS = 0.0
   */
  private calculateRealityScore(
    verdict: RealityVerdict,
    confidence: number,
    timeDecay: number = 1.0
  ): number {
    const verdictWeight = 
      verdict === 'CONFIRMED' ? 1.0 :
      verdict === 'NO_DATA' ? 0.6 :
      0.0; // CONTRADICTED
    
    return verdictWeight * confidence * timeDecay;
  }

  /**
   * Determine gate decision based on reality score
   */
  private determineDecision(
    realityScore: number,
    verdict: RealityVerdict,
    policy: RealityGatePolicy
  ): GateDecision {
    const { thresholds, noDataBehavior } = policy;

    // CONTRADICTED always blocks
    if (verdict === 'CONTRADICTED') {
      return 'BLOCK';
    }

    // NO_DATA follows policy
    if (verdict === 'NO_DATA') {
      return noDataBehavior === 'SUPPRESS' ? 'SUPPRESS' : 
             noDataBehavior === 'SEND_LOW' ? 'SEND_LOW' : 'SEND';
    }

    // CONFIRMED - use score thresholds
    if (realityScore < thresholds.blockBelow_0_1) {
      return 'BLOCK';
    }
    if (realityScore < thresholds.downgradeBelow_0_1) {
      return 'SEND_LOW';
    }
    if (realityScore >= thresholds.boostAbove_0_1) {
      return 'SEND_HIGH';
    }
    
    return 'SEND';
  }

  /**
   * Process Twitter event through Reality Gate
   */
  async evaluate(input: TwitterEventInput): Promise<RealityGateResult> {
    const config = await this.configStore.getOrCreate();
    const evaluatedAt = new Date().toISOString();

    // Check if gate is enabled
    if (!config.enabled) {
      return this.bypassResult(input, evaluatedAt, 'GATE_DISABLED');
    }

    // Check if this event type requires confirmation
    if (!config.requireConfirmFor.includes(input.eventType)) {
      return this.bypassResult(input, evaluatedAt, 'EVENT_TYPE_EXEMPT');
    }

    // Build neutral event and evaluate against on-chain
    const neutralEvent = buildNeutralEventFromTwitter({
      tweetId: input.meta?.tweetId || input.eventId,
      actorId: input.actorId,
      asset: input.asset || 'UNKNOWN',
      occurredAt: input.occurredAt,
      twitterScore: input.twitterScore_0_1000,
      networkSupport: input.networkScore_0_1,
    });

    const ledgerEntry = await this.realityEvaluator.evaluate(neutralEvent);

    // Calculate reality score
    const realityScore = this.calculateRealityScore(
      ledgerEntry.onchain.verdict,
      ledgerEntry.onchain.confidence_0_1
    );

    // Determine decision
    const decision = this.determineDecision(
      realityScore,
      ledgerEntry.onchain.verdict,
      config
    );

    // Get current trust and calculate adjustment
    const currentTrust = await this.trustService.computeTrustMultiplier(input.actorId);
    const trustMultiplier = 
      ledgerEntry.onchain.verdict === 'CONFIRMED' ? config.trustMultipliers.onConfirmed :
      ledgerEntry.onchain.verdict === 'CONTRADICTED' ? config.trustMultipliers.onContradicted :
      config.trustMultipliers.onNoData;
    
    const newTrust = Math.max(0.1, Math.min(1.5, currentTrust.trustMultiplier_0_1 * trustMultiplier));

    // Record in influence history
    await this.historyStore.addFromLedger({
      actorId: input.actorId,
      eventId: input.eventId,
      onchain: ledgerEntry.onchain,
      evaluatedAt,
    });

    // Build result
    const result: RealityGateResult = {
      eventId: input.eventId,
      decision,
      realityScore_0_1: realityScore,
      
      onchain: {
        verdict: ledgerEntry.onchain.verdict,
        confidence_0_1: ledgerEntry.onchain.confidence_0_1,
        flow_score: ledgerEntry.onchain.snapshots[0]?.flow_score_0_1,
        exchange_pressure: ledgerEntry.onchain.snapshots[0]?.exchange_pressure_m1_1,
      },
      
      trustAdjustment: {
        actorId: input.actorId,
        previousTrust_0_1: currentTrust.trustMultiplier_0_1,
        newTrust_0_1: newTrust,
        reason: ledgerEntry.onchain.verdict,
      },
      
      alert: {
        shouldSend: ['SEND', 'SEND_HIGH', 'SEND_LOW'].includes(decision),
        priority: decision === 'SEND_HIGH' ? 'HIGH' : decision === 'SEND_LOW' ? 'LOW' : 'NORMAL',
        suppressReason: decision === 'BLOCK' ? 'ONCHAIN_CONTRADICTS' : 
                        decision === 'SUPPRESS' ? 'NO_ONCHAIN_DATA' : undefined,
        warningBadge: ledgerEntry.onchain.verdict === 'NO_DATA' ? 'Awaiting Confirmation' :
                      ledgerEntry.onchain.verdict === 'CONTRADICTED' ? 'Reality Contradicted' : undefined,
      },
      
      evaluatedAt,
    };

    return result;
  }

  /**
   * Bypass result when gate is disabled or event is exempt
   */
  private bypassResult(
    input: TwitterEventInput,
    evaluatedAt: string,
    reason: string
  ): RealityGateResult {
    return {
      eventId: input.eventId,
      decision: 'SEND',
      realityScore_0_1: 1.0,
      onchain: {
        verdict: 'NO_DATA',
        confidence_0_1: 0,
      },
      trustAdjustment: {
        actorId: input.actorId,
        previousTrust_0_1: 1.0,
        newTrust_0_1: 1.0,
        reason: `BYPASS:${reason}`,
      },
      alert: {
        shouldSend: true,
        priority: 'NORMAL',
      },
      evaluatedAt,
    };
  }

  /**
   * Get gate status and stats
   */
  async getStatus(): Promise<{
    enabled: boolean;
    policy: RealityGatePolicy;
    stats: { total: number; blocked: number; sent: number };
  }> {
    const config = await this.configStore.getOrCreate();
    
    return {
      enabled: config.enabled,
      policy: config,
      stats: {
        total: 0, // TODO: aggregate from ledger
        blocked: 0,
        sent: 0,
      },
    };
  }
}
