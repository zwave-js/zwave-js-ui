import Vue from 'vue'
import Vuex from 'vuex'
import { state, mutations, getters, actions } from './mutations'

Vue.use(Vuex)

export default new Vuex.Store({
  state,
  mutations,
  getters,
  actions
})
