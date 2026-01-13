<template>
  <div class="app-shell">
    <div class="floating-bg">
      <canvas ref="bgCanvas" class="floating-canvas"></canvas>
    </div>

    <t-layout ref="layout" class="fullscreen-layout">

      <!-- 导航栏 -->
      <t-header class="nav-header" :style="getNavHeaderStyle">
        <div class="header-container">
          <t-head-menu theme="dark" class="nav-menu">


            <template #operations>
              <div class="ws-status-container">
                <t-tooltip :content="wsStatus.message" :theme="wsStatus.theme" placement="bottom">
                  <div class="ws-status-indicator" :style="{ backgroundColor: wsStatus.iconColor }"></div>
                </t-tooltip>
                <t-input-adornment>
                  <t-input clearable v-model="wsAddress" placeholder="WebSocket地址" :status="wsStatus.type"
                    @blur="updateWsAddress" />
                </t-input-adornment>
              </div>
            </template>

          </t-head-menu>
        </div>
      </t-header>

      <!-- 内容区域 -->
      <t-content class="fullscreen-content">
        <Console />
      </t-content>
    </t-layout>
  </div>
</template>

<script setup lang="ts">
const PORT_WS = 81
import { ref, reactive, onMounted, onBeforeUnmount, markRaw, shallowRef, computed } from "vue";
import Console from "./view/Console.vue";
import { webSocketClient } from "./common";

type ShapeKind = "circle" | "rounded-rect" | "capsule";

type FloatingShape = {
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  vx: number;
  vy: number;
  rotation: number;
  vr: number;
  color: string;
  opacity: number;
};

const currentPage = shallowRef(markRaw(Console));

// 处理导航菜单切换 - 已移除，现在直接显示 Settings 页面

// 全屏元素引用
const layout = ref<HTMLElement | null>(null);
const bgCanvas = ref<HTMLCanvasElement | null>(null);
const animationId = ref<number | null>(null);
const shapes = ref<FloatingShape[]>([]);
const viewSize = reactive({ width: window.innerWidth, height: window.innerHeight });
const palette = [
  "#7ad7f0",
  "#7bdcb5",
  "#f7e08d",
  "#f9c784",
  "#c4b1d4"
];

// WebSocket地址和状态
const wsAddress = ref('');
const wsStatus = reactive({
  type: 'default' as 'default' | 'success' | 'warning' | 'error',
  message: '未连接',
  theme: 'default' as 'default' | 'light' | 'primary' | 'warning' | 'danger',
  iconColor: 'var(--td-warning-color)',
  loading: false
});

// 获取默认的WebSocket地址（当前页面地址的81端口）
const getDefaultWsAddress = (): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:${PORT_WS}`;
};

// 更新WebSocket状态
const updateWsStatus = (
  type: 'default' | 'success' | 'warning' | 'error',
  message: string,
  theme: 'default' | 'light' | 'primary' | 'warning' | 'danger' = 'default',
  isLoading: boolean = false
) => {
  wsStatus.type = type;
  wsStatus.message = message;
  wsStatus.theme = theme;
  wsStatus.loading = isLoading;

  switch (type) {
    case 'success':
      wsStatus.iconColor = 'var(--td-success-color)';
      break;
    case 'error':
      wsStatus.iconColor = 'var(--td-error-color)';
      break;
    case 'warning':
      wsStatus.iconColor = 'var(--td-warning-color)';
      break;
    default:
      wsStatus.iconColor = 'var(--td-text-color-secondary)';
  }
};

// 更新WebSocket地址
const updateWsAddress = () => {
  if (!wsAddress.value) {
    updateWsStatus('error', '请输入WebSocket地址', 'danger');
    return;
  }

  try {
    // 验证WebSocket URL格式
    // new URL(wsAddress.value);

    // if (!wsAddress.value.startsWith('ws://') && !wsAddress.value.startsWith('wss://')) {
    //   throw new Error('无效的WebSocket URL');
    // }

    // 检查并自动添加ws://前缀
    if (!wsAddress.value.startsWith('ws://')) {
      wsAddress.value = 'ws://' + wsAddress.value;
    }

    console.log('WebSocket地址已更新:', wsAddress.value);

    updateWsStatus('default', '正在连接...', 'primary', true);
    webSocketClient.disconnect(); // 先断开现有连接
    webSocketClient.setUrl(wsAddress.value);



    // 设置连接超时
    const timeoutId = setTimeout(() => {
      if (wsStatus.loading) {
        updateWsStatus('error', '连接超时', 'danger');
      }
    }, 5000);

    // 添加连接事件监听器
    webSocketClient.onConnected(() => {
      clearTimeout(timeoutId);
      updateWsStatus('success', '已连接', 'primary');
      localStorage.setItem('wsAddress', wsAddress.value);
    });

    webSocketClient.onDisconnected(() => {
      clearTimeout(timeoutId);
      updateWsStatus('error', '连接已断开', 'danger');
    });

    webSocketClient.onError((error) => {
      clearTimeout(timeoutId);
      updateWsStatus('error', `连接错误: ${'message' in error ? (error as any).message : error.type || '未知错误'}`, 'danger');
    });

    webSocketClient.connect();
  } catch (error) {
    const msg = typeof error === 'object' && error !== null && 'message' in error
      ? (error as { message: string }).message
      : String(error);
    updateWsStatus('error', `无效的WebSocket地址: ${msg}`, 'danger');
  }
};

// 组件挂载时
onMounted(() => {
  initFloatingShapes();
  window.addEventListener('resize', handleResize);

  // 初始化WebSocket连接
  const savedAddress = localStorage.getItem('wsAddress');
  wsAddress.value = savedAddress || getDefaultWsAddress();

  // 设置初始状态
  updateWsStatus('default', '正在初始化...', 'primary');

  // 添加WebSocket事件监听器
  webSocketClient.onConnected(() => {
    updateWsStatus('success', '已连接', 'primary');
  });

  webSocketClient.onDisconnected(() => {
    updateWsStatus('error', '连接已断开', 'danger');
  });

  webSocketClient.onError((error) => {
    updateWsStatus('error', `连接错误: ${'message' in error ? (error as any).message : error.type || '未知错误'}`, 'danger');
  });

  // 初始化连接
  webSocketClient.setUrl(wsAddress.value);
  webSocketClient.connect();
  updateWsStatus('default', '正在连接...', 'primary', true);
  console.log('WebSocket连接已初始化:', wsAddress.value);
});

// 组件卸载时
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  if (animationId.value !== null) {
    cancelAnimationFrame(animationId.value);
  }

  // 断开WebSocket连接
  webSocketClient.disconnect();
  console.log('WebSocket连接已断开');
});

// WebSocket状态对应的导航栏背景色
const getNavHeaderStyle = computed(() => {
  let backgroundColor = 'unset'; // 默认深色背景

  if (wsStatus.loading) {
    backgroundColor = '--td-warning-color'; // 加载中 - 深黄色
  } else {
    switch (wsStatus.type) {
      case 'success':
        backgroundColor = '--td-success-color'; // 连接成功 - 深绿色
        break;
      case 'error':
        backgroundColor = '--td-error-color'; // 连接错误 - 深红色
        break;
      case 'warning':
        backgroundColor = '--td-warning-color'; // 警告状态 - 深黄色
        break;
    }
  }

  return { backgroundColor };
});

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const handleResize = () => {
  viewSize.width = window.innerWidth;
  viewSize.height = window.innerHeight;
  setupCanvas();
  shapes.value.forEach((shape) => {
    const halfW = shape.width / 2;
    const halfH = shape.height / 2;
    shape.x = clamp(shape.x, halfW, viewSize.width - halfW);
    shape.y = clamp(shape.y, halfH, viewSize.height - halfH);
  });
};

const initFloatingShapes = () => {
  setupCanvas();
  shapes.value = buildShapes(18);
  startAnimation();
};

const setupCanvas = () => {
  const canvas = bgCanvas.value;
  if (!canvas) return;
  const ratio = window.devicePixelRatio || 1;
  const width = viewSize.width;
  const height = viewSize.height;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
};

const buildShapes = (count: number): FloatingShape[] => {
  const shapesList: FloatingShape[] = [];
  for (let i = 0; i < count; i += 1) {
    const kind = pickShapeKind();
    const width = 60 + Math.random() * 120;
    const height = kind === "circle" ? width : 40 + Math.random() * 80;
    const radius = Math.min(24 + Math.random() * 32, width / 2, height / 2);
    shapesList.push({
      kind,
      width,
      height,
      radius,
      x: Math.random() * viewSize.width,
      y: Math.random() * viewSize.height,
      vx: (Math.random() * 0.8 + 0.2) * (Math.random() > 0.5 ? 1 : -1),
      vy: (Math.random() * 0.8 + 0.2) * (Math.random() > 0.5 ? 1 : -1),
      rotation: Math.random() * Math.PI,
      vr: (Math.random() * 0.003 + 0.001) * (Math.random() > 0.5 ? 1 : -1),
      color: palette[Math.floor(Math.random() * palette.length)],
      opacity: 0.08 + Math.random() * 0.08
    });
  }
  return shapesList;
};

const pickShapeKind = (): ShapeKind => {
  const rand = Math.random();
  if (rand < 0.34) return "circle";
  if (rand < 0.67) return "rounded-rect";
  return "capsule";
};

const startAnimation = () => {
  if (animationId.value !== null) {
    cancelAnimationFrame(animationId.value);
  }
  const loop = () => {
    drawFrame();
    animationId.value = requestAnimationFrame(loop);
  };
  animationId.value = requestAnimationFrame(loop);
};

const drawFrame = () => {
  const canvas = bgCanvas.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const ratio = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  shapes.value.forEach((shape) => {
    updateShape(shape);
    drawShape(ctx, shape);
  });
};

const updateShape = (shape: FloatingShape) => {
  const halfW = shape.width / 2;
  const halfH = shape.height / 2;
  shape.x += shape.vx;
  shape.y += shape.vy;
  shape.rotation += shape.vr;

  if (shape.x - halfW < 0 || shape.x + halfW > viewSize.width) {
    shape.vx *= -1;
    shape.x = clamp(shape.x, halfW, viewSize.width - halfW);
  }
  if (shape.y - halfH < 0 || shape.y + halfH > viewSize.height) {
    shape.vy *= -1;
    shape.y = clamp(shape.y, halfH, viewSize.height - halfH);
  }
};

const drawShape = (ctx: CanvasRenderingContext2D, shape: FloatingShape) => {
  ctx.save();
  ctx.translate(shape.x, shape.y);
  ctx.rotate(shape.rotation);
  ctx.globalAlpha = shape.opacity;
  ctx.fillStyle = shape.color;

  switch (shape.kind) {
    case "circle":
      ctx.beginPath();
      ctx.arc(0, 0, shape.width / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "capsule":
      drawRoundedRect(ctx, -shape.width / 2, -shape.height / 2, shape.width, shape.height, shape.height / 2);
      break;
    default:
      drawRoundedRect(ctx, -shape.width / 2, -shape.height / 2, shape.width, shape.height, shape.radius);
  }

  ctx.restore();
};

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
};


</script>

<style>
body,
.fullscreen-layout {
  min-height: 100vh;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.app-shell {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: radial-gradient(120% 120% at 20% 20%, #0f1a2b, #080d19 60%, #050812);
}

.floating-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  filter: blur(0.4px) saturate(110%);
}

.floating-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fullscreen-content {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 !important;
  overflow: hidden;
  position: relative;
  z-index: 1;
}

/* 移除TDesign的默认内边距 */
:deep(.t-layout) {
  padding: 0 !important;
}

:deep(.t-content) {
  padding: 0 !important;
}

/* 导航栏样式 */
:deep(.t-head-menu) {
  border-bottom: none !important;
}

:deep(.t-menu__item) {
  color: #fff !important;
}

:deep(.t-menu__item.t-is-active) {
  color: #0052d9 !important;
  background-color: rgba(0, 82, 217, 0.1) !important;
}

:deep(.t-layout) {
  background: transparent;
  position: relative;
  z-index: 1;
}

/* 页面过渡效果 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* WebSocket状态指示器样式 */
.ws-status-container {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 var(--td-comp-margin-xs);
  height: 100%;
  margin-right: 8px;
}

.ws-status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  transition: background-color 0.3s ease;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
  margin: 0 4px;
}

/* 导航栏颜色过渡效果 */
.nav-header {
  transition: background-color 0.5s ease;
}

/* 暗色主题适配 */
:root[theme-mode="dark"] {
  .ws-status-container {
    background: var(--td-gray-color-13);
  }
}
</style>
