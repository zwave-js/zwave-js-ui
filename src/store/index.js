import { createStore } from 'vuex'
import { state, mutations, getters, actions } from './mutations'

export const store = createStore({
  state,
  mutations,
  getters,
  actions
})
