<template>
  <div class="setting">
    <t-space direction="vertical" size="large" style="width: 100%">
      <!-- WiFi配置部分 -->
      <t-card title="WiFi 配置" :bordered="false" class="config-card">
        <t-form ref="form" :data="wifiConfig" :rules="rules" @submit="onSubmit">
          <t-form-item label="SSID" name="ssid">
            <t-input v-model="wifiConfig.ssid" :placeholder="wifiConfig.ssid" />
          </t-form-item>

          <t-form-item label="PASS" name="password">
            <t-input v-model="wifiConfig.password" :placeholder="wifiConfig.password" />
          </t-form-item>

          <t-form-item>
            <t-space>
              <t-button theme="primary" type="submit" :disabled="!isConnected || !wifiConfig.ssid">
                发送配置
              </t-button>
            </t-space>
          </t-form-item>
        </t-form>
      </t-card>


    </t-space>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { DataOperation, DataPort, webSocketClient } from '../common';

// 使用全局WebSocketClient实例
const wsClient = webSocketClient;

// 表单引用
const form = ref();

// 响应式状态
const isConnected = ref(false);

// WiFi配置状态
const wifiConfig = reactive({
  ssid: '',
  password: '',
});

// 表单验证规则
const rules = {
  ssid: [
    { required: true, message: '请输入WiFi名称', type: 'error' },
    { min: 1, max: 32, message: 'WiFi名称长度应在1-32个字符之间', type: 'warning' }
  ]
};


// 更新连接状态
const updateConnectionStatus = () => {
  isConnected.value = wsClient.isConnected();
};


// 表单提交处理
const onSubmit = ({ validateResult }: { validateResult: boolean }) => {
  if (validateResult === true)
    connectToWifi();
}

// 连接WiFi
const connectToWifi = () => {
  // 验证连接状态
  if (!wsClient.isConnected()) {
    MessagePlugin.warning("设备未连接...");
    return;
  }

  // 准备WiFi配置消息
  const wifiConfigMessage = {
    port: DataPort.WEB_PORT_CONFIG,
    rw: DataOperation.WRITE,
    ssid: wifiConfig.ssid,
    pass: wifiConfig.password,
  };

  // 发送WiFi配置到ESP32
  wsClient.send(wifiConfigMessage);
};


onMounted(() => {
  // 设置事件监听器
  wsClient.onConnected(() => {
    updateConnectionStatus();
    MessagePlugin.success('WebSocket 已连接');
  });

  wsClient.onDisconnected(() => {
    updateConnectionStatus();
    MessagePlugin.warning('WebSocket 已断开连接');
  });

  wsClient.onMessage((data) => {
    try {
      // 确保数据是字符串类型
      const messageStr = typeof data === 'object' ? JSON.stringify(data) : data.toString();
      const jsonData = JSON.parse(messageStr);

      // 验证数据格式
      if (typeof jsonData === 'object' && jsonData !== null) {
        if (jsonData.ssid && jsonData.pass) {
          wifiConfig.ssid = jsonData.ssid;
          wifiConfig.password = jsonData.pass;
          MessagePlugin.success('WiFi配置已更新');
        }
      }
    } catch (error) {
      console.error('解析WebSocket消息失败:', error);
      MessagePlugin.error('解析设备返回的数据失败');
    }
  });

  /** 发送一个数据同步请求，以从设备读取配置 */
  const requestData = {
    port: DataPort.WEB_PORT_CONFIG,
    rw: DataOperation.READ,
  };
  wsClient.send(requestData);

  // 初始状态更新
  updateConnectionStatus();
});


</script>

<style scoped>
.setting {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.config-card,
.monitor-card {
  margin-bottom: 24px;
}

.status-alert {
  margin-left: 16px;
  flex-grow: 1;
}

.message-section {
  margin: 16px 0;
}

/* 自定义列表样式 */
:deep(.t-list) {
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-medium);
  max-height: 200px;
  overflow-y: auto;
}

:deep(.t-list-item) {
  padding: 8px 16px;
  font-size: 14px;
}

/* 确保表单布局美观 */
:deep(.t-form__item) {
  margin-bottom: 24px;
}

:deep(.t-input),
:deep(.t-select) {
  width: 100%;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .setting {
    padding: 16px;
  }

  :deep(.t-form__item) {
    margin-bottom: 16px;
  }
}
</style>
