import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
      // `server-only` estoura de proposito quando importado fora de um
      // Server Component. No Next real o bundle do cliente nunca recebe o
      // modulo de servidor, mas o vitest segue a cadeia de imports ao pe da
      // letra. O proprio pacote traz um `empty.js` para este caso.
      'server-only': path.resolve(import.meta.dirname, 'node_modules/server-only/empty.js'),
    },
  },
})
