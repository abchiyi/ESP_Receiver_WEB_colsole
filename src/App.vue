<template>
  <t-layout ref="layout" class="fullscreen-layout">
    <!-- 导航栏 -->
    <t-header class="nav-header">
      <t-head-menu theme="dark" :value="currentTab" @change="handleMenuChange">
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
      </t-head-menu>
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
import { ref, reactive, onMounted, onBeforeUnmount, markRaw, shallowRef } from "vue";
import Dashboard from "./view/Dashboard.vue";
import Settings from "./view/Setting.vue";
import { webSocketClient } from "./common";

const currentPage = shallowRef(markRaw(Dashboard));
const currentTab = ref('att');// 当前选中的标签页

// 处理导航菜单切换
function handleMenuChange(value: string) {
  currentTab.value = value;

  switch (value) {
    case 'att':
      currentPage.value = markRaw(Dashboard);
      break;

    case 'settings':
      currentPage.value = markRaw(Settings);
      break;
  }
}

// 姿态数据
const attitude = reactive({
  pitch: 0,  // 俯仰角
  roll: 0,   // 横滚角
  yaw: 0     // 偏航角
});

// 屏幕常亮锁
const wakeLock = ref<WakeLockSentinel | null>(null);
// 全屏元素引用
const layout = ref<HTMLElement | null>(null);

// 保持屏幕常亮
async function keepScreenAwake() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock.value = await (navigator as any).wakeLock.request('screen');
      console.log('屏幕常亮已激活');

      // 添加 null 检查
      if (wakeLock.value) {
        wakeLock.value.addEventListener('release', () => {
          console.log('屏幕常亮已释放');
        });
      }
    }
  } catch (err) {
    console.error(`无法保持屏幕常亮: ${err}`);
  }
}

// 组件挂载时
onMounted(() => {
  // 初始化屏幕常亮和全屏
  keepScreenAwake();

  // 初始化WebSocket连接
  // 使用默认URL，也可以从本地存储中获取
  webSocketClient.setUrl('ws://192.168.101.107:81');
  webSocketClient.connect();
  console.log('WebSocket连接已初始化');
});

// 组件卸载时
onBeforeUnmount(() => {
  // 释放屏幕常亮锁
  if (wakeLock.value) {
    wakeLock.value.release().then(() => {
      wakeLock.value = null;
    });
  }

  // 断开WebSocket连接
  webSocketClient.disconnect();
  console.log('WebSocket连接已断开');
});


</script>

<style>
body,
.fullscreen-layout {
  /* width: 100vw; */
  /* height: 100vh; */
  min-height: 100vh;
  margin: 0;
  padding: 0;
  /* overflow: hidden; */
  /* background: #000; */
  display: flex;
  flex-direction: column;
}

.nav-header {
  flex: none;
  /* background: #1a1a1a; */
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
</style>
