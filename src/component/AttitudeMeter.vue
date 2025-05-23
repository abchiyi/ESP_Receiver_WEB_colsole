<template>
  <div class="attitude-indicator">
    <canvas ref="attitudeCanvas" class="attitude-canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';

// 通过props接收姿态数据
const props = defineProps({
  pitch: {
    type: Number,
    default: 0
  },
  roll: {
    type: Number,
    default: 0
  },
  yaw: {
    type: Number,
    default: 0
  }
});

// Canvas引用
const attitudeCanvas = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
let animationFrameId: number | null = null;

// 画布尺寸
const CANVAS_SIZE = 300;
const CENTER_X = CANVAS_SIZE / 2;
const CENTER_Y = CANVAS_SIZE / 2;
// 设备像素比（用于高清显示）
let pixelRatio = 1;

// 绘制人工地平仪
function drawAttitudeIndicator() {
  if (!ctx || !attitudeCanvas.value) return;

  // 清除画布
  ctx.clearRect(0, 0, CANVAS_SIZE * pixelRatio, CANVAS_SIZE * pixelRatio);

  // 绘制姿态背景（天空和地面）
  drawAttitudeBackground();

  // 绘制偏航角刻度环
  drawYawRing();

  // 绘制固定的飞机符号
  drawAirplaneSymbol();

  // 请求下一帧动画
  animationFrameId = requestAnimationFrame(drawAttitudeIndicator);
}

// 绘制姿态背景（天空和地面）
function drawAttitudeBackground() {
  if (!ctx) return;

  ctx.save();
  ctx.translate(CENTER_X * pixelRatio, CENTER_Y * pixelRatio);
  ctx.rotate((props.roll * Math.PI) / 180);

  const pitchScale = 3; // 增加俯仰角的缩放系数
  const pitchOffset = (props.pitch * pitchScale) * pixelRatio;
  const radius = 120 * pixelRatio; // 内圆半径
  const extendedHeight = radius * 4; // 增加绘制区域的高度

  // 创建圆形裁剪区域
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.clip();

  // 天空（蓝色）
  ctx.fillStyle = '#3498db';
  ctx.fillRect(-radius, -extendedHeight - pitchOffset, radius * 2, extendedHeight);

  // 地面（棕色）
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(-radius, 0 - pitchOffset, radius * 2, extendedHeight);

  // 绘制水平线
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2 * pixelRatio;
  ctx.beginPath();
  ctx.moveTo(-radius, 0 - pitchOffset);
  ctx.lineTo(radius, 0 - pitchOffset);
  ctx.stroke();

  // 绘制俯仰角刻度
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 1 * pixelRatio;
  for (let i = -90; i <= 90; i += 10) {
    const y = (i * pitchScale * pixelRatio) - pitchOffset;
    const lineLength = (i % 30 === 0) ? 40 * pixelRatio : 20 * pixelRatio;

    if (y > -radius && y < radius) { // 只绘制在可见区域内的刻度
      ctx.beginPath();
      ctx.moveTo(-lineLength / 2, y);
      ctx.lineTo(lineLength / 2, y);
      ctx.stroke();

      if (i % 30 === 0) {
        ctx.fillStyle = 'white';
        ctx.font = `${14 * pixelRatio}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText(`${i}°`, lineLength / 2 + 5 * pixelRatio, y + 5 * pixelRatio);
      }
    }
  }

  ctx.restore();
}

// 绘制偏航角刻度环
function drawYawRing() {
  if (!ctx) return;

  const radius = 140 * pixelRatio;
  const innerRadius = 120 * pixelRatio;

  ctx.save();
  ctx.translate(CENTER_X * pixelRatio, CENTER_Y * pixelRatio);

  // 绘制半透明背景环
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.arc(0, 0, innerRadius, Math.PI * 2, 0, true);
  ctx.fill();

  // 绘制偏航角刻度线
  for (let i = 0; i < 360; i += 10) {
    const angle = ((i - props.yaw) * Math.PI) / 180;

    ctx.save();
    ctx.rotate(angle);

    // 只在每30度绘制刻度线
    if (i % 30 === 0) {
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2 * pixelRatio;
      ctx.beginPath();
      ctx.moveTo(0, -radius);
      ctx.lineTo(0, -innerRadius);
      ctx.stroke();
    } else {
      // 小刻度线
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1 * pixelRatio;
      ctx.beginPath();
      ctx.moveTo(0, -radius);
      ctx.lineTo(0, -(radius - 5 * pixelRatio));
      ctx.stroke();
    }

    ctx.restore();
  }

  // 单独绘制数字和方向标记，避免与刻度线重叠
  for (let i = 0; i < 360; i += 30) {
    const angle = ((i - props.yaw) * Math.PI) / 180;

    ctx.save();
    ctx.rotate(angle);

    // 绘制主要方向标记
    if (i % 90 === 0) {
      ctx.fillStyle = i === 0 ? 'red' : 'white';
      ctx.font = `bold ${16 * pixelRatio}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const text = i === 0 ? 'N' : i === 90 ? 'E' : i === 180 ? 'S' : 'W';
      ctx.fillText(text, 0, -(innerRadius - 15 * pixelRatio));
    }
    // 绘制数字标记
    else {
      ctx.fillStyle = 'white';
      ctx.font = `${12 * pixelRatio}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const text = (i / 10).toString();
      ctx.fillText(text, 0, -(innerRadius - 15 * pixelRatio));
    }

    ctx.restore();
  }

  // 绘制当前偏航角指示器（三角形指针）
  ctx.fillStyle = 'yellow';
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(-5 * pixelRatio, -(radius - 10 * pixelRatio));
  ctx.lineTo(5 * pixelRatio, -(radius - 10 * pixelRatio));
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// 绘制固定的飞机符号
function drawAirplaneSymbol() {
  if (!ctx) return;

  ctx.strokeStyle = 'yellow';
  ctx.lineWidth = 3 * pixelRatio;

  // 中心点
  ctx.beginPath();
  ctx.arc(CENTER_X * pixelRatio, CENTER_Y * pixelRatio, 3 * pixelRatio, 0, Math.PI * 2);
  ctx.fill();

  // 机翼
  ctx.beginPath();
  ctx.moveTo(CENTER_X * pixelRatio - 40 * pixelRatio, CENTER_Y * pixelRatio);
  ctx.lineTo(CENTER_X * pixelRatio + 40 * pixelRatio, CENTER_Y * pixelRatio);
  ctx.stroke();

  // 机头
  ctx.beginPath();
  ctx.moveTo(CENTER_X * pixelRatio, CENTER_Y * pixelRatio - 20 * pixelRatio);
  ctx.lineTo(CENTER_X * pixelRatio, CENTER_Y * pixelRatio + 20 * pixelRatio);
  ctx.stroke();
}

// 监听props变化，触发重绘
watch(() => [props.pitch, props.roll, props.yaw], () => {
  // 姿态数据变化时不需要特别处理，因为动画循环会自动使用最新的数据
}, { deep: true });

// 初始化高DPI Canvas
function setupHiDPICanvas() {
  if (!attitudeCanvas.value || !ctx) return;

  // 获取设备像素比
  pixelRatio = window.devicePixelRatio || 1;

  // 设置Canvas的实际尺寸（物理像素）
  attitudeCanvas.value.width = CANVAS_SIZE * pixelRatio;
  attitudeCanvas.value.height = CANVAS_SIZE * pixelRatio;

  // 设置Canvas的显示尺寸（CSS像素）
  attitudeCanvas.value.style.width = `${CANVAS_SIZE}px`;
  attitudeCanvas.value.style.height = `${CANVAS_SIZE}px`;

  // 设置字体抗锯齿
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
}

// 组件挂载时的初始化
onMounted(() => {
  if (attitudeCanvas.value) {
    ctx = attitudeCanvas.value.getContext('2d');

    if (ctx) {
      setupHiDPICanvas();
      drawAttitudeIndicator();
    }
  }
});

// 组件卸载时的清理
onBeforeUnmount(() => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
  }
});
</script>

<style scoped>
.attitude-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
}

.attitude-canvas {
  border: 2px solid #444;
  border-radius: 5px;
  background: #1a1a1a;
}
</style>
