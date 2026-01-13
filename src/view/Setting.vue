<template>
  <div class="setting">
    <t-card title="监控" class="chart-card">
      <div class="chart-toolbar">
        <t-switch v-model="demoMode" size="small" />
        <span class="toolbar-label">演示数据</span>
      </div>
      <Waveform :values="channelOutputs" :height="240" :stacked="false" />
    </t-card>
    <t-row :gutter="[16, 16]" class="layout-row with-gap">
      <t-col :xs="12" :sm="6" :lg="4" class="card-col">
        <t-card title="基本参数"></t-card>
      </t-col>
      <t-col :xs="12" :sm="6" :lg="4" class="card-col">
        <t-card title="通信设置"></t-card>
      </t-col>
    </t-row>



    <t-row :gutter="[16, 16]" class="channel-row with-gap">
      <t-col v-for="channel in channelSettings" :key="channel.id" :xs="12" :sm="6" :lg="4" class="card-col">
        <channel-set :title="`通道 ${channel.name}`" :model-value="channel"
          @update:modelValue="(val) => updateChannel(val.id, val)" @save="handleChannelSave" />
      </t-col>
    </t-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, watch, onBeforeUnmount } from 'vue';
import { MessagePlugin, Select as TSelect, Option as TOption } from 'tdesign-vue-next';
import { DataOperation, DataPort, webSocketClient } from '../common';
import ChannelSet from '../component/channelSet.vue';
import Waveform from '../component/Waveform.vue';

type ChannelSetting = {
  id: number;
  name: string;
  min: number;
  center: number;
  max: number;
  reverse: boolean;
  expo: number;
  rate: number;
};



// 无线模式枚举
enum radio_mode {
  ESP_NOW,
  BT_CONTROLLER,
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

// 4通道输出（-1000 ~ 1000）
const channelOutputs = ref<number[]>([0, 0, 0, 0]);

// 演示数据开关与生成器
const demoMode = ref(false);
let demoTimer: number | null = null;
let theta = 0;

function startDemo() {
  stopDemo();
  demoTimer = window.setInterval(() => {
    theta += 0.08;
    const t = theta;
    const ch1 = Math.sin(t) * 900;
    const ch2 = Math.cos(t * 0.9 + 0.4) * 800;
    const ch3 = Math.sin(t * 1.2 + 1.2) * 700;
    const ch4 = (Math.sin(t * 0.6) + Math.sin(t * 2.2 + 0.7)) * 250;
    channelOutputs.value = [ch1, ch2, ch3, ch4];
  }, 33);
}

function stopDemo() {
  if (demoTimer !== null) {
    clearInterval(demoTimer);
    demoTimer = null;
  }
}

watch(demoMode, (v) => {
  if (v) startDemo(); else stopDemo();
});

// 表单引用
const form = ref();

// WebSocket状态
const isConnected = ref(false);

// 设备配置
const Config = reactive({
  ssid: '',
  pass: '',
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

const channelSettings = ref<ChannelSetting[]>(buildDefaultChannels());

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

const getRadioModeOptions = () => {
  const modeLabels: Record<string, string> = {
    'ESP_NOW': 'ESP-NOW'
  };

  return Object.keys(radio_mode)
    .filter(key => typeof radio_mode[key as keyof typeof radio_mode] === 'number'
      && key !== '__radio_mode_max')
    .map(key => ({ label: modeLabels[key] || key, value: radio_mode[key as keyof typeof radio_mode] }));
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

const updateChannel = (id: number, value: ChannelSetting) => {
  channelSettings.value = channelSettings.value.map((ch) => (ch.id === id ? { ...value } : ch));
};

const handleChannelSave = (value: ChannelSetting) => {
  updateChannel(value.id, value);
  MessagePlugin.success(`通道 ${value.name} 配置已保存`);
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

      // 解析输出通道波形数据（尽量兼容多种字段）
      const next = parseChannelOutputs(jsonData);
      if (next && !demoMode.value) {
        channelOutputs.value = next;
      }
    }
  } catch (error) {
    console.error('解析WebSocket消息失败:', error);
    MessagePlugin.error('解析设备返回的数据失败');
  }
}

// 尝试从设备消息中解析4通道输出，返回[-1000,1000]范围数组
function parseChannelOutputs(payload: any): number[] | null {
  if (!payload || typeof payload !== 'object') return null;

  // 1) 数组形式：channels / outputs / out
  const arrKey = ['channels', 'outputs', 'out'];
  for (const k of arrKey) {
    const v = payload[k];
    if (Array.isArray(v) && v.length >= 4) {
      return [toNum(v[0]), toNum(v[1]), toNum(v[2]), toNum(v[3])].map(clamp1000);
    }
  }

  // 2) 独立字段：CH1..CH4 或 ch1..ch4
  const fields = ['CH1', 'CH2', 'CH3', 'CH4'];
  const lower = ['ch1', 'ch2', 'ch3', 'ch4'];
  const a: number[] = [];
  for (let i = 0; i < 4; i++) {
    let v: any = undefined;
    if (payload.hasOwnProperty(fields[i])) v = payload[fields[i]];
    else if (payload.hasOwnProperty(lower[i])) v = payload[lower[i]];
    else return null; // 缺少字段则放弃
    a.push(clamp1000(toNum(v)));
  }
  return a.length === 4 ? a : null;
}

function toNum(v: any): number { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function clamp1000(v: number): number { return Math.max(-1000, Math.min(1000, v)); }

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


  // 初始状态更新
  updateConnectionStatus();

  // 若未连接，则默认开启演示数据
  if (!wsClient.isConnected()) {
    demoMode.value = true;
  }
});

onBeforeUnmount(() => {
  stopDemo();
});

function buildDefaultChannels(): ChannelSetting[] {
  return [
    { id: 1, name: 'CH1', min: -1000, center: 0, max: 1000, reverse: false, expo: 0, rate: 100 },
    { id: 2, name: 'CH2', min: -1000, center: 0, max: 1000, reverse: false, expo: 0, rate: 100 },
    { id: 3, name: 'CH3', min: -1000, center: 0, max: 1000, reverse: false, expo: 0, rate: 100 },
    { id: 4, name: 'CH4', min: -1000, center: 0, max: 1000, reverse: false, expo: 0, rate: 100 },
  ];
}


</script>

<style scoped>
.setting {
  padding: 20px;
  margin: 0 auto;
  max-width: 1280px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.layout-row {
  width: 100%;
}

.channel-row {
  width: 100%;
}

.with-gap {
  margin: -8px;
}

.card-col {
  padding: 8px;
  box-sizing: border-box;
}

.channel-wrapper {
  width: 100%;
}

.chart-card {
  width: 100%;
}

.chart-placeholder {
  height: 240px;
  border: 1px dashed var(--td-component-border);
  border-radius: var(--td-radius-medium);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--td-text-color-secondary);
  background: var(--td-bg-color-container-hover);
}

.chart-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 8px;
}

.toolbar-label {
  color: var(--td-text-color-secondary);
  font-size: 12px;
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
