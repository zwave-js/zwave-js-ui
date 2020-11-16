import axios from 'axios'
import { loadProgressBar } from 'axios-progress-bar'

function getBasePath () {
  return document.baseURI.replace(/\/$/, '')
}

axios.defaults.socketUrl = getBasePath()
axios.defaults.baseURL = `${axios.defaults.socketUrl}/api`

loadProgressBar()

export default {
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
  getConfig () {
    return axios.get('/settings').then(response => {
      return response.data
    })
  },
  updateConfig (data) {
    return axios.post('/settings', data).then(response => {
      return response.data
    })
  },
  exportConfig () {
    return axios.get('/exportConfig').then(response => {
      return response.data
    })
  },
  importConfig (data) {
    return axios.post('/importConfig', data).then(response => {
      return response.data
    })
  }
}
