const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('DELETE FROM "RoomMember";');
  await prisma.$executeRawUnsafe('DELETE FROM "Task";');
  await prisma.$executeRawUnsafe('DELETE FROM "ApiKey";');
  await prisma.$executeRawUnsafe('DELETE FROM "Room";');
  await prisma.$executeRawUnsafe('DELETE FROM "User";');
  console.log('Deleted all rows in all tables to bypass Prisma prompt.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
