import { Router } from "express";
import passport from "passport";
import { register, login, logout, refresh, me } from "../controllers/auth.controller";
import { googleCallback } from "../controllers/google.auth.controller";
import { validate } from "../middleware/validate.middleware";
import { authenticate } from "../middleware/auth.middleware";
import { registerSchema, loginSchema } from "../models/schemas";

const router = Router();

// Public
router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/refresh", refresh);
router.post("/logout", logout);

// Google OAuth
router.get("/google", passport.authenticate("google", { scope: ["email", "profile"] }));
router.get("/google/callback", passport.authenticate("google", { session: false }), googleCallback);

// Protected
router.get("/me", authenticate, me);

export default router;
