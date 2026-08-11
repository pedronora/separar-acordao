import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../server/generated/prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const senha = process.env.SEED_ADMIN_PASSWORD;
  const nome = process.env.SEED_ADMIN_NOME || 'Administrador';

  if (!email || !senha) {
    console.warn(
      'SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD não definidos; nada a criar.'
    );
    return;
  }

  const senhaHash = await argon2.hash(senha);
  await prisma.usuario.upsert({
    where: { email },
    update: { senhaHash },
    create: { email, nome, senhaHash },
  });
  console.log(`Usuário administrador garantido: ${email}`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
