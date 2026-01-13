<template>
  <div class="setting">

    <t-card title="监控" class="chart-card">
      <Waveform :values="receiverInfo.channel_outputs" :height="240" :stacked="false" />
    </t-card>

    <t-row :gutter="[16, 16]" class="layout-row with-gap">


      <t-col v-for="channel in config.channel_settings" :key="channel.id" :xs="12" :sm="6" :lg="4" class="card-col">
        <channel-set :model-value="channel" :use-bt-gamepad="config.radio_mode == radio_mode.BT_CONTROLLER"
          @update:modelValue="(val) => updateChannel(val.id, val)" />
      </t-col>


      <t-col :xs="12" :sm="6" :lg="4" class="card-col">
        <t-card title="通信设置">
          <t-form layout="vertical" label-width="100px" :model="config" ref="form">

            <t-form-item label="无线模式" name="radio_mode">
              <t-select v-model="config.radio_mode" size="small" :options="getRadioModeOptions()" />
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
import { DataOperation, webSocketClient as wsClient } from '../common';
import ChannelSet from '../component/channelSet.vue';
import Waveform from '../component/Waveform.vue';

//==============================================
// 类似&枚举常量声明
//==============================================

// 通道数量常量
const CHANNEL_COUNT = 4;

// 接收机通道基本配置结构
type ChannelSetting = {
  id: number; // 通道ID
  name: string; // 通道别名
  min: number; // 最小值脉宽
  center: number; // 中值脉宽
  max: number; // 最大值脉宽
  reverse: boolean; // true表示反向 ，反向raw值
  offset: number; // pwm中位偏移值
  xbox_input_key: number; // Xbox输入键映射,如果设备处于蓝牙手柄模式
};


// 接收机状态信息
type receiverInfo = {
  rssi_ground: number; // 地面RSSI值
  rssi_air: number; // 空中RSSI值
  battery_voltage: number; // 电池电压
  firmware_version: string; // 固件版本
  channel_outputs: [number, number, number, number]; // 通道输出值数组
};

type configData = {
  radio_mode: number; // 无线模式
  channel_settings: ChannelSetting[]; // 通道设置数组
};


enum DataPort {
  PORT_CONFIG_SYNC = 0,          // 同步配置端口(双向)
  PORT_CONFIG_AND_CHANNEL_SYNC,  // 从接收机同步基本信息和通道输出值(单向)
  ___data_port_max
}


// 无线模式枚举
enum radio_mode {
  ESP_NOW = 0,
  BT_CONTROLLER,
  __radio_mode_max
}

//==============================================
// 变量&对象声明
//==============================================

// 配置对象用于在WEB APP 和接收机之间同步配置
const config: configData = reactive({
  radio_mode: radio_mode.ESP_NOW,
  channel_settings: buildDefaultChannels(),
});


// 信息展示对象,服务于基本参数卡片和波形图
const receiverInfo = reactive<receiverInfo>({
  rssi_ground: -99,
  rssi_air: -99,
  battery_voltage: 0,
  firmware_version: '--',
  channel_outputs: [1500, 1500, 1500, 1500],
});


// TODO 修改为计算属性
const getRadioModeOptions = () => {
  const modeLabels: Record<string, string> = {
    'ESP_NOW': 'ESP-NOW'
  };

  return Object.keys(radio_mode)
    .filter(key => typeof radio_mode[key as keyof typeof radio_mode] === 'number'
      && key !== '__radio_mode_max')
    .map(key => ({ label: modeLabels[key] || key, value: radio_mode[key as keyof typeof radio_mode] }));
};


// WebSocket消息事件处理 Callback
function onMessage(data: any) {
  try {
    // 确保数据是字符串类型
    const messageStr = typeof data === 'object' ? JSON.stringify(data) : data.toString();
    const jsonData = JSON.parse(messageStr);


    // XXX 打印收到的数据
    console.log(data);

    // 验证数据格式
    if (typeof jsonData === 'object' && jsonData !== null) {

    }
  } catch (error) {
    console.error('解析WebSocket消息失败:', error);
    MessagePlugin.error('解析设备返回的数据失败');
  }
}

onMounted(() => {
  // 设置事件监听器
  wsClient.onConnected(() => {
    MessagePlugin.success('WebSocket 已连接');
  });

  wsClient.onDisconnected(() => {
    MessagePlugin.warning('WebSocket 已断开连接');
  });

  wsClient.onMessage(onMessage); // 注册消息监听器

});



const updateChannel = (id: number, val: Partial<ChannelSetting>) => {
  const idx = config.channel_settings.findIndex(c => c.id === id);
  if (idx < 0) return;

  console.log('更新通道设置:', id, val);

  const prev = config.channel_settings[idx];
  const merged: ChannelSetting = {
    id: prev.id,
    name: val.name ?? prev.name,
    min: val.min ?? prev.min,
    center: val.center ?? prev.center,
    max: val.max ?? prev.max,
    reverse: val.reverse ?? prev.reverse,
    offset: val.offset ?? prev.offset ?? 0, // 补齐缺失的 offset
    xbox_input_key: val.xbox_input_key ?? prev.xbox_input_key,
  };

  // 保持响应性
  config.channel_settings.splice(idx, 1, merged);
};

/**
 * 构建默认通道设置数组。
 *
 * 根据全局常量 CHANNEL_COUNT 生成 CHANNEL_COUNT 个 ChannelSetting 对象，
 * 每个对象包含以下默认值：
 * - id: 从 0 开始递增的通道索引
 * - name: "CH" + (id + 1)
 * - min: 1000
 * - center: 1500
 * - max: 2000
 * - reverse: false
 * - xbox_input_key: 0
 * @returns {ChannelSetting[]} 包含默认通道设置的数组，长度为 CHANNEL_COUNT。
 */
function buildDefaultChannels(): ChannelSetting[] {
  const channels: ChannelSetting[] = [];
  for (let i = 0; i < CHANNEL_COUNT; i++) {
    channels.push({
      id: i,
      name: `CH${i + 1}`,
      min: 1000,
      center: 1500,
      max: 2000,
      reverse: false,
      xbox_input_key: 0,
      offset: 0,
    });
  }
  return channels;
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
