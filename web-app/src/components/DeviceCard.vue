<template>
  <div class="device-card" @click="onCardClick">
    <div class="preview-area" :class="{ 'is-landscape': isLandscape }">
      <!-- 展示快照或占位图 -->
      <img v-if="currentSnapshot" :src="currentSnapshot" class="snapshot-img" @load="onImageLoad" />
      <div v-else class="snapshot-placeholder">
        <span class="vm-icon">💻</span>
      </div>
      <!-- 隐藏的预加载图片 -->
      <img v-if="nextSnapshotUrl" :src="nextSnapshotUrl" style="display: none;" @load="onNextSnapshotLoaded" />
      <div class="overlay">
        <span class="play-hint">点击进入控制</span>
      </div>
      <!-- 悬浮页脚 -->
      <div class="card-footer-overlay" @click.stop>
        <div class="device-main-info">
          <h3 class="device-id-text" :title="device.id">{{ device.id }}</h3>
          <span class="status-badge" :class="statusClass">
            {{ statusText }}
          </span>
        </div>
        <div v-if="device.info?.model" class="device-meta">
          <span class="model-name">{{ device.info.model }}</span>
        </div>
        <div v-if="tags.length > 0" class="device-tags">
          <span
            v-for="tag in visibleTags"
            :key="tag.id"
            class="device-tag"
            :style="tagStyle(tag)"
            :title="tag.name"
          >
            {{ tag.name }}
          </span>
          <span v-if="hiddenTagCount > 0" class="device-tag more-tag">
            +{{ hiddenTagCount }}
          </span>
        </div>
        <!-- 功能菜单按钮 -->
        <button class="menu-btn" @click.stop="toggleMenu" title="更多操作">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <circle cx="4" cy="8" r="1.5"/>
            <circle cx="8" cy="8" r="1.5"/>
            <circle cx="12" cy="8" r="1.5"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 下拉菜单 -->
    <div v-if="showMenu" class="card-menu" @click.stop>
      <button class="menu-item" @click="onSettings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        连接设置
      </button>
      <button class="menu-item" @click="onEditTags">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 12v7a1 1 0 0 1-1 1h-7L4 12V5a1 1 0 0 1 1-1h7l8 8z"></path><circle cx="8.5" cy="8.5" r="1.5"></circle></svg>
        编辑标签
      </button>
      <button class="menu-item danger" @click="onQuitAgent" :disabled="device.status !== 'online'">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v6M12 4.5a6 6 0 11-8 0"/></svg>
        退出 Agent
      </button>
    </div>
    
    <!-- 点击其他地方关闭菜单 -->
    <div v-if="showMenu" class="menu-overlay" @click.stop="showMenu = false"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDeviceStore } from '@/stores/devices'

const props = defineProps({
  device: {
    type: Object,
    required: true
  },
  tags: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['connect', 'settings', 'edit-tags'])
const deviceStore = useDeviceStore()
const showMenu = ref(false)
const isLandscape = ref(false)

const currentSnapshot = ref(props.device.snapshot || '')
const nextSnapshotUrl = ref('')

watch(() => props.device.snapshot, (newSnapshot) => {
  if (newSnapshot) {
    if (!currentSnapshot.value) {
      currentSnapshot.value = newSnapshot
    } else {
      nextSnapshotUrl.value = newSnapshot
    }
  } else {
    currentSnapshot.value = ''
    nextSnapshotUrl.value = ''
  }
})

function onNextSnapshotLoaded() {
  if (nextSnapshotUrl.value) {
    currentSnapshot.value = nextSnapshotUrl.value
    nextSnapshotUrl.value = ''
  }
}

function onImageLoad(event) {
  const img = event.target
  if (img.naturalWidth > img.naturalHeight) {
    isLandscape.value = true
  } else {
    isLandscape.value = false
  }
}

const statusClass = computed(() => {
  return props.device.status === 'online' ? 'online' : 'offline'
})

const statusText = computed(() => {
  return props.device.status === 'online' ? '在线' : '离线'
})

const visibleTags = computed(() => props.tags.slice(0, 3))
const hiddenTagCount = computed(() => Math.max(0, props.tags.length - visibleTags.value.length))

function onCardClick() {
  if (!showMenu.value) {
    emit('connect', props.device.id)
  }
}

function toggleMenu() {
  showMenu.value = !showMenu.value
}

function onSettings() {
  showMenu.value = false
  emit('settings', props.device.id)
}

function onEditTags() {
  showMenu.value = false
  emit('edit-tags', props.device.id)
}

function tagStyle(tag) {
  return {
    color: tag.color,
    borderColor: `${tag.color}80`,
    background: `${tag.color}16`
  }
}

function onQuitAgent() {
  showMenu.value = false
  if (confirm(`警告：确定要停止设备 "${props.device.id}" 上的 Agent 进程吗？停止后该设备将下线。`)) {
    deviceStore.quitAgent(props.device.id)
  }
}

function onClickOutside() {
  if (showMenu.value) showMenu.value = false
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<style scoped>
.device-card {
  background: var(--bg-secondary);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid var(--border);
  position: relative;
}

.device-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  border-color: var(--accent);
}

.preview-area {
  aspect-ratio: 9 / 16;
  background: #111;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.snapshot-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.snapshot-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  transition: transform 0.3s ease, width 0.3s ease, height 0.3s ease;
}

/* 横屏时的旋转适配：强制以竖屏在 9:16 容器中显示 */
.preview-area.is-landscape .snapshot-img {
  position: absolute;
  width: 177.78%; /* 宽高对调：宽为容器的高（16/9 ≈ 177.78%） */
  height: 100%;   /* 高为容器的宽（100%） */
  top: 0;
  left: -38.89%;  /* 水平居中偏移：(177.78% - 100%) / 2 = 38.89% */
  object-fit: contain;
  transform: rotate(90deg); /* 顺时针旋转 90 度 */
}

.vm-icon {
  font-size: 48px;
  opacity: 0.3;
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.device-card:hover .overlay {
  opacity: 1;
}

.play-hint {
  background: var(--accent);
  color: white;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  transform: translateY(10px);
  transition: transform 0.2s;
}

.device-card:hover .play-hint {
  transform: translateY(0);
}

.card-footer-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(13, 17, 23, 0.95) 0%, rgba(13, 17, 23, 0.7) 60%, rgba(13, 17, 23, 0) 100%);
  padding: 12px 14px 10px;
  z-index: 5;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.device-main-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.device-id-text {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-primary);
  max-width: 140px;
}

.status-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
  text-transform: uppercase;
}

.status-badge.online {
  background: rgba(74, 222, 128, 0.1);
  color: #4ade80;
}

.status-badge.offline {
  background: rgba(255, 255, 255, 0.1);
  color: #999;
}

.device-meta {
  font-size: 11px;
  color: var(--text-secondary);
}

.model-name {
  opacity: 0.7;
}

.device-tags {
  display: flex;
  flex-wrap: nowrap; /* 强制不折行 */
  gap: 5px;
  overflow: hidden; /* 溢出隐藏 */
  padding-right: 28px;
  margin-top: auto; /* 自动推到最底端 */
}

.device-tag {
  max-width: 86px;
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border: 1px solid;
  border-radius: 999px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.more-tag {
  color: var(--text-secondary);
  border-color: var(--border);
  background: rgba(255, 255, 255, 0.06);
}

/* 菜单按钮 */
.menu-btn {
  position: absolute;
  right: 12px;
  bottom: 12px; /* 锁死在右下角，因为页脚固定高度，所以在纵向上也是完全对齐的 */
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08); /* 明显的磨砂质感背景 */
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  cursor: pointer;
  opacity: 0.8;
  transition: all 0.2s ease;
}

.menu-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.18);
  border-color: var(--accent);
}

.menu-btn svg {
  width: 14px;
  height: 14px;
  color: var(--text-primary);
}

/* 下拉菜单 */
.card-menu {
  position: absolute;
  bottom: 42px; /* 呈现在右下角按钮的上方 */
  right: 12px;
  min-width: 140px;
  background: #161b22 !important; /* 强制不透明底色 */
  opacity: 1 !important; /* 强制不透明 */
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  z-index: 100;
  padding: 4px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
}

.menu-item:hover:not(:disabled) {
  background: var(--bg-hover);
}

.menu-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.menu-item.danger {
  color: var(--error);
}

.menu-item svg {
  width: 14px;
  height: 14px;
}

.menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
}

/* 移动端卡片优化 */
@media (max-width: 1024px) {
  .device-card {
    height: 100%;
  }
  .preview-area {
    aspect-ratio: unset;
    flex: 1;
    min-height: 0;
  }
  .card-footer-overlay {
    padding: 8px 10px;
  }
  .device-id-text {
    font-size: 13px;
    max-width: 80px;
  }
  .status-badge {
    font-size: 9px;
    padding: 1px 4px;
  }
  .vm-icon {
    font-size: 32px;
  }
  .device-tags {
    gap: 4px;
    padding-right: 22px;
  }
  .device-tag {
    max-width: 70px;
    height: 18px;
    padding: 0 6px;
    font-size: 9px;
  }
  .menu-btn {
    opacity: 1;
  }
}
</style>
