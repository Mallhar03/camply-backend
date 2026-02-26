/**
 * trust.service.ts
 *
 * Centralises all trust-score mutations so controllers never have to
 * repeat the "increment → recalculate level → save" dance.
 */

import prisma from "../config/prisma";
import { calculateTrustLevel, TrustScoreActions } from "../utils/trustScore";

type TrustAction = keyof typeof TrustScoreActions;

/**
 * Award trust points to a single user and recalculate their trust level.
 * Safe to call without try/catch — errors are swallowed so a trust-score
 * failure never breaks the primary operation.
 */
export async function awardTrust(userId: string, action: TrustAction): Promise<void> {
  try {
    const delta = TrustScoreActions[action];
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { trustScore: { increment: delta } },
      select: { trustScore: true },
    });
    const newLevel = calculateTrustLevel(updated.trustScore);
    await prisma.user.update({ where: { id: userId }, data: { trustLevel: newLevel } });
  } catch {
    // Non-fatal – trust-score errors should not bubble up
  }
}

/**
 * Award trust points to multiple users at once (e.g. on a match event).
 */
export async function awardTrustToMany(userIds: string[], action: TrustAction): Promise<void> {
  await Promise.all(userIds.map((id) => awardTrust(id, action)));
}
