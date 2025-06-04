<template>
  <t-layout ref="layout" class="fullscreen-layout">
    <!-- 导航栏 -->
    <t-header class="nav-header" :style="getNavHeaderStyle">
      <div class="header-container">
        <t-head-menu theme="dark" :value="currentTab" @change="handleMenuChange" class="nav-menu">
          <t-menu-item value="att" class="nav-item">
            <template #icon>
              <t-icon name="dashboard" />
            </template>
            仪表
          </t-menu-item>
          <t-menu-item value="settings" class="nav-item">
            <template #icon>
              <t-icon name="setting" />
            </template>
            设置
          </t-menu-item>


          <template #operations>
            <div class="ws-status-container">
              <t-tooltip :content="wsStatus.message" :theme="wsStatus.theme" placement="bottom">
                <div class="ws-status-indicator" :style="{ backgroundColor: wsStatus.iconColor }"></div>
              </t-tooltip>
              <t-input-adornment prepend="ws://">
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
      <!-- 使用transition组件添加过渡效果 -->
      <transition name="fade" mode="out-in">
        <component :is="currentPage" v-if="currentPage" />
      </transition>
    </t-content>
  </t-layout>
</template>

<script setup lang="ts">
const PORT_WS = 81
import { ref, reactive, onMounted, onBeforeUnmount, markRaw, shallowRef, computed } from "vue";
import Dashboard from "./view/Dashboard.vue";
import Settings from "./view/Setting.vue";
import { webSocketClient } from "./common";

const currentPage = shallowRef(markRaw(Dashboard));
const currentTab = ref('att');// 当前选中的标签页

// 处理导航菜单切换
function handleMenuChange(value: string | number) {
  currentTab.value = String(value);

  switch (value) {
    case 'att':
      currentPage.value = markRaw(Dashboard);
      break;

    case 'settings':
      currentPage.value = markRaw(Settings);
      break;
  }
}

// 全屏元素引用
const layout = ref<HTMLElement | null>(null);

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
