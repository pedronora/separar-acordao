<script setup lang="ts">
const { usuario, logout } = useAuth();
const router = useRouter();
const route = useRoute();
const menuAberto = ref(false);

watch(
  () => route.path,
  () => {
    menuAberto.value = false;
  }
);

async function sair() {
  menuAberto.value = false;
  await logout();
  await router.push('/login');
}
</script>

<template>
  <div>
    <header class="cabecalho">
      <div class="container cabecalho-inner">
        <NuxtLink to="/" class="logo"> Separar Acórdãos </NuxtLink>
        <button
          v-if="usuario"
          class="menu-botao"
          :aria-expanded="menuAberto"
          aria-label="Abrir menu de navegação"
          @click="menuAberto = !menuAberto"
        >
          {{ menuAberto ? '✕' : '☰' }}
        </button>
        <nav v-if="usuario" class="nav" :class="{ aberto: menuAberto }">
          <NuxtLink to="/">Novo envio</NuxtLink>
          <NuxtLink to="/historico">Histórico</NuxtLink>
          <NuxtLink to="/configuracoes">Configurações</NuxtLink>
          <span class="usuario">{{ usuario.nome }}</span>
          <button class="btn btn-secundario" @click="sair">Sair</button>
        </nav>
      </div>
    </header>
    <main class="container">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.cabecalho {
  background: var(--cor-primaria);
  color: #fff;
}

.cabecalho-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding-top: 0.9rem;
  padding-bottom: 0.9rem;
}

.menu-botao {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2.75rem;
  min-height: 2.75rem;
  background: transparent;
  border: 1px solid #fff;
  border-radius: 6px;
  color: #fff;
  font-size: 1.2rem;
  cursor: pointer;
}

.logo {
  color: #fff;
  font-weight: 700;
  font-size: 1.1rem;
}

.logo:hover {
  text-decoration: none;
}

.nav {
  display: none;
  width: 100%;
  flex-direction: column;
  align-items: stretch;
  gap: 0.5rem;
  font-size: 1rem;
}

.nav.aberto {
  display: flex;
}

.nav a {
  color: #fff;
  padding: 0.65rem 0;
}

.usuario {
  color: #cfe3f1;
  padding: 0.65rem 0;
}

@media (min-width: 640px) {
  .menu-botao {
    display: none;
  }

  .nav {
    display: flex;
    width: auto;
    flex-direction: row;
    align-items: center;
    gap: 1rem;
    font-size: 0.9rem;
  }

  .nav a,
  .usuario {
    padding: 0;
  }
}
</style>
