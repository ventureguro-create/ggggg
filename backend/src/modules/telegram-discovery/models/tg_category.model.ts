/**
 * TG Category Model
 * Collection: tg_categories
 */
import { Schema, model, Document } from 'mongoose';

export interface ITgCategory extends Document {
  key: string;
  title: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TgCategorySchema = new Schema<ITgCategory>({
  key: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  description: String,
}, {
  timestamps: true,
  collection: 'tg_categories'
});

export const TgCategoryModel = model<ITgCategory>('TgCategory', TgCategorySchema);
