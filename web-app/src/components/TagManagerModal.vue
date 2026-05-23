<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <header class="modal-header">
        <div>
          <h2>标签管理</h2>
        </div>
        <button class="close-btn" @click="$emit('close')" title="关闭">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </header>

      <div class="modal-body">
        <section class="panel tags-panel">
          <div class="panel-header">
            <h3>标签</h3>
            <span>{{ tagStore.tags.length }} 个</span>
          </div>

          <form class="tag-form" @submit.prevent="addTag">
            <input
              v-model="newTagName"
              class="text-input"
              type="text"
              maxlength="20"
              placeholder="新标签名称"
            >
            <input v-model="newTagColor" class="color-input" type="color" title="标签颜色">
            <button class="primary-btn" type="submit">新增</button>
          </form>

          <p v-if="tagError" class="error-text">{{ tagError }}</p>

          <div v-if="tagStore.tags.length === 0" class="empty-state">
            还没有标签
          </div>

          <div v-else class="tag-list">
            <div v-for="tag in tagStore.tags" :key="tag.id" class="tag-row">
              <input
                class="color-input compact"
                type="color"
                :value="tag.color"
                @input="updateColor(tag, $event.target.value)"
                title="修改颜色"
              >
              <input
                class="text-input tag-name-input"
                type="text"
                maxlength="20"
                :value="tag.name"
                @change="renameTag(tag, $event.target.value)"
              >
              <button class="icon-btn danger" @click="deleteTag(tag)" title="删除标签">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                  <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>
                </svg>
              </button>
            </div>
          </div>
        </section>

        <section class="panel devices-panel">
          <div class="panel-header">
            <h3>设备分配</h3>
            <span>{{ selectedDeviceId || '未选择' }}</span>
          </div>

          <div v-if="devices.length === 0" class="empty-state">
            暂无在线虚机
          </div>

          <div v-else class="assignment-layout">
            <div class="device-list">
              <button
                v-for="device in devices"
                :key="device.id"
                class="device-row"
                :class="{ active: selectedDeviceId === device.id }"
                @click="selectedDeviceId = device.id"
              >
                <span class="device-id">{{ device.id }}</span>
                <span class="device-tag-count">{{ tagStore.getTagIdsForDevice(device.id).length }}</span>
              </button>
            </div>

            <div class="assignment-panel">
              <div v-if="!selectedDeviceId" class="empty-state">
                选择一台设备后分配标签
              </div>
              <div v-else-if="tagStore.tags.length === 0" class="empty-state">
                先创建标签
              </div>
              <div v-else class="checkbox-list">
                <label v-for="tag in tagStore.tags" :key="tag.id" class="tag-checkbox">
                  <input
                    type="checkbox"
                    :checked="tagStore.getTagIdsForDevice(selectedDeviceId).includes(tag.id)"
                    @change="tagStore.toggleDeviceTag(selectedDeviceId, tag.id)"
                  >
                  <span class="tag-chip" :style="tagStyle(tag)">
                    {{ tag.name }}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { DEFAULT_TAG_COLORS, useTagStore } from '@/stores/tags'

const props = defineProps({
  devices: {
    type: Array,
    default: () => []
  },
  initialDeviceId: {
    type: String,
    default: ''
  }
})

defineEmits(['close'])

const tagStore = useTagStore()
const selectedDeviceId = ref('')
const newTagName = ref('')
const newTagColor = ref(DEFAULT_TAG_COLORS[0])
const tagError = ref('')

watch(
  () => [props.initialDeviceId, props.devices],
  () => {
    if (props.initialDeviceId && props.devices.some(device => device.id === props.initialDeviceId)) {
      selectedDeviceId.value = props.initialDeviceId
      return
    }
    if (selectedDeviceId.value && !props.devices.some(device => device.id === selectedDeviceId.value)) {
      selectedDeviceId.value = ''
    }
    if (!selectedDeviceId.value && props.devices.length > 0) {
      selectedDeviceId.value = props.devices[0].id
    }
  },
  { immediate: true }
)

function tagStyle(tag) {
  return {
    color: tag.color,
    borderColor: `${tag.color}80`,
    background: `${tag.color}18`
  }
}

function addTag() {
  const name = newTagName.value.trim()
  if (!name) {
    tagError.value = '请输入标签名称'
    return
  }
  if (tagStore.tagNameExists(name)) {
    tagError.value = '标签名称已存在'
    return
  }

  const created = tagStore.createTag(name, newTagColor.value)
  if (!created) {
    tagError.value = '标签创建失败'
    return
  }

  tagError.value = ''
  newTagName.value = ''
}

function renameTag(tag, value) {
  const name = value.trim()
  if (!name) {
    tagError.value = '标签名称不能为空'
    return
  }
  if (!tagStore.updateTag(tag.id, { name, color: tag.color })) {
    tagError.value = '标签名称已存在'
    return
  }
  tagError.value = ''
}

function updateColor(tag, color) {
  tagStore.updateTag(tag.id, { name: tag.name, color })
}

function deleteTag(tag) {
  if (confirm(`删除标签 "${tag.name}"？该标签会从所有设备上移除。`)) {
    tagStore.deleteTag(tag.id)
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
}

.modal {
  width: min(960px, 100%);
  max-height: min(760px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
}

.close-btn,
.icon-btn {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: transparent;
  border-radius: 6px;
}

.close-btn:hover,
.icon-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
}

.close-btn svg,
.icon-btn svg {
  width: 18px;
  height: 18px;
}

.icon-btn.danger:hover {
  color: #ef4444;
}

.modal-body {
  min-height: 0;
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 16px;
  padding: 16px;
  overflow: auto;
}

.panel {
  min-height: 420px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-secondary);
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
}

.panel-header span {
  max-width: 220px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-secondary);
  font-size: 12px;
}

.tag-form {
  display: grid;
  grid-template-columns: 1fr 36px 64px;
  gap: 8px;
  padding: 12px;
}

.text-input {
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border);
  border-radius: 6px;
  outline: none;
}

.text-input:focus {
  border-color: var(--accent);
}

.color-input {
  width: 36px;
  height: 34px;
  padding: 2px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.color-input.compact {
  flex: 0 0 auto;
}

.primary-btn {
  height: 34px;
  padding: 0 12px;
  color: #fff;
  background: var(--accent);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
}

.primary-btn:hover {
  background: var(--accent-hover);
}

.error-text {
  margin: 0 12px 8px;
  color: #f87171;
  font-size: 12px;
}

.empty-state {
  display: flex;
  min-height: 120px;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: var(--text-secondary);
  text-align: center;
  font-size: 13px;
}

.tag-list {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 12px 12px;
  overflow: auto;
}

.tag-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tag-name-input {
  flex: 1;
}

.assignment-layout {
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns: 220px 1fr;
}

.device-list {
  min-height: 0;
  padding: 8px;
  border-right: 1px solid var(--border);
  overflow: auto;
}

.device-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  color: var(--text-primary);
  background: transparent;
  border-radius: 6px;
  text-align: left;
}

.device-row:hover,
.device-row.active {
  background: rgba(255, 255, 255, 0.08);
}

.device-id {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 13px;
}

.device-tag-count {
  min-width: 20px;
  padding: 1px 6px;
  border-radius: 999px;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.08);
  font-size: 11px;
  text-align: center;
}

.assignment-panel {
  min-width: 0;
  min-height: 0;
  padding: 12px;
  overflow: auto;
}

.checkbox-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tag-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.tag-checkbox input {
  width: 15px;
  height: 15px;
  accent-color: var(--accent);
}

.tag-chip {
  max-width: 180px;
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 9px;
  border: 1px solid;
  border-radius: 999px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 600;
}

@media (max-width: 768px) {
  .modal-overlay {
    align-items: stretch;
    padding: 10px;
  }

  .modal {
    max-height: calc(100vh - 20px);
  }

  .modal-body {
    grid-template-columns: 1fr;
  }

  .panel {
    min-height: 320px;
  }

  .assignment-layout {
    grid-template-columns: 1fr;
  }

  .device-list {
    max-height: 180px;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
}
</style>
