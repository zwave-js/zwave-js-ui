// src/plugins/vuetify.js

import { createVuetify } from 'vuetify'
import 'material-design-icons-iconfont/dist/material-design-icons.css' // Ensure you are using css-loader
import 'vuetify/lib/styles/main.sass'
import * as components from 'vuetify/lib/components'
import * as directives from 'vuetify/lib/directives'

export default createVuetify({
  icons: {
    iconfont: 'md'
  },
  components,
  directives
})
