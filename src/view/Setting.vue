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
            <t-input v-model="Config.pass" :placeholder="Config.pass" />
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

          <t-form-item label="ROLL" name="ROLL">
            <t-select v-model="Config.ROLL" :options="getJoyInputOptions()" />
            <t-switch v-model="Config.ROLL_FLIP" style="margin-left: 10px">
              <template #label>R</template>
            </t-switch>
          </t-form-item>

          <t-form-item label="PITCH" name="PITCH">
            <t-select v-model="Config.PITCH" :options="getJoyInputOptions()" />
            <t-switch v-model="Config.PITCH_FLIP" style="margin-left: 10px">
              <template #label>R</template>
            </t-switch>
          </t-form-item>

          <t-form-item label="YAW" name="YAW">
            <t-select v-model="Config.YAW" :options="getJoyInputOptions()" />
            <t-switch v-model="Config.YAW_FLIP" style="margin-left: 10px">
              <template #label>R</template>
            </t-switch>
          </t-form-item>

          <t-form-item label="THRUST" name="THRUST">
            <t-select v-model="Config.THRUST" :options="getJoyInputOptions()" />
            <t-switch v-model="Config.THRUST_FLIP" style="margin-left: 10px">
              <template #label>R</template>
            </t-switch>
          </t-form-item>

          <t-form-item label="Breaker A" name="breaker[0]">
            <t-select v-model="Config.breaker[0]" :options="getXboxInputOptions()" />
            <t-switch v-model="Config.breaker_FLIP[0]" style="margin-left: 10px">
              <template #label>R</template>
            </t-switch>
          </t-form-item>

          <t-form-item label="Breaker B" name="breaker[1]">
            <t-select v-model="Config.breaker[1]" :options="getXboxInputOptions()" />
            <t-switch v-model="Config.breaker_FLIP[1]" style="margin-left: 10px">
              <template #label>R</template>
            </t-switch>
          </t-form-item>

          <t-form-item label="Reverse" name="reverse">
            <t-select v-model="Config.Reverse" :options="getXboxInputOptions()" />
            <t-switch v-model="Config.Reverse_FLIP" style="margin-left: 10px">
              <template #label>R</template>
            </t-switch>
          </t-form-item>


          <t-space>
            <t-button theme="primary" type="submit" :disabled="!isConnected || !Config.ssid">
              发送配置
            </t-button>
          </t-space>
        </t-form>
      </t-card>


    </t-space>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { MessagePlugin, Select as TSelect, Option as TOption } from 'tdesign-vue-next';
import { DataOperation, DataPort, webSocketClient } from '../common';


// 无线模式枚举
enum radio_mode {
  ESP_NOW,
  __radio_mode_max
}

// Xbox输入按钮枚举
enum XBOX_INPUT {
  None, // no button
  btnA,
  btnB,
  btnX,
  btnY,
  btnLB,
  btnRB,
  btnSelect,
  btnStart,
  btnXbox,
  btnLS,
  btnRS,
  btnShare,
  btnDirUp,
  btnDirRight,
  btnDirDown,
  btnDirLeft,
  XBOX_BUTTON_MAX, // max value
  joyLHori = (XBOX_BUTTON_MAX + 1),
  joyLVert,
  joyRHori,
  joyRVert,
  trigLT,
  trigRT,
  XBOX_HAT_MAX // max value for joystick axes
};

// 使用全局WebSocketClient实例
const wsClient = webSocketClient;

// 表单引用
const form = ref();

// WebSocket状态
const isConnected = ref(false);

// 设备配置
const Config = reactive({
  ssid: '',
  pass: '',
  control_mode: 0, // 0: slave模式, 1: master模式
  radio_mode: radio_mode.ESP_NOW, // 默认使用ESP_NOW模式
  ROLL: XBOX_INPUT.None,
  PITCH: XBOX_INPUT.None,
  YAW: XBOX_INPUT.None,
  THRUST: XBOX_INPUT.None,
  breaker: [XBOX_INPUT.None, XBOX_INPUT.None],
  Reverse: XBOX_INPUT.None,
  ROLL_FLIP: false,
  PITCH_FLIP: false,
  YAW_FLIP: false,
  THRUST_FLIP: false,
  breaker_FLIP: [false, false],
  Reverse_FLIP: false
});

import type { FormRule, } from 'tdesign-vue-next';

// 生成XBOX_INPUT选项
const getXboxInputOptions = () => {
  const buttonLabels: Record<string, string> = {
    'None': '无',
    'btnA': 'A按钮',
    'btnB': 'B按钮',
    'btnX': 'X按钮',
    'btnY': 'Y按钮',
    'btnLB': '左肩按钮',
    'btnRB': '右肩按钮',
    'btnSelect': '选择按钮',
    'btnStart': '开始按钮',
    'btnXbox': 'Xbox按钮',
    'btnLS': '左摇杆按钮',
    'btnRS': '右摇杆按钮',
    'btnShare': '分享按钮',
    'btnDirUp': '方向上',
    'btnDirRight': '方向右',
    'btnDirDown': '方向下',
    'btnDirLeft': '方向左',
    'joyLHori': '左摇杆水平',
    'joyLVert': '左摇杆垂直',
    'joyRHori': '右摇杆水平',
    'joyRVert': '右摇杆垂直',
    'trigLT': '左扳机',
    'trigRT': '右扳机'
  };

  return Object.keys(XBOX_INPUT)
    .filter(key => typeof XBOX_INPUT[key as keyof typeof XBOX_INPUT] === 'number'
      && ['XBOX_BUTTON_MAX', 'XBOX_HAT_MAX'].indexOf(key) == -1)
    .map(key => ({ label: buttonLabels[key] || key, value: XBOX_INPUT[key as keyof typeof XBOX_INPUT] }));
};

const getJoyInputOptions = () => {
  const axisLabels: Record<string, string> = {
    'None': '无',
    'joyLHori': '左摇杆水平',
    'joyLVert': '左摇杆垂直',
    'joyRHori': '右摇杆水平',
    'joyRVert': '右摇杆垂直',
    'trigLT': '左扳机',
    'trigRT': '右扳机'
  };

  return Object.keys(XBOX_INPUT)
    .filter(key => typeof XBOX_INPUT[key as keyof typeof XBOX_INPUT] === 'number'
      && ['None', 'joyLHori', 'joyLVert', 'joyRHori', 'joyRVert', 'trigLT', 'trigRT'].includes(key))
    .map(key => ({ label: axisLabels[key] || key, value: XBOX_INPUT[key as keyof typeof XBOX_INPUT] }));
};

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
    ...Config
  };

  // 发送配置到ESP32
  wsClient.send(configMessage);
};

// WebSocket消息事件处理 Callback
function onMessage(data: any) {
  try {
    // 确保数据是字符串类型
    const messageStr = typeof data === 'object' ? JSON.stringify(data) : data.toString();
    const jsonData = JSON.parse(messageStr);


    console.log(data);
    // 验证数据格式
    if (typeof jsonData === 'object' && jsonData !== null) {

      Config.ssid = jsonData.ssid != undefined ? jsonData.ssid : "";
      Config.pass = jsonData.pass != undefined ? jsonData.pass : "";

      // 如果control_mode未定义，默认为slave模式(0)
      Config.control_mode = jsonData.control_mode !== undefined
        ? jsonData.control_mode : 0;

      // 如果radio_mode未定义，默认为ESP_NOW模式
      Config.radio_mode = jsonData.radio_mode !== undefined
        ? jsonData.radio_mode
        : radio_mode.ESP_NOW;

      Config.ROLL = jsonData.ROLL !== undefined
        ? jsonData.ROLL
        : XBOX_INPUT.None;

      Config.PITCH = jsonData.PITCH !== undefined
        ? jsonData.PITCH
        : XBOX_INPUT.None;

      Config.YAW = jsonData.YAW !== undefined
        ? jsonData.YAW
        : XBOX_INPUT.None;

      Config.THRUST = jsonData.THRUST !== undefined
        ? jsonData.THRUST
        : XBOX_INPUT.None;

      Config.breaker = jsonData.breaker !== undefined
        ? jsonData.breaker
        : [XBOX_INPUT.None, XBOX_INPUT.None];

      Config.Reverse = jsonData.Reverse !== undefined
        ? jsonData.Reverse
        : XBOX_INPUT.None;

      Config.ROLL_FLIP = jsonData.ROLL_FLIP !== undefined
        ? Boolean(jsonData.ROLL_FLIP)
        : false;

      Config.PITCH_FLIP = jsonData.PITCH_FLIP !== undefined
        ? Boolean(jsonData.PITCH_FLIP)
        : false;

      Config.YAW_FLIP = jsonData.YAW_FLIP !== undefined
        ? Boolean(jsonData.YAW_FLIP)
        : false;

      Config.THRUST_FLIP = jsonData.THRUST_FLIP !== undefined
        ? Boolean(jsonData.THRUST_FLIP)
        : false;

      Config.breaker_FLIP = jsonData.breaker_FLIP !== undefined
        ? jsonData.breaker_FLIP.map((item: any) => Boolean(item))
        : [false, false];

      Config.Reverse_FLIP = jsonData.Reverse_FLIP !== undefined
        ? Boolean(jsonData.Reverse_FLIP)
        : false;


      MessagePlugin.success('设备配置已更新');
    }
  } catch (error) {
    console.error('解析WebSocket消息失败:', error);
    MessagePlugin.error('解析设备返回的数据失败');
  }
}

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

  wsClient.onMessage(onMessage); // 注册消息监听器


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
