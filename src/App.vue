<template>
  <v-app :dark="dark">
    <v-navigation-drawer clipped-left :mini-variant="mini" v-model="drawer" app>
      <v-list nav class="py-0">
        <v-list-item :class="mini && 'px-0'">
          <v-list-item-avatar>
            <img
              style="padding:3px;border-radius:0"
              :src="`${baseURI}/static/logo.png`"
            />
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>{{
              'ZWave2MQTT v' + version
            }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
      <v-divider style="margin-top:8px"></v-divider>
      <v-list nav>
        <v-list-item
          v-for="item in pages"
          :key="item.title"
          :to="item.path == '#' ? '' : item.path"
          :color="item.path === $route.path ? 'primary' : ''"
        >
          <v-list-item-action>
            <v-icon>{{ item.icon }}</v-icon>
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title class="subtitle-2 font-weight-bold">{{
              item.title
            }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item v-if="!mini">
          <v-switch label="Dark theme" hide-details v-model="dark"></v-switch>
        </v-list-item>
      </v-list>
      <v-footer absolute v-if="!mini" class="pa-3">
        <div>Innovation System &copy; {{ new Date().getFullYear() }}</div>
      </v-footer>
    </v-navigation-drawer>

    <v-app-bar app>
      <v-app-bar-nav-icon @click.stop="toggleDrawer" />
      <v-toolbar-title>{{ title }}</v-toolbar-title>

      <v-spacer></v-spacer>

      <v-tooltip bottom>
        <template v-slot:activator="{ on }">
          <v-icon
            dark
            medium
            style="cursor:default;"
            :color="statusColor || 'primary'"
            v-on="on"
            >swap_horizontal_circle</v-icon
          >
        </template>
        <span>{{ status }}</span>
      </v-tooltip>
    </v-app-bar>
    <main>
      <v-main>
        <router-view
          @import="importFile"
          @export="exportConfiguration"
          @showSnackbar="showSnackbar"
          :socket="socket"
          :socketEvents="socketEvents"
          :socketActions="socketActions"
        />
      </v-main>
    </main>

    <v-snackbar
      :timeout="3000"
      :bottom="true"
      :multi-line="false"
      :vertical="false"
      v-model="snackbar"
    >
      {{ snackbarText }}
      <v-btn text @click.native="snackbar = false">Close</v-btn>
    </v-snackbar>
  </v-app>
</template>

<script>
// https://github.com/socketio/socket.io-client/blob/master/docs/API.md
import io from 'socket.io-client'
import ConfigApis from '@/apis/ConfigApis'

export default {
  name: 'app',
  methods: {
    toggleDrawer () {
      if (['xs', 'sm', 'md'].indexOf(this.$vuetify.breakpoint.name) >= 0) {
        this.mini = false
        this.drawer = !this.drawer
      } else {
        this.mini = !this.mini
        this.drawer = true
      }
    },
    showSnackbar: function (text) {
      this.snackbarText = text
      this.snackbar = true
    },
    updateStatus: function (status, color) {
      this.status = status
      this.statusColor = color
    },
    changeThemeColor: function () {
      var metaThemeColor = document.querySelector('meta[name=theme-color]')
      var metaThemeColor2 = document.querySelector(
        'meta[name=msapplication-TileColor]'
      )

      metaThemeColor.setAttribute('content', this.dark ? '#000' : '#fff')
      metaThemeColor2.setAttribute('content', this.dark ? '#000' : '#fff')
    },
    importFile: function (ext, callback) {
      var self = this
      // Check for the various File API support.
      if (window.File && window.FileReader && window.FileList && window.Blob) {
        var input = document.createElement('input')
        input.type = 'file'
        input.addEventListener('change', function (event) {
          var files = event.target.files

          if (files && files.length > 0) {
            var file = files[0]
            var reader = new FileReader()

            reader.addEventListener('load', function (fileReaderEvent) {
              var err
              var data = fileReaderEvent.target.result

              if (ext === 'json') {
                try {
                  data = JSON.parse(data)
                } catch (e) {
                  self.showSnackbar(
                    'Error while parsing input file, check console for more info'
                  )
                  console.log(e)
                  err = e
                }
              }

              callback(err, data)
            })

            reader.readAsText(file)
          }
        })

        input.click()
      } else {
        alert('Unable to load a file in this browser.')
      }
    },
    exportConfiguration: function (data, fileName, ext) {
      var contentType = ext === 'xml' ? 'text/xml' : 'application/octet-stream'
      var a = document.createElement('a')

      var blob = new Blob([ext === 'xml' ? data : JSON.stringify(data)], {
        type: contentType
      })

      document.body.appendChild(a)
      a.href = window.URL.createObjectURL(blob)
      a.download = fileName + '.' + (ext || 'json')
      a.target = '_self'
      a.click()
    }
  },
  data () {
    return {
      socket: null,
      version: process.env.VERSION,
      pages: [
        { icon: 'widgets', title: 'Control Panel', path: '/' },
        { icon: 'settings', title: 'Settings', path: '/settings' },
        { icon: 'share', title: 'Network graph', path: '/mesh' }
      ],
      socketEvents: {
        init: 'INIT',
        controller: 'CONTROLLER_CMD',
        connected: 'CONNECTED',
        nodeRemoved: 'NODE_REMOVED',
        nodeUpdated: 'NODE_UPDATED',
        valueUpdated: 'VALUE_UPDATED',
        api: 'API_RETURN',
        debug: 'DEBUG'
      },
      socketActions: {
        init: 'INITED',
        hass: 'HASS_API',
        zwave: 'ZWAVE_API'
      },
      status: '',
      statusColor: '',
      drawer: false,
      mini: false,
      topbar: [],
      title: '',
      snackbar: false,
      snackbarText: '',
      dark: false,
      baseURI: ConfigApis.getBasePath()
    }
  },
  watch: {
    $route: function (value) {
      this.title = value.name || ''
    },
    dark (v) {
      if (v) localStorage.setItem('dark', 'true')
      else localStorage.removeItem('dark')

      this.$vuetify.theme.dark = v
      this.changeThemeColor()
    }
  },
  beforeMount () {
    this.title = this.$route.name || ''

    var self = this

    this.socket = io('/', {
      path: ConfigApis.getSocketPath()
    })

    this.socket.on('connect', () => {
      self.updateStatus('Connected', 'green')
    })

    this.socket.on('disconnect', () => {
      self.updateStatus('Disconnected', 'red')
    })

    this.socket.on('error', () => {
      console.log('Socket error')
    })

    this.socket.on('reconnecting', () => {
      self.updateStatus('Reconnecting', 'yellow')
    })
  },
  mounted () {
    if (this.$vuetify.breakpoint.lg || this.$vuetify.breakpoint.xl) {
      this.toggleDrawer()
    }

    this.dark = !!localStorage.getItem('dark')
    this.changeThemeColor()
  },
  beforeDestroy () {
    if (this.socket) this.socket.close()
  }
}
</script>
