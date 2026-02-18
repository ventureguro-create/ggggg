/**
 * TG Category Membership Model
 * Collection: tg_category_memberships
 */
import { Schema, model, Document } from 'mongoose';

export interface ITgCategoryMembership extends Document {
  username: string;
  category: string;
  method: 'RULES' | 'MANUAL';
  confidence: number;
  updatedAt: Date;
  createdAt: Date;
}

const TgCategoryMembershipSchema = new Schema<ITgCategoryMembership>({
  username: { type: String, required: true, index: true },
  category: { type: String, required: true, index: true },
  method: { 
    type: String, 
    enum: ['RULES', 'MANUAL'], 
    default: 'RULES' 
  },
  confidence: { type: Number, default: 0.5, min: 0, max: 1 },
}, {
  timestamps: true,
  collection: 'tg_category_memberships'
});

TgCategoryMembershipSchema.index({ username: 1, category: 1 }, { unique: true });

export const TgCategoryMembershipModel = model<ITgCategoryMembership>('TgCategoryMembership', TgCategoryMembershipSchema);
