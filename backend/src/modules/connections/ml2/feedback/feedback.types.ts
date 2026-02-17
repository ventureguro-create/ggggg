/**
 * Feedback Types - PHASE C2
 * Feedback & Impact Layer
 */

export type FeedbackSource = 'ADMIN' | 'USER' | 'SYSTEM';

export type FeedbackAction =
  | 'FALSE_POSITIVE'
  | 'CORRECT'
  | 'IGNORE'
  | 'SAVE'
  | 'CLICK';

export interface MlFeedback {
  actorId: string;
  alertId?: string;
  ml2Decision: 'SEND' | 'DOWNGRADE' | 'SUPPRESS';
  action: FeedbackAction;
  source: FeedbackSource;
  createdAt: Date;
}

export interface FeedbackStats {
  byAction: Array<{ _id: FeedbackAction; count: number }>;
  bySource: Array<{ _id: FeedbackSource; count: number }>;
  byDecision: Array<{ _id: string; count: number }>;
}

export interface FeedbackInput {
  actorId: string;
  alertId?: string;
  ml2Decision: 'SEND' | 'DOWNGRADE' | 'SUPPRESS';
  action: FeedbackAction;
  source: FeedbackSource;
}

console.log('[ML2/Feedback] Types loaded (Phase C2)');
