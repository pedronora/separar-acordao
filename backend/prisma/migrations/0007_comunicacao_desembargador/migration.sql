-- CreateEnum
CREATE TYPE "ComunicacaoStatus" AS ENUM ('pendente', 'enviando', 'enviada', 'falhou');

-- CreateTable
CREATE TABLE "comunicacoes_desembargador" (
    "id" TEXT NOT NULL,
    "lote_id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "status" "ComunicacaoStatus" NOT NULL DEFAULT 'pendente',
    "destinatario" TEXT NOT NULL,
    "destinatario_nome" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "corpo_html" TEXT NOT NULL,
    "bcc" JSONB,
    "erro" TEXT,
    "apresentada_em" TIMESTAMP(3),
    "enviada_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comunicacoes_desembargador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "comunicacoes_desembargador_lote_id_key" ON "comunicacoes_desembargador"("lote_id");

-- AddForeignKey
ALTER TABLE "comunicacoes_desembargador" ADD CONSTRAINT "comunicacoes_desembargador_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes_envio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicacoes_desembargador" ADD CONSTRAINT "comunicacoes_desembargador_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
