import Vue from 'vue'
import Router from 'vue-router'
import ControlPanel from '@/components/ControlPanel'
import Settings from '@/components/Settings'
import Mesh from '@/components/Mesh'
import Store from '@/components/Store'
import Scenes from '@/components/Scenes'
import Debug from '@/components/Debug'

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
      path: '/scenes',
      name: 'Scenes',
      component: Scenes,
      props: true
    },
    {
      path: '/debug',
      name: 'Debug',
      component: Debug,
      props: true
    },
    {
      path: '/store',
      name: 'Store',
      component: Store,
      props: true
    },
    {
      path: '/mesh',
      name: 'Network Graph',
      component: Mesh,
      props: true
    }
  ]
})
