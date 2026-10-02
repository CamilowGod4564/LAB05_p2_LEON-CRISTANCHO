import axios from 'axios'
import { API_BASE } from '../config.js'

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 8000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      // Optionally redirect to login or clear token
      localStorage.removeItem('token')
    }
    return Promise.reject(err)
  },
)

export default api
