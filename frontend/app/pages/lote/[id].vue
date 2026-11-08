<script setup lang="ts">
import { mensagemDeErro, useApi } from '~/composables/useApi';
import { formatarData } from '~/utils/format';
import { agruparReenvios, type LinhaEnvio } from '~/utils/reenvios';
import { deveApresentarComunicacaoAutomaticamente } from '~/utils/comunicacao';
import type { ComunicacaoPreview, EnvioDetalhe, LoteDetalhe } from '~/types';

definePageMeta({ title: 'Detalhes do lote', middleware: 'auth' });

const route = useRoute();
const lote = ref<LoteDetalhe | null>(null);
const selecionados = ref<string[]>([]);
const reenviando = ref(false);
const erroMsg = ref('');
const sucessoMsg = ref('');
const envioVisualizado = ref<EnvioDetalhe | null>(null);
const comunicacaoDados = ref<ComunicacaoPreview | null>(null);
const modalComunicacaoAberto = ref(false);
const preparandoComunicacao = ref(false);

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

const podeComunicar = computed(() => {
  if (!lote.value) {
    return false;
  }
  return (
    lote.value.status === 'processado' && lote.value.completamenteConfirmado
  );
});

async function carregar() {
  erroMsg.value = '';
  try {
    lote.value = await useApi<LoteDetalhe>(`/api/lotes/${route.params.id}`);
  } catch (erro) {
    erroMsg.value = mensagemDeErro(erro);
  }
}

async function abrirComunicacao(automatica: boolean) {
  if (!lote.value || preparandoComunicacao.value) {
    return;
  }
  preparandoComunicacao.value = true;
  erroMsg.value = '';
  try {
    const dados = await useApi<ComunicacaoPreview>(
      `/api/lotes/${lote.value.id}/comunicacao/preparar`,
      { method: 'POST' }
    );
    if (automatica && !dados.apresentadaAgora) {
      return;
    }
    if (dados.apresentadaAgora) {
      lote.value.comunicacao.apresentadaEm =
        lote.value.comunicacao.apresentadaEm ?? new Date().toISOString();
    }
    comunicacaoDados.value = dados;
    modalComunicacaoAberto.value = true;
  } catch (erro) {
    erroMsg.value = mensagemDeErro(erro);
  } finally {
    preparandoComunicacao.value = false;
  }
}

async function avaliarAberturaAutomatica() {
  if (deveApresentarComunicacaoAutomaticamente(lote.value)) {
    await abrirComunicacao(true);
  }
}

function fecharComunicacao() {
  modalComunicacaoAberto.value = false;
  comunicacaoDados.value = null;
}

async function comunicacaoEnviadaComSucesso() {
  fecharComunicacao();
  sucessoMsg.value = 'Comunicação enviada ao desembargador com sucesso.';
  await carregar();
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

onMounted(async () => {
  if (lote.value?.status === 'processando') {
    iniciarAcompanhamento();
  }
  await avaliarAberturaAutomatica();
});

function alternarSelecao(id: string) {
  const indice = selecionados.value.indexOf(id);
  if (indice >= 0) {
    selecionados.value.splice(indice, 1);
  } else {
    selecionados.value.push(id);
  }
}

async function reenviar(envioIds: string[]) {
  if (!lote.value || envioIds.length === 0) {
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
      body: { envioIds },
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
    const resultado = await useApi<{
      atualizados: number;
      completamenteConfirmado: boolean;
      transicao: boolean;
    }>(`/api/lotes/${lote.value.id}/confirmar`, {
      method: 'POST',
      body: {
        envioIds: ids,
        confirmado: !todosConfirmados,
      },
    });
    await carregar();
    if (resultado.transicao) {
      await avaliarAberturaAutomatica();
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
              <TagStatus :status="lote.status" />
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
          :disabled="reenviando || selecionados.length === 0"
          @click="reenviar(selecionados)"
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
                  <TagStatus :status="linha.envio.status" />
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

      <section class="card">
        <h2>Comunicação ao desembargador</h2>
        <p v-if="!lote.comunicacao.configurado" class="dica">
          Cadastre o nome e o e-mail do desembargador em
          <NuxtLink to="/configuracoes">Configurações</NuxtLink>
          para habilitar o envio.
        </p>
        <p v-else-if="lote.comunicacao.status === 'enviada'" class="sucesso">
          Comunicação enviada
          <template v-if="lote.comunicacao.enviadaEm">
            em {{ formatarData(lote.comunicacao.enviadaEm) }}
          </template>
          .
        </p>
        <p v-else-if="!podeComunicar" class="dica">
          A comunicação fica disponível quando todos os responsáveis
          confirmarem a conclusão da revisão.
        </p>
        <p v-else class="dica">
          Todos os responsáveis confirmaram a revisão. Envie a comunicação de
          conclusão ao desembargador quando estiver pronto.
        </p>

        <button
          v-if="
            lote.comunicacao.configurado &&
            lote.comunicacao.status !== 'enviada'
          "
          class="btn"
          :disabled="!podeComunicar || preparandoComunicacao"
          @click="abrirComunicacao(false)"
        >
          {{
            preparandoComunicacao
              ? 'Preparando...'
              : 'Comunicar conclusão ao desembargador'
          }}
        </button>
      </section>
    </template>

    <AppModal
      v-if="envioVisualizado"
      :titulo="envioVisualizado.responsavel.nome"
      @fechar="fecharVisualizacao"
    >
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
    </AppModal>
    <ComunicacaoDesembargadorModal
      v-if="modalComunicacaoAberto && comunicacaoDados"
      :lote-id="lote?.id ?? ''"
      :dados="comunicacaoDados"
      @fechar="fecharComunicacao"
      @enviado="comunicacaoEnviadaComSucesso"
    />
  </div>
</template>

<style scoped>
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
</style>
