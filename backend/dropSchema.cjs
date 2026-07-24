const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('DROP SCHEMA public CASCADE;');
  await prisma.$executeRawUnsafe('CREATE SCHEMA public;');
  console.log('Dropped and recreated public schema to baseline the DB.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
