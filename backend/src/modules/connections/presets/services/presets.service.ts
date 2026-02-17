/**
 * Presets Service
 */

import { Preset, PRESETS, PresetId } from '../contracts/presets.types.js';

export class PresetsService {
  getAll(): Preset[] {
    return PRESETS;
  }

  getById(id: PresetId): Preset | undefined {
    return PRESETS.find(p => p.id === id);
  }

  getFiltersForPreset(id: PresetId): Preset['filters'] | null {
    const preset = this.getById(id);
    return preset?.filters ?? null;
  }

  getSortForPreset(id: PresetId): { sortBy: string; sortOrder: string } | null {
    const preset = this.getById(id);
    if (!preset) return null;
    return { sortBy: preset.sortBy, sortOrder: preset.sortOrder };
  }
}
