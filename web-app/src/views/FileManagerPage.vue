<template>
  <div class="file-manager-page">
    <!-- 头部设备控制栏 -->
    <div class="fm-page-header">
      <div class="header-title-group">
        <svg class="header-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <h2 class="header-title">文件中心</h2>
      </div>

      <div class="device-selector-group">
        <span class="selector-label">选择设备:</span>
        <select v-model="selectedDeviceId" class="device-select">
          <option value="" disabled>-- 请选择云手机设备 --</option>
          <option v-for="d in deviceStore.onlineDevices" :key="d.id" :value="d.id">
            {{ d.id }} (在线)
          </option>
        </select>
        
        <div class="connection-status" :class="connectionClass">
          <span class="status-indicator"></span>
          <span class="status-text">{{ connectionText }}</span>
        </div>
      </div>
    </div>

    <!-- 隐藏的哑视频，用来满足 useWebRTC.js 对视频流接收的内部要求 -->
    <video ref="dummyVideo" style="display: none;" autoplay playsinline muted></video>

    <!-- 主面板内容 -->
    <div class="fm-page-body">
      <!-- 未选择设备提示 -->
      <div v-if="!selectedDeviceId" class="fm-placeholder-box">
        <svg class="placeholder-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <h3>暂无连接设备</h3>
        <p>请在上方下拉菜单中选择一个在线的云手机设备，以开启 P2P 文件传输通道。</p>
      </div>

      <!-- 连接中/连接出错 -->
      <div v-else-if="webrtcStatus === 'connecting' || webrtcStatus === 'signaling' || webrtcStatus === 'connecting_webrtc'" class="fm-placeholder-box">
        <div class="mini-spinner"></div>
        <h3>正在建立 WebRTC 连接...</h3>
        <p>建立 P2P 隧道中，请稍候...</p>
      </div>

      <div v-else-if="webrtcError" class="fm-placeholder-box error-state">
        <svg class="placeholder-icon-svg error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <h3>连接失败</h3>
        <p class="error-detail">{{ webrtcError }}</p>
        <button class="retry-btn" @click="reconnectDevice">重试连接</button>
      </div>

      <!-- 文件管理器核心界面 -->
      <div v-else class="file-manager-container">
        <!-- 导航及操作栏 -->
        <div class="fm-nav-bar">
          <button class="fm-back-btn" @click="goUpFolder" :disabled="currentPath === '/'">
            <svg class="svg-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span class="btn-text">返回</span>
          </button>
          <div class="fm-path-display">
            <span class="path-label">路径:</span>
            <input v-model="currentPath" @keyup.enter="refreshFileList" class="path-input" />
          </div>
          <button class="fm-action-btn accent" @click="refreshFileList">
            <svg class="svg-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            <span class="btn-text">刷新</span>
          </button>
          <button class="fm-action-btn" @click="showNewFolderPrompt">
            <svg class="svg-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              <line x1="12" y1="11" x2="12" y2="17"></line>
              <line x1="9" y1="14" x2="15" y2="14"></line>
            </svg>
            <span class="btn-text">新建</span>
          </button>
          <label class="fm-upload-label">
            <svg class="svg-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <span class="btn-text">上传</span>
            <input type="file" @change="onFileSelected" style="display:none" />
          </label>
        </div>

        <!-- 列表容器（支持文件拖拽） -->
        <div 
          class="fm-list-wrapper"
          @dragover.prevent="dragOver = true"
          @dragleave="dragOver = false"
          @drop.prevent="onFileDropped"
          :class="{'drag-over': dragOver}"
        >
          <div v-if="dragOver" class="drag-overlay">
            <div class="drag-hint">释放鼠标以上传至当前目录</div>
          </div>

          <div v-if="filesLoading" class="fm-loading">正在载入文件列表...</div>
          <div v-else-if="fileList.length === 0" class="fm-empty-hint">空目录或无权限</div>
          <table v-else class="fm-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>大小</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="file in fileList" :key="file.path" class="fm-row" @dblclick="onRowDblClick(file)">
                <td class="fm-name-col-cell">
                  <div class="file-name-cell">
                    <svg v-if="file.is_dir" class="file-icon folder-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6H12L10 4Z" fill="#e0a924"/>
                    </svg>
                    <svg v-else class="file-icon file-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2ZM16 18H8V16H16V18ZM16 14H8V12H16V14ZM13 9V3.5L18.5 9H13Z" fill="#8b949e"/>
                    </svg>
                    <span class="file-name-txt">{{ file.name }}</span>
                  </div>
                </td>
                <td class="fm-size-cell">{{ file.is_dir ? '-' : formatFileSize(file.size) }}</td>
                <td class="fm-actions-col-cell">
                  <div class="fm-actions-cell">
                    <button v-if="!file.is_dir" class="row-btn" @click="downloadFile(file)" title="下载">
                      <svg class="row-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      <span class="row-btn-text">下载</span>
                    </button>
                    <button v-if="!file.is_dir && file.name.endsWith('.apk')" class="row-btn accent" @click="installApkFromFile(file)" title="一键安装">
                      <svg class="row-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="16 16 12 12 8 16"></polyline>
                        <line x1="12" y1="12" x2="12" y2="21"></line>
                        <path d="M20.8 4.6a2 2 0 0 0-1.8-1.1H5a2 2 0 0 0-1.8 1.1L1 10h22z"></path>
                      </svg>
                      <span class="row-btn-text">安装</span>
                    </button>
                    <button class="row-btn danger" @click="deleteFile(file)" title="删除">
                      <svg class="row-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                      <span class="row-btn-text">删除</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 传输进度监控 -->
        <div v-if="activeTransfers.length > 0" class="fm-transfer-section">
          <div class="transfer-title">传输任务进度</div>
          <div class="transfer-list">
            <div v-for="t in activeTransfers" :key="t.id" class="transfer-card">
              <span class="transfer-name" :title="t.name">{{ t.name }}</span>
              <span class="transfer-info">{{ t.type === 'upload' ? '上传' : '下载' }} ({{ t.progress }}%)</span>
              <div class="transfer-progress-bar">
                <div class="progress-fill" :style="{width: t.progress + '%'}"></div>
              </div>
              <button v-if="t.progress >= 100 || t.status === 'success' || t.status === 'failed'" class="close-card" @click="removeTransfer(t.id)">✕</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import { useWebRTC } from '@/composables/useWebRTC'

const deviceStore = useDeviceStore()
const selectedDeviceId = ref('')
const dummyVideo = ref(null)

// WebRTC 状态
let webrtc = null
let unwatchStatus = null
let unwatchError = null
let unwatchReady = null
let isSharedConnection = false
const webrtcStatus = ref('disconnected')
const webrtcError = ref(null)
const isFileChannelReady = ref(false)

// 文件列表相关
const currentPath = ref('/sdcard')
const fileList = ref([])
const filesLoading = ref(false)
const dragOver = ref(false)
const activeTransfers = ref([]) // { id, name, type, progress, status, total, loaded }
let transferIdSeq = 0

// 缓存下载/上传中的会话
const downloadSessions = {}
const uploadSessions = {}

// 计算连接状态文案与类名
const connectionText = computed(() => {
  if (!selectedDeviceId.value) return '未连接'
  if (isFileChannelReady.value) return '已建立 P2P 通道'
  if (webrtcError.value) return '连接错误'
  if (webrtcStatus.value === 'connecting' || webrtcStatus.value === 'signaling' || webrtcStatus.value === 'connecting_webrtc') {
    return '正在建立隧道...'
  }
  return '未连接'
})

const connectionClass = computed(() => {
  if (!selectedDeviceId.value) return 'disconnected'
  if (isFileChannelReady.value) return 'connected'
  if (webrtcError.value) return 'error'
  return 'connecting'
})

// 初始化与释放 WebRTC
function cleanWebRTC() {
  if (unwatchStatus) { unwatchStatus(); unwatchStatus = null }
  if (unwatchError) { unwatchError(); unwatchError = null }
  if (unwatchReady) { unwatchReady(); unwatchReady = null }

  if (webrtc) {
    if (!isSharedConnection) {
      webrtc.disconnect()
    } else {
      webrtc.onFileChannelMessage(null)
    }
    webrtc = null
  }
  isSharedConnection = false
  webrtcStatus.value = 'disconnected'
  webrtcError.value = null
  isFileChannelReady.value = false
  fileList.value = []
  activeTransfers.value = []
}

function reconnectDevice() {
  if (selectedDeviceId.value) {
    const id = selectedDeviceId.value
    selectedDeviceId.value = ''
    setTimeout(() => {
      selectedDeviceId.value = id
    }, 100)
  }
}

watch(selectedDeviceId, (newId) => {
  console.log('[FileManager] selectedDeviceId changed to:', newId, 'activeDeviceId:', deviceStore.activeDeviceId, 'activeWebRTC:', !!deviceStore.activeWebRTC)
  cleanWebRTC()
  if (newId) {
    // 智能检查：如果当前右侧正开启了该设备的云手机窗口，则直接共享复用其 WebRTC 实例！
    if (deviceStore.activeDeviceId === newId && deviceStore.activeWebRTC) {
      webrtc = deviceStore.activeWebRTC
      isSharedConnection = true
      console.log('[FileManager] Reusing active WebRTC session for device:', newId, 'fileChannelReady:', webrtc?.fileChannelReady?.value, 'status:', webrtc?.status?.value)
    } else {
      // 独立建立 webrtc 通道，只做文件管理
      webrtc = useWebRTC(newId, {
        audio: false // 纯文件管理不需要音频
      })
      isSharedConnection = false
      console.log('[FileManager] Initializing standalone WebRTC connection for device:', newId)
    }
    
    // 监听 WebRTC 基础状态
    unwatchStatus = watch(() => webrtc?.status?.value, (newStatus) => {
      console.log('[FileManager] webrtc status changed:', newStatus)
      webrtcStatus.value = newStatus || 'disconnected'
    }, { immediate: true })

    unwatchError = watch(() => webrtc?.error?.value, (newErr) => {
      console.log('[FileManager] webrtc error changed:', newErr)
      webrtcError.value = newErr || null
    }, { immediate: true })

    unwatchReady = watch(() => webrtc?.fileChannelReady?.value, (ready) => {
      console.log('[FileManager] webrtc fileChannelReady changed:', ready)
      isFileChannelReady.value = !!ready
      if (ready) {
        if (!currentPath.value) {
          currentPath.value = '/sdcard'
        }
        refreshFileList()
      }
    }, { immediate: true })

    if (isSharedConnection) {
      // 共享连接已在正常运行，仅绑定文件回调并触发初始化刷新
      console.log('[FileManager] Setting up message listener for shared WebRTC')
      webrtc.onFileChannelMessage((data) => {
        handleFileChannelMessage(data)
      })
      if (isFileChannelReady.value) {
        console.log('[FileManager] fileChannel already ready, triggering refresh')
        refreshFileList()
      }
    } else {
      // 独立连接绑定哑视频并启动
      setTimeout(() => {
        if (webrtc && dummyVideo.value) {
          console.log('[FileManager] Connecting standalone WebRTC')
          webrtc.setVideoGetter(() => dummyVideo.value)
          webrtc.onFileChannelMessage((data) => {
            handleFileChannelMessage(data)
          })
          webrtc.connect()
        }
      }, 50)
    }
  }
})

// 页面销毁时主动断开连接
onUnmounted(() => {
  cleanWebRTC()
})

// 列表及基本操作
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function refreshFileList() {
  console.log('[FileManager] refreshFileList called. path:', currentPath.value, 'ready:', isFileChannelReady.value, 'webrtc:', !!webrtc)
  if (!isFileChannelReady.value || !webrtc) {
    return
  }
  filesLoading.value = true
  const success = webrtc.sendFileChannelCmd({
    type: 'list',
    path: currentPath.value
  })
  console.log('[FileManager] list command sent, success:', success)
}

function onRowDblClick(file) {
  if (file.is_dir) {
    currentPath.value = file.path
    refreshFileList()
  } else {
    downloadFile(file)
  }
}

function goUpFolder() {
  const parts = currentPath.value.split('/').filter(Boolean)
  if (parts.length > 0) {
    parts.pop()
    currentPath.value = '/' + parts.join('/')
    refreshFileList()
  }
}

function showNewFolderPrompt() {
  const name = prompt('请输入新建文件夹名称:')
  if (!name) return
  const newPath = currentPath.value.endsWith('/') ? currentPath.value + name : currentPath.value + '/' + name
  webrtc.sendFileChannelCmd({
    type: 'mkdir',
    path: newPath
  })
}

function deleteFile(file) {
  if (!confirm(`确认要删除 ${file.is_dir ? '文件夹' : '文件'} "${file.name}" 吗？\n警告：删除后无法恢复！`)) return
  webrtc.sendFileChannelCmd({
    type: 'delete',
    path: file.path
  })
}

function downloadFile(file) {
  if (downloadSessions[file.name]) {
    alert('该文件正在下载中，请勿重复操作')
    return
  }
  
  const id = ++transferIdSeq
  activeTransfers.value.push({
    id,
    name: file.name,
    type: 'download',
    progress: 0,
    status: 'transferring',
    total: file.size,
    loaded: 0
  })

  downloadSessions[file.name] = {
    id,
    chunks: [],
    loaded: 0,
    total: file.size
  }

  webrtc.sendFileChannelCmd({
    type: 'download_start',
    path: file.path
  })
}

function installApkFromFile(file) {
  if (!confirm(`确认要在云手机中静默安装 "${file.name}" 吗？`)) return
  webrtc.sendCommand({
    cmd: `pm install -r -t "${file.path}"`
  })
  alert(`静默安装指令已下发！您可以在终端中监控对应的安装状态。`)
}

function onFileSelected(e) {
  const file = e.target.files[0]
  if (!file) return
  startUploadFile(file)
}

function onFileDropped(e) {
  dragOver.value = false
  const file = e.dataTransfer.files[0]
  if (!file) return
  startUploadFile(file)
}

async function startUploadFile(file) {
  if (!isFileChannelReady.value || !webrtc) {
    alert('通道尚未建立，无法上传文件！')
    return
  }

  const isApk = file.name.endsWith('.apk')
  let installOnFinish = false
  if (isApk) {
    installOnFinish = confirm(`检测到您上传的是 Android 安装包 "${file.name}"，是否在传输完成后自动安装到云手机？`)
  }

  const destPath = currentPath.value.endsWith('/') 
    ? currentPath.value + file.name 
    : currentPath.value + '/' + file.name

  const id = ++transferIdSeq
  const transfer = {
    id,
    name: file.name,
    type: 'upload',
    progress: 0,
    status: 'transferring',
    total: file.size,
    loaded: 0
  }
  activeTransfers.value.push(transfer)

  webrtc.sendFileChannelCmd({
    type: 'upload_start',
    path: destPath,
    size: file.size,
    install_on_finish: installOnFinish
  })

  uploadSessions[destPath] = {
    id,
    file,
    offset: 0,
    installOnFinish,
    destPath
  }
}

async function sendNextChunks(session) {
  // 修改为标准的 16KB，防止底层 WebRTC / Pion SCTP 抛出 short buffer 错误
  const chunkSize = 16384
  const file = session.file
  let chunkCount = 0

  while (session.offset < file.size) {
    if (!webrtc) break
    const buffered = webrtc.getFileChannelBufferedAmount()
    if (buffered > 256 * 1024) {
      await new Promise(resolve => setTimeout(resolve, 30))
      continue
    }

    const start = session.offset
    const end = Math.min(start + chunkSize, file.size)
    const blobSlice = file.slice(start, end)

    const arrayBuffer = await blobSlice.arrayBuffer()
    if (!webrtc) break
    const success = webrtc.sendFileChannelChunk(arrayBuffer)
    if (success) {
      session.offset = end
      const t = activeTransfers.value.find(x => x.id === session.id)
      if (t) {
        t.loaded = end
        t.progress = Math.min(Math.floor((end / file.size) * 100), 99)
      }
      
      chunkCount++
      // 每次成功发送一个分片后，均强制微小挂起 2ms，让出主线程以便浏览器将数据推入底层协议栈并准确更新 bufferedAmount
      await new Promise(resolve => setTimeout(resolve, 2))
    } else {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
}

let activeDownloadSession = null

function handleFileChannelMessage(data) {
  if (data instanceof ArrayBuffer) {
    if (activeDownloadSession) {
      activeDownloadSession.chunks.push(data)
      activeDownloadSession.loaded += data.byteLength
      
      const t = activeTransfers.value.find(x => x.id === activeDownloadSession.id)
      if (t) {
        t.loaded = activeDownloadSession.loaded
        t.progress = Math.min(Math.floor((activeDownloadSession.loaded / activeDownloadSession.total) * 100), 100)
      }

      if (activeDownloadSession.loaded >= activeDownloadSession.total) {
        // 拼接下载
        const blob = new Blob(activeDownloadSession.chunks)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const matchedName = Object.keys(downloadSessions).find(k => downloadSessions[k].id === activeDownloadSession.id)
        a.download = matchedName || 'downloaded_file'
        a.click()
        URL.revokeObjectURL(url)

        if (t) {
          t.progress = 100
          t.status = 'success'
        }
        if (matchedName) {
          delete downloadSessions[matchedName]
        }
        activeDownloadSession = null
      }
    }
    return
  }

  try {
    const msg = JSON.parse(data)
    console.log('[FileManager] Received JSON msg from channel:', msg.type || msg.message_type, msg)
    switch (msg.type) {
      case 'list_reply':
        filesLoading.value = false
        if (msg.success) {
          fileList.value = msg.files || []
        } else {
          alert('读取文件列表失败: ' + msg.error)
        }
        break

      case 'mkdir_reply':
        if (msg.success) {
          refreshFileList()
        } else {
          alert('创建目录失败: ' + msg.error)
        }
        break

      case 'delete_reply':
        if (msg.success) {
          refreshFileList()
        } else {
          alert('删除失败: ' + msg.error)
        }
        break

      case 'upload_reply':
        if (msg.success) {
          let matched = null
          if (msg.path) {
            matched = uploadSessions[msg.path]
          }
          if (!matched) {
            matched = Object.values(uploadSessions).find(s => s.offset === 0) || Object.values(uploadSessions)[0]
          }
          if (matched) {
            sendNextChunks(matched)
          } else {
            console.error('[FileManager] No active upload session matched for start', msg)
          }
        } else {
          alert('开始上传文件失败: ' + msg.error)
        }
        break

      case 'upload_ack':
        {
          let matched = null
          if (msg.path) {
            matched = uploadSessions[msg.path]
          }
          if (!matched) {
            matched = Object.values(uploadSessions)[0]
          }
          
          if (msg.finished) {
            const sessionKey = Object.keys(uploadSessions).find(k => uploadSessions[k].id === (matched?.id || msg.id))
            const t = activeTransfers.value.find(x => x.id === (matched?.id || msg.id))
            if (t) {
              t.progress = 100
              t.status = msg.installOnFinish ? 'installing' : 'success'
              if (sessionKey) delete uploadSessions[sessionKey]
              refreshFileList()
            }
          }
        }
        break

      case 'download_reply':
        if (msg.success) {
          activeDownloadSession = downloadSessions[msg.name]
        } else {
          alert('开始下载文件失败: ' + msg.error)
        }
        break

      case 'install_status':
        const target = activeTransfers.value.find(x => x.type === 'upload' && (x.status === 'installing' || x.status === 'transferring'))
        if (target) {
          if (msg.status === 'success') {
            target.status = 'success'
            alert('APK 静默安装成功！')
          } else if (msg.status === 'error') {
            target.status = 'failed'
            alert(msg.message)
          }
        }
        break
    }
  } catch (e) {
    console.error('[FileChannel] Failed to parse message JSON:', e)
  }
}

function removeTransfer(id) {
  activeTransfers.value = activeTransfers.value.filter(x => x.id !== id)
}

onMounted(() => {
  // 如果当前 store 中有正在被激活的设备，则默认作为当前选中的设备
  if (deviceStore.activeDeviceId) {
    selectedDeviceId.value = deviceStore.activeDeviceId
  }
})
</script>

<style scoped>
.file-manager-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--bg-primary, #0d1117);
  color: #c9d1d9;
}

.fm-page-header {
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
  border-radius: 55%;
  background: #8b949e;
}

.connection-status.connected .status-indicator {
  background: #3fb950;
  box-shadow: 0 0 8px rgba(63, 185, 80, 0.5);
}

.connection-status.connecting .status-indicator {
  background: #dbb32d;
  animation: status-pulse 1s infinite alternate;
}

.connection-status.error .status-indicator {
  background: #f85149;
}

.status-text {
  font-weight: 500;
}

@keyframes status-pulse {
  0% { opacity: 0.4; }
  100% { opacity: 1; }
}

.fm-page-body {
  flex: 1;
  overflow: hidden;
  display: flex;
}

.fm-placeholder-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px;
}

.placeholder-icon-svg {
  width: 48px;
  height: 48px;
  margin-bottom: 16px;
  opacity: 0.4;
  color: var(--accent, #58a6ff);
}

.fm-placeholder-box h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #eee;
}

.fm-placeholder-box p {
  color: #8b949e;
  font-size: 14px;
  max-width: 400px;
  margin: 0 0 20px 0;
  line-height: 1.5;
}

.fm-placeholder-box.error h3 {
  color: #f85149;
}

.error-detail {
  font-family: monospace;
  background: rgba(248, 81, 73, 0.1);
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid rgba(248, 81, 73, 0.2);
}

.retry-btn {
  background: var(--accent, #58a6ff);
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.retry-btn:hover {
  background: #1f85ff;
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

/* 核心管理器样式 */
.file-manager-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  background: var(--bg-primary, #0d1117);
  overflow: hidden;
}

.fm-nav-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-secondary, #161b22);
  padding: 12px 24px;
  border-bottom: 1px solid var(--border, #30363d);
}

.fm-back-btn, .fm-action-btn, .fm-upload-label {
  background: #21262d;
  color: #c9d1d9;
  border: 1px solid #30363d;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  user-select: none;
}

.svg-btn-icon {
  width: 14px;
  height: 14px;
  margin-right: 6px;
  flex-shrink: 0;
}

.fm-back-btn:hover:not(:disabled), .fm-action-btn:hover, .fm-upload-label:hover {
  background: #30363d;
  border-color: #8b949e;
}

.fm-back-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.fm-action-btn.accent, .fm-upload-label {
  background: var(--accent, #58a6ff);
  border-color: var(--accent, #58a6ff);
  color: #ffffff;
}

.fm-action-btn.accent:hover, .fm-upload-label:hover {
  background: #1f85ff;
  border-color: #1f85ff;
}

.fm-path-display {
  display: flex;
  align-items: center;
  flex: 1;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 6px 12px;
}

.path-label {
  font-size: 12px;
  color: #8b949e;
  margin-right: 8px;
}

.path-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #c9d1d9;
  font-size: 13px;
  font-family: monospace;
  outline: none;
}

.fm-list-wrapper {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

.fm-list-wrapper.drag-over {
  background: rgba(88, 166, 255, 0.05);
  border: 2px dashed var(--accent, #58a6ff);
}

.drag-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(13, 17, 23, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  pointer-events: none;
}

.drag-hint {
  color: var(--accent, #58a6ff);
  font-size: 16px;
  font-weight: 600;
  border: 2px dashed var(--accent, #58a6ff);
  padding: 24px 48px;
  border-radius: 8px;
  animation: breathe 1.5s infinite ease-in-out;
}

@keyframes breathe {
  0%, 100% { opacity: 0.6; transform: scale(0.98); }
  50% { opacity: 1; transform: scale(1.02); }
}

.fm-loading, .fm-empty-hint {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
  color: #8b949e;
  font-size: 14px;
}

.fm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  text-align: left;
}

.fm-table th {
  background: var(--bg-secondary, #161b22);
  color: #8b949e;
  font-weight: 600;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border, #30363d);
  position: sticky;
  top: 0;
  z-index: 2;
}

.fm-table td {
  padding: 10px 24px;
  border-bottom: 1px solid #21262d;
  color: #c9d1d9;
  vertical-align: middle;
}

.fm-row {
  cursor: pointer;
  transition: background 0.15s ease;
}

.fm-row:hover {
  background: #1f242c;
}

.fm-name-col-cell {
  vertical-align: middle;
}

.file-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
  color: #f0f6fc;
}

.file-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: inline-block;
  vertical-align: middle;
}

.file-name-txt {
  max-width: 500px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.fm-size-cell {
  vertical-align: middle;
}

.fm-actions-col-cell {
  vertical-align: middle;
}

.fm-actions-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.row-btn {
  background: #21262d;
  color: #c9d1d9;
  border: 1px solid #30363d;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.row-btn-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.row-btn:hover {
  background: #30363d;
  color: #fff;
  border-color: #8b949e;
}

.row-btn.accent {
  background: var(--accent, #58a6ff);
  border-color: var(--accent, #58a6ff);
  color: #fff;
}

.row-btn.accent:hover {
  background: #1f85ff;
  border-color: #1f85ff;
}

.row-btn.danger {
  background: transparent;
  border-color: rgba(248, 81, 73, 0.4);
  color: #f85149;
}

.row-btn.danger:hover {
  background: rgba(248, 81, 73, 0.15);
  border-color: #f85149;
}

/* 传输面板样式 */
.fm-transfer-section {
  border-top: 1px solid var(--border, #30363d);
  background: var(--bg-secondary, #161b22);
  padding: 16px 24px;
  max-height: 160px;
  overflow-y: auto;
}

.transfer-title {
  font-size: 12px;
  color: #8b949e;
  font-weight: 600;
  margin-bottom: 12px;
  text-transform: uppercase;
}

.transfer-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.transfer-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #0d1117;
  border: 1px solid #30363d;
  padding: 8px 16px;
  border-radius: 6px;
}

.transfer-name {
  font-size: 12px;
  font-weight: 500;
  color: #f0f6fc;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.transfer-info {
  font-size: 11px;
  color: #8b949e;
  min-width: 90px;
}

.transfer-progress-bar {
  flex: 1;
  height: 6px;
  background: #21262d;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent, #58a6ff);
  border-radius: 3px;
  transition: width 0.1s linear;
}

.close-card {
  background: none;
  border: none;
  color: #8b949e;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 4px;
}

.close-card:hover {
  color: #f0f6fc;
}

/* 移动端响应式适配 */
@media (max-width: 768px) {
  .fm-page-header {
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
    gap: 8px;
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

  /* 导航及操作栏移动端单行紧凑排列 */
  .fm-nav-bar {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
  }

  .fm-path-display {
    flex: 1;
    padding: 4px 6px;
  }

  .path-label {
    display: none; /* 移动端隐藏路径标签 */
  }

  .path-input {
    font-size: 12px;
    padding: 4px 8px;
    height: 32px;
  }

  .btn-text {
    display: none; /* 移动端只保留小图标按钮 */
  }

  .svg-btn-icon {
    margin-right: 0 !important;
  }

  /* 移动端统一调整操作按钮 */
  .fm-back-btn, .fm-action-btn, .fm-upload-label {
    padding: 6px 0;
    font-size: 14px;
    justify-content: center;
    align-items: center;
    width: 34px;
    height: 32px;
    flex-shrink: 0;
    text-align: center;
  }

  .fm-table th, .fm-table td {
    padding: 8px 6px;
    font-size: 13px;
  }

  .fm-table th:nth-child(1), .fm-table td:nth-child(1) {
    width: 60%;
    max-width: 0;
  }

  .fm-table th:nth-child(2), .fm-table td:nth-child(2) {
    width: 15%;
    text-align: center;
    white-space: nowrap;
  }

  .fm-table th:nth-child(3), .fm-table td:nth-child(3) {
    width: 25%;
    text-align: right;
  }

  .file-name-txt {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .fm-actions-cell {
    display: flex;
    justify-content: flex-end;
    flex-wrap: nowrap !important;
    gap: 6px;
  }

  .row-btn {
    width: 28px;
    height: 28px;
    padding: 0 !important;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50% !important;
    flex-shrink: 0;
  }

  .row-btn-text {
    display: none !important;
  }

  .row-btn-icon {
    width: 14px;
    height: 14px;
  }

  .fm-transfer-section {
    padding: 10px 16px;
    max-height: 120px;
  }

  .transfer-card {
    padding: 6px 12px;
    gap: 8px;
  }

  .transfer-name {
    max-width: 80px;
  }
}
</style>
