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
import { type ChannelSetting, XBOX_INPUT } from '../types';
import { clamp, normalizeRange, normalizeName } from '../utils';

const props = defineProps<{
    useBtGamepad?: boolean; // 为 BT 手柄输入时展示额外选项
}>();

// 与父级 v-model 建立双向绑定，父级变更会直接同步到该 ref
const channel = defineModel<ChannelSetting>({ required: true });

// 通过整体赋值触发父级更新，包含校验与钳制逻辑
const updateField = (patch: Partial<ChannelSetting>) => {
    // 先合并，再做规范化处理
    let merged = { ...channel.value, ...patch } as ChannelSetting;
    // 处理名称
    if (patch.name !== undefined) {
        merged = { ...merged, name: normalizeName(merged, patch.name) };
    }
    // 钳制 offset 到 [-200, 200]
    if (patch.offset !== undefined) {
        merged = { ...merged, offset: clamp(Number(patch.offset), -200, 200) };
    }
    // 修正范围 min/center/max
    merged = normalizeRange(merged);
    // 规范 xbox_input_key 为整数
    if (patch.xbox_input_key !== undefined) {
        const v = Number(patch.xbox_input_key);
        merged = { ...merged, xbox_input_key: Number.isFinite(v) ? Math.trunc(v) : 0 };
    }
    channel.value = merged;
};

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
