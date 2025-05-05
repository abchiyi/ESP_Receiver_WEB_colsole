import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import viteImagemin from 'vite-plugin-imagemin'
import viteCompression from 'vite-plugin-compression'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(),
  viteImagemin({
    gifsicle: { optimizationLevel: 3 },
    mozjpeg: { quality: 70 },
    pngquant: { quality: [0.7, 0.9] },
    svgo: {
      plugins: [
        { removeViewBox: false },
        { removeMetadata: true }
      ]
    }
  }),
  viteCompression({ algorithm: 'gzip' }) // 生成 .gz 文件
  ],
  build: {
    outDir: "../data",
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        dead_code: true,
        passes: 3
      },
      format: {
        comments: false
      }
    },

    rollupOptions: {
      output: {
        // manualChunks: () => 'all', // 所有的chunk都放在一个文件中
        entryFileNames: `[hash:8].js`,          // 8位哈希 (e.g. "3a5b7d2.js")
        chunkFileNames: `[hash:8].js`,          // 所有JS文件
        assetFileNames: `[hash:8][extname]` // 图片/CSS等 (e.g. "a1b2c3d4.css")
      }
    }
  }
})
