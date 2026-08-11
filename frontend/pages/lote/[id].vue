<script setup lang="ts">
import { mensagemDeErro, useApi } from '~/composables/useApi';
import { formatarData } from '~/utils/format';
import type { LoteDetalhe } from '~/types';

definePageMeta({ middleware: 'auth' });

const route = useRoute();
const lote = ref<LoteDetalhe | null>(null);
const selecionados = ref<string[]>([]);
const reenviando = ref(false);
const erroMsg = ref('');
const sucessoMsg = ref('');

async function carregar() {
  erroMsg.value = '';
  try {
    lote.value = await useApi<LoteDetalhe>(`/api/lotes/${route.params.id}`);
  } catch (erro) {
    erroMsg.value = mensagemDeErro(erro);
  }
}

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
              <td>{{ envio.responsavel.nome }}</td>
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
</style>
