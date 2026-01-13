<template>
    <t-card :title="title" :bordered="false" class="channel-card">
        <t-space direction="vertical" size="medium" style="width: 100%">

            <t-form layout="vertical" label-width="80px">
                <t-form-item label="名称">
                    <t-input v-model="channel.name" size="small" @change="(v) => updateField({ name: String(v) })" />
                </t-form-item>

                <t-form-item label="范围">
                    <div class="range-row">
                        <t-input-number v-model="channel.min" theme="column" size="small" :min="-2000"
                            :max="channel.center" @change="(v) => updateField({ min: Number(v) })" />
                        <span class="range-sep">~</span>
                        <t-input-number v-model="channel.center" theme="column" size="small" :min="channel.min"
                            :max="channel.max" @change="(v) => updateField({ center: Number(v) })" />
                        <span class="range-sep">~</span>
                        <t-input-number v-model="channel.max" theme="column" size="small" :min="channel.center"
                            :max="2000" @change="(v) => updateField({ max: Number(v) })" />
                    </div>
                </t-form-item>

                <t-form-item label="反向">
                    <t-switch v-model="channel.reverse" size="small"
                        @change="(v) => updateField({ reverse: Boolean(v) })" />
                </t-form-item>

                <t-form-item label="Expo">
                    <div class="slider-row">
                        <t-slider v-model="channel.expo" :min="-100" :max="100" :step="5" :label="`${channel.expo}%`"
                            @change="(v) => updateField({ expo: Number(v) })" />
                    </div>
                </t-form-item>

                <t-form-item label="Rate">
                    <div class="slider-row">
                        <t-slider v-model="channel.rate" :min="50" :max="150" :step="5" :label="`${channel.rate}%`"
                            @change="(v) => updateField({ rate: Number(v) })" />
                    </div>
                </t-form-item>
            </t-form>

            <t-space size="small">
                <t-button theme="primary" @click="emitSave">保存配置</t-button>
                <t-button variant="outline" @click="resetToDefault">重置默认</t-button>
            </t-space>
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
    expo: number;
    rate: number;
};

const props = defineProps<{
    modelValue?: ChannelSetting;
    title?: string;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: ChannelSetting): void;
    (e: 'save', value: ChannelSetting): void;
}>();

const defaultChannel: ChannelSetting = {
    id: 1,
    name: 'CH1',
    min: -1000,
    center: 0,
    max: 1000,
    reverse: false,
    expo: 0,
    rate: 100
};

const channel = ref<ChannelSetting>(cloneChannel(props.modelValue || defaultChannel));
const title = computed(() => props.title || `通道 ${channel.value.name}`);

watch(
    () => props.modelValue,
    (val) => {
        if (val) channel.value = cloneChannel(val);
    },
    { deep: true }
);

const emitUpdate = () => emit('update:modelValue', cloneChannel(channel.value));

const updateField = (patch: Partial<ChannelSetting>) => {
    channel.value = { ...channel.value, ...patch };
    emitUpdate();
};

const emitSave = () => emit('save', cloneChannel(channel.value));

const resetToDefault = () => {
    const base: ChannelSetting = {
        ...defaultChannel,
        id: props.modelValue?.id ?? defaultChannel.id,
        name: props.modelValue?.name ?? defaultChannel.name
    };
    channel.value = cloneChannel(base);
    emitUpdate();
};

function cloneChannel(data: ChannelSetting): ChannelSetting {
    return { ...data };
}
</script>

<style scoped>
.channel-card {}

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

.slider-row {
    padding: 0 6px;
    width: 100%;
}

:deep(.slider-row .t-slider) {
    width: 100%;
}
</style>
