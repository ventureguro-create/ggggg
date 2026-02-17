/**
 * Presets Routes
 */

import { FastifyInstance } from 'fastify';
import { PresetsService } from '../services/presets.service.js';

export async function registerPresetsRoutes(
  app: FastifyInstance,
  deps: { presets: PresetsService }
) {
  // Get all presets
  app.get('/', async () => {
    const presets = deps.presets.getAll();
    return { ok: true, data: presets };
  });

  // Get single preset
  app.get('/:id', async (req) => {
    const { id } = (req as any).params;
    const preset = deps.presets.getById(id.toUpperCase());
    if (!preset) {
      return { ok: false, error: 'PRESET_NOT_FOUND' };
    }
    return { ok: true, data: preset };
  });

  console.log('[Presets] Routes registered');
}
