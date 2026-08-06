import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-ignore
import tailwindcss from '@tailwindcss/vite'
import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.API_PROXY_TARGET
  const aiTarget = env.AI_PROXY_TARGET || 'http://localhost:4000'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5174,
      proxy: {
        ...(apiTarget
          ? {
              '/api': {
                target: apiTarget,
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ''),
              },
            }
          : {}),
        '/ai-api': {
          target: aiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ai-api/, '/api'),
        },
      },
    },
  }
})
