/**
 * Taxonomy v2 Module
 * 
 * PHASE B: Hard Identity Layer
 */

export * from './taxonomy.types.js';
export * from './taxonomy.constants.js';
export * from './taxonomy.engine.js';
export * from './taxonomy.store.js';
export * from './taxonomy.presets.js';
export { registerTaxonomyRoutes } from './taxonomy.routes.js';

console.log('[Taxonomy] Module loaded');
