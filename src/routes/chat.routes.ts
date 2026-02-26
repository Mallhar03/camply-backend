import { Router } from "express";
import { getChats, createChat, joinChat, leaveChat, getMessages } from "../controllers/chat.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { createChatSchema } from "../models/schemas";

const router = Router();

router.use(authenticate);

router.get("/", getChats);
router.post("/", validate(createChatSchema), createChat);
router.post("/:id/join", joinChat);
router.delete("/:id/members/me", leaveChat);
router.get("/:id/messages", getMessages);

export default router;
