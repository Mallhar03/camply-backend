/**
 * notification.service.ts
 *
 * Thin wrapper around Socket.IO for pushing real-time events to specific
 * users.  Controllers call these helpers instead of importing `io` directly.
 */

import { getIo } from "../config/socket";
import logger from "../config/logger";

/** Emit an event to all sockets belonging to a specific user. */
function emitToUser(userId: string, event: string, payload: unknown): void {
  try {
    getIo().to(`user:${userId}`).emit(event, payload);
  } catch (err) {
    logger.warn(`Notification emit failed for user ${userId}`, err);
  }
}

// ── Public helpers ──────────────────────────────────────

/**
 * Tell both users they've been matched.
 */
export function notifyMatch(userAId: string, userBId: string): void {
  emitToUser(userAId, "match", { matchedUserId: userBId });
  emitToUser(userBId, "match", { matchedUserId: userAId });
}

/**
 * Notify a user that someone commented on their post.
 */
export function notifyComment(
  postAuthorId: string,
  commenterId: string,
  postId: string
): void {
  if (postAuthorId === commenterId) return; // don't notify yourself
  emitToUser(postAuthorId, "new-comment", { commenterId, postId });
}

/**
 * Notify a user that someone voted on their post.
 */
export function notifyVote(
  postAuthorId: string,
  voterId: string,
  postId: string,
  value: number
): void {
  if (postAuthorId === voterId) return;
  emitToUser(postAuthorId, "new-vote", { voterId, postId, value });
}

/**
 * Notify a user they've been added to a team.
 */
export function notifyTeamInvite(
  inviteeId: string,
  teamId: string,
  teamName: string
): void {
  emitToUser(inviteeId, "team-invite", { teamId, teamName });
}
