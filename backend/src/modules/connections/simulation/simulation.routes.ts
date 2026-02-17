/**
 * Simulation Routes (Phase 4.7)
 * 
 * Admin API for running simulations before FREEZE
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  SimulationEngine,
  runAllScenarios,
  getScenario,
  type ScenarioId,
} from './simulation.engine.js';

export async function registerSimulationRoutes(fastify: FastifyInstance): Promise<void> {
  
  /**
   * GET /scenarios
   * List available scenarios
   */
  fastify.get('/scenarios', async (req: FastifyRequest, reply: FastifyReply) => {
    const scenarios: ScenarioId[] = [
      'BASELINE_STABILITY',
      'BOT_PUMP',
      'SMART_NONAME',
      'ELITE_FOLLOW_UNFOLLOW',
      'GRAPH_POISONING',
      'ALERT_FLOOD',
      'ROLLBACK_DRILL',
      'AI_CONSISTENCY',
    ];
    
    const details = scenarios.map(id => {
      const s = getScenario(id);
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        ticks: s.ticks,
        accounts: s.accounts.length,
        expected: s.expected,
      };
    });
    
    return reply.send({ ok: true, data: details });
  });
  
  /**
   * POST /run/:scenario_id
   * Run single scenario
   */
  fastify.post('/run/:scenario_id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { scenario_id } = req.params as { scenario_id: ScenarioId };
    
    try {
      const engine = new SimulationEngine(scenario_id);
      const result = engine.run();
      
      return reply.send({
        ok: true,
        data: {
          scenario_id: result.scenario_id,
          run_id: result.run_id,
          passed: result.passed,
          failures: result.failures,
          warnings: result.warnings,
          ticks_run: result.ticks_run,
          final_scores: result.final_scores,
          final_confidence: result.final_confidence,
          score_deltas: result.score_deltas,
          alerts_total: result.alerts_total,
          rollbacks: result.rollbacks,
        },
      });
    } catch (err: any) {
      return reply.status(400).send({ ok: false, error: err.message });
    }
  });
  
  /**
   * POST /run-all
   * Run all scenarios
   */
  fastify.post('/run-all', async (req: FastifyRequest, reply: FastifyReply) => {
    const { results, summary } = runAllScenarios();
    
    // Generate FREEZE readiness report
    const freezeReady = summary.failed === 0;
    
    const report = {
      freeze_ready: freezeReady,
      freeze_verdict: freezeReady ? 'GO' : 'NO-GO',
      summary,
      details: results.map(r => ({
        scenario: r.scenario_id,
        passed: r.passed,
        failures: r.failures,
        warnings: r.warnings,
        score_deltas: r.score_deltas,
        alerts: r.alerts_total,
        rollbacks: r.rollbacks,
      })),
    };
    
    return reply.send({ ok: true, data: report });
  });
  
  /**
   * GET /freeze-status
   * Get FREEZE readiness status
   */
  fastify.get('/freeze-status', async (req: FastifyRequest, reply: FastifyReply) => {
    // Run quick validation
    const { summary } = runAllScenarios();
    
    const checklist = {
      baseline_stability: summary.scenarios['BASELINE_STABILITY'],
      bot_pump_blocked: summary.scenarios['BOT_PUMP'],
      smart_noname_wins: summary.scenarios['SMART_NONAME'],
      elite_follow_works: summary.scenarios['ELITE_FOLLOW_UNFOLLOW'],
      graph_protected: summary.scenarios['GRAPH_POISONING'],
      alert_flood_handled: summary.scenarios['ALERT_FLOOD'],
      rollback_works: summary.scenarios['ROLLBACK_DRILL'],
      ai_consistent: summary.scenarios['AI_CONSISTENCY'],
    };
    
    const allPassed = Object.values(checklist).every(v => v);
    
    return reply.send({
      ok: true,
      data: {
        freeze_ready: allPassed,
        verdict: allPassed ? 'GO' : 'NO-GO',
        passed: summary.passed,
        failed: summary.failed,
        checklist,
        message: allPassed 
          ? '✅ All scenarios PASSED. System ready for FREEZE.'
          : '❌ Some scenarios FAILED. Fix issues before FREEZE.',
      },
    });
  });
  
  console.log('[Simulation] Routes registered at /api/admin/connections/simulation/*');
}
