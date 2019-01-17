import Vue from 'vue'
import Router from 'vue-router'
import ControlPanel from '@/components/ControlPanel'
import Settings from '@/components/Settings'

Vue.use(Router)

export default new Router({
  mode: 'history',
  routes: [
    {
      path: '/',
      name: 'ControlPanel',
      component: ControlPanel,
      props: true
    },
    {
      path: '/settings',
      name: 'Settings',
      component: Settings,
      props: true
    }
  ]
})
