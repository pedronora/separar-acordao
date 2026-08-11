const { spawnSync } = require('node:child_process');

const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  let total;
  try {
    total = await prisma.usuario.count();
  } finally {
    await prisma.$disconnect();
  }

  if (total > 0) {
    console.log(`Seed ignorado: ${total} usuário(s) existente(s).`);
    return;
  }

  console.log('Nenhum usuário no banco. Executando seed do administrador...');
  const resultado = spawnSync('npx', ['tsx', 'prisma/seed.ts'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  if (resultado.status !== 0) {
    process.exit(resultado.status ?? 1);
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
