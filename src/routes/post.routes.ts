import { Router } from "express";
import {
  getFeed,
  createPost,
  getPost,
  deletePost,
  votePost,
  addComment,
} from "../controllers/post.controller";
import { authenticate, optionalAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { createPostSchema, voteSchema, commentSchema } from "../models/schemas";

const router = Router();

router.get("/", optionalAuth, getFeed);
router.post("/", authenticate, validate(createPostSchema), createPost);
router.get("/:id", optionalAuth, getPost);
router.delete("/:id", authenticate, deletePost);
router.post("/:id/vote", authenticate, validate(voteSchema), votePost);
router.post("/:id/comments", authenticate, validate(commentSchema), addComment);

export default router;
