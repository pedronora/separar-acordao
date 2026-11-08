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
const assuntoEditado = ref(props.dados.assunto);
const corpoEditado = ref(props.dados.corpoHtml);
const corpoRef = ref<HTMLElement | null>(null);

const envioConcluido = computed(() => props.dados.status === 'enviada');
const envioEmAndamento = computed(() => props.dados.status === 'enviando');
const camposBloqueados = computed(
  () => enviando.value || envioConcluido.value || envioEmAndamento.value
);

const resumoBcc = computed(() => {
  const total = bccSelecionados.value.length;
  if (total === 0) {
    return 'Selecionar responsáveis';
  }
  if (total === 1) {
    const responsavel = props.dados.bccDisponiveis.find(
      (item) => item.id === bccSelecionados.value[0]
    );
    return responsavel?.nome ?? '1 selecionado';
  }
  return `${total} selecionados`;
});

const nomesBccSelecionados = computed(() =>
  props.dados.bccDisponiveis
    .filter((responsavel) => bccSelecionados.value.includes(responsavel.id))
    .map((responsavel) => responsavel.nome)
    .join(', ')
);

onMounted(() => {
  if (corpoRef.value) {
    corpoRef.value.innerHTML = props.dados.corpoHtml;
  }
});

function capturarCorpo() {
  corpoEditado.value = corpoRef.value?.innerHTML ?? '';
}

function alternarBcc(id: string) {
  const indice = bccSelecionados.value.indexOf(id);
  if (indice >= 0) {
    bccSelecionados.value.splice(indice, 1);
  } else {
    bccSelecionados.value.push(id);
  }
}

function limparBcc() {
  bccSelecionados.value = [];
}

function fechar() {
  if (enviando.value) {
    return;
  }
  emit('fechar');
}

async function enviar() {
  if (camposBloqueados.value) {
    return;
  }
  capturarCorpo();
  enviando.value = true;
  erroMsg.value = '';
  try {
    const resultado = await useApi<{
      status: string;
      enviadaEm: string | null;
      jaEnviada: boolean;
    }>(`/api/lotes/${props.loteId}/comunicacao`, {
      method: 'POST',
      body: {
        bccResponsavelIds: bccSelecionados.value,
        assunto: assuntoEditado.value,
        corpoHtml: corpoEditado.value,
      },
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
  <AppModal
    titulo="Comunicar conclusão ao desembargador"
    :bloqueado="enviando"
    @fechar="fechar"
  >
    <p v-if="erroMsg" class="erro" role="alert">{{ erroMsg }}</p>

    <p v-if="envioConcluido" class="sucesso" role="status">
      Comunicação já enviada
      <template v-if="dados.enviadaEm">
        em {{ formatarData(dados.enviadaEm) }} </template
      >.
    </p>
    <p v-else-if="envioEmAndamento" class="sucesso" role="status">
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
    </dl>

    <div class="campo">
      <label for="comunicacao-assunto">Assunto</label>
      <input
        id="comunicacao-assunto"
        v-model="assuntoEditado"
        :disabled="camposBloqueados"
      />
    </div>

    <div class="bcc-campo">
      <span class="bcc-rotulo">Cópia oculta (BCC)</span>
      <details class="bcc-dropdown">
        <summary>{{ resumoBcc }}</summary>
        <div class="bcc-opcoes">
          <label
            v-for="responsavel in dados.bccDisponiveis"
            :key="responsavel.id"
            class="bcc-item"
          >
            <input
              type="checkbox"
              :checked="bccSelecionados.includes(responsavel.id)"
              :disabled="camposBloqueados"
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
          <button
            v-if="bccSelecionados.length > 0"
            type="button"
            class="btn btn-secundario btn-pequeno"
            :disabled="camposBloqueados"
            @click="limparBcc"
          >
            Limpar seleção
          </button>
        </div>
      </details>
      <p v-if="nomesBccSelecionados" class="bcc-selecionados">
        {{ nomesBccSelecionados }}
      </p>
    </div>

    <h3>Mensagem</h3>
    <p class="dica">Edite o assunto e o corpo antes de enviar.</p>
    <div class="corpo-email">
      <div
        ref="corpoRef"
        class="corpo-editavel"
        role="textbox"
        aria-label="Corpo do e-mail"
        aria-multiline="true"
        :contenteditable="!camposBloqueados"
        @input="capturarCorpo"
      />
    </div>

    <template #acoes>
      <button
        v-if="!envioConcluido"
        class="btn"
        :disabled="camposBloqueados"
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
      <button class="btn btn-secundario" :disabled="enviando" @click="fechar">
        {{ envioConcluido ? 'Fechar' : 'Cancelar' }}
      </button>
    </template>
  </AppModal>
</template>

<style scoped>
.bcc-campo {
  margin-bottom: 1rem;
}

.bcc-rotulo {
  display: block;
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 0.3rem;
}

.bcc-dropdown {
  border: 1px solid var(--cor-borda);
  border-radius: var(--raio-campo);
  background: var(--cor-superficie);
}

.bcc-dropdown summary {
  padding: 0.55rem 0.75rem;
  cursor: pointer;
  font-weight: 600;
}

.bcc-opcoes {
  max-height: 14rem;
  overflow-y: auto;
  border-top: 1px solid var(--cor-borda);
  padding: 0.25rem 0.75rem 0.75rem;
}

.bcc-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0;
  border-top: 1px solid var(--cor-borda);
}

.bcc-item:first-child {
  border-top: none;
}

.bcc-item small {
  display: block;
  color: var(--cor-texto-suave);
  font-size: 0.8rem;
}

.bcc-selecionados {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  color: var(--cor-texto-suave);
}

.corpo-editavel {
  min-height: 12rem;
}
</style>
