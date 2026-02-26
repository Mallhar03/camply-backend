import { Router } from "express";
import {
  getFeed,
  createPost,
  getPost,
  updatePost,
  deletePost,
  votePost,
  addComment,
  deleteComment,
} from "../controllers/post.controller";
import { authenticate, optionalAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { createPostSchema, updatePostSchema, voteSchema, commentSchema } from "../models/schemas";

const router = Router();

router.get("/", optionalAuth, getFeed);
router.post("/", authenticate, validate(createPostSchema), createPost);
router.get("/:id", optionalAuth, getPost);
router.patch("/:id", authenticate, validate(updatePostSchema), updatePost);
router.delete("/:id", authenticate, deletePost);
router.post("/:id/vote", authenticate, validate(voteSchema), votePost);
router.post("/:id/comments", authenticate, validate(commentSchema), addComment);
router.delete("/:id/comments/:commentId", authenticate, deleteComment);

export default router;
