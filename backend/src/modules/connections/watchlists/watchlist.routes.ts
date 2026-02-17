import { FastifyInstance } from 'fastify';
import { getMongoDb } from '../../../db/mongoose.js';
import {
  createWatchlist,
  getWatchlists,
  getWatchlistById,
  getWatchlistWithDiff,
  addItemToWatchlist,
  removeItemFromWatchlist,
  deleteWatchlist
} from './watchlist.service.js';

export async function registerWatchlistRoutes(app: FastifyInstance) {
  const db = getMongoDb();

  // Create watchlist
  app.post('/api/connections/watchlists', async (req: any) => {
    const { name, type } = req.body || {};
    const userId = req.headers['x-user-id'] || 'anonymous';

    if (!name) {
      return { ok: false, error: 'name required' };
    }

    const watchlist = await createWatchlist(db, userId, name, type);
    return { ok: true, watchlist };
  });

  // Get all watchlists for user
  app.get('/api/connections/watchlists', async (req: any) => {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const watchlists = await getWatchlists(db, userId);
    return { ok: true, watchlists };
  });

  // Get single watchlist
  app.get('/api/connections/watchlists/:id', async (req: any) => {
    const id = String(req.params.id);
    const watchlist = await getWatchlistById(db, id);
    
    if (!watchlist) {
      return { ok: false, error: 'Watchlist not found' };
    }
    
    return { ok: true, watchlist };
  });

  // Get watchlist with diff (current vs snapshot)
  app.get('/api/connections/watchlists/:id/diff', async (req: any) => {
    const id = String(req.params.id);
    const watchlist = await getWatchlistWithDiff(db, id);
    
    if (!watchlist) {
      return { ok: false, error: 'Watchlist not found' };
    }
    
    return { ok: true, watchlist };
  });

  // Add item to watchlist
  app.post('/api/connections/watchlists/:id/items', async (req: any) => {
    const id = String(req.params.id);
    const { entityId, type, preset } = req.body || {};

    if (!entityId) {
      return { ok: false, error: 'entityId required' };
    }

    const success = await addItemToWatchlist(db, id, {
      entityId,
      type: type || 'ACCOUNT',
      preset
    });

    return { ok: success };
  });

  // Remove item from watchlist
  app.delete('/api/connections/watchlists/:id/items/:entityId', async (req: any) => {
    const id = String(req.params.id);
    const entityId = String(req.params.entityId);

    const success = await removeItemFromWatchlist(db, id, entityId);
    return { ok: success };
  });

  // Delete watchlist
  app.delete('/api/connections/watchlists/:id', async (req: any) => {
    const id = String(req.params.id);
    const success = await deleteWatchlist(db, id);
    return { ok: success };
  });

  console.log('[Watchlists] Routes registered at /api/connections/watchlists/*');
}
