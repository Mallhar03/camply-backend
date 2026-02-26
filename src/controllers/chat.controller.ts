import { Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { AuthRequest } from "../middleware/auth.middleware";

// GET /api/v1/chats
export async function getChats(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const chats = await prisma.chat.findMany({
      select: {
        id: true,
        name: true,
        topic: true,
        _count: { select: { members: true, messages: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, createdAt: true, sender: { select: { username: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    sendSuccess(res, { chats });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/chats/:id/join
export async function joinChat(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const chatId = req.params.id as string;
    const userId = req.user!.userId;

    const chat = await prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) {
      sendError(res, "Chat not found", 404);
      return;
    }

    await prisma.chatMember.upsert({
      where: { chatId_userId: { chatId, userId } },
      create: { chatId, userId },
      update: {},
    });

    sendSuccess(res, { chatId }, "Joined chat");
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/chats/:id/messages?cursor=<messageId>
export async function getMessages(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const chatId = req.params.id as string;
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(50, parseInt(req.query.limit as string) || 30);

    const messages = await prisma.message.findMany({
      where: { chatId },
      select: {
        id: true,
        content: true,
        createdAt: true,
        sender: { select: { id: true, username: true, avatar: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    sendSuccess(res, {
      messages: messages.reverse(),
      nextCursor: messages.length === limit ? messages[0]?.id : null,
    });
  } catch (err) {
    next(err);
  }
}
