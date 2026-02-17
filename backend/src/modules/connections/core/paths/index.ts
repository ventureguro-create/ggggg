/**
 * Network Paths Module - Main Export
 */

export { buildPathsResponse, generateMockGraphForPaths } from './paths-engine.js';
export { computeExposure, getExposureTierLabel, getExposureTierColor } from './exposure-engine.js';
export { explainPaths, formatPath } from './paths-explain.js';

export { 
  pathsConfig, 
  updatePathsConfig, 
  getPathsConfig,
  PATHS_VERSION,
} from './paths-config.js';
export type { PathsConfig } from './paths-config.js';

export type {
  AuthorityTier,
  PathNode,
  NetworkPath,
  NetworkExposure,
  PathsRequest,
  PathsResponse,
  GraphNode,
  GraphEdge,
  GraphSnapshot,
} from './paths-types.js';
