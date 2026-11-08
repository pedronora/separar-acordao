import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Garante que a paleta mantenha o contraste mínimo AA (4.5:1) para texto
 * normal. Lê os tokens direto de main.css, então qualquer troca de cor que
 * quebre a acessibilidade falha aqui em vez de passar despercebida.
 */
const CAMINHO_CSS = fileURLToPath(
  new URL('../app/assets/css/main.css', import.meta.url)
);

const TOKENS = new Map<string, string>();
for (const achado of readFileSync(CAMINHO_CSS, 'utf8').matchAll(
  /--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8});/g
)) {
  const nome = achado[1];
  const valor = achado[2];
  if (nome && valor) {
    TOKENS.set(nome, valor);
  }
}

function canal(valor: number): number {
  const normalizado = valor / 255;
  if (normalizado <= 0.04045) {
    return normalizado / 12.92;
  }
  return ((normalizado + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string): number {
  let digitos = hex.replace('#', '');
  if (digitos.length === 3) {
    digitos = digitos
      .split('')
      .map((d) => d + d)
      .join('');
  }
  const r = Number.parseInt(digitos.slice(0, 2), 16);
  const g = Number.parseInt(digitos.slice(2, 4), 16);
  const b = Number.parseInt(digitos.slice(4, 6), 16);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  const claro = Math.max(la, lb);
  const escuro = Math.min(la, lb);
  return (claro + 0.05) / (escuro + 0.05);
}

function cor(nome: string): string {
  const valor = TOKENS.get(nome);
  if (!valor) {
    throw new Error(`Token --${nome} não encontrado em main.css`);
  }
  return valor;
}

type Combinacao = { par: string; frente: string; fundo: string };

const COMBINACOES_TEXTO: Combinacao[] = [
  { par: 'texto sobre fundo', frente: 'cor-texto', fundo: 'cor-fundo' },
  {
    par: 'texto sobre superfície',
    frente: 'cor-texto',
    fundo: 'cor-superficie',
  },
  {
    par: 'texto suave sobre fundo',
    frente: 'cor-texto-suave',
    fundo: 'cor-fundo',
  },
  {
    par: 'texto suave sobre superfície',
    frente: 'cor-texto-suave',
    fundo: 'cor-superficie',
  },
  {
    par: 'texto suave sobre superfície alternada',
    frente: 'cor-texto-suave',
    fundo: 'cor-superficie-alt',
  },
  {
    par: 'texto suave sobre primária suave',
    frente: 'cor-texto-suave',
    fundo: 'cor-primaria-suave',
  },
  {
    par: 'botão primário',
    frente: 'cor-cabecalho-texto',
    fundo: 'cor-primaria',
  },
  {
    par: 'botão primário em hover',
    frente: 'cor-cabecalho-texto',
    fundo: 'cor-primaria-escura',
  },
  {
    par: 'texto do cabeçalho',
    frente: 'cor-cabecalho-texto',
    fundo: 'cor-cabecalho',
  },
  {
    par: 'texto suave do cabeçalho',
    frente: 'cor-cabecalho-texto-suave',
    fundo: 'cor-cabecalho',
  },
  {
    par: 'link sobre superfície',
    frente: 'cor-primaria',
    fundo: 'cor-superficie',
  },
  {
    par: 'link sobre fundo',
    frente: 'cor-primaria',
    fundo: 'cor-fundo',
  },
  {
    par: 'alerta de erro',
    frente: 'cor-erro',
    fundo: 'cor-erro-fundo',
  },
  {
    par: 'alerta de sucesso',
    frente: 'cor-sucesso',
    fundo: 'cor-sucesso-fundo',
  },
  {
    par: 'alerta de atenção',
    frente: 'cor-alerta',
    fundo: 'cor-alerta-fundo',
  },
  {
    par: 'linha confirmada',
    frente: 'cor-sucesso',
    fundo: 'cor-sucesso-fundo',
  },
  {
    par: 'cabeçalho de tabela',
    frente: 'cor-texto-suave',
    fundo: 'cor-th-fundo',
  },
  {
    par: 'botão secundário em hover',
    frente: 'cor-primaria',
    fundo: 'cor-primaria-suave',
  },
];

/** Componentes de interface precisam de 3:1 (WCAG 1.4.11). */
const COMBINACOES_INTERFACE: Combinacao[] = [
  {
    par: 'borda de campo sobre superfície',
    frente: 'cor-borda-campo',
    fundo: 'cor-superficie',
  },
  {
    par: 'borda de campo sobre fundo',
    frente: 'cor-borda-campo',
    fundo: 'cor-fundo',
  },
];

describe('contraste da paleta', () => {
  it('encontra os tokens de cor em main.css', () => {
    expect(TOKENS.size).toBeGreaterThan(20);
  });

  for (const { par, frente, fundo } of COMBINACOES_TEXTO) {
    it(`mantém AA em: ${par}`, () => {
      const razao = contraste(cor(frente), cor(fundo));
      expect(
        razao,
        `${par} = ${razao.toFixed(2)}:1 (mínimo 4.5:1)`
      ).toBeGreaterThanOrEqual(4.5);
    });
  }

  for (const { par, frente, fundo } of COMBINACOES_INTERFACE) {
    it(`mantém 3:1 em: ${par}`, () => {
      const razao = contraste(cor(frente), cor(fundo));
      expect(
        razao,
        `${par} = ${razao.toFixed(2)}:1 (mínimo 3:1)`
      ).toBeGreaterThanOrEqual(3);
    });
  }
});
