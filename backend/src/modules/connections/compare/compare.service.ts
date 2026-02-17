/**
 * Compare Service - A vs B comparison
 */

import { Db } from 'mongodb';
import { authorityV3 } from '../authority-v3/authorityv3.service.js';

export interface CompareResult {
  winner: string | null;
  reason: string;
  comparison: {
    authority: [number, number];
    network: [number, number];
    early: [number, number];
    smart: [number, number];
  };
  leftEntity: any;
  rightEntity: any;
}

export async function compareEntities(
  db: Db,
  leftId: string,
  rightId: string,
  preset?: string
): Promise<CompareResult> {
  // Fetch both entities
  const [left, right] = await Promise.all([
    db.collection('connections_unified_accounts').findOne({
      $or: [{ id: leftId }, { slug: leftId }]
    }),
    db.collection('connections_unified_accounts').findOne({
      $or: [{ id: rightId }, { slug: rightId }]
    })
  ]);

  if (!left || !right) {
    return {
      winner: null,
      reason: 'One or both entities not found',
      comparison: {
        authority: [0, 0],
        network: [0, 0],
        early: [0, 0],
        smart: [0, 0]
      },
      leftEntity: left,
      rightEntity: right
    };
  }

  // Calculate scores
  const leftAuthority = left.authority ?? left.seedAuthority ?? 0;
  const rightAuthority = right.authority ?? right.seedAuthority ?? 0;

  const leftNetwork = left.networkScore ?? left.influence ?? 0;
  const rightNetwork = right.networkScore ?? right.influence ?? 0;

  const leftEarly = left.early ?? left.earlyScore ?? 0;
  const rightEarly = right.early ?? right.earlyScore ?? 0;

  const leftSmart = left.smart ?? left.smartScore ?? 0;
  const rightSmart = right.smart ?? right.smartScore ?? 0;

  // Calculate composite scores based on preset
  let leftTotal = 0;
  let rightTotal = 0;

  switch (preset) {
    case 'SMART':
      leftTotal = leftSmart * 0.4 + leftAuthority * 0.3 + leftNetwork * 0.3;
      rightTotal = rightSmart * 0.4 + rightAuthority * 0.3 + rightNetwork * 0.3;
      break;
    case 'VC':
      leftTotal = leftAuthority;
      rightTotal = rightAuthority;
      break;
    case 'EARLY':
      leftTotal = leftEarly * 0.5 + leftSmart * 0.3 + leftNetwork * 0.2;
      rightTotal = rightEarly * 0.5 + rightSmart * 0.3 + rightNetwork * 0.2;
      break;
    default:
      leftTotal = (leftAuthority + leftNetwork + leftEarly + leftSmart) / 4;
      rightTotal = (rightAuthority + rightNetwork + rightEarly + rightSmart) / 4;
  }

  // Determine winner
  let winner: string | null = null;
  let reason = '';

  if (Math.abs(leftTotal - rightTotal) < 0.05) {
    winner = null;
    reason = 'Both entities are comparable in overall strength';
  } else if (leftTotal > rightTotal) {
    winner = leftId;
    const diff = Math.round((leftTotal - rightTotal) * 100);
    reason = `${left.title || leftId} scores ${diff}% higher overall`;
    
    if (leftAuthority > rightAuthority + 0.1) {
      reason += ' with stronger authority';
    } else if (leftSmart > rightSmart + 0.1) {
      reason += ' with better smart signals';
    }
  } else {
    winner = rightId;
    const diff = Math.round((rightTotal - leftTotal) * 100);
    reason = `${right.title || rightId} scores ${diff}% higher overall`;
    
    if (rightAuthority > leftAuthority + 0.1) {
      reason += ' with stronger authority';
    } else if (rightSmart > leftSmart + 0.1) {
      reason += ' with better smart signals';
    }
  }

  return {
    winner,
    reason,
    comparison: {
      authority: [Math.round(leftAuthority * 100) / 100, Math.round(rightAuthority * 100) / 100],
      network: [Math.round(leftNetwork * 100) / 100, Math.round(rightNetwork * 100) / 100],
      early: [Math.round(leftEarly * 100) / 100, Math.round(rightEarly * 100) / 100],
      smart: [Math.round(leftSmart * 100) / 100, Math.round(rightSmart * 100) / 100]
    },
    leftEntity: {
      id: left.id,
      title: left.title,
      kind: left.kind
    },
    rightEntity: {
      id: right.id,
      title: right.title,
      kind: right.kind
    }
  };
}
