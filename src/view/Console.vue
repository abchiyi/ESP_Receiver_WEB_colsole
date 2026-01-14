<template>
  <div class="setting">

    <t-card title="监控" class="chart-card">
      <Waveform :values="receiverInfo.channel_outputs" :height="240" :stacked="false" />
    </t-card>

    <t-row :gutter="[16, 16]" class="layout-row with-gap">


      <t-col v-for="(channel, index) in config.channel_settings" :key="channel.id" :xs="12" :sm="6" :lg="4"
        class="card-col">
        <channel-set v-model="config.channel_settings[index]"
          :use-bt-gamepad="config.radio_mode == radio_mode.BT_CONTROLLER" />
      </t-col>


      <t-col :xs="12" :sm="6" :lg="4" class="card-col">
        <t-card title="通信设置">
          <t-form layout="vertical" label-width="100px" :model="config" ref="form">

            <t-form-item label="无线模式" name="radio_mode">
              <t-select v-model="config.radio_mode" size="small" :options="radioModeOptions" />
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

    <!-- 悬浮操作按钮 -->
    <div class="float-actions">
      <t-button shape="circle" theme="primary" size="large" @click="handleSync" title="从设备同步">
        <template #icon>
          <t-icon name="refresh" />
        </template>
      </t-button>
      <t-button shape="circle" theme="success" size="large" @click="handleSave" title="保存到设备">
        <template #icon>
          <t-icon name="check" />
        </template>
      </t-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, watch, onBeforeUnmount, computed } from 'vue';
import { MessagePlugin, Select as TSelect, Option as TOption } from 'tdesign-vue-next';
import { webSocketClient as wsClient } from '../common';
import ChannelSet from '../component/channelSet.vue';
import Waveform from '../component/Waveform.vue';
import { CHANNEL_COUNT, radio_mode, DataPort, type ChannelSetting, type configData, type receiverInfo } from '../types';
import { buildDefaultChannels, getRadioModeOptions } from '../utils';

// 类型与枚举从共享模块引入

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


//==============================================
// 方法函数声明
//==============================================

// 计算属性：无线模式选项
const radioModeOptions = computed(() => getRadioModeOptions(radio_mode));


// WebSocket消息事件处理 Callback
function onMessage(data: any) {
  try {
    // 确保数据是字符串类型
    const messageStr = typeof data === 'object' ? JSON.stringify(data) : data.toString();
    const jsonData = JSON.parse(messageStr);


    /**
     * * 处理配置和通道同步数据
     */
    if (jsonData?.channel_settings !== undefined) {
      if (typeof jsonData.radio_mode === 'number') {
        config.radio_mode = jsonData.radio_mode;
      }
      if (Array.isArray(jsonData.channel_settings)) {
        config.channel_settings = jsonData.channel_settings;
      }

      /**
      * * 处理接收机信息数据
       */
      if (typeof jsonData.receiver_info === 'object'
        && jsonData.receiver_info !== null) {

        const info = jsonData.receiver_info;
        if (typeof info.rssi_ground === 'number') {
          receiverInfo.rssi_ground = info.rssi_ground;
        }
        if (typeof info.rssi_air === 'number') {
          receiverInfo.rssi_air = info.rssi_air;
        }
        if (typeof info.battery_voltage === 'number') {
          receiverInfo.battery_voltage = info.battery_voltage;
        }
        if (typeof info.firmware_version === 'string') {
          receiverInfo.firmware_version = info.firmware_version;
        }
        if (Array.isArray(info.channel_outputs) && info.channel_outputs.length === CHANNEL_COUNT) {
          receiverInfo.channel_outputs = info.channel_outputs as [number, number, number, number];
        }
      }
    }

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


/**
 * 同步设备配置数据
 *
 * 该函数用于在主机和设备之间同步配置数据。支持两种模式：
 * 1. APP向设备发送配置 (to_device = true)
 * 2. APP从设备请求配置 (to_device = false)
 *
 * @param {boolean} [to_device=true] - 同步方向标志
 *   - true: 将当前配置发送到设备端
 *   - false: 从设备端请求最新配置
 *
 * @returns {void}
 *
 * @example
 * // 向设备发送配置
 * SYNC_DEVICE_DATA(true);
 *
 * @example
 * // 从设备请求配置
 * SYNC_DEVICE_DATA(false);
 *
 * @remarks
 * - 依赖全局 wsClient WebSocket 客户端实例
 * - 依赖全局 config 配置对象
 * - 依赖 DataPort.PORT_CONFIG_SYNC 端口定义
 * - 发送的数据格式为 JSON 字符串
 */
function SYNC_DEVICE_DATA(to_device: boolean = true): void {
  if (to_device) {
    const payload = {
      port: DataPort.PORT_CONFIG_SYNC,
      config: config,
    };
    wsClient.send(JSON.stringify(payload));
    console.log('发送配置同步数据到设备:', payload);
  } else {
    const payload = {
      port: DataPort.PORT_CONFIG_SYNC,
      sync: true,
    };
    wsClient.send(JSON.stringify(payload));
    console.log('请求从设备同步配置数据:', payload);
  }
}


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

// 处理同步按钮点击
const handleSync = () => {
  SYNC_DEVICE_DATA(false);
  MessagePlugin.info('正在从设备同步配置...');
};

// 处理保存按钮点击
const handleSave = () => {
  SYNC_DEVICE_DATA(true);
  MessagePlugin.success('配置已发送到设备');
};




// ==============================================
// 生命周期钩子
// ==============================================
onMounted(() => {
  // 设置事件监听器
  wsClient.onConnected(() => {
    MessagePlugin.success('WebSocket 已连接');
  });

  wsClient.onDisconnected(() => {
    MessagePlugin.warning('WebSocket 已断开连接');
  });

  wsClient.onMessage(onMessage); // 注册消息监听器

  SYNC_DEVICE_DATA(false); // 连接后立即同步数据

});

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

/* 悬浮操作按钮 */
.float-actions {
  position: fixed;
  right: 32px;
  bottom: 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 1000;
}

.float-actions .t-button {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
}

.float-actions .t-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

@media (max-width: 768px) {
  .float-actions {
    right: 16px;
    bottom: 16px;
  }
}
</style>
