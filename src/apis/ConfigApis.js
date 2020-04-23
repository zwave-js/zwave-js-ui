import axios from 'axios'

import { loadProgressBar } from 'axios-progress-bar'

if (process.env.NODE_ENV === 'development') {
  axios.defaults.socketUrl = location.protocol + '//' + location.hostname + ':' + process.env.PORT
  axios.defaults.baseURL = axios.defaults.socketUrl + '/api'
} else {
  var port = parseInt(window.location.port) || (window.location.protocol === 'https:' ? 443 : 80)
  axios.defaults.socketUrl = location.protocol + '//' + location.hostname + ':' + port
  axios.defaults.baseURL = '/api'
}

loadProgressBar()

export default {
  getSocketIP () { return axios.defaults.socketUrl },
  getConfig () {
    return axios.get('/settings')
      .then(response => {
        return response.data
      })
  },
  updateConfig (data) {
    return axios.post('/settings', data)
      .then(response => {
        return response.data
      })
  },
  exportConfig () {
    return axios.get('/exportConfig')
      .then(response => {
        return response.data
      })
  },
  importConfig (data) {
    return axios.post('/importConfig', data)
      .then(response => {
        return response.data
      })
  }
}
