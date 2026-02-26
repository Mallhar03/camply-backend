import { z } from "zod";

// ─── Auth ────────────────────────────────────────────────
export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(60).trim(),
    username: z
      .string()
      .min(3)
      .max(30)
      .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
      .trim(),
    email: z.string().email().toLowerCase().trim(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(100)
      .regex(/[A-Z]/, "Must include uppercase letter")
      .regex(/[0-9]/, "Must include a number"),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    identifier: z.string().min(1, "Email or username required").trim(),
    password: z.string().min(1, "Password required"),
  }),
});

// ─── Posts ───────────────────────────────────────────────
export const createPostSchema = z.object({
  body: z.object({
    content: z.string().min(1).max(5000).trim(),
    category: z
      .enum(["QUERY", "SOLUTION", "JOB", "DISCUSSION"])
      .default("DISCUSSION"),
  }),
});

export const voteSchema = z.object({
  body: z.object({
    value: z.literal(1).or(z.literal(-1)),
  }),
});

export const commentSchema = z.object({
  body: z.object({
    content: z.string().min(1).max(2000).trim(),
  }),
});

// ─── Profile ─────────────────────────────────────────────
export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(60).optional(),
    bio: z.string().max(500).optional(),
    college: z.string().max(100).optional(),
    skills: z.array(z.string().max(30)).max(20).optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(8)
      .max(100)
      .regex(/[A-Z]/, "Must include uppercase letter")
      .regex(/[0-9]/, "Must include a number"),
  }),
});

// ─── Match ───────────────────────────────────────────────
export const swipeSchema = z.object({
  body: z.object({
    toUserId: z.string().uuid(),
    action: z.enum(["like", "pass"]),
  }),
});

// ─── Teams ───────────────────────────────────────────────
export const createTeamSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(80).trim(),
    description: z.string().max(500).optional(),
    hackathon: z.string().max(100).optional(),
    roles: z.array(z.string().max(50)).max(10).optional(),
  }),
});
