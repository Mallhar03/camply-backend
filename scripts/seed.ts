import "dotenv/config";
import { PrismaClient, PostCategory, TrustLevel } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Users ─────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Password123", 12);

  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      name: "Alice Kumar",
      username: "alicek",
      email: "alice@example.com",
      passwordHash,
      bio: "Full-stack dev | Hackathon enthusiast",
      college: "IIT Bangalore",
      skills: ["React", "Node.js", "TypeScript"],
      trustLevel: TrustLevel.GOLD,
      trustScore: 210,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: {
      name: "Bob Sharma",
      username: "bobs",
      email: "bob@example.com",
      passwordHash,
      bio: "ML engineer | Pytorch & TensorFlow",
      college: "NIT Trichy",
      skills: ["Python", "PyTorch", "TensorFlow", "FastAPI"],
      trustLevel: TrustLevel.SILVER,
      trustScore: 80,
    },
  });

  const priya = await prisma.user.upsert({
    where: { email: "priya@example.com" },
    update: {},
    create: {
      name: "Priya Nair",
      username: "priyan",
      email: "priya@example.com",
      passwordHash,
      bio: "UI/UX designer & frontend dev",
      college: "BITS Pilani",
      skills: ["Figma", "React", "Tailwind CSS"],
      trustLevel: TrustLevel.BRONZE,
      trustScore: 15,
    },
  });

  // ── Posts ─────────────────────────────────────────────
  await prisma.post.createMany({
    data: [
      {
        content:
          "Looking for React + ML teammates for the upcoming HackBangalore 2025! DM me if interested 🚀",
        category: PostCategory.DISCUSSION,
        authorId: alice.id,
      },
      {
        content:
          "QUERY: Best way to handle auth with JWT refresh tokens in a React SPA? Cookie vs localStorage?",
        category: PostCategory.QUERY,
        authorId: bob.id,
      },
      {
        content:
          "SOLUTION: Use httpOnly cookies for refresh tokens and in-memory for access tokens. Here's why...",
        category: PostCategory.SOLUTION,
        authorId: alice.id,
      },
      {
        content:
          "JOB: Intern opening at my startup — 2-month remote internship, React + Node. College students preferred!",
        category: PostCategory.JOB,
        authorId: priya.id,
      },
    ],
    skipDuplicates: true,
  });

  // ── Community Chats ───────────────────────────────────
  const generalChat = await prisma.chat.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "General",
      topic: "Campus news and announcements",
    },
  });

  const hackChat = await prisma.chat.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      name: "Hackathon Hub",
      topic: "Find teammates & discuss hackathons",
    },
  });

  // Add members
  for (const userId of [alice.id, bob.id, priya.id]) {
    await prisma.chatMember
      .upsert({
        where: { chatId_userId: { chatId: generalChat.id, userId } },
        update: {},
        create: { chatId: generalChat.id, userId },
      })
      .catch(() => {});
  }

  // Seed messages
  await prisma.message.createMany({
    data: [
      { content: "Hey everyone! Welcome to Camply 🎉", chatId: generalChat.id, senderId: alice.id },
      { content: "Thanks! Looking forward to meeting you all 👋", chatId: generalChat.id, senderId: bob.id },
      { content: "Anyone participating in HackBangalore?", chatId: hackChat.id, senderId: priya.id },
    ],
    skipDuplicates: true,
  });

  console.log("✅ Seed complete!");
  console.log(`
  Test accounts:
  ─────────────────────────────────
  Email: alice@example.com  | Password: Password123
  Email: bob@example.com    | Password: Password123
  Email: priya@example.com  | Password: Password123
  `);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
