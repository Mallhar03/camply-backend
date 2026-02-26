import { Router } from "express";
import { getMyTeams, createTeam, inviteMember, deleteTeam } from "../controllers/team.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { createTeamSchema } from "../models/schemas";

const router = Router();

router.use(authenticate);

router.get("/mine", getMyTeams);
router.post("/", validate(createTeamSchema), createTeam);
router.post("/:id/invite", inviteMember);
router.delete("/:id", deleteTeam);

export default router;
