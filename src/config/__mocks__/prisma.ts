import { vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

export const prismaMock = {
  user: { create: vi.fn(), deleteMany: vi.fn(), findUnique: vi.fn() },
  post: { create: vi.fn(), findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn(), update: vi.fn() },
  comment: { create: vi.fn(), deleteMany: vi.fn() },
  vote: { groupBy: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn(), create: vi.fn(), update: vi.fn() },
} as unknown as PrismaClient;

export default prismaMock;
