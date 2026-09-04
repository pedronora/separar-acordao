-- AlterTable
ALTER TABLE "envios" ADD COLUMN "confirmado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "envios" ADD COLUMN "confirmado_em" TIMESTAMPTZ;
