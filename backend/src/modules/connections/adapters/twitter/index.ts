/**
 * Twitter → Connections Adapter Module
 * 
 * PHASE 4.1
 * 
 * This module provides the integration layer between:
 * - Twitter Parser (existing, unchanged)
 * - Connections Core (our scoring/graph engine)
 * 
 * Key principles:
 * - Twitter Parser is NOT modified
 * - Adapter reads from Twitter storage
 * - Adapter writes to Connections storage
 * - dry-run mode for safe testing
 * - Admin controls everything
 * 
 * Architecture:
 * 
 * [ Twitter Parser ]         ← unchanged
 *         ↓
 * [ Twitter Storage ]        ← unchanged  
 *         ↓
 * 🧩 Twitter→Connections Adapter   ← THIS MODULE
 *         ↓
 * [ Connections Core ]       ← unchanged
 */

// Contracts
export * from './contracts/index.js';

// Mapper
export * from './mapper/index.js';

// Safety
export * from './safety/index.js';

// Adapter
export * from './adapter/index.js';

// API
export { registerTwitterAdapterRoutes } from './api/index.js';
