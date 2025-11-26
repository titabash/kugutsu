import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    // メインプロセス設定
    plugins: [externalizeDepsPlugin({
      // Externalize packages that have issues in Electron
      exclude: ['undici']
    })],
    resolve: {
      alias: {
        '@workflow': resolve(__dirname, 'src/workflow')
      }
    },
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main/index.ts')
        },
        external: ['undici', '@langchain/core', '@langchain/langgraph']
      }
    }
  },
  preload: {
    // preloadスクリプト設定
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    // レンダラープロセス設定（既存のVite設定を統合）
    root: resolve(__dirname, 'electron/renderer'),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'electron/renderer'),
        // Ensure single React instance to avoid hooks issues with rete-react-plugin and styled-components
        'react': resolve(__dirname, 'node_modules/react'),
        'react-dom': resolve(__dirname, 'node_modules/react-dom'),
        'react/jsx-runtime': resolve(__dirname, 'node_modules/react/jsx-runtime'),
        'react/jsx-dev-runtime': resolve(__dirname, 'node_modules/react/jsx-dev-runtime'),
      },
      // Dedupe to prevent multiple React instances
      dedupe: ['react', 'react-dom', 'styled-components'],
    },
    build: {
      outDir: resolve(__dirname, 'out/renderer'),
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(__dirname, 'electron/renderer/index.html')
      }
    },
    base: './'
  }
})
