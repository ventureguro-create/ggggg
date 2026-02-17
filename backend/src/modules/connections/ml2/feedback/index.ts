/**
 * Feedback Module Index - PHASE C2
 */

export * from './feedback.types.js';
export { 
  initFeedbackStore, 
  saveFeedback, 
  getFeedbackStats, 
  getRecentFeedback,
  getFeedbackByAlertId 
} from './feedback.store.js';

console.log('[ML2/Feedback] Module loaded (Phase C2)');
