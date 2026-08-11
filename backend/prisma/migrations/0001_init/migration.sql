-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LoteStatus" AS ENUM ('processando', 'processado', 'falhou');

-- CreateEnum
CREATE TYPE "EnvioStatus" AS ENUM ('pendente', 'enviado', 'falhou');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responsaveis" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "responsaveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes_envio" (
    "id" TEXT NOT NULL,
    "arquivo_origem" TEXT NOT NULL,
    "orgao" TEXT,
    "data_sessao" TEXT,
    "usuario_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "LoteStatus" NOT NULL DEFAULT 'processando',

    CONSTRAINT "lotes_envio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envios" (
    "id" TEXT NOT NULL,
    "lote_id" TEXT NOT NULL,
    "responsavel_id" TEXT NOT NULL,
    "tarefas" JSONB NOT NULL,
    "enviado_em" TIMESTAMP(3),
    "reenviado_de" TEXT,
    "status" "EnvioStatus" NOT NULL DEFAULT 'pendente',

    CONSTRAINT "envios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "responsaveis_nome_key" ON "responsaveis"("nome");

-- AddForeignKey
ALTER TABLE "lotes_envio" ADD CONSTRAINT "lotes_envio_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envios" ADD CONSTRAINT "envios_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes_envio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envios" ADD CONSTRAINT "envios_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "responsaveis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envios" ADD CONSTRAINT "envios_reenviado_de_fkey" FOREIGN KEY ("reenviado_de") REFERENCES "envios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

