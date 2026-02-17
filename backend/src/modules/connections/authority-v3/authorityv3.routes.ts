import { FastifyInstance } from 'fastify';
import { getMongoDb } from '../../../db/mongoose.js';
import { authorityV3, computeAuthorityV3Batch } from './authorityv3.service.js';

export async function registerAuthorityV3Routes(app: FastifyInstance) {
  const db = getMongoDb();

  // Compute authority for single account
  app.post('/api/connections/authority/v3/compute', async (req: any) => {
    const input = req.body;
    const result = authorityV3(input);
    return { ok: true, ...result };
  });

  // Get authority for account by ID
  app.get('/api/connections/authority/v3/:accountId', async (req: any) => {
    const accountId = String(req.params.accountId);
    const results = await computeAuthorityV3Batch(db, [accountId]);
    const result = results.get(accountId);
    
    if (!result) {
      return { ok: false, error: 'Account not found' };
    }
    
    return { ok: true, accountId, ...result };
  });

  console.log('[AuthorityV3] Routes registered at /api/connections/authority/v3/*');
}
