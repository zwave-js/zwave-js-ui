import axios from 'axios'

import { loadProgressBar } from 'axios-progress-bar'

if(process.env.NODE_ENV === 'development')
  axios.defaults.baseURL = location.protocol + '//' + location.hostname + ':8091/api';
else
  axios.defaults.baseURL = '/api';

loadProgressBar();

export default{
  getConfig(){
    return axios.get('/config')
    .then(response => {
      return response.data;
    })
  },
  updateConfig(data){
    return axios.post('/config', data)
    .then(response => {
      return response.data;
    })
  }
}
