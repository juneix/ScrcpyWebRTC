import { defineStore } from 'pinia'
import { ref, computed, shallowRef, markRaw } from 'vue'
import { debugLog } from '@/utils/debug'

export const useDeviceStore = defineStore('devices', () => {
  const devices = ref([])
  const loading = ref(false)
  const error = ref(null)

  const onlineDevices = computed(() => 
    [...devices.value]
      .filter(d => d.status === 'online')
      .sort((a, b) => a.id.localeCompare(b.id)) // 稳定升序排序
  )

  const offlineDevices = ref([])


  // 辅助函数：根据当前活跃的 ID 列表更新在线和离线列表
  function processDeviceList(activeIds) {
    // 1. 找出刚刚掉线（原本在线但在新活跃列表中找不到）的设备
    devices.value.forEach(d => {
      if (!activeIds.includes(d.id)) {
        const offlineDev = {
          ...d,
          status: 'offline',
          lastOffline: new Date().toISOString()
        }
        const idx = offlineDevices.value.findIndex(od => od.id === d.id)
        if (idx === -1) {
          offlineDevices.value.push(offlineDev)
        } else {
          // 保留或更新最新的属性
          offlineDevices.value[idx] = { ...offlineDevices.value[idx], ...offlineDev }
        }
      }
    })

    // 2. 过滤在线列表，只保留当前活跃的设备
    const newOnlineList = devices.value.filter(d => activeIds.includes(d.id))

    // 3. 处理重新上线或新上线的设备
    activeIds.forEach(id => {
      const existingOnline = newOnlineList.find(d => d.id === id)
      if (!existingOnline) {
        const existingOfflineIdx = offlineDevices.value.findIndex(d => d.id === id)
        if (existingOfflineIdx > -1) {
          // 从离线列表移除并移回在线列表
          const resurrected = offlineDevices.value.splice(existingOfflineIdx, 1)[0]
          newOnlineList.push({
            ...resurrected,
            status: 'online',
            lastSeen: new Date().toISOString()
          })
        } else {
          // 全新上线的设备
          newOnlineList.push({
            id,
            status: 'online',
            snapshot: null,
            lastSeen: new Date().toISOString()
          })
        }
      }
    })

    newOnlineList.sort((a, b) => a.id.localeCompare(b.id))
    devices.value = newOnlineList
  }

  async function fetchDevices() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/devices')
      const data = await res.json()
      
      if (Array.isArray(data)) {
        const activeIds = data.map(id => typeof id === 'string' ? id : id.device_id)
        processDeviceList(activeIds)
      } else {
        processDeviceList([])
      }
    } catch (e) {
      error.value = e.message
      console.error('Failed to fetch devices:', e)
    } finally {
      loading.value = false
    }
  }

  function addDevice(device) {
    const existing = devices.value.find(d => d.id === device.id)
    if (!existing) {
      // 检查是否在离线列表中
      const idx = offlineDevices.value.findIndex(d => d.id === device.id)
      if (idx > -1) {
        offlineDevices.value.splice(idx, 1)
      }
      devices.value.push({ ...device, status: 'online', lastSeen: new Date().toISOString() })
      devices.value.sort((a, b) => a.id.localeCompare(b.id))
    }
  }

  function removeDevice(deviceId) {
    const index = devices.value.findIndex(d => d.id === deviceId)
    if (index > -1) {
      devices.value.splice(index, 1)
    }
    const idx = offlineDevices.value.findIndex(d => d.id === deviceId)
    if (idx > -1) {
      offlineDevices.value.splice(idx, 1)
    }
  }

  function updateFromList(idList) {
    if (!Array.isArray(idList)) return
    const activeIds = idList.map(id => typeof id === 'string' ? id : id.device_id)
    processDeviceList(activeIds)
    debugLog('[Store] Device list updated via broadcast:', idList)
  }

  function updateSnapshot(deviceId, base64Data) {
    const index = devices.value.findIndex(d => d.id === deviceId)
    if (index > -1) {
      // 深度更新属性
      devices.value[index].snapshot = `data:image/png;base64,${base64Data}`
      // 触发响应式 (虽然 Vue3 应该能检测到，但重新赋值数组引用更保险)
      devices.value = [...devices.value]
      debugLog(`[Store] Snapshot updated for ${deviceId}, length: ${base64Data.length}`)
    }
  }

  const activeDeviceId = ref(null)
  const activeWebRTC = shallowRef(null)

  const activeDevice = computed(() => 
    devices.value.find(d => d.id === activeDeviceId.value)
  )

  function setActiveDevice(id) {
    activeDeviceId.value = id
  }

  function setActiveWebRTC(webrtcInstance) {
    activeWebRTC.value = webrtcInstance ? markRaw(webrtcInstance) : null
  }

  function clearActiveDevice() {
    activeDeviceId.value = null
    activeWebRTC.value = null
  }

  const deviceHistory = ref({})

  function updateMetrics(deviceId, metrics) {
    const index = devices.value.findIndex(d => d.id === deviceId)
    if (index > -1) {
      devices.value[index].metrics = metrics
      devices.value = [...devices.value]
    }

    if (!deviceHistory.value[deviceId]) {
      deviceHistory.value[deviceId] = {
        cpu: [],
        memory: [],
        disk: [],
        temp: [],
        downSpeed: [],
        upSpeed: [],
        timestamps: []
      }
    }

    const history = deviceHistory.value[deviceId]
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const ss = String(now.getSeconds()).padStart(2, '0')
    const timeStr = `${hh}:${mm}:${ss}`

    history.cpu.push(metrics.cpu || 0)
    history.memory.push(metrics.memory_percent || 0)
    history.disk.push(metrics.disk_percent || 0)
    history.temp.push(metrics.temperature || 0)
    history.downSpeed.push(metrics.download_speed || 0)
    history.upSpeed.push(metrics.upload_speed || 0)
    history.timestamps.push(timeStr)

    if (history.cpu.length > 360) {
      history.cpu.shift()
      history.memory.shift()
      history.disk.shift()
      history.temp.shift()
      history.downSpeed.shift()
      history.upSpeed.shift()
      history.timestamps.shift()
    }

    // 显式触发响应式引用变更以更新大盘折线图
    deviceHistory.value = { ...deviceHistory.value }
  }

  let globalWs = null

  function initSignaling() {
    if (globalWs) return

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const token = localStorage.getItem('auth_token') || ''
    const url = `${protocol}//${location.host}/connect_client?token=${encodeURIComponent(token)}`
    
    debugLog('[Store] Connecting to global signaling:', url)
    globalWs = new WebSocket(url)

    globalWs.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        if (msg.message_type === 'snapshot_update') {
          updateSnapshot(msg.device_id, msg.data)
        } else if (msg.message_type === 'snapshot_updated') {
          // HTTP 模式下的更新通知
          handleSnapshotUpdated(msg.device_id, msg.url)
        } else if (msg.message_type === 'global_settings_updated') {
          localStorage.setItem('cloudphone_settings', JSON.stringify(msg.settings))
          window.dispatchEvent(new CustomEvent('cloudphone-settings-updated', { detail: { deviceId: '' } }))
        } else if (msg.message_type === 'device_list_update') {
          updateFromList(msg.devices)
        } else if (msg.type === 'device_metrics') {
          updateMetrics(msg.device_id, msg.metrics)
        }
      } catch (e) {
        console.error('[Store] Message error:', e)
      }
    }

    globalWs.onclose = () => {
      globalWs = null
      setTimeout(initSignaling, 3000) // 自动重连
    }
  }

  function quitAgent(deviceId) {
    if (!globalWs || globalWs.readyState !== WebSocket.OPEN) {
      console.warn('[Store] Signaling not connected, cannot quit agent')
      return
    }
    globalWs.send(JSON.stringify({
      message_type: 'quit_agent',
      device_id: deviceId
    }))
  }

  function handleSnapshotUpdated(deviceId, url) {
    const index = devices.value.findIndex(d => d.id === deviceId)
    if (index > -1) {
      const token = localStorage.getItem('auth_token') || ''
      // 增加时间戳防止浏览器缓存不刷新，并附加 token 进行鉴权
      devices.value[index].snapshot = url + '?t=' + Date.now() + '&token=' + encodeURIComponent(token)
      devices.value = [...devices.value]
      debugLog(`[Store] Snapshot URL updated for ${deviceId}`)
    }
  }

  return {
    devices,
    offlineDevices,
    loading,
    error,
    activeDeviceId,
    activeWebRTC,
    activeDevice,
    onlineDevices,
    deviceHistory,
    fetchDevices,
    addDevice,
    removeDevice,
    updateFromList,
    updateSnapshot,
    updateMetrics,
    initSignaling, // 导出
    quitAgent,
    setActiveDevice,
    setActiveWebRTC,
    clearActiveDevice
  }
})
