import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { config } from '../../utils/config';

const TAMANHO_MAXIMO = 10 * 1024 * 1024;

export default defineEventHandler(async (event) => {
  getUsuarioAutenticado(event);

  const partes = await readMultipartFormData(event);
  const arquivo = partes?.find((parte) => parte.name === 'file');
  if (!arquivo || !arquivo.data || !arquivo.filename) {
    throw createError({
      statusCode: 422,
      message: 'Arquivo CSV obrigatório.',
    });
  }
  if (!arquivo.filename.toLowerCase().endsWith('.csv')) {
    throw createError({
      statusCode: 422,
      message: 'Somente arquivos .csv são aceitos.',
    });
  }
  if (arquivo.data.byteLength > TAMANHO_MAXIMO) {
    throw createError({
      statusCode: 413,
      message: 'Arquivo excede o tamanho máximo de 10 MB.',
    });
  }

  const diretorio = resolve(process.cwd(), config.uploadDir);
  await mkdir(diretorio, { recursive: true });

  const token = randomUUID();
  await writeFile(join(diretorio, `${token}.csv`), arquivo.data);

  const queryTotal = getQuery(event).total_acordaos;
  const totalAcordaos =
    typeof queryTotal === 'string' ? Number(queryTotal) : undefined;

  try {
    const resultado = await chamarAnalisar(
      arquivo.data,
      arquivo.filename,
      totalAcordaos
    );
    return {
      token,
      arquivoOrigem: arquivo.filename,
      desdes: resultado.desdes,
      responsaveis: resultado.responsaveis,
      totalAcordaos: resultado.total_acordaos,
    };
  } catch (erro) {
    await rm(join(diretorio, `${token}.csv`)).catch(() => {});
    throw erro;
  }
});
