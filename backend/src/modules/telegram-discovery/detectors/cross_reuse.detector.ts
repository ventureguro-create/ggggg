/**
 * Cross-Channel Reuse Detector
 * 
 * Detects synchronized content across network (same fingerprint in multiple channels)
 */
import { clamp01 } from '../utils/math.js';

export interface CrossReuseResult {
  reuseRatio: number;       // share of posts participating in clusters
  reuseClusterCount: number;
  maxClusterSize: number;
  reuseScore: number;       // 0..1
}

export async function detectCrossReuse(
  username: string,
  TgPostModel: any,
  windowHours = 6
): Promise<CrossReuseResult> {
  const since = new Date(Date.now() - windowHours * 3600 * 1000);

  const posts = await TgPostModel.find({
    channelUsername: username,
    date: { $gte: since },
    fingerprint: { $exists: true, $ne: '' }
  }).lean();

  if (posts.length < 5) {
    return { reuseRatio: 0, reuseClusterCount: 0, maxClusterSize: 0, reuseScore: 0 };
  }

  let reuseCount = 0;
  let clusterCount = 0;
  let maxCluster = 0;

  for (const p of posts) {
    const same = await TgPostModel.countDocuments({
      fingerprint: p.fingerprint,
      date: { $gte: since }
    });

    if (same >= 3) {
      reuseCount++;
      clusterCount++;
      maxCluster = Math.max(maxCluster, same);
    }
  }

  const reuseRatio = reuseCount / posts.length;
  const reuseScore = clamp01(0.7 * reuseRatio + 0.3 * (maxCluster / 10));

  return {
    reuseRatio,
    reuseClusterCount: clusterCount,
    maxClusterSize: maxCluster,
    reuseScore
  };
}
