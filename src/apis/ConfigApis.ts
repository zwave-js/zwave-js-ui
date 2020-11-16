import axios from 'axios'
// @ts-expect-error ts-migrate(7016) FIXME: Could not find a declaration file for module 'axio... Remove this comment to see the full error message
import { loadProgressBar } from 'axios-progress-bar'

function getBasePath () {
  return document.baseURI.replace(/\/$/, '');
}

// @ts-expect-error ts-migrate(2339) FIXME: Property 'socketUrl' does not exist on type 'Axios... Remove this comment to see the full error message
axios.defaults.socketUrl = getBasePath()
// @ts-expect-error ts-migrate(2339) FIXME: Property 'socketUrl' does not exist on type 'Axios... Remove this comment to see the full error message
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
  updateConfig (data: any) {
    return axios.post('/settings', data).then(response => {
      return response.data
    })
  },
  exportConfig () {
    return axios.get('/exportConfig').then(response => {
      return response.data
    })
  },
  importConfig (data: any) {
    return axios.post('/importConfig', data).then(response => {
      return response.data
    })
  }
}
