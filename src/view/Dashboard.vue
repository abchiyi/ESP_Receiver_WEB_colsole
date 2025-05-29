<template>
  <div class="dashboard">
    <div class="websocket-status">
      <div class="status-indicator" :class="{ connected: isConnected }"></div>
      <span>WebSocket: {{ connectionStatus }}</span>
      <button @click="toggleConnection">{{ isConnected ? '断开连接' : '连接' }}</button>
    </div>

    <div class="message-section">
      <div class="message-input">
        <input v-model="messageToSend" placeholder="输入要发送的消息" />
        <button @click="sendMessage" :disabled="!isConnected">发送</button>
      </div>

      <div class="received-messages">
        <h3>接收到的消息:</h3>
        <div v-if="messages.length === 0" class="no-messages">暂无消息</div>
        <ul v-else>
          <li v-for="(msg, index) in messages" :key="index">{{ msg }}</li>
        </ul>
      </div>
    </div>

    <AttitudeMeter />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import AttitudeMeter from '../component/AttitudeMeter.vue';
import { webSocketClient } from '../common';

// 使用全局WebSocketClient实例
const wsClient = webSocketClient;

// 响应式状态
const isConnected = ref(false);
const messages = ref<string[]>([]);
const messageToSend = ref('');

// 计算属性
const connectionStatus = computed(() => {
  return isConnected.value ? '已连接' : '未连接';
});

// 方法
const updateConnectionStatus = () => {
  isConnected.value = wsClient.isConnected();
};

const toggleConnection = () => {
  if (isConnected.value) {
    wsClient.disconnect();
  } else {
    wsClient.connect();
  }
};

const sendMessage = () => {
  if (messageToSend.value.trim() && isConnected.value) {
    wsClient.send(messageToSend.value);
    messageToSend.value = '';
  }
};

// 生命周期钩子
onMounted(() => {
  // 设置WebSocket事件回调
  wsClient.onConnected(() => {
    updateConnectionStatus();
    messages.value.push('WebSocket已连接');
  });

  wsClient.onDisconnected(() => {
    updateConnectionStatus();
    messages.value.push('WebSocket已断开连接');
  });

  wsClient.onError((error) => {
    updateConnectionStatus();
    messages.value.push(`WebSocket错误: ${error}`);
  });

  wsClient.onMessage((data) => {
    const message = typeof data === 'object' ? JSON.stringify(data) : data.toString();
    messages.value.push(`收到: ${message}`);
  });

  // 更新连接状态
  updateConnectionStatus();
});

// 移除onUnmounted钩子，不在组件卸载时断开连接
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
}

.websocket-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: #ff4d4f;
}

.status-indicator.connected {
  background-color: #52c41a;
}

.message-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.message-input {
  display: flex;
  gap: 10px;
}

.message-input input {
  flex-grow: 1;
  padding: 8px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
}

button {
  padding: 8px 16px;
  background-color: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background-color: #d9d9d9;
  cursor: not-allowed;
}

.received-messages {
  margin-top: 10px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.received-messages h3 {
  margin-top: 0;
  margin-bottom: 10px;
}

.no-messages {
  color: #999;
  font-style: italic;
}

ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

li {
  padding: 5px 0;
  border-bottom: 1px solid #eee;
}

li:last-child {
  border-bottom: none;
}
</style>
