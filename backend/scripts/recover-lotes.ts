import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../server/generated/prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const resultado = await prisma.loteEnvio.updateMany({
    where: { status: 'processando' },
    data: {
      status: 'falhou',
      erro: 'Processamento interrompido por reinicialização do serviço.',
    },
  });
  console.log(
    `Recuperados ${resultado.count} lote(s) em processando -> falhou.`
  );
}

main()
  .catch((erro) => {
    console.error('Erro ao recuperar lotes:', erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
