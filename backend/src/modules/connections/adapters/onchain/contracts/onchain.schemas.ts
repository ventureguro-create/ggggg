/**
 * On-chain Adapter Schemas (Zod validation)
 */

import { z } from 'zod';

export const OnchainSnapshotSchema = z.object({
  asset: z.string().min(1),
  timestamp: z.string().min(10),
  window: z.object({ from: z.string(), to: z.string() }).optional(),
  flow_score_0_1: z.number().min(0).max(1),
  exchange_pressure_m1_1: z.number().min(-1).max(1),
  whale_activity_0_1: z.number().min(0).max(1),
  network_heat_0_1: z.number().min(0).max(1),
  velocity_0_1: z.number().min(0).max(1).optional(),
  distribution_skew_m1_1: z.number().min(-1).max(1).optional(),
  verdict: z.enum(['CONFIRMS', 'CONTRADICTS', 'NO_DATA']),
  confidence_0_1: z.number().min(0).max(1),
  warnings: z.array(z.string()).optional(),
  source: z.object({ name: z.string(), version: z.string().optional() }).optional(),
});

export const OnchainResolveRequestSchema = z.object({
  asset: z.string().min(1),
  eventTimestamp: z.string().min(10),
  windows: z.array(z.object({
    from: z.string().min(10),
    to: z.string().min(10),
    label: z.string().optional(),
  })).optional(),
});
