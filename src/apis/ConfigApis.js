import axios from 'axios'
import { loadProgressBar } from 'axios-progress-bar'
import Router from '../router'

function getBasePath () {
  return document.baseURI.replace(/\/$/, '')
}

axios.defaults.socketUrl = getBasePath()
axios.defaults.baseURL = `${axios.defaults.socketUrl}/api`

function responseHandler (response) {
  if (response.data && response.data.code === 3) {
    localStorage.removeItem('logged')
    Router.push('/')
    throw Error(response.message || 'Authentication failed')
  }

  return response
}

const request = {
  async get (...args) {
    const response = await axios.get(...args)
    return responseHandler(response)
  },
  async put (...args) {
    const response = await axios.put(...args)
    return responseHandler(response)
  },
  async post (...args) {
    const response = await axios.post(...args)
    return responseHandler(response)
  },
  async delete (...args) {
    const response = await axios.delete(...args)
    return responseHandler(response)
  }
}

loadProgressBar()

export default {
  // ---- LOGIN/LOGOUT ------
  async login (data) {
    const response = await request.post('/authenticate', data)
    return response.data
  },
  logout () {
    return request.get('/logout')
  },
  getBasePath () {
    return getBasePath()
  },
  getSocketPath () {
    const innerPath = document.baseURI
      .split('/')
      .splice(3)
      .join('/')
    const socketPath = `/${innerPath}/socket.io`.replace('//', '/')
    return socketPath === '/socket.io' ? undefined : socketPath
  },
  async getConfig () {
    const response = await request.get('/settings')
    return response.data
  },
  async updateConfig (data) {
    const response = await request.post('/settings', data)
    return response.data
  },
  async exportConfig () {
    const response = await request.get('/exportConfig')
    return response.data
  },
  async importConfig (data) {
    const response = await request.post('/importConfig', data)
    return response.data
  },
  async getStore () {
    const response = await request.get('/store')
    return response.data
  },
  async getFile (path) {
    const response = await request.get('/store/' + encodeURIComponent(path))
    return response.data
  },
  async writeFile (path, content) {
    const response = await request
      .put('/store/' + encodeURIComponent(path), { content })
    return response.data
  },
  async deleteFile (path) {
    const response = await request.delete('/store/' + encodeURIComponent(path))
    return response.data
  },
  downloadZip (files) {
    return request.post('/store-multi', { files }, { responseType: 'blob' })
  },
  async deleteMultiple (files) {
    const response = await request.put('/store-multi', { files })
    return response.data
  }
}
