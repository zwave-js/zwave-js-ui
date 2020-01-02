import Vue from 'vue'
import Router from 'vue-router'
import ControlPanel from '@/components/ControlPanel'
import Settings from '@/components/Settings'
import Mesh from '@/components/Mesh'

Vue.use(Router)

export default new Router({
  mode: 'history',
  routes: [
    {
      path: '/',
      name: 'Control Panel',
      component: ControlPanel,
      props: true
    },
    {
      path: '/settings',
      name: 'Settings',
      component: Settings,
      props: true
    },
    {
      path: '/mesh',
      name: 'Mesh',
      component: Mesh,
      props: true
    }
  ]
})
