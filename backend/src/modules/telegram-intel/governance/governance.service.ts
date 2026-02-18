/**
 * Governance Service
 * Phase 4: Config + Overrides management
 */
import {
  TgScoringConfigModel,
  TgOverridesModel,
  DEFAULT_INTEL_CONFIG,
} from './governance.model.js';

export class GovernanceService {
  constructor(private log: (msg: string, meta?: any) => void) {}

  async ensureDefaultConfig() {
    const existing = await TgScoringConfigModel.findOne({
      key: DEFAULT_INTEL_CONFIG.key,
      version: 1,
    }).lean();

    if (existing) return existing;

    await TgScoringConfigModel.create({
      key: DEFAULT_INTEL_CONFIG.key,
      version: DEFAULT_INTEL_CONFIG.version,
      isActive: true,
      payload: DEFAULT_INTEL_CONFIG,
      createdBy: 'system',
    });

    this.log('[gov] default config created');
    return DEFAULT_INTEL_CONFIG;
  }

  async getActiveConfig(key = 'intel_v1') {
    await this.ensureDefaultConfig();
    const cfg = await TgScoringConfigModel.findOne({ key, isActive: true })
      .sort({ version: -1 })
      .lean();
    return (cfg as any)?.payload || DEFAULT_INTEL_CONFIG;
  }

  async setActiveVersion(key: string, version: number) {
    await TgScoringConfigModel.updateMany({ key }, { $set: { isActive: false } });
    await TgScoringConfigModel.updateOne({ key, version }, { $set: { isActive: true } });
    return { ok: true };
  }

  async createConfigVersion(key: string, payload: any, createdBy: string) {
    const latest = await TgScoringConfigModel.findOne({ key })
      .sort({ version: -1 })
      .lean();
    const newVersion = ((latest as any)?.version || 0) + 1;

    await TgScoringConfigModel.create({
      key,
      version: newVersion,
      isActive: false,
      payload,
      createdBy,
    });

    return { ok: true, version: newVersion };
  }

  async upsertOverride(username: string, patch: any) {
    await TgOverridesModel.updateOne(
      { username },
      { $set: { ...patch, username, updatedAt: new Date() } },
      { upsert: true }
    );
    return { ok: true };
  }

  async getOverride(username: string) {
    return TgOverridesModel.findOne({ username }).lean();
  }

  async listOverrides(status?: string) {
    const filter: any = {};
    if (status) filter.status = status;
    return TgOverridesModel.find(filter).sort({ updatedAt: -1 }).lean();
  }
}
