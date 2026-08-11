import { withNuxt } from './.nuxt/eslint.config.mjs';

export default (async () => {
  const configs = await withNuxt().toConfigs();
  return [
    ...configs,
    {
      rules: {
        'vue/html-self-closing': 'off',
      },
    },
  ];
})();
