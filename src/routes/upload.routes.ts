import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { avatarUpload, uploadToCloudinary } from "../config/cloudinary";
import { sendSuccess, sendError } from "../utils/apiResponse";

const router = Router();

// POST /api/v1/upload/avatar — standalone Cloudinary upload
router.post(
  "/avatar",
  authenticate,
  avatarUpload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file?.buffer) {
        sendError(res, "Upload failed: No file provided", 400);
        return;
      }
      
      const url = await uploadToCloudinary(file.buffer, "camply/avatars");
      sendSuccess(res, { url }, "Upload successful", 201);
    } catch {
      sendError(res, "Upload failed to process", 500);
    }
  }
);

export default router;
