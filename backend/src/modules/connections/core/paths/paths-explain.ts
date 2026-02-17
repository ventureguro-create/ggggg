/**
 * Network Paths Explain
 * 
 * Human-readable explanations for network paths and exposure
 * 
 * Phase 3.4 POLISH: Enhanced path badges and inline explanations
 */

import { NetworkPath, NetworkExposure, PathBadge } from './paths-types.js';
import { pathsConfig as cfg } from './paths-config.js';

/**
 * Phase 3.4.1A: Compute path badges (quick semantic labels)
 * 
 * Badge conditions:
 * - 🔥 Strong Access: strength > 0.7
 * - 🧠 Smart Route: authority_sum > P75 (1.8 for typical paths)
 * - ⚡ Short Reach: hops ≤ 2
 * - 👑 Elite Touch: target tier = elite
 */
export function computePathBadges(path: NetworkPath): PathBadge[] {
  const badges: PathBadge[] = [];
  
  // 🔥 Strong Access
  if (path.strength > 0.7) {
    badges.push('strong_access');
  }
  
  // 🧠 Smart Route (P75 threshold ~1.8 for authority_sum)
  if (path.authority_sum > 1.8) {
    badges.push('smart_route');
  }
  
  // ⚡ Short Reach
  if (path.hops <= 2) {
    badges.push('short_reach');
  }
  
  // 👑 Elite Touch
  const targetNode = path.nodes[path.nodes.length - 1];
  if (targetNode?.authority_tier === 'elite') {
    badges.push('elite_touch');
  }
  
  return badges;
}

/**
 * Phase 3.4.1B: Generate inline explanation for a path
 * 
 * Short 1-2 sentence explanation of WHY this path matters
 */
export function explainPath(path: NetworkPath): string {
  const badges = path.badges || computePathBadges(path);
  const targetTier = path.nodes[path.nodes.length - 1]?.authority_tier || 'mid';
  
  // Priority-based explanation
  if (badges.includes('short_reach') && badges.includes('strong_access')) {
    return `Short and strong path to a high-authority account — direct network influence.`;
  }
  
  if (badges.includes('elite_touch') && path.hops <= 2) {
    return `${path.hops} handshake${path.hops > 1 ? 's' : ''} to an elite node — exceptional network positioning.`;
  }
  
  if (badges.includes('smart_route')) {
    return `Multi-step access through smart network players — quality over quantity.`;
  }
  
  if (badges.includes('strong_access')) {
    return `Strong influence chain — all nodes in path have high authority.`;
  }
  
  if (badges.includes('short_reach')) {
    return `Quick access to ${targetTier}-tier node in just ${path.hops} hop${path.hops > 1 ? 's' : ''}.`;
  }
  
  if (targetTier === 'elite' || targetTier === 'high') {
    return `Indirect network exposure to ${targetTier}-tier influence via ${path.hops} intermediaries.`;
  }
  
  return `Indirect network exposure through ${path.hops} connection${path.hops > 1 ? 's' : ''}.`;
}

/**
 * Phase 3.4.1: Enhance path with badges and explanation
 */
export function enhancePath(path: NetworkPath): NetworkPath {
  const badges = computePathBadges(path);
  const explain_text = explainPath({ ...path, badges });
  return {
    ...path,
    badges,
    explain_text,
  };
}

/**
 * Badge display labels (for frontend reference)
 */
export const BADGE_LABELS: Record<PathBadge, { emoji: string; text: string; description: string }> = {
  strong_access: {
    emoji: '🔥',
    text: 'Strong Access',
    description: 'Strong influence chain',
  },
  smart_route: {
    emoji: '🧠',
    text: 'Smart Route',
    description: 'Through high-quality players',
  },
  short_reach: {
    emoji: '⚡',
    text: 'Short Reach',
    description: 'Quick access path',
  },
  elite_touch: {
    emoji: '👑',
    text: 'Elite Touch',
    description: 'Reaches elite tier',
  },
};

/**
 * Generate explanation for paths analysis
 */
export function explainPaths(
  account_id: string,
  paths: NetworkPath[],
  exposure: NetworkExposure
): {
  summary: string;
  details: string[];
  recommendations: string[];
} {
  const details: string[] = [];
  const recommendations: string[] = [];
  
  // Path analysis
  if (paths.length === 0) {
    details.push('Нет значимых путей до сильных узлов сети.');
    recommendations.push('Расширять сеть связей через органическое взаимодействие.');
  } else {
    const shortestElite = paths.find(p => 
      p.nodes[p.nodes.length - 1]?.authority_tier === 'elite'
    );
    
    if (shortestElite) {
      details.push(`${shortestElite.hops} рукопожатия до elite-узла (@${shortestElite.to}).`);
    }
    
    const avgContribution = paths.reduce((a, b) => a + b.contribution_0_1, 0) / paths.length;
    details.push(`Средний вклад пути в network score: ${Math.round(avgContribution * 100)}%.`);
    
    const strongPaths = paths.filter(p => p.strength >= 0.6);
    if (strongPaths.length > 0) {
      details.push(`${strongPaths.length} сильных путей (strength ≥ 0.6).`);
    }
  }
  
  // Exposure analysis
  if (exposure.exposure_tier === 'elite') {
    details.push('Elite-уровень доступа к сети: аккаунт встроен в ядро.');
  } else if (exposure.exposure_tier === 'strong') {
    details.push('Сильный уровень доступа: хорошие связи с влиятельными узлами.');
  } else if (exposure.exposure_tier === 'moderate') {
    details.push('Умеренный уровень доступа: есть связи, но потенциал роста.');
    recommendations.push('Укреплять связи с high/elite узлами.');
  } else {
    details.push('Слабый уровень доступа: аккаунт изолирован от ядра сети.');
    recommendations.push('Критически важно расширять сеть качественных связей.');
  }
  
  // Reachability
  if (exposure.reachable_elite > 0) {
    details.push(`Достижимо ${exposure.reachable_elite} elite-узлов.`);
  }
  if (exposure.reachable_high > 0) {
    details.push(`Достижимо ${exposure.reachable_high} high-узлов.`);
  }
  
  // General recommendations
  recommendations.push('Поддерживать активность в сети для сохранения позиции.');
  
  // Summary
  let summary: string;
  if (exposure.exposure_tier === 'elite') {
    summary = 'Аккаунт имеет элитный уровень сетевого влияния — встроен в ядро сети через короткие сильные пути.';
  } else if (exposure.exposure_tier === 'strong') {
    summary = 'Аккаунт хорошо интегрирован в сеть — есть значимые пути к влиятельным узлам.';
  } else if (exposure.exposure_tier === 'moderate') {
    summary = 'Аккаунт имеет умеренное сетевое влияние — связи есть, но есть потенциал для укрепления.';
  } else {
    summary = 'Аккаунт слабо интегрирован в сеть — мало путей к влиятельным узлам.';
  }
  
  return { summary, details, recommendations };
}

/**
 * Format path as readable string
 */
export function formatPath(path: NetworkPath): string {
  return path.nodes.map(n => `@${n.id}`).join(' → ');
}
