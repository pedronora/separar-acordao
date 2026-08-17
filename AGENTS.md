# AGENTS.md

Este arquivo orienta agentes de IA (Claude Code e similares) e desenvolvedores humanos sobre como trabalhar neste repositório. Leia por completo antes de propor ou aplicar mudanças.

---

## 1. Visão geral do projeto

Aplicação para **identificar tarefas de mesma pauta** (a partir de um arquivo de entrada com acórdãos/tarefas), **agrupá-las** e **enviá-las por e-mail** aos respectivos responsáveis, de forma ordenada e rastreável.

A lógica de separação/agrupamento das tarefas **deve seguir a proposta de solução já validada** em `Separar_acórdãos_para_formatar.ipynb`. Esse notebook é a fonte de verdade do algoritmo de negócio — qualquer refatoração para Python "de produção" deve preservar seu comportamento (mesmos critérios de agrupamento, mesma ordenação), não reinventar a lógica.

> **Nota para o agente:** o notebook deve estar versionado em `python-service/reference/Separar_acórdãos_para_formatar.ipynb`. Se ele ainda não estiver no repositório, pare e peça ao usuário para adicioná-lo antes de implementar a lógica de separação — não deduza o algoritmo sem consultá-lo.

### Funcionalidades principais
- Upload de arquivo com as tarefas.
- Separação automática das tarefas por pauta (motor Python, baseado no notebook de referência).
- Envio ordenado por e-mail para cada responsável, agrupando as tarefas daquele responsável em um único envio.
- Histórico de envios: o quê foi enviado, para quem, quando e por qual usuário do sistema.
- Reenvio de um envio específico (todo ou parcial) a partir do histórico.
- Cadastro/edição de responsáveis (nome, e-mail, e demais metadados necessários para casar com a pauta).
- **Validação de pré-cadastro:** se o motor de separação encontrar um responsável presente no arquivo de tarefas mas **não cadastrado no sistema**, o backend deve rejeitar o processamento daquele lote com erro explícito, listando o(s) responsável(is) faltante(s), e não enviar nenhum e-mail até que o cadastro seja feito.
- Autenticação de usuários do sistema (quem opera a ferramenta), com senhas criptografadas (hash, nunca texto plano nem criptografia reversível).

### Fora de escopo (a menos que solicitado explicitamente)
- Edição do conteúdo das tarefas/acórdãos em si.
- Múltiplos idiomas de interface.

---

## 2. Stack e arquitetura

Monorepo com três componentes desacoplados, orquestrados via Docker Compose:

```
/
├── frontend/          # Nuxt 3 (SSR) — UI
├── backend/           # Nuxt 3 (modo server-only / Nitro) — API REST, auth, orquestração
├── python-service/    # FastAPI — motor de separação de tarefas (baseado no notebook)
├── docker-compose.yml
├── docker-compose.dev.yml
└── AGENTS.md
```

**Por que essa divisão:**
- **Frontend**: Nuxt 3 com **SSR** habilitado (`ssr: true`). Títulos, meta e
  conteúdo das páginas são renderizados no servidor. Expõe um proxy em `/api/**`
  (routeRules) para o backend, então o navegador fala apenas com o frontend (mesma
  origem). No SSR, chamadas à API usam `API_INTERNAL_URL` via `useRequestFetch`
  (encaminha o cookie de sessão); no navegador, usam caminho relativo `/api/**`.
- **Backend**: Nuxt 3 usado apenas como camada de servidor (Nitro), expondo rotas em `server/api/`. Responsável por autenticação, regras de negócio, acesso ao banco, envio de e-mail e por chamar o `python-service` via HTTP interno para a etapa de separação. A sessão é emitida como **cookie httpOnly** (`auth_token`) no login e validada via cookie ou `Authorization: Bearer` no middleware.
- **python-service**: microsserviço Python isolado (FastAPI) que expõe um endpoint interno (ex.: `POST /separar`) implementando a lógica do notebook. Mantido separado do backend Node para não misturar runtimes e para permitir testar/evoluir o algoritmo isoladamente com os mesmos dados do notebook.
- Comunicação entre backend e python-service é **interna à rede Docker**, nunca exposta publicamente.

### Banco de dados
- **PostgreSQL**, acessado pelo backend via **Prisma ORM**.
- Entidades mínimas esperadas:
  - `usuarios` (login do sistema): id, email, senha_hash, nome, criado_em.
  - `responsaveis` (destinatários pré-cadastrados): id, nome, email, ativo, criado_em, atualizado_em.
  - `lotes_envio` (um processamento de arquivo): id, arquivo_origem, usuario_id (quem processou), criado_em, status.
  - `envios` (um e-mail para um responsável dentro de um lote): id, lote_id, responsavel_id, tarefas (JSON ou tabela relacionada), enviado_em, reenviado_de (nullable, self-reference), status (`pendente`, `enviado`, `falhou`).
  - `configuracoes` (chave-valor, editável pela interface): chave, valor, atualizado_em. Chave usada: `email_padrao_responsavel_inativo` (e-mail padrão para envios de responsáveis inativos).
- Migrations gerenciadas via Prisma Migrate — nunca alterar o schema do banco manualmente em produção.

### Autenticação
- JWT (access token) para sessão da API.
- Hash de senha com **argon2** (preferencial) ou **bcrypt** — nunca `md5`/`sha1` puro nem reversível.
- Middleware de auth em todas as rotas do backend, exceto `/api/auth/login`, `/api/auth/logout` e `/api/health`.
- Sessão: JWT emitido no login como **cookie httpOnly** (`auth_token`), também aceito via `Authorization: Bearer`.

### E-mail
- Envio via SMTP configurável por variáveis de ambiente (ver seção 6), usando uma lib como `nodemailer` no backend.
- Cada envio deve ser registrado em `envios` **antes ou imediatamente após** o disparo, com o resultado (sucesso/falha), para garantir rastreabilidade mesmo em caso de erro parcial.

---

## 3. Comandos principais

> Assumindo **pnpm** para os pacotes Node (frontend/backend) e **uv** (ou `pip` como alternativa) para o python-service. Ajuste se o projeto adotar outra ferramenta — mas mantenha consistência e atualize esta seção.

### Setup inicial
```bash
# Frontend
cd frontend && pnpm install

# Backend
cd backend && pnpm install
cd backend && pnpm exec nuxi prepare   # gera .nuxt (tsconfig exigido pelo prisma.config.ts)
cd backend && pnpm prisma generate     # gera o cliente em server/generated/prisma
cd backend && pnpm prisma migrate dev  # aplica migrations em dev

# Python service
cd python-service && uv sync            # ou: pip install -r requirements.txt
```

### Desenvolvimento (local, sem Docker)
```bash
# Frontend       -> http://localhost:3000
cd frontend && pnpm dev

# Backend        -> http://localhost:3001
cd backend && pnpm dev

# Python service -> http://localhost:8000
cd python-service && uv run uvicorn app.main:app --reload --port 8000
```

### Desenvolvimento (via Docker)
```bash
docker compose -f docker-compose.dev.yml up --build
```

### Produção
```bash
docker compose up --build -d
```

### Lint e formatação
```bash
# JS/TS (frontend e backend) — ESLint + Prettier
pnpm lint          # verifica
pnpm lint:fix       # corrige automaticamente
pnpm format         # roda o Prettier

# Python (python-service) — Ruff
ruff check .
ruff check . --fix
ruff format .
```

### Testes
```bash
# Frontend/Backend (Vitest)
pnpm test
pnpm test:watch

# Python (pytest)
uv run pytest
```

### Build
```bash
cd frontend && pnpm build
cd backend && pnpm build
```

> **Regra para o agente:** sempre rodar lint + testes relevantes ao componente alterado antes de considerar uma tarefa concluída. Não é necessário rodar a suíte completa dos três serviços se a mudança foi isolada em apenas um deles.

---

## 4. Convenções e padrões de código

### JavaScript / TypeScript (frontend e backend)
- **Line length:** 79 colunas.
- **Indentação:** 2 espaços.
- **Aspas:** simples (`'`), inclusive em JSX/template literals quando aplicável.
- Formatação via **Prettier**, com config equivalente a:
  ```json
  {
    "printWidth": 79,
    "tabWidth": 2,
    "singleQuote": true,
    "semi": true,
    "trailingComma": "es5"
  }
  ```
- Lint via **ESLint** (config Nuxt/Vue oficial + regras acima delegadas ao Prettier via `eslint-config-prettier`).
- Componentes Vue: `<script setup>`, nomes de componentes em `PascalCase`, composables em `useAlgumaCoisa`.
- Nomeação de variáveis/funções em português ou inglês — **manter consistência com o restante do arquivo já existente**; não misturar idiomas dentro do mesmo módulo.

### Python (python-service)
- **Line length:** 79 (`line-length = 79` no `pyproject.toml`).
- **Linter/formatter:** `ruff`, com regras habilitadas: `I` (isort), `F` (pyflakes), `E`/`W` (pycodestyle), `PL` (pylint), `PT` (pytest style).
- **Quote style:** aspas simples (`quote-style = "single"`).
- Exemplo de configuração em `python-service/pyproject.toml`:
  ```toml
  [tool.ruff]
  line-length = 79

  [tool.ruff.lint]
  select = ["I", "F", "E", "W", "PL", "PT"]

  [tool.ruff.format]
  quote-style = "single"
  ```
- Type hints obrigatórios em funções públicas do serviço (FastAPI se beneficia disso para validação via Pydantic).

### Commits e branches
- Branches: `feature/<descrição-curta>`, `fix/<descrição-curta>`, `chore/<descrição-curta>`.
- Commits no padrão **Conventional Commits** (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`).
- Nunca commitar `.env`, chaves, senhas ou dumps de banco.

---

## 5. Segurança — pontos de atenção obrigatórios

- Senhas de usuários do sistema: hash com **argon2/bcrypt**, salt automático da própria lib, nunca reutilizar salt fixo.
- Validação de responsável não cadastrado deve ocorrer **antes** de qualquer envio de e-mail do lote — falha em um responsável não pode gerar envios parciais silenciosos.
- Sanitizar/validar arquivos enviados (tipo, tamanho, conteúdo) antes de repassar ao `python-service`.
- Rotas do backend protegidas por JWT, exceto login.
- Segredos (SMTP, JWT secret, DB URL) somente via variáveis de ambiente — nunca hardcoded.
- CORS do backend restrito à origem do frontend.

---

## 6. Variáveis de ambiente esperadas

```bash
# backend/.env
DATABASE_URL=postgresql://user:pass@db:5432/app
JWT_SECRET=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
PYTHON_SERVICE_URL=http://python-service:8000

# python-service/.env
# (variáveis específicas do motor de separação, se houver)

# frontend/.env
API_INTERNAL_URL=http://backend:3001
API_PROXY_TARGET=http://backend:3001
COOKIE_SECURE=false
```

---

## 7. Docker

- `docker-compose.yml`: produção — serviços `frontend`, `backend`, `python-service`, `db` (Postgres), sem hot-reload, imagens multi-stage otimizadas.
- `docker-compose.dev.yml`: desenvolvimento — volumes montados para hot-reload, mesma topologia de serviços.
- Cada serviço deve ter seu próprio `Dockerfile` no respectivo diretório (`frontend/Dockerfile`, `backend/Dockerfile`, `python-service/Dockerfile`).
- Apenas `frontend` fica exposto publicamente; `backend` e `python-service` são acessíveis apenas pela rede interna Docker (o frontend faz proxy de `/api/**` para o backend).

---

## 8. O que o agente deve sempre verificar antes de abrir um PR / finalizar uma tarefa

1. Lint (`pnpm lint` / `ruff check .`) sem erros nos componentes tocados.
2. Formatação aplicada (`pnpm format` / `ruff format .`).
3. Testes relevantes passando.
4. Nenhum segredo/credencial commitado.
5. Migrations do Prisma criadas quando houver alteração de schema (`pnpm prisma migrate dev --name <descrição>`).
6. Se a mudança tocar a lógica de separação de tarefas, confirmar que o comportamento continua alinhado ao notebook de referência (`python-service/reference/Separar_acórdãos_para_formatar.ipynb`).