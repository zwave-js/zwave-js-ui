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
  },
  getStore () {
    return axios.get('/store').then(response => {
      return response.data
    })
  },
  getFile (path) {
    return axios.get('/store/' + encodeURIComponent(path)).then(response => {
      return response.data
    })
  },
  writeFile (path, content) {
    return axios
      .put('/store/' + encodeURIComponent(path), { content })
      .then(response => {
        return response.data
      })
  },
  deleteFile (path) {
    return axios.delete('/store/' + encodeURIComponent(path)).then(response => {
      return response.data
    })
  },
  downloadZip (files) {
    return axios.post('/store-zip', { files }, { responseType: 'blob' })
  }
}
