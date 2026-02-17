/**
 * Projects Module Index - E2 Phase
 * 
 * Project Detail Pages for the influence network.
 */

export * from './project.types.js';
export { 
  initProjectStore,
  createProject,
  updateProject,
  getProjectById,
  getProjectBySlug,
  listProjects,
  linkBacker,
  unlinkBacker,
  getProjectBackers,
  linkAccount,
  unlinkAccount,
  getProjectAccounts,
  getProjectNetwork,
  getRelatedProjects,
  getWhyItMatters,
  recomputeProjectAuthority,
} from './project.store.js';
export { registerProjectRoutes } from './project.routes.js';
export { registerProjectAdminRoutes } from './project.admin.routes.js';

console.log('[Projects] Module loaded (E2 Phase)');
