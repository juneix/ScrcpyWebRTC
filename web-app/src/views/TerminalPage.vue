<template>
  <div class="terminal-page">
    <header class="terminal-page-header">
      <div class="header-title-group">
        <svg class="header-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="4 17 10 11 4 5"></polyline>
          <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
        <h2 class="header-title">终端控制台</h2>
      </div>

      <div class="device-selector-group">
        <span class="selector-label">选择虚机:</span>
        <select class="device-select" v-model="selectedDeviceId" @change="onDeviceChange">
          <option value="" disabled>-- 请选择云手机设备 --</option>
          <option v-for="d in deviceStore.onlineDevices" :key="d.id" :value="d.id">
            {{ d.model || d.id }} (在线)
          </option>
        </select>

        <div v-if="selectedDeviceId" class="connection-status" :class="statusClass">
          <span class="status-indicator"></span>
          <span class="status-text">{{ statusText }}</span>
        </div>
      </div>
    </header>

    <div class="terminal-body">
      <!-- 占位状态 -->
      <div v-if="!selectedDeviceId" class="placeholder-box">
        <svg class="placeholder-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="4 17 10 11 4 5"></polyline>
          <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
        <h3>选择一台云手机以连接 adb shell</h3>
        <p>支持原生 adb 交互、常用运维命令执行等控制台操作</p>
      </div>

      <div v-else-if="webrtcConnecting" class="placeholder-box">
        <div class="mini-spinner"></div>
        <h3>正在与虚机建立通信通道...</h3>
        <p>正在建立 WebRTC 连接以传输 adb 数据包</p>
      </div>

      <div v-else-if="webrtcError" class="placeholder-box error-state">
        <svg class="placeholder-icon-svg error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <h3>连接失败</h3>
        <p class="error-detail">{{ webrtcError }}</p>
        <button class="retry-btn" @click="reconnectDevice">重试连接</button>
      </div>

      <!-- Xterm 终端容器 -->
      <div v-show="selectedDeviceId && !webrtcConnecting && !webrtcError" class="term-wrapper">
        <div v-if="!isAdbConnected" class="term-placeholder">
          <button class="adb-connect-btn" @click="startAdb">连接 ADB 调试终端</button>
          <p>建立安全 P2P 隧道并开启原生 Android ADB Shell</p>
        </div>
        <div ref="termContainer" class="xterm-view-container"></div>
      </div>
    </div>
    <!-- 隐藏的哑视频，用来满足 useWebRTC.js 对视频流接收的内部要求 -->
    <video ref="dummyVideo" style="display: none;" autoplay playsinline muted></video>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import { useAdb } from '@/composables/useAdb'
import { useWebRTC } from '@/composables/useWebRTC'
import { getDeviceSettings } from '@/utils/settings'

const deviceStore = useDeviceStore()
const selectedDeviceId = ref('')
const termContainer = ref(null)
const dummyVideo = ref(null)

let webrtc = null
let adbInstance = null
let isSharedConnection = false
let unwatchStatus = null
let unwatchError = null

// 共享 WebRTC 逻辑和连接复用
const webrtcConnecting = ref(false)
const isAdbConnected = ref(false)
const webrtcStatus = ref('disconnected')
const webrtcError = ref(null)

const statusText = computed(() => {
  if (webrtcError.value) return '连接错误'
  if (webrtcStatus.value === 'connected') return '已就绪'
  if (webrtcStatus.value === 'connecting') return '连接中'
  return '未连接'
})

const statusClass = computed(() => {
  return {
    connected: webrtcStatus.value === 'connected' && !webrtcError.value,
    connecting: webrtcStatus.value === 'connecting' && !webrtcError.value,
    disconnected: webrtcStatus.value === 'disconnected' || !!webrtcError.value,
    error: !!webrtcError.value
  }
})

// 复用或建立连接
async function setupDeviceConnection(deviceId) {
  if (!deviceId) return
  
  cleanupConnection()
  webrtcConnecting.value = true
  webrtcError.value = null
  
  // 检查是否已有活跃的控制面板 WebRTC 实例
  let activeInstance = null
  if (deviceStore.activeDeviceId === deviceId && deviceStore.activeWebRTC) {
    activeInstance = deviceStore.activeWebRTC
    console.log('[Terminal] Reusing active WebRTC session for device:', deviceId)
  }
  
  if (activeInstance) {
    webrtc = activeInstance
    isSharedConnection = true
    webrtcStatus.value = webrtc.status.value || 'connected'
    webrtcError.value = webrtc.error?.value || null
    webrtcConnecting.value = false
    
    // 监听 WebRTC 状态变化
    unwatchStatus = watch(() => webrtc.status.value, (newStatus) => {
      webrtcStatus.value = newStatus || 'connected'
    }, { immediate: true })

    unwatchError = watch(() => webrtc.error?.value, (newErr) => {
      webrtcError.value = newErr || null
    }, { immediate: true })
    
    initAdbComposables()
  } else {
    // 创建与正常连接参数完全一致的 WebRTC 连接（绑定到隐藏的 dummyVideo 元素）
    console.log('[Terminal] Connecting WebRTC with full scrcpy options (headless) for device:', deviceId)
    webrtcStatus.value = 'connecting'
    isSharedConnection = false
    try {
      const settings = getDeviceSettings(deviceId)
      const scrcpyOptions = {
        max_fps: settings.fps,
        max_size: settings.size,
        bitrate: settings.bitrate * 1000000,
        min_bitrate: settings.minBitrate * 1000000,
        max_bitrate: settings.maxBitrate * 1000000,
        bwe: settings.bwe,
        audio: settings.audio,
        audio_gain: settings.audioGain,
        audio_source: settings.audioSource,
        audio_dup: settings.audioDup,
        audio_low_latency: settings.audioLowLatency,
        debug: settings.debug,
        snapshot_interval: settings.snapshotInterval,
        power_off: settings.powerOff
      }

      webrtc = useWebRTC(deviceId, scrcpyOptions)
      
      unwatchStatus = watch(() => webrtc.status.value, (newStatus) => {
        webrtcStatus.value = newStatus || 'disconnected'
        if (newStatus === 'connected') {
          webrtcConnecting.value = false
          initAdbComposables()
        } else if (newStatus === 'failed' || newStatus === 'disconnected') {
          webrtcConnecting.value = false
        }
      }, { immediate: true })

      unwatchError = watch(() => webrtc.error?.value, (newErr) => {
        webrtcError.value = newErr || null
      }, { immediate: true })

      setTimeout(() => {
        if (webrtc && dummyVideo.value) {
          console.log('[Terminal] Connecting standalone WebRTC')
          webrtc.setVideoGetter(() => dummyVideo.value)
          webrtc.connect()
        }
      }, 50)
    } catch (e) {
      console.error('[Terminal] Failed to connect device:', e)
      webrtcStatus.value = 'disconnected'
      webrtcError.value = e.message || '初始化失败'
      webrtcConnecting.value = false
    }
  }
}

function initAdbComposables() {
  if (!webrtc) return
  
  // 销毁旧实例
  if (adbInstance) {
    try { adbInstance.closeAdb() } catch (e) {}
  }
  
  const { isAdbConnected: adbConnected, initAdb, closeAdb } = useAdb(webrtc)
  
  adbInstance = { initAdb, closeAdb }
  
  watch(adbConnected, (val) => {
    isAdbConnected.value = val
  }, { immediate: true })
  
  // 延时自动连接 adb
  setTimeout(() => {
    startAdb()
  }, 300)
}

function startAdb() {
  if (adbInstance && termContainer.value) {
    adbInstance.initAdb(termContainer.value)
  }
}

// 设备选择发生变化
function onDeviceChange() {
  cleanupConnection()
  if (selectedDeviceId.value) {
    setupDeviceConnection(selectedDeviceId.value)
  }
}

// 重试连接
function reconnectDevice() {
  if (selectedDeviceId.value) {
    const id = selectedDeviceId.value
    selectedDeviceId.value = ''
    setTimeout(() => {
      selectedDeviceId.value = id
    }, 100)
  }
}

function cleanupConnection() {
  if (adbInstance) {
    try { adbInstance.closeAdb() } catch (e) {}
    adbInstance = null
  }
  
  isAdbConnected.value = false
  webrtcStatus.value = 'disconnected'
  webrtcError.value = null
  
  if (unwatchStatus) {
    unwatchStatus()
    unwatchStatus = null
  }
  if (unwatchError) {
    unwatchError()
    unwatchError = null
  }
  
  // 如果是专门建立的数据连接，而不是全局的共享连接，我们应该关闭它
  if (webrtc && !isSharedConnection) {
    console.log('[Terminal] Closing custom data channel connection')
    try { webrtc.disconnect() } catch (e) {}
  }
  webrtc = null
}

onMounted(() => {
  if (deviceStore.activeDeviceId) {
    selectedDeviceId.value = deviceStore.activeDeviceId
    setupDeviceConnection(selectedDeviceId.value)
  }
})

onUnmounted(() => {
  cleanupConnection()
})
</script>

<style scoped>
.terminal-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--bg-primary, #0d1117);
  color: #c9d1d9;
}

.terminal-page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--bg-secondary, #161b22);
  border-bottom: 1px solid var(--border, #30363d);
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon-svg {
  width: 20px;
  height: 20px;
  color: var(--accent, #58a6ff);
  flex-shrink: 0;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: #f0f6fc;
}

.device-selector-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selector-label {
  font-size: 14px;
  color: #8b949e;
}

.device-select {
  background: #21262d;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 14px;
  outline: none;
  cursor: pointer;
}

.device-select:focus {
  border-color: var(--accent, #58a6ff);
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #21262d;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #30363d;
  font-size: 12px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8b949e;
}

.connection-status.connected .status-indicator {
  background: #3fb950;
  box-shadow: 0 0 8px rgba(63, 185, 80, 0.5);
}

.connection-status.connecting .status-indicator {
  background: #dbb32d;
  animation: pulse 1s infinite alternate;
}

.status-text {
  font-weight: 500;
}

@keyframes pulse {
  0% { opacity: 0.4; }
  100% { opacity: 1; }
}

.terminal-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  position: relative;
  background: #000;
}

.placeholder-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px;
  background: var(--bg-primary, #0d1117);
}

.placeholder-icon-svg {
  width: 48px;
  height: 48px;
  margin-bottom: 16px;
  opacity: 0.4;
  color: var(--accent, #58a6ff);
}

.placeholder-box h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #eee;
}

.placeholder-box p {
  color: #8b949e;
  font-size: 14px;
  max-width: 400px;
  margin: 0;
  line-height: 1.5;
}

.connection-status.error .status-indicator {
  background: #f85149;
  box-shadow: 0 0 8px rgba(248, 81, 73, 0.5);
}

.placeholder-box.error-state .error-icon {
  color: #f85149;
  opacity: 0.8;
}

.error-detail {
  color: #f85149;
  font-size: 13px;
  background: rgba(248, 81, 73, 0.1);
  border: 1px solid rgba(248, 81, 73, 0.2);
  padding: 8px 16px;
  border-radius: 6px;
  margin-top: 12px !important;
  max-width: 500px;
  word-break: break-all;
}

.retry-btn {
  background: #21262d;
  color: #c9d1d9;
  border: 1px solid #30363d;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 16px;
  font-size: 13px;
  transition: all 0.2s ease;
}

.retry-btn:hover {
  background: #30363d;
  border-color: #8b949e;
  color: #f0f6fc;
}

.mini-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #30363d;
  border-top-color: var(--accent, #58a6ff);
  border-radius: 50%;
  animation: spinner 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spinner {
  to { transform: rotate(360deg); }
}

.term-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.term-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #000;
  color: #8b949e;
  z-index: 10;
  text-align: center;
  padding: 20px;
}

.adb-connect-btn {
  background: var(--accent, #58a6ff);
  color: #ffffff;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 12px;
  font-size: 14px;
}

.adb-connect-btn:hover {
  background: #1f85ff;
}

.xterm-view-container {
  flex: 1;
  width: 100%;
  height: 100%;
  padding: 12px;
  box-sizing: border-box;
}

/* 移动端终端响应式样式 */
@media (max-width: 768px) {
  .terminal-page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding: 12px 16px;
  }

  .header-title-group {
    justify-content: space-between;
  }

  .header-title {
    font-size: 14px;
  }

  .header-icon-svg {
    width: 16px;
    height: 16px;
  }

  .device-selector-group {
    width: 100%;
    justify-content: space-between;
  }

  .device-select {
    flex: 1;
    max-width: 160px;
    padding: 4px 8px;
    font-size: 13px;
  }

  .connection-status {
    padding: 4px 8px;
    font-size: 11px;
  }
}
</style>
