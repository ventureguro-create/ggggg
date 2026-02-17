/**
 * Discovery Job
 * 
 * Периодическое обнаружение новых каналов
 */
import { discoveryService } from '../services/index.js';
import { TgCandidateModel } from '../models/index.js';
import { telegramAdapter } from '../adapter/index.js';

let discoveryInterval: NodeJS.Timeout | null = null;

/**
 * Process pending candidates
 */
async function processCandidate(username: string): Promise<void> {
  try {
    // Mark as processing
    await TgCandidateModel.updateOne(
      { username },
      { status: 'processing' }
    );

    // Validate channel
    const validation = await telegramAdapter.validateChannel(username);
    
    // Update pre-validation
    await TgCandidateModel.updateOne(
      { username },
      { preValidation: validation }
    );

    if (!validation.exists || !validation.isChannel || !validation.isPublic) {
      await TgCandidateModel.updateOne(
        { username },
        { 
          status: 'rejected',
          processedAt: new Date(),
          errorMessage: 'Channel not found or not public',
        }
      );
      return;
    }

    // Auto-approve if meets criteria (can be configured)
    if (validation.subscriberCount && validation.subscriberCount >= 1000) {
      // Get channel info
      const channelInfo = await telegramAdapter.getChannelInfo(username);
      
      if (channelInfo) {
        await discoveryService.seedChannel({
          username: channelInfo.username,
          title: channelInfo.title,
          description: channelInfo.description,
        });

        await TgCandidateModel.updateOne(
          { username },
          { status: 'approved', processedAt: new Date() }
        );
        
        console.log(`[Discovery] Auto-approved channel: @${username}`);
      }
    } else {
      // Keep as pending for manual review
      await TgCandidateModel.updateOne(
        { username },
        { status: 'pending' }
      );
    }
  } catch (error) {
    console.error(`[Discovery] Error processing ${username}:`, error);
    await TgCandidateModel.updateOne(
      { username },
      { status: 'error', errorMessage: String(error) }
    );
  }
}

/**
 * Run discovery job iteration
 */
async function runDiscoveryIteration(): Promise<void> {
  console.log('[Discovery] Running discovery iteration...');
  
  const candidates = await discoveryService.getPendingCandidates(5);
  
  if (candidates.length === 0) {
    console.log('[Discovery] No pending candidates');
    return;
  }

  console.log(`[Discovery] Processing ${candidates.length} candidates`);
  
  for (const candidate of candidates) {
    await processCandidate(candidate.username);
  }
}

/**
 * Start discovery job
 */
export function startDiscoveryJob(intervalMinutes: number = 10): void {
  if (discoveryInterval) {
    console.log('[Discovery] Job already running');
    return;
  }

  console.log(`[Discovery] Starting job (interval: ${intervalMinutes}min)`);
  
  // Run immediately
  runDiscoveryIteration().catch(console.error);
  
  // Then schedule
  discoveryInterval = setInterval(
    () => runDiscoveryIteration().catch(console.error),
    intervalMinutes * 60 * 1000
  );
}

/**
 * Stop discovery job
 */
export function stopDiscoveryJob(): void {
  if (discoveryInterval) {
    clearInterval(discoveryInterval);
    discoveryInterval = null;
    console.log('[Discovery] Job stopped');
  }
}

/**
 * Run discovery manually
 */
export async function runDiscoveryManually(): Promise<{ processed: number }> {
  const candidates = await discoveryService.getPendingCandidates(10);
  
  for (const candidate of candidates) {
    await processCandidate(candidate.username);
  }

  return { processed: candidates.length };
}
