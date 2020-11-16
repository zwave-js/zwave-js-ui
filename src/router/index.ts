import Vue from 'vue'
import Router from 'vue-router'
// @ts-expect-error ts-migrate(2307) FIXME: Cannot find module '@/components/ControlPanel' or ... Remove this comment to see the full error message
import ControlPanel from '@/components/ControlPanel'
// @ts-expect-error ts-migrate(2307) FIXME: Cannot find module '@/components/Settings' or its ... Remove this comment to see the full error message
import Settings from '@/components/Settings'
// @ts-expect-error ts-migrate(2307) FIXME: Cannot find module '@/components/Mesh' or its corr... Remove this comment to see the full error message
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
      name: 'Network Graph',
      component: Mesh,
      props: true
    }
  ]
})
