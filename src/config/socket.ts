import { Server, Socket } from "socket.io";
import http from "http";
import jwt from "jsonwebtoken";
import prisma from "./prisma";
import logger from "./logger";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

interface TokenPayload {
  userId: string;
  username: string;
}

// Exported so services can push events
export let io: Server;

export function getIo(): Server {
  if (!io) throw new Error("Socket.IO not initialised");
  return io;
}

export async function initSocket(httpServer: http.Server) {
  io = new Server(httpServer, {
    cors: {
      origin: (process.env.ALLOWED_ORIGINS || "http://localhost:8080")
        .split(",")
        .map((o) => o.trim()),
      credentials: true,
    },
  });

  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();

  pubClient.on("error", (err) => logger.error("Socket Redis pub error:", err));
  subClient.on("error", (err) => logger.error("Socket Redis sub error:", err));

  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));

  // ── Auth middleware ────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Authentication required"));

    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET!
      ) as TokenPayload;
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket as any).user as TokenPayload;
    logger.info(`Socket connected: ${user.username} (${socket.id})`);

    // Join personal room for targeted notifications
    socket.join(`user:${user.userId}`);

    // ── Join a chat room ─────────────────────────────────
    socket.on("join-chat", (chatId: string) => {
      socket.join(`chat:${chatId}`);
      logger.info(`${user.username} joined chat ${chatId}`);
    });

    socket.on("leave-chat", (chatId: string) => {
      socket.leave(`chat:${chatId}`);
    });

    // ── Send a message ───────────────────────────────────
    socket.on("send-message", async (data: { chatId: string; content: string }) => {
      const { chatId, content } = data;
      if (!content?.trim()) return;

      try {
        const message = await prisma.message.create({
          data: { content: content.trim(), chatId, senderId: user.userId },
          include: { sender: { select: { id: true, username: true, avatar: true } } },
        });

        io.to(`chat:${chatId}`).emit("new-message", message);
      } catch (err) {
        logger.error("Socket send-message error", err);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // ── Typing indicator ─────────────────────────────────
    socket.on("typing", (chatId: string) => {
      socket.to(`chat:${chatId}`).emit("user-typing", {
        userId: user.userId,
        username: user.username,
      });
    });

    socket.on("disconnect", () => {
      logger.info(`Socket disconnected: ${user.username}`);
    });
  });

  return io;
}
