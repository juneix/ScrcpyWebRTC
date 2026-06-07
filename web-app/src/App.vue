<template>
  <div v-if="!authStore.isLoggedIn" style="width: 100vw; height: 100vh;">
    <Login />
  </div>
  <div v-else class="app-container" :class="{ 'is-resizing': isResizing }">
    <!-- 1. 全局侧边导航 (仅PC显示) -->
    <nav class="side-nav" :class="{ expanded: isNavExpanded }" v-if="!isMobile">
      <button class="nav-brand" @click="isNavExpanded = !isNavExpanded" :title="isNavExpanded ? '收起侧边栏' : '展开侧边栏'">
        <svg class="nav-brand-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
        </svg>
        <span class="nav-brand-text">云虚机</span>
        <span class="nav-brand-collapse-arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="11 17 6 12 11 7"></polyline>
            <polyline points="18 17 13 12 18 7"></polyline>
          </svg>
        </span>
      </button>
      <div class="nav-links">
        <a href="javascript:void(0)" @click="navigateTo('/')" class="nav-item" :class="{ active: !showDeployPage && !showFilePage && !showTerminalPage && !showMonitorPage }">
          <svg class="nav-item-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
            <line x1="12" y1="18" x2="12.01" y2="18"></line>
          </svg>
          <span class="nav-item-text">虚机</span>
        </a>
        <a href="javascript:void(0)" @click="navigateTo('/monitor')" class="nav-item" :class="{ active: showMonitorPage }">
          <svg class="nav-item-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          <span class="nav-item-text">大盘</span>
        </a>
        <a href="javascript:void(0)" @click="navigateTo('/files')" class="nav-item" :class="{ active: showFilePage }">
          <svg class="nav-item-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <span class="nav-item-text">文件</span>
        </a>
        <a href="javascript:void(0)" @click="navigateTo('/deploy')" class="nav-item" :class="{ active: showDeployPage }">
          <svg class="nav-item-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="7" y="2" width="10" height="7" rx="1"></rect>
            <line x1="10" y1="5.5" x2="10" y2="5.51"></line>
            <line x1="14" y1="5.5" x2="14" y2="5.51"></line>
            <path d="M6 9h12v5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9z"></path>
            <path d="M12 16v6"></path>
          </svg>
          <span class="nav-item-text">部署</span>
        </a>
        <a href="javascript:void(0)" @click="navigateTo('/admin')" class="nav-item" :class="{ active: showUserAdminPage }" v-if="authStore.role === 'admin'">
          <svg class="nav-item-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span class="nav-item-text">管理</span>
        </a>
        <a href="javascript:void(0)" @click="handleLogout" class="nav-item logout-nav-item" title="退出登录">
          <svg class="nav-item-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span class="nav-item-text">退出</span>
        </a>
      </div>
      <div class="nav-tag-group" v-if="!showDeployPage && !showFilePage && !showMonitorPage">
        <div class="nav-tag-group-title">
          <span>标签</span>
          <button class="nav-tag-manage-btn" @click="openTagManager">
            <span class="manage-plus">+</span>
            <span class="manage-text">管理</span>
          </button>
        </div>
        <div class="nav-tag-list">
          <button
            class="nav-tag-item"
            :class="{ active: tagStore.selectedTagId === '' }"
            @click="tagStore.setSelectedTag('')"
            title="全部设备"
          >
            <span class="nav-tag-dot all"></span>
            <span class="nav-tag-name">全部设备</span>
            <span class="nav-tag-count">{{ deviceStore.devices.length }}</span>
          </button>
          <button
            v-for="tag in tagStore.tags"
            :key="tag.id"
            class="nav-tag-item"
            :class="{ active: tagStore.selectedTagId === tag.id }"
            :title="tag.name"
            @click="toggleTag(tag.id)"
          >
            <span class="nav-tag-dot" :style="{ background: tag.color }"></span>
            <span class="nav-tag-name">{{ tag.name }}</span>
            <span class="nav-tag-count">{{ getTagDeviceCount(tag.id) }}</span>
          </button>
        </div>
      </div>
    </nav>

    <!-- 2. 主内容区域 -->
    <main class="main-content" id="main-layout-content">
      <header class="top-bar" v-if="!isMobile">
        <h1 class="page-title">{{ showDeployPage ? '云端自动化部署' : (showFilePage ? '云设备文件中心' : (showMonitorPage ? '云监控实时大盘' : '云虚机矩阵')) }}</h1>
        <div class="header-user-card">
          <div class="user-avatar" :title="authStore.username + ' (' + (authStore.role === 'admin' ? '管理员' : '普通用户') + ')'">
            {{ authStore.username ? authStore.username.substring(0, 1).toUpperCase() : 'U' }}
          </div>
          <span class="user-name" :title="authStore.username">{{ authStore.username }}</span>
          <span class="user-role-badge" :class="authStore.role">
            {{ authStore.role === 'admin' ? '管理员' : '普通用户' }}
          </span>
        </div>
      </header>
      
      <section class="viewport">
        <transition name="fade" mode="out-in">
          <DeviceList v-if="!showDeployPage && !showFilePage && !showTerminalPage && !showMonitorPage && !showUserAdminPage" />
          <UserAdminPage v-else-if="showUserAdminPage" />
          <DeployPage v-else-if="showDeployPage" />
          <FileManagerPage v-else-if="showFilePage" />
          <Dashboard v-else-if="showMonitorPage" />
          <TerminalPage v-else />
        </transition>
      </section>
    </main>

    <!-- 3. 右侧控制面板 (支持悬浮和拉伸) -->
    <aside 
      class="control-panel-wrapper" 
      :class="{ 
        'is-open': !!deviceStore.activeDeviceId && !showTerminalPage && !showDeployPage && !showMonitorPage,
        'is-floating': isFloating && !isMobile,
        'is-mobile': isMobile
      }"
      :style="panelStyle"
    >
      <!-- 调整大小的手柄 (PC固定模式) -->
      <div class="side-resizer" v-if="!isFloating && !isMobile" @mousedown="startResizing('left', $event)"></div>
      
      <!-- 悬浮模式的缩放手柄 -->
      <template v-if="isFloating && !isMobile">
        <div class="resize-handle top" @mousedown="startResizing('top', $event)"></div>
        <div class="resize-handle bottom" @mousedown="startResizing('bottom', $event)"></div>
        <div class="resize-handle left" @mousedown="startResizing('left', $event)"></div>
        <div class="resize-handle right" @mousedown="startResizing('right', $event)"></div>
        <div class="resize-corner bottom-right" @mousedown="startResizing('bottom-right', $event)"></div>
      </template>

      <!-- 面板内容区 -->
      <div class="panel-inner" v-if="deviceStore.activeDeviceId">
        <!-- 仅在 PC 端显示的头部 -->
        <header class="panel-top-bar" v-if="!isMobile" @mousedown="startDragging">
          <div class="vm-info">
            <span class="status-dot online"></span>
            <span class="vm-id">{{ deviceStore.activeDeviceId }}</span>
          </div>
          <div class="panel-tools" @mousedown.stop @click.stop>
            <button class="tool-btn" @click="toggleFloating" :title="isFloating ? '固定面板' : '悬浮面板'">
              <svg v-if="isFloating" class="tool-btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="17" x2="12" y2="22"></line>
                <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.58A2 2 0 0 1 15 9.18V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.18a2 2 0 0 1-.78 1.24l-2.78 3.58A2 2 0 0 0 5 15.24z"></path>
              </svg>
              <svg v-else class="tool-btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
              </svg>
            </button>
            <button class="tool-btn close" @click="closePanel" title="关闭">
              <svg class="tool-btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </header>

        <div class="panel-main">
           <!-- 渲染 DeviceClient -->
           <DeviceClient v-if="deviceStore.activeDeviceId" :deviceId="deviceStore.activeDeviceId" @recommend-layout="handleRecommendLayout" />
        </div>
      </div>

      <div class="panel-empty" v-else>
        <div class="hint-icon-wrapper">
          <svg class="hint-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
            <line x1="12" y1="18" x2="12.01" y2="18"></line>
          </svg>
        </div>
        <p>在左侧选择虚机<br/>开启远程控制</p>
      </div>
    </aside>

    <!-- 4. 移动端底部导航栏 (仅在主视图显示活跃虚机视频时才隐藏，在文件、终端或列表页均保持可见) -->
    <nav class="mobile-bottom-nav" v-if="isMobile && (showFilePage || showTerminalPage || showDeployPage || showMonitorPage || !deviceStore.activeDeviceId)">
      <button @click="navigateTo('/')" class="mobile-nav-item" :class="{ active: !showDeployPage && !showFilePage && !showTerminalPage && !showMonitorPage }">
        <svg class="mobile-nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
          <line x1="12" y1="18" x2="12.01" y2="18"></line>
        </svg>
        <span class="mobile-nav-text">虚机</span>
      </button>
      <button @click="navigateTo('/monitor')" class="mobile-nav-item" :class="{ active: showMonitorPage }">
        <svg class="mobile-nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
        <span class="mobile-nav-text">大盘</span>
      </button>
      <button @click="navigateTo('/files')" class="mobile-nav-item" :class="{ active: showFilePage }">
        <svg class="mobile-nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <span class="mobile-nav-text">文件</span>
      </button>
      <button @click="navigateTo('/terminal')" class="mobile-nav-item" :class="{ active: showTerminalPage }">
        <svg class="mobile-nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="4 17 10 11 4 5"></polyline>
          <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
        <span class="mobile-nav-text">终端</span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDeviceStore } from '@/stores/devices'
import { useTagStore } from '@/stores/tags'
import { useAuthStore } from '@/stores/auth'
import DeviceClient from '@/views/DeviceClient.vue'
import DeviceList from '@/views/DeviceList.vue'
import DeployPage from '@/views/DeployPage.vue'
import FileManagerPage from '@/views/FileManagerPage.vue'
import TerminalPage from '@/views/TerminalPage.vue'
import Dashboard from '@/views/Dashboard.vue'
import Login from '@/views/Login.vue'
import UserAdminPage from '@/views/UserAdminPage.vue'

const deviceStore = useDeviceStore()
const tagStore = useTagStore()
const authStore = useAuthStore()

function handleLogout() {
  authStore.logout()
}

const isMobile = ref(window.innerWidth <= 1024)
const isFloating = ref(false)
const isResizing = ref(false)
const userAdjusted = ref(false)
const showDeployPage = ref(false)
const showFilePage = ref(false)
const showTerminalPage = ref(false)
const showMonitorPage = ref(false)
const showUserAdminPage = ref(false)
const isNavExpanded = ref(false)

const floatPos = ref({ x: 100, y: 100 })
const floatSize = ref({ w: 600, h: 800 })
const sideWidth = ref(420)

// 动态样式计算
const panelStyle = computed(() => {
  if (isMobile.value) return {}
  // 面板关闭或者处于文件/终端/部署/大盘页面时不设置宽度
  if (!deviceStore.activeDeviceId || showTerminalPage.value || showDeployPage.value || showMonitorPage.value) return { width: '0px' }
  if (isFloating.value) {
    return {
      position: 'fixed',
      left: `${floatPos.value.x}px`,
      top: `${floatPos.value.y}px`,
      width: `${floatSize.value.w}px`,
      height: `${floatSize.value.h}px`,
      transform: 'none'
    }
  }
  return { width: `${sideWidth.value}px` }
})

// 处理子组件建议的布局
function handleRecommendLayout({ isLandscape, ratio }) {
  if (isMobile.value || userAdjusted.value) return
  
  if (isFloating.value) {
    const targetW = isLandscape ? Math.min(window.innerWidth * 0.7, 900) : 500
    const targetH = targetW / ratio
    floatSize.value = { w: targetW, h: Math.min(targetH, window.innerHeight * 0.85) }
  } else {
    if (isLandscape) {
      sideWidth.value = Math.min(window.innerWidth * 0.7, window.innerHeight * ratio + 40)
    } else {
      sideWidth.value = 420
    }
  }
}

function toggleFloating() {
  if (!isFloating.value) {
    floatPos.value = { x: window.innerWidth - floatSize.value.w - 40, y: 80 }
  }
  isFloating.value = !isFloating.value
}

// 拖拽逻辑
let dragOffset = { x: 0, y: 0 }
function startDragging(e) {
  if (!isFloating.value || isMobile.value) return
  isResizing.value = true
  dragOffset = { x: e.clientX - floatPos.value.x, y: e.clientY - floatPos.value.y }
  const onMove = (ev) => {
    floatPos.value.x = ev.clientX - dragOffset.x
    floatPos.value.y = ev.clientY - dragOffset.y
  }
  const onUp = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
}

// 缩放逻辑
function startResizing(type, e) {
  e.preventDefault(); e.stopPropagation()
  isResizing.value = true; userAdjusted.value = true
  const initial = { 
    x: floatPos.value.x, y: floatPos.value.y, 
    w: floatSize.value.w, h: floatSize.value.h, 
    sw: sideWidth.value, px: e.clientX, py: e.clientY 
  }
  const onMove = (ev) => {
    const dx = ev.clientX - initial.px, dy = ev.clientY - initial.py
    if (!isFloating.value) {
      const newWidth = initial.sw - dx
      if (newWidth > 300 && newWidth < window.innerWidth * 0.9) sideWidth.value = newWidth
      return
    }
    if (type.includes('right')) floatSize.value.w = Math.max(300, initial.w + dx)
    if (type.includes('left')) { const newW = initial.w - dx; if (newW > 300) { floatSize.value.w = newW; floatPos.value.x = initial.x + dx } }
    if (type.includes('bottom')) floatSize.value.h = Math.max(300, initial.h + dy)
    if (type.includes('top')) { const newH = initial.h - dy; if (newH > 300) { floatSize.value.h = newH; floatPos.value.y = initial.y + dy } }
  }
  const onUp = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
}

const updateMedia = () => {
  isMobile.value = window.innerWidth <= 1024
  if (isMobile.value) isFloating.value = false
}

function openTagManager() {
  window.dispatchEvent(new CustomEvent('cloudphone-open-tag-manager'))
}

function toggleTag(tagId) {
  tagStore.setSelectedTag(tagStore.selectedTagId === tagId ? '' : tagId)
}

function getTagDeviceCount(tagId) {
  return deviceStore.devices.filter(device => tagStore.getTagIdsForDevice(device.id).includes(tagId)).length
}

const initApp = () => {
  if (authStore.isLoggedIn) {
    deviceStore.fetchDevices()
    deviceStore.initSignaling()
    
    // 方案三：异步拉取部署时由后端指定的环境变量默认配置
    fetch('/api/default_settings')
      .then(res => res.json())
      .then(config => {
        if (config && typeof config === 'object' && Object.keys(config).length > 0) {
          const stored = localStorage.getItem('cloudphone_settings')
          let current = {}
          if (stored) {
            try {
              current = JSON.parse(stored)
            } catch(e) {}
          }
          const merged = { ...current, ...config }
          localStorage.setItem('cloudphone_settings', JSON.stringify(merged))
          window.dispatchEvent(new CustomEvent('cloudphone-settings-updated', { detail: { deviceId: '' } }))
        }
      })
      .catch(err => console.warn('未配置或无法获取后端默认配置:', err))
  }
}

onMounted(() => {
  initApp()
  window.addEventListener('resize', updateMedia)
  updateMedia() // 确保组件挂载后瞬间重新执行检测，避免初次视口异常
})

watch(() => authStore.isLoggedIn, (newVal) => {
  if (newVal) {
    initApp()
  }
})
onUnmounted(() => window.removeEventListener('resize', updateMedia))

watch(() => deviceStore.activeDeviceId, (newId) => {
  if (!newId) {
    isFloating.value = false; userAdjusted.value = false
  }
})

function closePanel() {
  deviceStore.clearActiveDevice()
}

function navigateTo(path) {
  if (path === '/deploy') {
    showDeployPage.value = true
    showFilePage.value = false
    showTerminalPage.value = false
    showMonitorPage.value = false
    showUserAdminPage.value = false
  } else if (path === '/files') {
    showDeployPage.value = false
    showFilePage.value = true
    showTerminalPage.value = false
    showMonitorPage.value = false
    showUserAdminPage.value = false
  } else if (path === '/terminal') {
    showDeployPage.value = false
    showFilePage.value = false
    showTerminalPage.value = true
    showMonitorPage.value = false
    showUserAdminPage.value = false
  } else if (path === '/monitor') {
    showDeployPage.value = false
    showFilePage.value = false
    showTerminalPage.value = false
    showMonitorPage.value = true
    showUserAdminPage.value = false
  } else if (path === '/admin') {
    showDeployPage.value = false
    showFilePage.value = false
    showTerminalPage.value = false
    showMonitorPage.value = false
    showUserAdminPage.value = true
  } else {
    showDeployPage.value = false
    showFilePage.value = false
    showTerminalPage.value = false
    showMonitorPage.value = false
    showUserAdminPage.value = false
  }
}
</script>

<style>
:root { --nav-width: 64px; --bg-primary: #0d1117; --bg-secondary: #161b22; --border: #30363d; --accent: #58a6ff; }
body { margin: 0; background: var(--bg-primary); color: #c9d1d9; font-family: -apple-system, sans-serif; overflow: hidden; height: 100vh; height: 100dvh; }

.app-container { display: flex; height: 100vh; height: 100dvh; width: 100vw; position: relative; }
.is-resizing * { transition: none !important; user-select: none !important; }

.side-nav { 
  width: var(--nav-width); 
  background: var(--bg-secondary); 
  border-right: 1px solid var(--border); 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  padding: 20px 0; 
  flex-shrink: 0; 
  box-sizing: border-box;
  transition: width 0.22s ease;
}

.side-nav.expanded {
  width: 180px;
  align-items: stretch;
  padding-left: 12px;
  padding-right: 12px;
}

.nav-brand { 
  width: 40px;
  min-height: 40px;
  margin-bottom: 40px; 
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: inherit;
  background: transparent;
  border-radius: 12px;
  align-self: center;
  overflow: hidden;
  position: relative;
  transition: background 0.2s;
}

/* 折叠指示小图标样式 */
.nav-brand-collapse-arrow {
  display: none;
  margin-left: auto;
  align-items: center;
  justify-content: center;
  color: #8b949e;
  opacity: 0.4;
  transition: opacity 0.2s;
  cursor: pointer;
}

.nav-brand-collapse-arrow svg {
  width: 14px;
  height: 14px;
}

.side-nav.expanded .nav-brand-collapse-arrow {
  display: inline-flex;
}

.nav-brand:hover .nav-brand-collapse-arrow {
  opacity: 0.9;
}

/* 气泡提示 (仅在收缩状态下 Hover 顶部品牌图标时显示) */
.side-nav:not(.expanded) .nav-brand {
  overflow: visible;
}

.side-nav:not(.expanded) .nav-brand::after {
  content: "展开侧边栏";
  position: absolute;
  left: 52px;
  top: 50%;
  transform: translateY(-50%);
  background: #1f2937;
  color: #e5e7eb;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid #374151;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  z-index: 999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.side-nav:not(.expanded) .nav-brand::before {
  content: "";
  position: absolute;
  left: 46px;
  top: 50%;
  transform: translateY(-50%);
  border: 6px solid transparent;
  border-right-color: #1f2937;
  z-index: 999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.side-nav:not(.expanded) .nav-brand:hover::after,
.side-nav:not(.expanded) .nav-brand:hover::before {
  opacity: 1;
}

.side-nav.expanded .nav-brand {
  width: 100%;
  justify-content: flex-start;
  padding: 0 8px;
}

.nav-brand:hover {
  background: rgba(255,255,255,0.05);
}

.nav-brand-icon-svg {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  color: var(--accent, #58a6ff);
}

.nav-brand-text,
.nav-item-text,
.nav-tag-name,
.nav-tag-count,
.manage-text {
  display: none;
}

.side-nav.expanded .nav-brand-text,
.side-nav.expanded .nav-item-text,
.side-nav.expanded .nav-tag-name,
.side-nav.expanded .nav-tag-count,
.side-nav.expanded .manage-text {
  display: inline-flex;
}

.nav-brand-text {
  font-size: 14px;
  font-weight: 700;
  color: #e6edf3;
  white-space: nowrap;
}

.nav-links { 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  width: 100%;
}

.side-nav.expanded .nav-links {
  align-items: stretch;
}

.nav-item { 
  min-height: 40px;
  padding: 0 10px; 
  border-radius: 12px; 
  margin-bottom: 20px; 
  opacity: 0.5; 
  text-decoration: none; 
  color: inherit; 
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  overflow: hidden;
  white-space: nowrap;
}

.side-nav.expanded .nav-item {
  justify-content: flex-start;
  margin-bottom: 8px;
}

.nav-item-icon-svg {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
}

.nav-item-text {
  font-size: 13px;
  font-weight: 700;
}

.nav-item.active { opacity: 1; color: var(--accent); background: rgba(88,166,255,0.1); }
.nav-item.logout-nav-item:hover { opacity: 1; color: #f85149; background: rgba(248,81,73,0.1); }

.header-user-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  box-sizing: border-box;
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #58a6ff, #1f6feb);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(31, 111, 235, 0.3);
  flex-shrink: 0;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: #e6edf3;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-role-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 600;
  flex-shrink: 0;
}

.user-role-badge.admin {
  background: rgba(242, 193, 46, 0.12);
  color: #f2c12e;
  border: 1px solid rgba(242, 193, 46, 0.25);
}

.user-role-badge.user {
  background: rgba(88, 166, 255, 0.12);
  color: #58a6ff;
  border: 1px solid rgba(88, 166, 255, 0.25);
}

.nav-tag-group {
  width: 100%;
  min-height: 0;
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.side-nav.expanded .nav-tag-group {
  align-items: stretch;
}

.nav-tag-group-title {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #8b949e;
  font-size: 11px;
  font-weight: 700;
}

.side-nav.expanded .nav-tag-group-title {
  flex-direction: row;
  justify-content: space-between;
}

.nav-tag-manage-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c9d1d9;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 18px;
  line-height: 1;
  gap: 6px;
}

.side-nav.expanded .nav-tag-manage-btn {
  width: auto;
  height: 26px;
  padding: 0 8px;
  font-size: 12px;
}

.manage-plus {
  font-size: 18px;
  line-height: 1;
}

.nav-tag-manage-btn:hover {
  color: #fff;
  background: rgba(88,166,255,0.12);
  border-color: rgba(88,166,255,0.4);
}

.nav-tag-list {
  width: 100%;
  min-height: 0;
  margin-top: 12px;
  padding: 0 0 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  overflow-y: auto;
}

.side-nav.expanded .nav-tag-list {
  align-items: stretch;
}

.nav-tag-list::-webkit-scrollbar {
  width: 0;
}

.nav-tag-item {
  width: 36px;
  height: 36px;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  opacity: 0.75;
  color: #c9d1d9;
  overflow: hidden;
}

.side-nav.expanded .nav-tag-item {
  width: 100%;
  justify-content: flex-start;
  padding: 0 8px;
}

.nav-tag-item:hover,
.nav-tag-item.active {
  opacity: 1;
  background: rgba(88,166,255,0.1);
  border-color: rgba(88,166,255,0.25);
}

.nav-tag-dot {
  flex: 0 0 auto;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgba(255,255,255,0.06);
}

.nav-tag-dot.all {
  background: var(--accent);
}

.nav-tag-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 700;
}

.nav-tag-count {
  min-width: 22px;
  justify-content: center;
  padding: 1px 6px;
  border-radius: 999px;
  color: #8b949e;
  background: rgba(255,255,255,0.08);
  font-size: 11px;
}

.main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.top-bar { height: 60px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); }
.page-title { font-size: 16px; font-weight: 600; color: #e6edf3; }
.global-status { color: #888; font-size: 13px; }
.viewport { flex: 1; overflow-y: auto; padding: 12px; }

/* 侧边面板容器 */
.control-panel-wrapper {
  height: 100vh; background: var(--bg-secondary); border-left: 0px solid var(--border);
  display: flex; flex-direction: column; position: relative; z-index: 200;
  transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-left-width 0.3s ease;
  width: 0; /* 关闭时宽度为0 */
  overflow: hidden;
}
.control-panel-wrapper.is-open { 
  border-left: 1px solid var(--border);
  /* 宽度由panelStyle控制 */
}

/* 悬浮模式 */
.control-panel-wrapper.is-floating {
  position: fixed; border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 30px 60px rgba(0,0,0,0.6); z-index: 1000; transform: none; transition: none;
}

/* 缩放手柄 */
.side-resizer { position: absolute; left: -4px; top: 0; bottom: 0; width: 8px; cursor: col-resize; z-index: 100; }
.resize-handle { position: absolute; z-index: 100; }
.resize-handle.top { top: -5px; left: 0; right: 0; height: 10px; cursor: ns-resize; }
.resize-handle.bottom { bottom: -5px; left: 0; right: 0; height: 10px; cursor: ns-resize; }
.resize-handle.left { left: -5px; top: 0; bottom: 0; width: 10px; cursor: ew-resize; }
.resize-handle.right { right: -5px; top: 0; bottom: 0; width: 10px; cursor: ew-resize; }
.resize-corner.bottom-right { position: absolute; right: -5px; bottom: -5px; width: 20px; height: 20px; cursor: nwse-resize; z-index: 101; }

.panel-inner { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-secondary); border-radius: 12px; }
.panel-top-bar { height: 50px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); cursor: grab; }
.vm-info { display: flex; align-items: center; gap: 8px; pointer-events: none; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; }
.vm-id { font-weight: 600; font-size: 14px; }
.tool-btn { background: none; border: none; color: #8b949e; cursor: pointer; padding: 6px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease; }
.tool-btn:hover { color: #fff; background: rgba(255,255,255,0.05); }
.tool-btn.close:hover { color: #f85149; }
.tool-btn-svg { width: 16px; height: 16px; }

.panel-main { flex: 1; overflow: hidden; background: #000; }

.panel-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #888; text-align: center; opacity: 0.3; }
.hint-icon-wrapper { margin-bottom: 16px; display: flex; align-items: center; justify-content: center; }
.hint-icon-svg { width: 48px; height: 48px; color: #8b949e; }

/* 移动端适配 */
@media (max-width: 1024px) {
  .app-container { flex-direction: column; }
  .control-panel-wrapper.is-mobile { 
    position: fixed; 
    inset: 0; 
    width: 100vw !important; 
    height: 100dvh !important; 
    transform: translateX(100%); 
    z-index: 2000; 
    border: none;
    padding-top: env(safe-area-inset-top, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    padding-left: env(safe-area-inset-left, 0px);
    padding-right: env(safe-area-inset-right, 0px);
    box-sizing: border-box;
    background: #000;
  }
  .control-panel-wrapper.is-mobile.is-open { transform: translateX(0); }
  .panel-inner { border-radius: 0; }
}

/* 移动端底部导航栏样式 */
.mobile-bottom-nav {
  height: 60px;
  width: 100%;
  flex-shrink: 0;
  background: var(--bg-secondary, #161b22);
  border-top: 1px solid var(--border, #30363d);
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 1000;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.mobile-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #8b949e;
  font-size: 11px;
  cursor: pointer;
  flex: 1;
  height: 100%;
  transition: all 0.2s ease;
  gap: 4px;
}

.mobile-nav-item:active {
  background: rgba(255, 255, 255, 0.05);
}

.mobile-nav-icon-svg {
  width: 20px;
  height: 20px;
}

.mobile-nav-text {
  font-weight: 600;
  font-size: 10px;
}

.mobile-nav-item.active {
  color: var(--accent, #58a6ff);
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
