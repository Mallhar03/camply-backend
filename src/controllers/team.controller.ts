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

// GET /api/v1/teams?q=&hackathon=&page=1&limit=10
export async function getAllTeams(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 10);
    const skip = (page - 1) * limit;
    const q = (req.query.q as string)?.trim();
    const hackathon = (req.query.hackathon as string)?.trim();

    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }
    if (hackathon) {
      where.hackathon = { contains: hackathon, mode: "insensitive" };
    }

    const [teams, total] = await Promise.all([
      prisma.team.findMany({ where, select: TEAM_SELECT, orderBy: { createdAt: "desc" }, skip, take: limit }),
      prisma.team.count({ where }),
    ]);

    sendSuccess(res, {
      teams,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: skip + limit < total },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/teams/:id
export async function getTeam(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const teamId = req.params.id as string;
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: TEAM_SELECT });
    if (!team) {
      sendError(res, "Team not found", 404);
      return;
    }
    sendSuccess(res, { team });
  } catch (err) {
    next(err);
  }
}

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
    const teamId = req.params.id as string;

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
    const teamId = req.params.id as string;

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

// DELETE /api/v1/teams/:id/members/me
export async function leaveTeam(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const teamId = req.params.id as string;
    const userId = req.user!.userId;

    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      sendError(res, "You are not a member of this team", 404);
      return;
    }

    if (membership.role === "OWNER") {
      const memberCount = await prisma.teamMember.count({ where: { teamId } });
      if (memberCount > 1) {
        sendError(res, "Transfer ownership before leaving", 400);
        return;
      }
      // Last member and owner – delete the team
      await prisma.team.delete({ where: { id: teamId } });
      sendSuccess(res, null, "Team deleted (you were the last member)");
      return;
    }

    await prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId } } });
    sendSuccess(res, null, "Left team successfully");
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/teams/:id
export async function updateTeam(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const teamId = req.params.id as string;
    const { name, description, hackathon, roles } = req.body;

    const membership = await prisma.teamMember.findFirst({
      where: { teamId, userId: req.user!.userId, role: "OWNER" },
    });
    if (!membership) {
      sendError(res, "Only team owner can update", 403);
      return;
    }

    const team = await prisma.team.update({
      where: { id: teamId },
      data: { name, description, hackathon, roles },
      select: TEAM_SELECT,
    });

    sendSuccess(res, { team }, "Team updated");
  } catch (err) {
    next(err);
  }
}
