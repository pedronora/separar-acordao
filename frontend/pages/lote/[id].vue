<script setup lang="ts">
import { mensagemDeErro, useApi } from '~/composables/useApi';
import { formatarData } from '~/utils/format';
import type { EnvioDetalhe, LoteDetalhe } from '~/types';

definePageMeta({ middleware: 'auth' });

const route = useRoute();
const lote = ref<LoteDetalhe | null>(null);
const selecionados = ref<string[]>([]);
const reenviando = ref(false);
const erroMsg = ref('');
const sucessoMsg = ref('');
const envioVisualizado = ref<EnvioDetalhe | null>(null);

const progresso = computed(() => {
  if (!lote.value) {
    return { enviados: 0, total: 0, restantes: 0 };
  }
  const enviados = lote.value.envios.filter(
    (e) => e.status === 'enviado'
  ).length;
  const total = lote.value.totalEnvios ?? lote.value.envios.length;
  return { enviados, total, restantes: total - enviados };
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
  (status) => {
    if (status && status !== 'processando') {
      pararAcompanhamento();
    }
  }
);

onUnmounted(pararAcompanhamento);

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

onMounted(() => {
  if (lote.value?.status === 'processando') {
    iniciarAcompanhamento();
  }
});
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
            <dt>Arquivo</dt>
            <dd>{{ lote.arquivoOrigem }}</dd>
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

        <p v-if="lote.erro" class="erro">
          Motivo da falha: {{ lote.erro }}
        </p>

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
            {{ progresso.enviados }} de {{ progresso.total }} e-mails
            enviados (restam {{ progresso.restantes }}).
          </template>
          <template v-else>
            Separando as tarefas por pauta...
          </template>
        </p>
        <table class="tabela">
          <thead>
            <tr>
              <th>Sel.</th>
              <th>Responsável</th>
              <th>Tarefas</th>
              <th>Status</th>
              <th>Enviado em</th>
              <th>Reenvio de</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="envio in lote.envios" :key="envio.id">
              <td>
                <input
                  type="checkbox"
                  :checked="selecionados.includes(envio.id)"
                  @change="alternarSelecao(envio.id)"
                />
              </td>
              <td>
                <button
                  class="link-responsavel"
                  :disabled="!envio.corpoHtml"
                  @click="visualizarEnvio(envio)"
                >
                  {{ envio.responsavel.nome }}
                </button>
              </td>
              <td>{{ envio.tarefas.length }}</td>
              <td>
                <span
                  :class="
                    envio.status === 'enviado'
                      ? 'tag tag-verde'
                      : envio.status === 'falhou'
                        ? 'tag tag-vermelha'
                        : 'tag tag-amarela'
                  "
                >
                  {{ envio.status }}
                </span>
              </td>
              <td>{{ formatarData(envio.enviadoEm) }}</td>
              <td>
                <span v-if="envio.reenviadoDe" class="tag tag-amarela">
                  reenviado
                </span>
                <span v-else>-</span>
              </td>
            </tr>
          </tbody>
        </table>
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
  padding: 0;
  color: var(--cor-primaria);
  font: inherit;
  cursor: pointer;
}

.link-responsavel:hover {
  text-decoration: underline;
}

.link-responsavel:disabled {
  color: var(--cor-texto-suave);
  cursor: default;
  text-decoration: none;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  z-index: 50;
}

.modal {
  background: #fff;
  border-radius: 8px;
  max-width: 720px;
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  padding: 1.25rem;
}

.modal-cabecalho {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
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
