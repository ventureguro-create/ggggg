/**
 * Fraud Signal Model
 * Collection: tg_fraud_signals
 */
import mongoose, { Schema } from 'mongoose';

const TgFraudSignalSchema = new Schema(
  {
    username: { type: String, index: true, unique: true },

    fraudRisk: Number,

    entropy: Number,
    elasticity: Number,
    spikeRatio: Number,
    subscriberEfficiency: Number,
    networkConcentration: Number,
    reuseScore: Number,

    signals: Schema.Types.Mixed, // breakdown object

    computedAt: { type: Date, index: true },
  },
  { timestamps: true }
);

export const TgFraudSignalModel =
  mongoose.models.TgFraudSignal ||
  mongoose.model('TgFraudSignal', TgFraudSignalSchema);
