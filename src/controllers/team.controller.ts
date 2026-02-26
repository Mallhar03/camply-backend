import { Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { AuthRequest } from "../middleware/auth.middleware";

const TEAM_SELECT = {
  id: true,
  name: true,
  description: true,
  hackathon: true,
  roles: true,
  createdAt: true,
  members: {
    include: {
      user: {
        select: { id: true, username: true, name: true, avatar: true, trustLevel: true },
      },
    },
  },
};

// GET /api/v1/teams/mine
export async function getMyTeams(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const teams = await prisma.team.findMany({
      where: { members: { some: { userId: req.user!.userId } } },
      select: TEAM_SELECT,
    });
    sendSuccess(res, { teams });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/teams
export async function createTeam(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, description, hackathon, roles } = req.body;

    const team = await prisma.team.create({
      data: {
        name,
        description,
        hackathon,
        roles: roles || [],
        members: {
          create: { userId: req.user!.userId, role: "OWNER" },
        },
      },
      select: TEAM_SELECT,
    });

    sendSuccess(res, { team }, "Team created", 201);
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/teams/:id/invite
export async function inviteMember(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { username } = req.body;
    const teamId = req.params.id;

    // Verify requester is owner
    const membership = await prisma.teamMember.findFirst({
      where: { teamId, userId: req.user!.userId, role: "OWNER" },
    });
    if (!membership) {
      sendError(res, "Only team owner can invite", 403);
      return;
    }

    const invitee = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!invitee) {
      sendError(res, "User not found", 404);
      return;
    }

    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: invitee.id } },
    });
    if (existing) {
      sendError(res, "User already in team", 409);
      return;
    }

    await prisma.teamMember.create({
      data: { teamId, userId: invitee.id, role: "MEMBER" },
    });

    const team = await prisma.team.findUnique({ where: { id: teamId }, select: TEAM_SELECT });
    sendSuccess(res, { team }, "Member added");
  } catch (err) {
    next(err);
  }
}

// DELETE /api/v1/teams/:id
export async function deleteTeam(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const teamId = req.params.id;

    const membership = await prisma.teamMember.findFirst({
      where: { teamId, userId: req.user!.userId, role: "OWNER" },
    });
    if (!membership) {
      sendError(res, "Only team owner can delete", 403);
      return;
    }

    await prisma.team.delete({ where: { id: teamId } });
    sendSuccess(res, null, "Team deleted");
  } catch (err) {
    next(err);
  }
}
