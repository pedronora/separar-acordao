<script setup lang="ts">
const { usuario, logout } = useAuth();
const router = useRouter();

async function sair() {
  logout();
  await router.push('/login');
}
</script>

<template>
  <div>
    <header class="cabecalho">
      <div class="container cabecalho-inner">
        <NuxtLink to="/" class="logo"> Separar Acórdãos </NuxtLink>
        <nav v-if="usuario" class="nav">
          <NuxtLink to="/">Novo envio</NuxtLink>
          <NuxtLink to="/configuracoes">Configurações</NuxtLink>
          <NuxtLink to="/historico">Histórico</NuxtLink>
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
  padding-top: 0.9rem;
  padding-bottom: 0.9rem;
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
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.9rem;
}

.nav a {
  color: #fff;
}

.usuario {
  color: #cfe3f1;
}
</style>
