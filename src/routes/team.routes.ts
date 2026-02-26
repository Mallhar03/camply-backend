import { Router } from "express";
import {
  getAllTeams,
  getTeam,
  getMyTeams,
  createTeam,
  updateTeam,
  inviteMember,
  leaveTeam,
  deleteTeam,
} from "../controllers/team.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { createTeamSchema, updateTeamSchema } from "../models/schemas";

const router = Router();

router.use(authenticate);

router.get("/", getAllTeams);
router.get("/mine", getMyTeams);
router.get("/:id", getTeam);
router.post("/", validate(createTeamSchema), createTeam);
router.patch("/:id", validate(updateTeamSchema), updateTeam);
router.post("/:id/invite", inviteMember);
router.delete("/:id/members/me", leaveTeam);
router.delete("/:id", deleteTeam);

export default router;
