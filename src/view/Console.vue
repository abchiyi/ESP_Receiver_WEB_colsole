<template>
  <div class="setting">
    <!-- 未连接提示对话框 -->
    <t-dialog v-model:visible="showDisconnectModal" title="设备未连接" :close-btn="false" :ok-btn="false" :cancel-btn="false"
      width="400px" class="disconnect-dialog">
      <div class="disconnect-content">
        <t-icon name="error-circle" class="disconnect-icon" />
        <p class="disconnect-message">WebSocket 未连接到设备</p>
        <p class="disconnect-hint">请在主界面配置并连接到 WebSocket 服务器</p>
      </div>
    </t-dialog>

    <t-card title="监控" class="chart-card">
      <div class="chart-toolbar">
        <t-switch v-model="demoMode" size="small" />
        <span class="toolbar-label">演示数据</span>
      </div>
      <Waveform :values="channelOutputs" :height="240" :stacked="false" />
    </t-card>

    <t-row :gutter="[16, 16]" class="layout-row with-gap">


      <t-col v-for="channel in channelSettings" :key="channel.id" :xs="12" :sm="6" :lg="4" class="card-col">
        <channel-set :title="`通道 ${channel.name}`" :model-value="channel"
          @update:modelValue="(val) => updateChannel(val.id, val)" @save="handleChannelSave" />
      </t-col>


      <t-col :xs="12" :sm="6" :lg="4" class="card-col">
        <t-card title="通信设置">
          <p><span></span></p>
          <t-form layout="vertical" label-width="100px" :model="Config" ref="form" @submit="onSubmit">

            <t-form-item label="无线模式" name="radio_mode">
              <t-select v-model="Config.radio_mode" size="small" :options="getRadioModeOptions()" />
            </t-form-item>

            <t-form-item>
              <t-button type="submit" theme="primary">保存配置</t-button>
            </t-form-item>

          </t-form>
        </t-card>
      </t-col>

      <t-col :xs="12" :sm="6" :lg="4" class="card-col">
        <t-card title="基本参数">
          <p>RC Mini C34B</p>
          <p>固件版本 0.1B</p>
          <p>电池串数 1S</p>
          <p>电池电压 3.7V</p>
          <p>RSSI 地面：-20db [良好]</p>
          <p>RSSI 空中：-30db [良好]</p>
        </t-card>
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

// WebSocket状态
const isConnected = ref(false);
const showDisconnectModal = ref(false);

watch(isConnected, (v) => {
  showDisconnectModal.value = !v;
});

// 设备配置
const Config = reactive({
  radio_mode: radio_mode.ESP_NOW, // 默认使用ESP_NOW模式
});

const channelSettings = ref<ChannelSetting[]>(buildDefaultChannels());

const getRadioModeOptions = () => {
  const modeLabels: Record<string, string> = {
    'ESP_NOW': 'ESP-NOW'
  };

  return Object.keys(radio_mode)
    .filter(key => typeof radio_mode[key as keyof typeof radio_mode] === 'number'
      && key !== '__radio_mode_max')
    .map(key => ({ label: modeLabels[key] || key, value: radio_mode[key as keyof typeof radio_mode] }));
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


      // 如果radio_mode未定义，默认为ESP_NOW模式
      Config.radio_mode = jsonData.radio_mode !== undefined
        ? jsonData.radio_mode
        : radio_mode.ESP_NOW;

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
    { id: 1, name: 'CH1', min: 500, center: 1500, max: 2500, reverse: false, expo: 0, rate: 100 },
    { id: 2, name: 'CH2', min: 500, center: 1500, max: 2500, reverse: false, expo: 0, rate: 100 },
    { id: 3, name: 'CH3', min: 500, center: 1500, max: 2500, reverse: false, expo: 0, rate: 100 },
    { id: 4, name: 'CH4', min: 500, center: 1500, max: 2500, reverse: false, expo: 0, rate: 100 },
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

<style scoped>
.disconnect-dialog {
  pointer-events: auto;
}

.disconnect-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  padding: 20px 0;
}

.disconnect-icon {
  font-size: 48px;
  color: var(--td-error-color);
}

.disconnect-message {
  font-size: 16px;
  font-weight: 500;
  color: var(--td-text-color);
  margin: 0;
}

.disconnect-hint {
  font-size: 14px;
  color: var(--td-text-color-secondary);
  margin: 0;
}
</style>
