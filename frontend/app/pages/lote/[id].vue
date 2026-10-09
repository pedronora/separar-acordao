<script setup lang="ts">
import { mensagemDeErro, useApi } from '~/composables/useApi';
import { formatarData } from '~/utils/format';
import { agruparReenvios, type LinhaEnvio } from '~/utils/reenvios';
import type { EnvioDetalhe, LoteDetalhe } from '~/types';

definePageMeta({ title: 'Detalhes do lote', middleware: 'auth' });

const route = useRoute();
const lote = ref<LoteDetalhe | null>(null);
const selecionados = ref<string[]>([]);
const reenviando = ref(false);
const erroMsg = ref('');
const sucessoMsg = ref('');
const envioVisualizado = ref<EnvioDetalhe | null>(null);

const arquivosLote = computed(() => {
  if (!lote.value) {
    return '';
  }
  if (lote.value.arquivos && lote.value.arquivos.length > 0) {
    return lote.value.arquivos.map((a) => a.arquivoOrigem).join(', ');
  }
  return lote.value.arquivoOrigem;
});

const etiquetasLote = computed(() => {
  if (!lote.value) {
    return '';
  }
  if (lote.value.arquivos && lote.value.arquivos.length > 0) {
    return lote.value.arquivos
      .map((a) => a.etiqueta)
      .filter((e) => e)
      .join(', ');
  }
  return lote.value.arquivoOrigem;
});

const progresso = computed(() => {
  if (!lote.value) {
    return { enviados: 0, total: 0, restantes: 0 };
  }
  const enviados = lote.value.envios.filter(
    (e: EnvioDetalhe) => e.status === 'enviado'
  ).length;
  const total = lote.value.totalEnvios ?? lote.value.envios.length;
  return { enviados, total, restantes: total - enviados };
});

const linhas = computed<LinhaEnvio[]>(() => {
  if (!lote.value) {
    return [];
  }
  return agruparReenvios(lote.value.envios);
});

async function carregar() {
  erroMsg.value = '';
  try {
    lote.value = await useApi<LoteDetalhe>(`/api/lotes/${route.params.id}`);
  } catch (erro) {
    erroMsg.value = mensagemDeErro(erro);
  }
}

let intervalo: ReturnType<typeof setInterval> | null = null;

function iniciarAcompanhamento() {
  if (intervalo) {
    clearInterval(intervalo);
  }
  intervalo = setInterval(() => {
    carregar();
  }, 4000);
}

function pararAcompanhamento() {
  if (intervalo) {
    clearInterval(intervalo);
    intervalo = null;
  }
}

watch(
  () => lote.value?.status,
  (status: LoteDetalhe['status'] | undefined) => {
    if (status && status !== 'processando') {
      pararAcompanhamento();
    }
  }
);

onUnmounted(pararAcompanhamento);

onMounted(() => {
  if (lote.value?.status === 'processando') {
    iniciarAcompanhamento();
  }
});

function alternarSelecao(id: string) {
  const indice = selecionados.value.indexOf(id);
  if (indice >= 0) {
    selecionados.value.splice(indice, 1);
  } else {
    selecionados.value.push(id);
  }
}

async function reenviar(envioIds?: string[]) {
  if (!lote.value) {
    return;
  }
  reenviando.value = true;
  erroMsg.value = '';
  sucessoMsg.value = '';
  try {
    const resultado = await useApi<{
      total: number;
      enviados: number;
      falhas: string[];
    }>(`/api/lotes/${lote.value.id}/reenvio`, {
      method: 'POST',
      body: envioIds ? { envioIds } : {},
    });
    sucessoMsg.value = `Reenvio concluído: ${resultado.enviados}/${resultado.total} e-mails.`;
    selecionados.value = [];
    await carregar();
  } catch (erro) {
    erroMsg.value = mensagemDeErro(erro);
  } finally {
    reenviando.value = false;
  }
}

function visualizarEnvio(envio: EnvioDetalhe) {
  envioVisualizado.value = envio;
}

function fecharVisualizacao() {
  envioVisualizado.value = null;
}

async function alternarConfirmacao(linha: LinhaEnvio) {
  if (!lote.value) {
    return;
  }
  const todosConfirmados =
    linha.envio.confirmado && linha.reenvios.every((r) => r.confirmado);
  const ids = [linha.envio.id, ...linha.reenvios.map((r) => r.id)];
  try {
    await useApi<{ atualizados: number }>(
      `/api/lotes/${lote.value.id}/confirmar`,
      {
        method: 'POST',
        body: {
          envioIds: ids,
          confirmado: !todosConfirmados,
        },
      }
    );
    linha.envio.confirmado = !todosConfirmados;
    linha.envio.confirmadoEm = linha.envio.confirmado
      ? new Date().toISOString()
      : null;
    for (const reenvio of linha.reenvios) {
      reenvio.confirmado = linha.envio.confirmado;
      reenvio.confirmadoEm = linha.envio.confirmadoEm;
    }
  } catch (erro) {
    erroMsg.value = mensagemDeErro(erro);
  }
}

await carregar();
</script>

<template>
  <div>
    <NuxtLink to="/historico">&larr; Histórico</NuxtLink>
    <h1>Lote {{ lote?.id.slice(0, 8) }}</h1>

    <p v-if="erroMsg" class="erro">
      {{ erroMsg }}
    </p>
    <p v-if="sucessoMsg" class="sucesso">
      {{ sucessoMsg }}
    </p>

    <template v-if="lote">
      <section class="card">
        <dl class="detalhes">
          <div>
            <dt>Arquivo(s)</dt>
            <dd>{{ arquivosLote }}</dd>
          </div>
          <div>
            <dt>Etiqueta(s)</dt>
            <dd>{{ etiquetasLote }}</dd>
          </div>
          <div>
            <dt>Órgão</dt>
            <dd>{{ lote.orgao || '-' }}</dd>
          </div>
          <div>
            <dt>Sessão</dt>
            <dd>{{ lote.dataSessao || '-' }}</dd>
          </div>
          <div>
            <dt>Criado em</dt>
            <dd>{{ formatarData(lote.criadoEm) }}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span
                :class="
                  lote.status === 'processado'
                    ? 'tag tag-verde'
                    : lote.status === 'falhou'
                      ? 'tag tag-vermelha'
                      : 'tag tag-amarela'
                "
              >
                {{ lote.status }}
              </span>
            </dd>
          </div>
          <div>
            <dt>Usuário</dt>
            <dd>{{ lote.usuario.nome }}</dd>
          </div>
        </dl>

        <p v-if="lote.erro" class="erro">Motivo da falha: {{ lote.erro }}</p>

        <button
          class="btn btn-secundario"
          :disabled="reenviando"
          @click="reenviar(selecionados.length ? selecionados : undefined)"
        >
          {{ reenviando ? 'Reenviando...' : 'Reenviar selecionados' }}
        </button>
      </section>

      <section class="card">
        <h2>Envios</h2>
        <p
          v-if="lote.status === 'processando'"
          class="sucesso"
          style="margin-bottom: 0.75rem"
        >
          <template v-if="lote.totalEnvios">
            {{ progresso.enviados }} de {{ progresso.total }} e-mails enviados
            (restam {{ progresso.restantes }}).
          </template>
          <template v-else> Separando as tarefas por pauta... </template>
        </p>
        <div class="tabela-responsiva">
          <table class="tabela tabela--cartoes">
            <thead>
              <tr>
                <th>Sel.</th>
                <th>Responsável</th>
                <th>Tarefas</th>
                <th>Status</th>
                <th>OK?</th>
                <th>Enviado em</th>
                <th>Reenvio(s)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="linha in linhas" :key="linha.envio.id">
                <td data-label="Selecionar">
                  <input
                    type="checkbox"
                    :checked="selecionados.includes(linha.envio.id)"
                    aria-label="Selecionar envio"
                    @change="alternarSelecao(linha.envio.id)"
                  />
                </td>
                <td data-label="Responsável">
                  <button
                    class="link-responsavel"
                    :disabled="!linha.envio.corpoHtml"
                    @click="visualizarEnvio(linha.envio)"
                  >
                    {{ linha.envio.responsavel.nome }}
                  </button>
                </td>
                <td data-label="Tarefas">
                  {{ linha.envio.tarefas.length }}
                </td>
                <td data-label="Status">
                  <span
                    :class="
                      linha.envio.status === 'enviado'
                        ? 'tag tag-verde'
                        : linha.envio.status === 'falhou'
                          ? 'tag tag-vermelha'
                          : 'tag tag-amarela'
                    "
                  >
                    {{ linha.envio.status }}
                  </span>
                </td>
                <td data-label="Confirmado">
                  <input
                    type="checkbox"
                    :checked="
                      linha.envio.confirmado &&
                      linha.reenvios.every((r) => r.confirmado)
                    "
                    aria-label="Confirmar conclusão"
                    @change="alternarConfirmacao(linha)"
                  />
                </td>
                <td data-label="Enviado em">
                  {{ formatarData(linha.envio.enviadoEm) }}
                </td>
                <td data-label="Reenvio(s)">
                  <template v-if="linha.reenvios.length">
                    <div
                      v-for="reenvio in linha.reenvios"
                      :key="reenvio.id"
                      class="reenvio-linha"
                    >
                      <template v-if="reenvio.enviadoEm">
                        reenviado em
                        {{ formatarData(reenvio.enviadoEm) }}
                      </template>
                      <span v-else class="tag tag-vermelha">
                        reenviado (falhou)
                      </span>
                    </div>
                  </template>
                  <span v-else>-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <div
      v-if="envioVisualizado"
      class="modal-overlay"
      @click.self="fecharVisualizacao"
    >
      <div class="modal">
        <div class="modal-cabecalho">
          <h2>{{ envioVisualizado.responsavel.nome }}</h2>
          <button class="btn btn-secundario" @click="fecharVisualizacao">
            Fechar
          </button>
        </div>
        <dl class="detalhes">
          <div>
            <dt>Para</dt>
            <dd>{{ envioVisualizado.para || '-' }}</dd>
          </div>
          <div>
            <dt>Assunto</dt>
            <dd>{{ envioVisualizado.assunto || '-' }}</dd>
          </div>
        </dl>
        <div class="corpo-email">
          <div
            v-if="envioVisualizado.corpoHtml"
            v-html="envioVisualizado.corpoHtml"
          />
          <p v-else class="erro">Conteúdo indisponível para este envio.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detalhes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
  margin: 0 0 1rem;
}

.detalhes dt {
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--cor-texto-suave);
}

.detalhes dd {
  margin: 0.15rem 0 0;
}

.link-responsavel {
  background: none;
  border: none;
  padding: 0.5rem 0;
  color: var(--cor-primaria);
  font: inherit;
  text-align: right;
  cursor: pointer;
}

@media (min-width: 640px) {
  .link-responsavel {
    padding: 0;
    text-align: left;
  }
}

.link-responsavel:hover {
  text-decoration: underline;
}

.link-responsavel:disabled {
  color: var(--cor-texto-suave);
  cursor: default;
  text-decoration: none;
}

.reenvio-linha + .reenvio-linha {
  margin-top: 0.25rem;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
  z-index: 50;
}

.modal {
  background: #fff;
  border-radius: 12px 12px 0 0;
  width: 100%;
  max-height: 100dvh;
  overflow-y: auto;
  padding: 1rem;
  padding-bottom: env(safe-area-inset-bottom);
}

.modal-cabecalho {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

@media (min-width: 640px) {
  .modal-overlay {
    align-items: center;
    padding: 1.5rem;
  }

  .modal {
    border-radius: 8px;
    max-width: 720px;
    max-height: 85vh;
    padding: 1.25rem;
  }
}

.modal-cabecalho h2 {
  margin: 0;
}

.corpo-email {
  border: 1px solid var(--cor-borda);
  border-radius: 6px;
  padding: 0.5rem;
  background: #fff;
  overflow-x: auto;
}
</style>
