import { Router } from "express";
import { getChats, joinChat, getMessages } from "../controllers/chat.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", getChats);
router.post("/:id/join", joinChat);
router.get("/:id/messages", getMessages);

export default router;
