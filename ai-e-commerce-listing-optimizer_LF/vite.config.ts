import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2
      },
      mangle: {
        safari10: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['@google/genai']
        }
      }
    },
    chunkSizeWarningLimit: 600,
    assetsInlineLimit: 4096, // Inline assets smaller than 4kb
    sourcemap: false // Disable source maps for production
  },
  
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  
  css: {
    devSourcemap: false
  },

  // Optimize dependencies
  optimizeDeps: {
    include: ['@google/genai']
  }
});