import { Router } from "express";
import {
  getProfile,
  updateProfile,
  updateAvatar,
  changePassword,
  searchUsers,
} from "../controllers/user.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { updateProfileSchema, changePasswordSchema } from "../models/schemas";
import { avatarUpload } from "../config/cloudinary";

const router = Router();

router.get("/search", authenticate, searchUsers);
router.get("/:username", getProfile);
router.patch("/me", authenticate, validate(updateProfileSchema), updateProfile);
router.patch("/me/avatar", authenticate, avatarUpload.single("avatar"), updateAvatar);
router.patch("/me/password", authenticate, validate(changePasswordSchema), changePassword);

export default router;
