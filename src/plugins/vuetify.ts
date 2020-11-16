// src/plugins/vuetify.js

import Vue from 'vue'
import Vuetify from 'vuetify'
import 'vuetify/dist/vuetify.min.css'
import 'material-design-icons-iconfont/dist/material-design-icons.css' // Ensure you are using css-loader

Vue.use(Vuetify)

const opts = {
  icons: {
    iconfont: 'md'
  }
}

// @ts-expect-error ts-migrate(2345) FIXME: Argument of type '{ icons: { iconfont: string; }; ... Remove this comment to see the full error message
export default new Vuetify(opts)
