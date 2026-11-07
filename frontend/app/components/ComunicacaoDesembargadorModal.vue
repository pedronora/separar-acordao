<script setup lang="ts">
import { mensagemDeErro, useApi } from '~/composables/useApi';
import type { ComunicacaoPreview } from '~/types';
import { formatarData } from '~/utils/format';

const props = defineProps<{
  loteId: string;
  dados: ComunicacaoPreview;
}>();

const emit = defineEmits<{
  fechar: [];
  enviado: [{ enviadaEm: string | null }];
}>();

const bccSelecionados = ref<string[]>([]);
const enviando = ref(false);
const erroMsg = ref(props.dados.erro ?? '');

const envioConcluido = computed(() => props.dados.status === 'enviada');
const envioEmAndamento = computed(() => props.dados.status === 'enviando');

function alternarBcc(id: string) {
  const indice = bccSelecionados.value.indexOf(id);
  if (indice >= 0) {
    bccSelecionados.value.splice(indice, 1);
  } else {
    bccSelecionados.value.push(id);
  }
}

function fechar() {
  if (enviando.value) {
    return;
  }
  emit('fechar');
}

async function enviar() {
  if (enviando.value || envioConcluido.value || envioEmAndamento.value) {
    return;
  }
  enviando.value = true;
  erroMsg.value = '';
  try {
    const resultado = await useApi<{
      status: string;
      enviadaEm: string | null;
      jaEnviada: boolean;
    }>(`/api/lotes/${props.loteId}/comunicacao`, {
      method: 'POST',
      body: { bccResponsavelIds: bccSelecionados.value },
    });
    emit('enviado', { enviadaEm: resultado.enviadaEm });
  } catch (erro) {
    erroMsg.value = mensagemDeErro(erro);
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="fechar">
    <div class="modal">
      <div class="modal-cabecalho">
        <h2>Comunicar conclusão ao desembargador</h2>
        <button class="btn btn-secundario" @click="fechar">Fechar</button>
      </div>

      <p v-if="erroMsg" class="erro">{{ erroMsg }}</p>

      <p v-if="envioConcluido" class="sucesso">
        Comunicação já enviada
        <template v-if="dados.enviadaEm">
          em {{ formatarData(dados.enviadaEm) }} </template
        >.
      </p>
      <p v-else-if="envioEmAndamento" class="sucesso">
        O envio desta comunicação já está em andamento.
      </p>

      <dl class="detalhes">
        <div>
          <dt>Destinatário</dt>
          <dd>
            {{ dados.destinatario.nome }}
            &lt;{{ dados.destinatario.email }}&gt;
          </dd>
        </div>
        <div>
          <dt>Assunto</dt>
          <dd>{{ dados.assunto }}</dd>
        </div>
      </dl>

      <fieldset class="bcc-lista">
        <legend>Cópia oculta (BCC)</legend>
        <p class="dica">
          Selecione responsáveis para receber cópia oculta. Os endereços
          escolhidos não aparecem no corpo da mensagem.
        </p>
        <label
          v-for="responsavel in dados.bccDisponiveis"
          :key="responsavel.id"
          class="bcc-item"
        >
          <input
            type="checkbox"
            :checked="bccSelecionados.includes(responsavel.id)"
            :disabled="enviando || envioConcluido"
            @change="alternarBcc(responsavel.id)"
          />
          <span>
            {{ responsavel.nome }}
            <small>{{ responsavel.email }}</small>
          </span>
        </label>
        <p v-if="dados.bccDisponiveis.length === 0" class="dica">
          Nenhum responsável ativo disponível para cópia oculta.
        </p>
      </fieldset>

      <h3>Prévia da mensagem</h3>
      <div class="corpo-email">
        <div v-html="dados.corpoHtml" />
      </div>

      <div class="acoes-modal">
        <button
          v-if="!envioConcluido"
          class="btn"
          :disabled="enviando || envioEmAndamento"
          @click="enviar"
        >
          {{
            enviando
              ? 'Enviando...'
              : dados.status === 'falhou'
                ? 'Tentar novamente'
                : 'Enviar e-mail'
          }}
        </button>
        <button
          class="btn btn-secundario"
          :disabled="enviando"
          @click="fechar"
        >
          {{ envioConcluido ? 'Fechar' : 'Cancelar' }}
        </button>
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

.bcc-lista {
  border: 1px solid var(--cor-borda);
  border-radius: 6px;
  padding: 0.75rem;
  margin: 0 0 1rem;
}

.bcc-lista legend {
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0 0.25rem;
}

.bcc-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0;
  border-top: 1px solid var(--cor-borda);
}

.bcc-item:first-of-type {
  border-top: none;
}

.bcc-item small {
  display: block;
  color: var(--cor-texto-suave);
  font-size: 0.8rem;
}

.dica {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  color: var(--cor-texto-suave);
}

.corpo-email {
  border: 1px solid var(--cor-borda);
  border-radius: 6px;
  padding: 0.5rem;
  background: #fff;
  overflow-x: auto;
  margin-bottom: 1rem;
}

.acoes-modal {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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

.modal-cabecalho h2 {
  margin: 0;
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

  .acoes-modal {
    flex-direction: row;
    justify-content: flex-end;
  }
}
</style>
