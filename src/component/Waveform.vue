<template>
    <div ref="container" class="waveform-container">
        <canvas ref="canvas" class="waveform-canvas"></canvas>
        <div class="legend" v-if="showLegend">
            <span v-for="(c, idx) in 4" :key="idx" class="legend-item">
                <i class="dot" :style="{ background: colors[idx] }"></i>CH{{ idx + 1 }}
            </span>
        </div>
    </div>

</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue';

type Props = {
    values?: number[];           // [-1000, 1000]
    width?: number;              // explicit width; otherwise auto fit container
    height?: number;             // canvas height
    speedPxPerTick?: number;     // horizontal pixels per update
    tickMs?: number;             // update interval
    colors?: string[];           // 4 colors
    showLegend?: boolean;        // show channel labels
    stacked?: boolean;           // stacked lanes vs overlay
    clean?: boolean;             // if true, redraw full frame each tick (no trail)
    smoothingEnabled?: boolean;  // apply EMA smoothing to incoming values
    smoothingAlpha?: number;     // EMA alpha in (0,1], default 0.3
    valueMax?: number;           // vertical scale max, default 2500
    gridSpacingPx?: number;      // square grid spacing in pixels, default 48
    showRulers?: boolean;        // draw time and value rulers
};

const props = withDefaults(defineProps<Props>(), {
    values: () => [0, 0, 0, 0],
    width: 0,
    height: 220,
    speedPxPerTick: 2,
    tickMs: 33,
    colors: () => ['#4caf50', '#2196f3', '#ff9800', '#e91e63'],
    showLegend: true,
    stacked: true,
    clean: true,
    smoothingEnabled: true,
    smoothingAlpha: 0.3,
    valueMax: 2500,
    gridSpacingPx: 48,
    showRulers: true,
});

const canvas = ref<HTMLCanvasElement | null>(null);
const container = ref<HTMLDivElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);
const lastYs = ref<number[]>([0, 0, 0, 0]);
const timer = ref<number | null>(null);
let resizeObserver: ResizeObserver | null = null;

// History buffer for clean redraw mode
let capacity = 0;      // equals canvas css width
let writePos = 0;      // circular index
let history: number[][] = [[], [], [], []];
let primed = false;
let filteredVals: number[] = [0, 0, 0, 0];
let lastPushed: number[] = [0, 0, 0, 0];
const PAD_BOTTOM = 30; // extra room to lift the plot upward
const PAD_TOP = 4;
const LABEL_SHIFT_X = 8; // shift time labels right by roughly one char width

const getHeightPx = () => {
    const c = canvas.value;
    if (c) {
        const rectH = c.getBoundingClientRect().height;
        if (rectH > 0) return rectH;
        if (c.clientHeight > 0) return c.clientHeight;
    }
    return props.height || 220;
};

const colors = computed(() => props.colors.length >= 4
    ? props.colors.slice(0, 4)
    : ['#4caf50', '#2196f3', '#ff9800', '#e91e63']);

const showLegend = computed(() => props.showLegend);

const getSize = () => {
    const w = props.width && props.width > 0
        ? props.width
        : (container.value?.clientWidth || 600);
    const h = props.height;
    return { w, h };
};

const setupCanvas = () => {
    const c = canvas.value; if (!c) return;
    const { w, h } = getSize();
    const ratio = window.devicePixelRatio || 1;
    c.width = Math.floor(w * ratio);
    c.height = Math.floor(h * ratio);
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const context = c.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.value = context;
    initHistory(w);
    primed = false;
    filteredVals = [0, 0, 0, 0];
    lastPushed = [0, 0, 0, 0];
    clearAll();
    drawGrid();
};

const clearAll = () => {
    const c = canvas.value; const context = ctx.value; if (!c || !context) return;
    context.clearRect(0, 0, c.width, c.height);
    // reset lastYs to current mapping to avoid long first line (copy mode)
    const { h } = getSize();
    for (let i = 0; i < 4; i++) lastYs.value[i] = laneCenter(i, h);
};

const drawGrid = () => {
    const context = ctx.value; if (!context) return;
    const { w, h } = getSize();
    const hPlot = h - PAD_BOTTOM;
    context.save();
    context.strokeStyle = 'rgba(0,0,0,0.12)';
    context.lineWidth = 1;
    context.beginPath();
    const gridY = props.stacked ? 4 : 6;
    for (let i = 0; i <= gridY; i++) {
        const y = PAD_TOP + (hPlot - PAD_TOP) / gridY * i + 0.5;
        context.moveTo(0, y);
        context.lineTo(w, y);
    }
    context.stroke();
    context.restore();
};

const laneCenter = (idx: number, height: number) => {
    const hPlot = height - PAD_BOTTOM;
    if (!props.stacked) return PAD_TOP + hPlot / 2;
    const laneH = (hPlot - PAD_TOP) / 4;
    return PAD_TOP + laneH * idx + laneH / 2;
};

const mapValueToY = (val: number, idx: number) => {
    const h = getHeightPx();
    const hPlot = h - PAD_BOTTOM;
    const clamped = Math.max(-1000, Math.min(1000, val || 0));
    const v = Math.max(0, clamped);
    if (props.stacked) {
        const laneH = (hPlot - PAD_TOP) / 4;
        const base = PAD_TOP + laneH * (idx + 1) - 2; // bottom of lane
        const amp = laneH * 0.9;            // upward only
        return base - (v / 1000) * amp;
    } else {
        const base = PAD_TOP + hPlot - 4;
        const amp = (hPlot - PAD_TOP) * 0.9;
        return base - (v / 1000) * amp;
    }
};

const shiftLeft = (dx: number) => {
    const c = canvas.value; const context = ctx.value; if (!c || !context) return;
    const { w, h } = getSize();
    const r = window.devicePixelRatio || 1;
    const dxClamped = Math.max(1, Math.min(Math.floor(dx), w - 1));
    // preserve devicePixelRatio transform
    context.save();
    // Copy source region in device pixels, draw to CSS pixels (transform scales it)
    context.drawImage(
        c,
        dxClamped * r, 0, (w - dxClamped) * r, h * r,
        0, 0, w - dxClamped, h
    );
    // clear the right strip (CSS pixels, affected by transform)
    context.clearRect(w - dxClamped, 0, dxClamped, h);
    context.restore();
};

const drawTick = () => {
    const context = ctx.value; if (!context) return;
    if (props.clean) {
        // full redraw mode (no trail artifacts)
        const { w } = getSize();
        const count = Math.max(1, Math.min(Math.floor(props.speedPxPerTick), 8));
        const raw = (props.values || []).slice(0, 4);
        const vals = positiveScaled(raw);
        const smooth = applyEMA(vals);
        if (!primed) {
            primeHistory(smooth);
            primed = true;
            lastPushed = smooth.slice();
        }
        pushSamplesInterpolated(smooth, count);
        // redraw entire frame
        clearAll();
        // draw channels first
        for (let ch = 0; ch < 4; ch++) {
            context.save();
            context.strokeStyle = colors.value[ch];
            context.lineWidth = 2;
            context.lineJoin = 'round';
            context.lineCap = 'round';
            context.beginPath();
            let started = false;
            for (let x = 0; x < w; x++) {
                const sample = history[ch][(writePos + x) % capacity];
                const y = mapValueToY(sample ?? 0, ch);
                if (!started) { context.moveTo(x, y); started = true; }
                else { context.lineTo(x, y); }
            }
            context.stroke();
            context.restore();
        }
        // overlays on top: grid + rulers
        drawGridSquares();
        if (props.showRulers) {
            drawTimeRuler();
            drawValueRuler();
        }
    } else {
        // copy-shift mode (faster, may cause minor artifacts on some devices)
        const { w } = getSize();
        const dx = Math.max(1, Math.min(Math.floor(props.speedPxPerTick), w - 1));
        shiftLeft(dx);
        const x1 = w - dx - 1;
        const x2 = w - 1;
        const raw = (props.values || []).slice(0, 4);
        const vals = positiveScaled(raw);
        const smooth = applyEMA(vals);
        for (let i = 0; i < 4; i++) {
            const y = mapValueToY(smooth[i] ?? 0, i);
            context.save();
            context.strokeStyle = colors.value[i];
            context.lineWidth = 2;
            context.lineJoin = 'round';
            context.lineCap = 'round';
            context.beginPath();
            context.moveTo(x1, lastYs.value[i] ?? y);
            context.lineTo(x2, y);
            context.stroke();
            context.restore();
            lastYs.value[i] = y;
        }
        // overlays on top: grid + rulers
        drawGridSquares();
        drawRightGrid(dx);
        if (props.showRulers) {
            drawTimeRuler();
            drawValueRuler();
        }
    }
};

const drawRightGrid = (dx: number) => {
    const context = ctx.value; if (!context) return;
    const { w, h } = getSize();
    context.save();
    context.strokeStyle = 'rgba(0,0,0,0.12)';
    context.lineWidth = 1;
    context.beginPath();
    const x = w - Math.floor(dx / 2) - 0.5;
    context.moveTo(x, 0);
    context.lineTo(x, h);
    context.stroke();
    context.restore();
};

const start = () => {
    stop();
    timer.value = window.setInterval(drawTick, props.tickMs);
};

const stop = () => {
    if (timer.value !== null) {
        clearInterval(timer.value);
        timer.value = null;
    }
};

onMounted(() => {
    setupCanvas();
    start();
    // auto resize
    if (container.value) {
        resizeObserver = new ResizeObserver(() => {
            setupCanvas();
        });
        resizeObserver.observe(container.value);
    }
});

onBeforeUnmount(() => {
    stop();
    resizeObserver?.disconnect();
});

watch(() => [props.width, props.height], () => {
    setupCanvas();
});

function initHistory(w: number) {
    capacity = Math.max(16, Math.floor(w));
    writePos = 0;
    history = [new Array(capacity).fill(0), new Array(capacity).fill(0), new Array(capacity).fill(0), new Array(capacity).fill(0)];
}

function primeHistory(vals: number[]) {
    const v0 = (vals[0] ?? 0), v1 = (vals[1] ?? 0), v2 = (vals[2] ?? 0), v3 = (vals[3] ?? 0);
    for (let i = 0; i < capacity; i++) {
        history[0][i] = v0;
        history[1][i] = v1;
        history[2][i] = v2;
        history[3][i] = v3;
    }
    writePos = 0;
}

function pushSamplesInterpolated(vals: number[], count: number) {
    const v0 = (vals[0] ?? 0), v1 = (vals[1] ?? 0), v2 = (vals[2] ?? 0), v3 = (vals[3] ?? 0);
    for (let k = 0; k < count; k++) {
        const t = (k + 1) / count;
        const s0 = lastPushed[0] + (v0 - lastPushed[0]) * t;
        const s1 = lastPushed[1] + (v1 - lastPushed[1]) * t;
        const s2 = lastPushed[2] + (v2 - lastPushed[2]) * t;
        const s3 = lastPushed[3] + (v3 - lastPushed[3]) * t;
        history[0][writePos] = s0;
        history[1][writePos] = s1;
        history[2][writePos] = s2;
        history[3][writePos] = s3;
        writePos = (writePos + 1) % capacity;
    }
    lastPushed = [v0, v1, v2, v3];
}

function applyEMA(vals: number[]): number[] {
    if (!props.smoothingEnabled) return vals;
    const a = Math.max(0.0001, Math.min(1, props.smoothingAlpha));
    for (let i = 0; i < 4; i++) {
        const v = vals[i] ?? 0;
        filteredVals[i] = filteredVals[i] + a * (v - filteredVals[i]);
    }
    return filteredVals.slice(0, 4);
}

function drawGridSquares() {
    const context = ctx.value; if (!context) return;
    const { w } = getSize();
    const h = getHeightPx();
    const s = Math.max(16, Math.floor(props.gridSpacingPx));
    context.save();
    // horizontal lines
    context.strokeStyle = 'rgba(255,255,255,0.08)';
    context.lineWidth = 1;
    context.beginPath();
    for (let y = 0; y <= h; y += s) {
        context.moveTo(0, y + 0.5);
        context.lineTo(w, y + 0.5);
    }
    context.stroke();
    // vertical lines
    context.beginPath();
    for (let x = 0; x <= w; x += s) {
        context.moveTo(x + 0.5, 0);
        context.lineTo(x + 0.5, h);
    }
    context.stroke();
    context.restore();
}

function drawTimeRuler() {
    const context = ctx.value; if (!context) return;
    const { w } = getSize();
    const h = getHeightPx();
    const baseY = h - PAD_BOTTOM * 0.5; // lift ruler above bottom padding
    const spanSec = 5; // total time window 5s across canvas
    const majorSec = 1;
    const pps = w / spanSec; // pixels per second based on full width
    const majorPx = pps * majorSec;

    context.save();
    context.strokeStyle = 'rgba(50,50,50,0.78)';
    context.fillStyle = 'rgba(50,50,50,0.9)';
    context.lineWidth = 1.5;
    context.font = '12px system-ui, -apple-system, Segoe UI, Roboto';
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.shadowColor = 'rgba(255,255,255,0.4)';
    context.shadowBlur = 1;
    // baseline
    context.beginPath();
    context.moveTo(0, baseY - 0.5);
    context.lineTo(w, baseY - 0.5);
    context.stroke();
    // ticks and vertical lines from right (now) to left (past)
    for (let t = 0; t <= spanSec; t += majorSec) {
        const x = w - t * pps;
        const sec = t;
        // tick
        context.beginPath();
        context.moveTo(x + 0.5, baseY - 12);
        context.lineTo(x + 0.5, baseY - 1);
        context.stroke();
        // label
        const labelY = baseY + 2;
        if (t === 0) context.fillText(`now`, Math.max(0, x - 18), labelY); // shift left by one char vs other labels
        else context.fillText(`${sec}s`, x + LABEL_SHIFT_X, labelY);
        // vertical time grid line aligned with ticks
        context.save();
        context.strokeStyle = 'rgba(0,0,0,0.16)';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x + 0.5, PAD_TOP);
        context.lineTo(x + 0.5, h - PAD_BOTTOM);
        context.stroke();
        context.restore();
    }
    context.restore();
}

function drawValueRuler() {
    const context = ctx.value; if (!context) return;
    const { w } = getSize();
    const h = getHeightPx();
    const plotH = h - PAD_BOTTOM;
    const maxV = Math.max(1, Math.floor(props.valueMax));
    const step = 500; // 0,500,...,max
    context.save();
    context.strokeStyle = 'rgba(50,50,50,0.78)';
    context.fillStyle = 'rgba(50,50,50,0.9)';
    context.lineWidth = 1.5;
    context.font = '12px system-ui, -apple-system, Segoe UI, Roboto';
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.shadowColor = 'rgba(255,255,255,0.4)';
    context.shadowBlur = 1;
    // left baseline
    context.beginPath();
    context.moveTo(1.5, PAD_TOP);
    context.lineTo(1.5, plotH);
    context.stroke();
    for (let v = 0; v <= maxV; v += step) {
        const y = valueToY(v, plotH);
        // tick
        context.beginPath();
        context.moveTo(0, y + 0.5);
        context.lineTo(12, y + 0.5);
        context.stroke();
        // label
        context.fillText(String(v), 16, y);
        // horizontal guide (keep light to not overpower waveform)
        context.save();
        context.strokeStyle = 'rgba(0,0,0,0.12)';
        context.beginPath();
        context.moveTo(0, y + 0.5);
        context.lineTo(w, y + 0.5);
        context.stroke();
        context.restore();
    }
    context.restore();
}

function valueToY(v: number, h: number): number {
    const hPlot = h;
    const base = PAD_TOP + hPlot - 4;
    const amp = (hPlot - PAD_TOP) * 0.9;
    const clamped = Math.max(0, Math.min(props.valueMax, v));
    return base - (clamped / props.valueMax) * amp;
}

// 接收正值，负值按0处理，并按最大值缩放到0~1000范围
function positiveScaled(vals: number[]): number[] {
    const numbers = vals.map((v) => Number.isFinite(v as number) ? Math.max(0, v as number) : 0);
    // scale from [0, valueMax] to [0, 1000] for mapValueToY
    return numbers.map((v) => {
        const clamped = Math.max(0, Math.min(props.valueMax, v));
        return (clamped / props.valueMax) * 1000;
    });
}

</script>

<style scoped>
.waveform-container {
    position: relative;
    width: 100%;
}

.waveform-canvas {
    display: block;
    width: 100%;
    height: auto;
    background: rgba(255, 255, 255, 0.02);
    border-radius: var(--td-radius-medium);
}

.legend {
    position: absolute;
    left: 8px;
    top: -18px;
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: var(--td-text-color-secondary);
    user-select: none;
}

.legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
}
</style>
