<template>
  <div class="device-list-page">
    <header class="page-header">
      <div class="header-left">
        <h2 class="page-title">所有虚机</h2>
        <span class="device-count">{{ filteredDevices.length }} / {{ deviceStore.devices.length }} 台在线</span>
      </div>
      
      <div class="header-controls">
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <circle cx="11" cy="11" r="7"></circle>
            <path d="M20 20l-4-4"></path>
          </svg>
          <input
            v-model="searchQuery"
            type="search"
            placeholder="搜索设备或标签"
          >
        </div>
        <div class="size-control">
          <span class="label">卡片</span>
          <input
            type="range"
            v-model="cardSize"
            min="150"
            max="400"
            step="10"
            class="size-slider"
          >
          <span class="size-value">{{ cardSize }}px</span>
        </div>
        <div class="header-actions">
          <button class="deploy-btn secondary mobile-tag-action" @click="openTagManager('')" title="标签管理" aria-label="标签管理">
            <svg class="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
              <path d="M20 12v7a1 1 0 0 1-1 1h-7L4 12V5a1 1 0 0 1 1-1h7l8 8z"></path>
              <circle cx="8.5" cy="8.5" r="1.4"></circle>
            </svg>
            <span class="btn-label">标签管理</span>
          </button>
          <button class="deploy-btn secondary" @click="openGlobalSettings" title="全局默认设置" aria-label="全局设置">
            <svg class="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.2 3h-4.4l-.3 2.7a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.3 2.7h4.4l.3-2.7a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"></path>
            </svg>
            <span class="btn-label">全局设置</span>
          </button>
          <button class="deploy-btn primary hide-on-mobile" @click="goToDeploy" aria-label="部署新设备">
            <svg class="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
              <path d="M12 5v14M5 12h14"></path>
            </svg>
            <span class="btn-label">部署新设备</span>
          </button>
        </div>
      </div>
    </header>

    <div class="content-layout">
      <section class="mobile-tag-bar">
        <button
          class="tag-filter"
          :class="{ active: tagStore.selectedTagId === '' }"
          @click="tagStore.setSelectedTag('')"
        >
          <span class="tag-dot all"></span>
          <span class="tag-name">全部设备</span>
          <span class="tag-count">{{ deviceStore.devices.length }}</span>
        </button>
        <button
          v-for="tag in tagStore.tags"
          :key="tag.id"
          class="tag-filter"
          :class="{ active: tagStore.selectedTagId === tag.id }"
          :style="tagFilterStyle(tag)"
          @click="toggleSelectedTag(tag.id)"
        >
          <span class="tag-dot" :style="{ background: tag.color }"></span>
          <span class="tag-name">{{ tag.name }}</span>
          <span class="tag-count">{{ getTagDeviceCount(tag.id) }}</span>
        </button>
      </section>

      <main class="grid-container">
        <div v-if="deviceStore.loading && deviceStore.devices.length === 0" class="state-view">
          <div class="spinner"></div>
          <p>正在获取虚机列表...</p>
        </div>

        <div v-else-if="deviceStore.devices.length === 0" class="state-view">
          <div class="empty-icon">📵</div>
          <h3>暂无在线虚机</h3>
          <p>请确保 Agent 已启动并注册到 Signaling Server</p>
        </div>

        <div v-else-if="filteredDevices.length === 0" class="state-view">
          <div class="empty-icon">🔎</div>
          <h3>没有匹配结果</h3>
          <p>调整搜索关键字或标签筛选</p>
        </div>

        <div 
          v-else 
          class="device-grid" 
          :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))` }"
        >
          <DeviceCard
            v-for="device in filteredDevices"
            :key="device.id"
            :device="device"
            :tags="tagStore.getTagsForDevice(device.id)"
            @connect="connectDevice"
            @settings="openSettings"
            @edit-tags="openTagManager"
          />
        </div>
      </main>
    </div>

    <SettingsModal 
      v-if="showSettingsModal" 
      :settings="localSettings" 
      :is-connected="false"
      :is-global="!selectedDeviceId"
      :is-custom="!!selectedDeviceId && hasCustomSettings(selectedDeviceId)"
      @close="closeSettings" 
      @save="saveSettings" 
      @reset="resetSettings"
    />

    <TagManagerModal
      v-if="showTagManager"
      :devices="deviceStore.devices"
      :initial-device-id="tagManagerDeviceId"
      @close="closeTagManager"
    />
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDeviceStore } from '@/stores/devices'
import { useTagStore } from '@/stores/tags'
import DeviceCard from '@/components/DeviceCard.vue'
import SettingsModal from '@/components/SettingsModal.vue'
import TagManagerModal from '@/components/TagManagerModal.vue'

import { getDeviceSettings, saveDeviceSettings, hasCustomSettings, deleteDeviceSettings } from '@/utils/settings'

const router = useRouter()
const deviceStore = useDeviceStore()
const tagStore = useTagStore()
const cardSize = ref(280)
const searchQuery = ref('')

let refreshInterval = null
const showSettingsModal = ref(false)
const selectedDeviceId = ref('')
const showTagManager = ref(false)
const tagManagerDeviceId = ref('')

const localSettings = ref(getDeviceSettings(''))

const filteredDevices = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return deviceStore.devices.filter(device => {
    const deviceTags = tagStore.getTagsForDevice(device.id)
    const matchesTag = !tagStore.selectedTagId || deviceTags.some(tag => tag.id === tagStore.selectedTagId)
    if (!matchesTag) return false

    if (!query) return true

    const searchable = [
      device.id,
      device.info?.model,
      ...deviceTags.map(tag => tag.name)
    ].filter(Boolean).join(' ').toLowerCase()

    return searchable.includes(query)
  })
})

function openGlobalSettings() {
  selectedDeviceId.value = ''
  localSettings.value = getDeviceSettings('')
  showSettingsModal.value = true
}

function goToDeploy() {
  window.history.pushState({}, '', '/deploy')
  window.dispatchEvent(new Event('popstate'))
}

function openSettings(deviceId) {
  selectedDeviceId.value = deviceId
  localSettings.value = getDeviceSettings(deviceId)
  showSettingsModal.value = true
}

function closeSettings() {
  showSettingsModal.value = false
  selectedDeviceId.value = ''
}

function saveSettings(newSettings) {
  localSettings.value = newSettings
  saveDeviceSettings(selectedDeviceId.value, newSettings)
  
  if (selectedDeviceId.value) {
    connectDevice(selectedDeviceId.value)
  } else {
    closeSettings()
  }
}

function resetSettings() {
  if (selectedDeviceId.value) {
    deleteDeviceSettings(selectedDeviceId.value)
    closeSettings()
  }
}

function openTagManager(deviceId = '') {
  tagManagerDeviceId.value = deviceId
  showTagManager.value = true
}

function closeTagManager() {
  showTagManager.value = false
  tagManagerDeviceId.value = ''
}

function tagFilterStyle(tag) {
  return {
    color: tagStore.selectedTagId === tag.id ? '#fff' : 'var(--text-primary)',
    borderColor: `${tag.color}80`,
    background: tagStore.selectedTagId === tag.id ? `${tag.color}35` : 'transparent'
  }
}

function getTagDeviceCount(tagId) {
  return deviceStore.devices.filter(device => tagStore.getTagIdsForDevice(device.id).includes(tagId)).length
}

function toggleSelectedTag(tagId) {
  tagStore.setSelectedTag(tagStore.selectedTagId === tagId ? '' : tagId)
}

onMounted(() => {
  deviceStore.fetchDevices()
  refreshInterval = setInterval(() => {
    deviceStore.fetchDevices()
  }, 10000)
  window.addEventListener('cloudphone-open-tag-manager', handleOpenTagManagerEvent)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
  window.removeEventListener('cloudphone-open-tag-manager', handleOpenTagManagerEvent)
})

function connectDevice(deviceId) {
  deviceStore.setActiveDevice(deviceId)
}

function handleOpenTagManagerEvent() {
  openTagManager('')
}
</script>

<style scoped>
.device-list-page {
  padding: 24px;
  min-height: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.device-count {
  font-size: 13px;
  color: var(--text-secondary);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-box {
  width: 260px;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid var(--border);
  border-radius: 7px;
}

.search-box:focus-within {
  border-color: var(--accent);
}

.search-box svg {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

.search-box input {
  min-width: 0;
  flex: 1;
  color: var(--text-primary);
  background: transparent;
  border: none;
  outline: none;
  font-size: 13px;
}

.search-box input::placeholder {
  color: var(--text-secondary);
}

.deploy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 0;
  height: 36px;
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border);
  padding: 0 12px;
  border-radius: 7px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.toolbar-icon,
.btn-label {
  display: inline-flex;
  align-items: center;
}

.toolbar-icon {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

.deploy-btn.secondary {
  background: rgba(255, 255, 255, 0.035);
  color: #d0d7de;
}

.deploy-btn.primary {
  color: #fff;
  background: rgba(88, 166, 255, 0.18);
  border-color: rgba(88, 166, 255, 0.35);
}

.mobile-tag-action {
  display: none;
}

.deploy-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.16);
}

.deploy-btn.primary:hover {
  background: rgba(88, 166, 255, 0.26);
  border-color: rgba(88, 166, 255, 0.5);
}

.size-control {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid var(--border);
  border-radius: 7px;
}

.size-control .label {
  font-size: 13px;
  color: var(--text-secondary);
}

.size-slider {
  width: 96px;
  height: 4px;
  -webkit-appearance: none;
  background: var(--border);
  border-radius: 2px;
  outline: none;
}

.size-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: var(--accent);
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.1s;
}

.size-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.size-value {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 40px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.content-layout {
  display: block;
}

.mobile-tag-bar {
  display: none;
}

.tag-filter {
  width: 100%;
  min-width: 0;
  height: 34px;
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-primary);
  background: transparent;
  text-align: left;
  font-size: 12px;
}

.tag-filter:hover {
  background: rgba(255, 255, 255, 0.06);
}

.tag-filter.active {
  border-color: var(--accent);
  background: rgba(233, 69, 96, 0.16);
}

.tag-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.tag-dot.all {
  background: var(--accent);
}

.tag-name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.tag-count {
  min-width: 22px;
  padding: 1px 6px;
  border-radius: 999px;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.08);
  font-size: 11px;
  text-align: center;
}

.btn-refresh-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.btn-refresh-icon:hover {
  background: rgba(255, 255, 255, 0.05);
}

.grid-container {
  min-width: 0;
  width: 100%;
}

.device-grid {
  display: grid;
  gap: 20px;
}

.state-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 0;
  color: var(--text-secondary);
  text-align: center;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.state-view h3 {
  margin: 0 0 8px 0;
  color: var(--text-primary);
}

/* 移动端适配 */
@media (max-width: 1024px) {
  .device-list-page {
    padding: 8px 10px;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .page-header {
    align-items: stretch;
    gap: 8px;
    margin-bottom: 8px;
    padding-bottom: 8px;
    flex-direction: column;
  }

  .header-left {
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .device-count {
    flex: 0 0 auto;
    font-size: 12px;
  }

  .header-controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 36px 36px;
    gap: 8px;
    align-items: center;
  }

  .search-box {
    width: auto;
    height: 36px;
  }

  .header-actions {
    display: contents;
  }

  .mobile-tag-action {
    display: flex;
  }

  .deploy-btn {
    width: 36px;
    min-width: 36px;
    height: 36px;
    justify-content: center;
    padding: 0;
    border-radius: 8px;
  }

  .deploy-btn:hover {
    background: rgba(255, 255, 255, 0.09);
  }

  .deploy-btn .btn-label {
    display: none;
  }
  
  .size-control {
    display: none !important;
  }

  .content-layout {
    min-height: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mobile-tag-bar {
    display: flex;
    flex-direction: row;
    gap: 8px;
    padding: 0 0 2px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .mobile-tag-bar::-webkit-scrollbar {
    display: none;
  }

  .tag-filter {
    width: auto;
    min-width: max-content;
    height: 30px;
    grid-template-columns: 8px minmax(0, auto) auto;
    border-color: var(--border);
    border-radius: 999px;
  }

  .hide-on-mobile {
    display: none !important;
  }

  .grid-container {
    flex: 1;
    display: flex;
    align-items: stretch;
    overflow: hidden;
  }

  .device-grid {
    /* 移动端采用左右滑动模式 */
    display: flex !important;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    gap: 16px;
    padding: 12px 8px 18px;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    -webkit-overflow-scrolling: touch;
  }

  .device-grid::-webkit-scrollbar {
    display: none; /* 隐藏滑动条 */
  }

  .device-grid > * {
    /* 每个卡片宽度占据屏幕大部 */
    min-width: 80vw;
    max-width: 80vw;
    height: calc(100% - 4px);
    scroll-snap-align: center;
  }
  
  .page-title {
    font-size: 16px;
  }
}
</style>
