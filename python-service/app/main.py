"""Endpoints HTTP do motor de separação."""

from __future__ import annotations

import json
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from .schemas import SepararResponse
from .separacao import ErroDeSeparacao, analisar, processar

app = FastAPI(
    title='separar-acordao python-service',
    description='Motor de separação de tarefas por pauta.',
    version='0.1.0',
)


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}


@app.post('/analisar')
async def analisar_arquivo(
    file: Annotated[UploadFile, File(...)],
    total_acordaos: Annotated[int | None, Form()] = None,
) -> dict:
    """Identifica os 'Desde' e responsáveis do CSV, sem separar ainda.

    - ``file``: arquivo CSV exportado do painel.
    - ``total_acordaos``: validação opcional do total esperado.
    """
    try:
        conteudo = await file.read()
        resultado = analisar(conteudo, total_acordaos=total_acordaos)
    except ErroDeSeparacao as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return resultado


@app.post('/separar', response_model=SepararResponse)
async def separar(
    file: Annotated[UploadFile, File(...)],
    pautas: Annotated[str, Form()],
    responsaveis_cadastrados: Annotated[str, Form()] = '[]',
    total_acordaos: Annotated[int | None, Form()] = None,
) -> SepararResponse:
    """Separa os acórdãos do CSV em grupos por responsável.

    - ``file``: arquivo CSV exportado do painel.
    - ``pautas``: JSON com o mapeamento ``Desde -> rótulo de pauta``.
    - ``responsaveis_cadastrados``: JSON com a lista de nomes cadastrados.
    - ``total_acordaos``: validação opcional do total esperado.
    """
    try:
        pautas_dict = json.loads(pautas)
        cadastrados = json.loads(responsaveis_cadastrados)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=422, detail='Parâmetros JSON inválidos.'
        ) from exc
    if not isinstance(pautas_dict, dict) or not isinstance(cadastrados, list):
        raise HTTPException(
            status_code=422, detail='Parâmetros JSON inválidos.'
        )

    try:
        conteudo = await file.read()
        resultado = processar(
            conteudo,
            pautas_dict,
            responsaveis_cadastrados=cadastrados,
            total_acordaos=total_acordaos,
        )
    except ErroDeSeparacao as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    faltantes = resultado['responsaveis_faltantes']
    if faltantes:
        raise HTTPException(
            status_code=422,
            detail={
                'tipo': 'responsaveis_faltantes',
                'faltantes': faltantes,
            },
        )

    return SepararResponse(**resultado)
