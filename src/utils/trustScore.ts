import { TrustLevel } from "@prisma/client";

export function calculateTrustLevel(score: number): TrustLevel {
  if (score >= 500) return TrustLevel.PLATINUM;
  if (score >= 200) return TrustLevel.GOLD;
  if (score >= 50) return TrustLevel.SILVER;
  return TrustLevel.BRONZE;
}

export const TrustScoreActions = {
  POST_CREATED: 5,
  COMMENT_RECEIVED: 2,
  UPVOTE_RECEIVED: 3,
  MATCH_MADE: 10,
  TEAM_JOINED: 8,
} as const;
