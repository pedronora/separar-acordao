"""Motor de separação de tarefas por pauta.

Porta fiel da lógica definida em
``reference/Separar_acórdãos_para_formatar.ipynb``.

Comportamento preservado:
- Filtro por ``Tarefa == 'Assinar acórdão'``.
- Substituição do campo ``Desde`` (data/hora) por um rótulo de pauta.
- Composição de ``Autos = Classe + ' ' + Processo``.
- Um grupo por responsável (ordem alfabética), com as tarefas ordenadas
  por pauta e depois por processo.
"""

from __future__ import annotations

import io

import pandas as pd

TAREFA_ALVO = 'Assinar acórdão'

COLUNAS_OBRIGATORIAS = (
    'Classe',
    'Processo',
    'Tarefa',
    'Desde',
    'Responsável',
)


class ErroDeSeparacao(ValueError):
    """Erro de validação nos dados de entrada (retorna HTTP 422)."""


def ler_csv(conteudo: bytes) -> pd.DataFrame:
    """Lê o CSV enviado e valida as colunas obrigatórias."""
    try:
        df = pd.read_csv(io.BytesIO(conteudo))
    except pd.errors.EmptyDataError as exc:
        raise ErroDeSeparacao('Arquivo vazio ou inválido.') from exc
    ausentes = [
        coluna for coluna in COLUNAS_OBRIGATORIAS if coluna not in df.columns
    ]
    if ausentes:
        raise ErroDeSeparacao(
            'Colunas obrigatórias ausentes no arquivo: ' + ', '.join(ausentes)
        )
    return df


def filtrar_acordaos(df: pd.DataFrame) -> pd.DataFrame:
    """Mantém apenas as tarefas do tipo 'Assinar acórdão'."""
    return df[df['Tarefa'] == TAREFA_ALVO].copy()


def aplicar_pautas(
    df_acordao: pd.DataFrame, pautas: dict[str, str]
) -> pd.DataFrame:
    """Substitui o valor de 'Desde' pelo rótulo de pauta informado."""
    desdes = set(df_acordao['Desde'].astype(str).unique())
    ausentes = sorted(desdes - set(pautas))
    if ausentes:
        raise ErroDeSeparacao(
            'Rótulo de pauta não informado para o(s) valor(es) de "Desde": '
            + ', '.join(ausentes)
        )
    df = df_acordao.copy()
    df['Desde'] = df['Desde'].astype(str).replace(pautas)
    return df


def responsaveis_faltantes(
    df_acordao: pd.DataFrame, cadastrados: list[str]
) -> list[str]:
    """Responsáveis presentes no arquivo e não cadastrados no sistema."""
    cadastrados_set = {nome.strip().upper() for nome in cadastrados}
    presentes = {
        str(nome).strip().upper()
        for nome in df_acordao['Responsável'].unique()
    }
    return sorted(presentes - cadastrados_set)


def separar(df_acordao: pd.DataFrame) -> list[dict]:
    """Agrupa os acórdãos por responsável, na ordem do notebook."""
    grupos: list[dict] = []
    for responsavel in sorted(df_acordao['Responsável'].unique()):
        mascara = df_acordao['Responsável'] == responsavel
        resultado = df_acordao[mascara].sort_values(by=['Desde', 'Processo'])
        tarefas = [
            {
                'autos': f'{row["Classe"]} {row["Processo"]}',
                'classe': str(row['Classe']),
                'processo': str(row['Processo']),
                'pauta': str(row['Desde']),
            }
            for _, row in resultado.iterrows()
        ]
        grupos.append({'responsavel': str(responsavel), 'tarefas': tarefas})
    return grupos


def analisar(conteudo: bytes, total_acordaos: int | None = None) -> dict:
    """Identifica os valores distintos de 'Desde' e responsáveis do arquivo."""
    df = ler_csv(conteudo)
    df_acordao = filtrar_acordaos(df)
    if df_acordao.empty:
        raise ErroDeSeparacao(
            'Nenhuma tarefa "Assinar acórdão" encontrada no arquivo.'
        )

    n_registros = df_acordao.shape[0]
    if total_acordaos is not None and total_acordaos != n_registros:
        raise ErroDeSeparacao(
            'Inconsistência no número de acórdãos informados. '
            f'Foram localizados {n_registros} registros e informados '
            f'{total_acordaos}.'
        )

    desdes = list(df_acordao['Desde'].astype(str).unique())
    responsaveis = sorted(
        {str(nome).strip() for nome in df_acordao['Responsável'].unique()}
    )
    return {
        'desdes': desdes,
        'responsaveis': responsaveis,
        'total_acordaos': n_registros,
    }


def processar(
    conteudo: bytes,
    pautas: dict[str, str],
    responsaveis_cadastrados: list[str] | None = None,
    total_acordaos: int | None = None,
) -> dict:
    """Executa o pipeline completo de separação (fluxo do notebook)."""
    df = ler_csv(conteudo)
    df_acordao = filtrar_acordaos(df)
    if df_acordao.empty:
        raise ErroDeSeparacao(
            'Nenhuma tarefa "Assinar acórdão" encontrada no arquivo.'
        )

    n_registros = df_acordao.shape[0]
    if total_acordaos is not None and total_acordaos != n_registros:
        raise ErroDeSeparacao(
            'Inconsistência no número de acórdãos informados. '
            f'Foram localizados {n_registros} registros e informados '
            f'{total_acordaos}.'
        )

    df_acordao = aplicar_pautas(df_acordao, pautas)

    cadastrados = responsaveis_cadastrados or []
    faltantes = responsaveis_faltantes(df_acordao, cadastrados)

    grupos = separar(df_acordao)
    return {
        'grupos': grupos,
        'total_acordaos': n_registros,
        'responsaveis_faltantes': faltantes,
    }
