import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import viteImagemin from 'vite-plugin-imagemin'
import viteCompression from 'vite-plugin-compression'
import { visualizer } from 'rollup-plugin-visualizer'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { TDesignResolver } from 'unplugin-vue-components/resolvers'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: true, // 监听所有地址，包括 LAN 和公共地址
    port: 5173, // 默认端口
  },
  plugins: [
    vue(),
    // 自动导入组件
    Components({
      resolvers: [
        TDesignResolver({
          library: 'vue-next'
        })
      ],
      dts: 'src/components.d.ts'
    }),
    // 自动导入 API
    AutoImport({
      resolvers: [
        TDesignResolver({
          library: 'vue-next'
        })
      ],
      imports: ['vue', 'vue-router'],
      dts: 'src/auto-imports.d.ts'
    }),
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
    viteCompression({
      algorithm: 'gzip',
      threshold: 1024, // 只有大于1kb的文件才会被压缩
      verbose: true,
      deleteOriginFile: false // 保留原文件
    }),
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true
    })
  ],
  build: {
    outDir: "../data",
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        dead_code: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 3,
        reduce_vars: true,
        reduce_funcs: true
      },
      format: {
        comments: false
      },
      toplevel: true,
      keep_classnames: false,
      keep_fnames: false
    },

    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue'],
          'ui': ['tdesign-vue-next', 'tdesign-icons-vue-next']
        },
        entryFileNames: 'assets/[name].[hash:8].js',
        chunkFileNames: 'assets/[name].[hash:8].js',
        assetFileNames: 'assets/[name].[hash:8][extname]',
        compact: true,
        generatedCode: {
          constBindings: true,
          objectShorthand: true
        }
      }
    },
    // 启用CSS代码分割
    cssCodeSplit: true,
    // CSS压缩
    cssMinify: true,
    // 设置警告大小限制（单位：KB）
    chunkSizeWarningLimit: 500,
    // 配置资源文件大小限制
    assetsInlineLimit: 4096,
    // 禁用源码映射以减小体积
    sourcemap: false,
    // 启用构建性能报告
    reportCompressedSize: true,
    // 启用依赖优化
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    },
    // 启用模块预加载
    modulePreload: {
      polyfill: true
    }
  }
})
