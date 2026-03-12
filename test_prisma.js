const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const votes = await prisma.vote.groupBy({
    by: ['postId', 'value'],
    _count: { value: true },
  });
  console.log('Votes DB:', JSON.stringify(votes, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
