"""Modelos Pydantic do serviço."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Tarefa(BaseModel):
    autos: str = Field(
        description='Classe + Processo, ex.: AP 0000123-45.2026.5.12.0001'
    )
    classe: str
    processo: str
    pauta: str


class Grupo(BaseModel):
    responsavel: str
    tarefas: list[Tarefa]


class SepararResponse(BaseModel):
    grupos: list[Grupo]
    total_acordaos: int
    responsaveis_faltantes: list[str]
