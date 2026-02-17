/**
 * Pilot Module Index (Phase 4.6)
 */

export {
  PilotStore,
  initPilotStore,
  getPilotStore,
  startPilotStep,
  checkPilotReadiness,
  type PilotAccount,
  type PilotAccountType,
  type PilotConfig,
  type PilotStats,
  type PilotStep,
  type StepWeights,
} from './pilot.store.js';

export { registerPilotRoutes } from './pilot.routes.js';
