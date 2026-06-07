import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('auth_token') || '')
  const username = ref(localStorage.getItem('auth_user') || '')
  const role = ref(localStorage.getItem('auth_role') || '')
  const assignedDevices = ref(JSON.parse(localStorage.getItem('auth_devices') || '[]'))

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => role.value === 'admin')

  async function login(user, pass) {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: user, password: pass })
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(errText || '登录失败')
      }

      const data = await response.json()
      token.value = data.token
      username.value = data.username
      role.value = data.role || 'user'
      assignedDevices.value = data.assigned_devices || []

      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('auth_user', data.username)
      localStorage.setItem('auth_role', data.role || 'user')
      localStorage.setItem('auth_devices', JSON.stringify(data.assigned_devices || []))
      return true
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  async function register(user, pass) {
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: user, password: pass })
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(errText || '注册失败')
      }
      return true
    } catch (error) {
      console.error('Register error:', error)
      throw error
    }
  }

  async function logout() {
    try {
      if (token.value) {
        await fetch('/api/logout', {
          method: 'POST'
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      token.value = ''
      username.value = ''
      role.value = ''
      assignedDevices.value = []
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      localStorage.removeItem('auth_role')
      localStorage.removeItem('auth_devices')
      window.location.href = '/login'
    }
  }

  return {
    token,
    username,
    role,
    assignedDevices,
    isLoggedIn,
    isAdmin,
    login,
    register,
    logout
  }
})
