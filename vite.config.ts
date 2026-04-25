import { defineConfig } from 'vite';

const repoBase = '/sailer/';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? repoBase : '/',
});
