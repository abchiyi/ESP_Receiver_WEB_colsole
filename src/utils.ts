import { CHANNEL_COUNT, radio_mode, type ChannelSetting } from './types';

// 数值钳制
export function clamp(val: number, min: number, max: number): number {
    const num = Number(val);
    if (!Number.isFinite(num)) return min;
    return Math.min(max, Math.max(min, num));
}

// 统一修复数值范围约束：min <= center <= max
export function normalizeRange(ch: ChannelSetting): ChannelSetting {
    let min = Math.floor(ch.min);
    let center = Math.floor(ch.center);
    let max = Math.floor(ch.max);

    min = clamp(min, 0, 2500);
    max = clamp(max, 0, 2500);

    if (min > max) max = min;

    center = clamp(center, min, max);
    return { ...ch, min, center, max };
}

// 名称清理
export function normalizeName(ch: ChannelSetting, name?: string): string {
    const n = (name ?? ch.name ?? '').toString().trim();
    if (n.length > 0) return n;
    return `CH${(ch.id ?? 0) + 1}`;
}

// 构建默认通道
export function buildDefaultChannels(): ChannelSetting[] {
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

// 下拉选项生成
export function getRadioModeOptions(modeEnum = radio_mode) {
    const labels: Record<string, string> = {
        ESP_NOW: 'ESP-NOW',
        BT_CONTROLLER: '蓝牙手柄',
    };
    return Object.keys(modeEnum)
        .filter(
            (key) =>
                typeof modeEnum[key as keyof typeof modeEnum] === 'number' &&
                key !== '__radio_mode_max',
        )
        .map((key) => ({
            label: labels[key] || key,
            value: modeEnum[key as keyof typeof modeEnum],
        }));
}
