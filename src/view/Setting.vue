<template>
  <div class="setting">
    <t-space direction="vertical" size="large" style="width: 100%">
      <!-- WiFi配置部分 -->
      <t-card title="配置" :bordered="false" class="config-card">
        <t-form ref="form" :data="Config" :rules="rules" @submit="onSubmit">
          <t-form-item label="SSID" name="ssid">
            <t-input v-model="Config.ssid" :placeholder="Config.ssid" />
          </t-form-item>

          <t-form-item label="PASS" name="password">
            <t-input v-model="Config.password" :placeholder="Config.password" />
          </t-form-item>

          <t-form-item label="控制模式" name="control_mode">
            <t-radio-group v-model="Config.control_mode">
              <t-radio :value="0">从机模式 (Slave)</t-radio>
              <t-radio :value="1">主机模式 (Master)</t-radio>
            </t-radio-group>
          </t-form-item>

          <t-form-item label="无线模式" name="radio_mode">
            <t-select v-model="Config.radio_mode">
              <t-option :value="radio_mode.ESP_NOW" label="ESP-NOW" />
            </t-select>
          </t-form-item>

          <t-form-item>
            <t-space>
              <t-button theme="primary" type="submit" :disabled="!isConnected || !Config.ssid">
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
import { MessagePlugin, Select as TSelect, Option as TOption } from 'tdesign-vue-next';
import { DataOperation, DataPort, webSocketClient } from '../common';


enum radio_mode {
  ESP_NOW,
  __radio_mode_max
}

// 使用全局WebSocketClient实例
const wsClient = webSocketClient;

// 表单引用
const form = ref();

// 响应式状态
const isConnected = ref(false);

// 设备配置状态
const Config = reactive({
  ssid: '',
  password: '',
  control_mode: 0, // 0: slave模式, 1: master模式
  radio_mode: radio_mode.ESP_NOW, // 默认使用ESP_NOW模式
});

import type { FormRule, SubmitContext } from 'tdesign-vue-next';

// 表单验证规则
const rules = {
  ssid: [
    { required: true, message: '请输入WiFi名称', type: 'error' as const },
    { min: 1, max: 32, message: 'WiFi名称长度应在1-32个字符之间', type: 'warning' as const }
  ] as FormRule[]
};

// 更新连接状态
const updateConnectionStatus = () => {
  isConnected.value = wsClient.isConnected();
};


// 表单提交处理
const onSubmit = (context: any) => {
  if (context.validateResult === true)
    saveConfig();
}

// 保存设备配置
const saveConfig = () => {
  // 验证连接状态
  if (!wsClient.isConnected()) {
    MessagePlugin.warning("设备未连接...");
    return;
  }

  // 准备设备配置消息
  const configMessage = {
    port: DataPort.WEB_PORT_CONFIG,
    rw: DataOperation.WRITE,
    ssid: Config.ssid,
    pass: Config.password,
    control_mode: Config.control_mode,
    radio_mode: Config.radio_mode,
  };

  // 发送配置到ESP32
  wsClient.send(configMessage);
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


      console.log(data);
      // 验证数据格式
      if (typeof jsonData === 'object' && jsonData !== null) {
        if (jsonData.ssid && jsonData.pass) {
          Config.ssid = jsonData.ssid;
          Config.password = jsonData.pass;
          Config.control_mode = jsonData.control_mode !== undefined ? jsonData.control_mode : 0; // 如果control_mode未定义，默认为slave模式(0)
          Config.radio_mode = jsonData.radio_mode !== undefined ? jsonData.radio_mode : radio_mode.ESP_NOW; // 如果radio_mode未定义，默认为ESP_NOW模式
          MessagePlugin.success('设备配置已更新');
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

  // 延迟一秒后检查是否收到了mode值，如果没有则再次请求
  setTimeout(() => {
    if (Config.control_mode === undefined) {
      wsClient.send(requestData);
    }
  }, 1000);

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
