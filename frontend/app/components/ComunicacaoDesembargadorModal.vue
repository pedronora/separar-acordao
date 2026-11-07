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
      </dl>

      <div class="campo-mensagem">
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

      <div class="acoes-modal">
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

.campo-mensagem {
  margin-bottom: 1rem;
}

.campo-mensagem label,
.bcc-rotulo {
  display: block;
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--cor-texto-suave);
  margin-bottom: 0.3rem;
}

.campo-mensagem input {
  display: block;
  width: 100%;
  padding: 0.625rem 0.75rem;
  font-family: inherit;
  font-size: inherit;
  line-height: 1.5;
  color: var(--cor-texto);
  background-color: #fff;
  border: 1px solid var(--cor-borda);
  border-radius: 6px;
  outline: none;
  transition:
    border-color 0.15s ease-in-out,
    box-shadow 0.15s ease-in-out;
  box-sizing: border-box;
}

.campo-mensagem input:focus {
  border-color: var(--cor-primaria);
  box-shadow: 0 0 0 0.2rem
    color-mix(in srgb, var(--cor-primaria) 20%, transparent);
}

.campo-mensagem input:disabled {
  background-color: #f1f3f5;
  cursor: not-allowed;
  opacity: 0.7;
}

.bcc-campo {
  margin-bottom: 1rem;
}

.bcc-dropdown {
  border: 1px solid var(--cor-borda);
  border-radius: 6px;
  background: #fff;
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

.corpo-editavel {
  min-height: 12rem;
  outline: none;
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
