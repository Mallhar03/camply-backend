import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { avatarUpload } from "../config/cloudinary";
import { sendSuccess, sendError } from "../utils/apiResponse";

const router = Router();

// POST /api/v1/upload/avatar — standalone Cloudinary upload
router.post(
  "/avatar",
  authenticate,
  avatarUpload.single("file"),
  (req: Request, res: Response) => {
    const file = req.file as any;
    if (!file?.path) {
      sendError(res, "Upload failed", 400);
      return;
    }
    sendSuccess(res, { url: file.path }, "Upload successful", 201);
  }
);

export default router;
