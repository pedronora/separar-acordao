const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
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
