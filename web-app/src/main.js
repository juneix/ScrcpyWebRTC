import './utils/cryptoPolyfill'

// 全局 Fetch 拦截器，自动注入 Authorization Token 并处理 401 响应
const originalFetch = window.fetch
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : (input && input.url ? input.url : '')
  if (url && !url.includes('/api/login') && !url.includes('/api/register')) {
    const token = localStorage.getItem('auth_token')
    if (token) {
      init.headers = init.headers || {}
      if (init.headers instanceof Headers) {
        init.headers.set('Authorization', `Bearer ${token}`)
      } else if (Array.isArray(init.headers)) {
        init.headers.push(['Authorization', `Bearer ${token}`])
      } else {
        init.headers['Authorization'] = `Bearer ${token}`
      }
    }
  }

  const response = await originalFetch(input, init)
  if (response.status === 401) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    try {
      const { useAuthStore } = await import('./stores/auth')
      const auth = useAuthStore()
      auth.token = ''
      auth.username = ''
    } catch (e) {}
  }
  return response
}

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './styles/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
