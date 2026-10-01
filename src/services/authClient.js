import axios from 'axios'
import { AUTH_BASE } from '../config.js'

const authClient = axios.create({
  baseURL: AUTH_BASE,
  timeout: 8000,
})

export default authClient
