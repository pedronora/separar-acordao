<script setup lang="ts">
/**
 * Diálogo modal com foco preso, fechamento por Esc e bloqueio de scroll.
 * No mobile abre como folha inferior; a partir de 640px centraliza.
 */
const props = withDefaults(
  defineProps<{
    titulo: string;
    /** Impede fechar por Esc, overlay ou botão enquanto algo está em curso. */
    bloqueado?: boolean;
  }>(),
  { bloqueado: false }
);

const emit = defineEmits<{ fechar: [] }>();

const painel = ref<HTMLElement | null>(null);
const tituloId = useId();

const SELETOR_FOCAVEL = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

function focaveis(): HTMLElement[] {
  const elementos =
    painel.value?.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL);
  return elementos ? Array.from(elementos) : [];
}

function fechar() {
  if (props.bloqueado) {
    return;
  }
  emit('fechar');
}

function aoTeclar(evento: KeyboardEvent) {
  if (evento.key === 'Escape') {
    if (!props.bloqueado) {
      evento.preventDefault();
      fechar();
    }
    return;
  }

  if (evento.key !== 'Tab') {
    return;
  }

  const lista = focaveis();
  const primeiro = lista[0];
  const ultimo = lista[lista.length - 1];
  if (!primeiro || !ultimo) {
    evento.preventDefault();
    return;
  }

  const ativo = document.activeElement as HTMLElement | null;
  const foraDoPainel = !ativo || !painel.value?.contains(ativo);

  if (evento.shiftKey && (foraDoPainel || ativo === primeiro)) {
    evento.preventDefault();
    ultimo.focus();
  } else if (!evento.shiftKey && (foraDoPainel || ativo === ultimo)) {
    evento.preventDefault();
    primeiro.focus();
  }
}

let overflowAnterior = '';
let elementoAnterior: HTMLElement | null = null;

onMounted(() => {
  elementoAnterior = document.activeElement as HTMLElement | null;
  overflowAnterior = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', aoTeclar);

  nextTick(() => {
    const primeiro = focaveis()[0];
    (primeiro ?? painel.value)?.focus();
  });
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', aoTeclar);
  document.body.style.overflow = overflowAnterior;
  if (elementoAnterior?.isConnected) {
    elementoAnterior.focus();
  }
});
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="fechar">
      <div
        ref="painel"
        class="modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="tituloId"
        tabindex="-1"
      >
        <div class="modal-cabecalho">
          <h2 :id="tituloId">{{ titulo }}</h2>
          <button
            type="button"
            class="btn btn-secundario"
            :disabled="bloqueado"
            @click="fechar"
          >
            Fechar
          </button>
        </div>
        <slot />
        <div v-if="$slots.acoes" class="acoes-modal">
          <slot name="acoes" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
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
  background: var(--cor-superficie);
  border-radius: 12px 12px 0 0;
  width: 100%;
  max-height: 100dvh;
  overflow-y: auto;
  padding: 1rem;
  padding-bottom: env(safe-area-inset-bottom);
}

.modal:focus {
  outline: none;
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

.acoes-modal {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}

@media (min-width: 640px) {
  .modal-overlay {
    align-items: center;
    padding: 1.5rem;
  }

  .modal {
    border-radius: var(--raio-card);
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
