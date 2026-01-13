<template>
    <t-card :bordered="false" class="channel-card">
        <template #title>
            <t-input v-model="channel.name" auto-width borderless class="title-input"
                @change="(v) => updateField({ name: String(v) })" />
        </template>

        <t-space direction="vertical" size="medium" style="width: 100%">

            <t-form layout="vertical" label-width="80px">

                <t-form-item v-if="useBtGamepad" label="输入源">
                    <t-select v-model="channel.xbox_input_key" :options="getXboxInputOptions()" placeholder="选择手柄按钮/摇杆"
                        size="small" @change="(v) => updateField({ xbox_input_key: v as any })" />
                </t-form-item>

                <t-form-item label="范围">
                    <div class="range-row">
                        <t-input-number v-model="channel.min" theme="column" size="small" :min="0" :max="channel.center"
                            @change="(v) => updateField({ min: Number(v) })" />
                        <span class="range-sep">~</span>
                        <t-input-number v-model="channel.center" theme="column" size="small" :min="channel.min"
                            :max="channel.max" @change="(v) => updateField({ center: Number(v) })" />
                        <span class="range-sep">~</span>
                        <t-input-number v-model="channel.max" theme="column" size="small" :min="channel.center"
                            :max="2500" @change="(v) => updateField({ max: Number(v) })" />
                    </div>
                </t-form-item>

                <div class="two-col-row">
                    <t-form-item label="偏移">
                        <t-input-number v-model="channel.offset" theme="column" size="small" :min="-200" :max="200"
                            @change="(v) => updateField({ offset: Number(v) })" />
                    </t-form-item>

                    <t-form-item label="反向">
                        <t-switch v-model="channel.reverse" size="small"
                            @change="(v) => updateField({ reverse: Boolean(v) })" />
                    </t-form-item>
                </div>


            </t-form>


        </t-space>
    </t-card>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';

type ChannelSetting = {
    id: number;
    name: string;
    min: number;
    center: number;
    max: number;
    reverse: boolean;
    offset: number;
    xbox_input_key: number;
};

const props = defineProps<{
    modelValue?: ChannelSetting;
    useBtGamepad?: boolean; // 为 BT 手柄输入时展示额外选项
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: ChannelSetting): void;
}>();

const defaultChannel: ChannelSetting = {
    id: 1,
    name: 'CH1',
    min: 1000,
    center: 1500,
    max: 2000,
    reverse: false,
    offset: 0,
    xbox_input_key: 0
};

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


const channel = ref<ChannelSetting>(cloneChannel(props.modelValue || defaultChannel));

watch(
    () => props.modelValue,
    (val) => { if (val) channel.value = cloneChannel(val); },
    { deep: true }
);

const emitUpdate = () => emit('update:modelValue', cloneChannel(channel.value));

const updateField = (patch: Partial<ChannelSetting>) => {
    channel.value = { ...channel.value, ...patch };
    emitUpdate();
};

function cloneChannel(data: ChannelSetting): ChannelSetting {
    return { ...data };
}

function getXboxInputOptions() {
    const labels: Record<string, string> = {
        None: '无',
        btnA: 'A',
        btnB: 'B',
        btnX: 'X',
        btnY: 'Y',
        btnLB: 'LB',
        btnRB: 'RB',
        btnSelect: 'Select',
        btnStart: 'Start',
        btnXbox: 'Xbox',
        btnLS: 'LS 按下',
        btnRS: 'RS 按下',
        btnShare: 'Share',
        btnDirUp: '方向 上',
        btnDirRight: '方向 右',
        btnDirDown: '方向 下',
        btnDirLeft: '方向 左',
        joyLHori: '左摇杆 水平',
        joyLVert: '左摇杆 垂直',
        joyRHori: '右摇杆 水平',
        joyRVert: '右摇杆 垂直',
        trigLT: '左扳机',
        trigRT: '右扳机'
    };

    return Object.keys(XBOX_INPUT)
        .filter((k) => Number.isInteger(XBOX_INPUT[k as keyof typeof XBOX_INPUT]))
        .filter((k) => !['XBOX_BUTTON_MAX', 'XBOX_HAT_MAX'].includes(k))
        .map((k) => ({ label: labels[k] || k, value: XBOX_INPUT[k as keyof typeof XBOX_INPUT] }));
}
</script>

<style scoped>
.t-input-number.t-is-controls-right.t-size-s {
    width: 80px;
}

.two-col-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

.range-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr auto 1fr;
    align-items: center;
    gap: 8px;
}

.range-sep {
    color: var(--td-text-color-placeholder);
    font-size: 12px;
}
</style>
