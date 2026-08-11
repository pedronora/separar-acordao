export default defineEventHandler(async () => {
  const responsaveis = await prisma.responsavel.findMany({
    orderBy: { nome: 'asc' },
  });
  return responsaveis;
});
