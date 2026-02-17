/**
 * TG Discovery Edges Model
 * Collection: tg_discovery_edges
 * 
 * Граф связей между каналами (forwards, mentions)
 */
import { Schema, model, Document } from 'mongoose';

export interface ITgDiscoveryEdge extends Document {
  sourceChannelId: string;     // Channel that forwarded/mentioned
  targetChannelId: string;     // Channel being forwarded/mentioned
  
  type: 'forward' | 'mention'; // Edge type
  
  // Counters
  count: number;               // How many times this edge occurred
  firstSeen: Date;
  lastSeen: Date;
  
  // Recent examples
  recentPostIds: string[];     // Last 5 post IDs with this edge
  
  // Analysis
  strength: number;            // Normalized strength (0-1)
  bidirectional: boolean;      // Does target also link to source?
  
  createdAt: Date;
  updatedAt: Date;
}

const TgDiscoveryEdgeSchema = new Schema<ITgDiscoveryEdge>({
  sourceChannelId: { type: String, required: true, index: true },
  targetChannelId: { type: String, required: true, index: true },
  
  type: {
    type: String,
    enum: ['forward', 'mention'],
    required: true
  },
  
  count: { type: Number, default: 1 },
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  
  recentPostIds: { type: [String], default: [] },
  
  strength: { type: Number, default: 0, min: 0, max: 1 },
  bidirectional: { type: Boolean, default: false },
}, {
  timestamps: true,
  collection: 'tg_discovery_edges'
});

// Compound unique index
TgDiscoveryEdgeSchema.index(
  { sourceChannelId: 1, targetChannelId: 1, type: 1 }, 
  { unique: true }
);
TgDiscoveryEdgeSchema.index({ targetChannelId: 1 });
TgDiscoveryEdgeSchema.index({ lastSeen: -1 });

export const TgDiscoveryEdgeModel = model<ITgDiscoveryEdge>('TgDiscoveryEdge', TgDiscoveryEdgeSchema);
