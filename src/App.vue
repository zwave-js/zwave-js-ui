<template>
  <v-app>
    <v-navigation-drawer clipped-left :mini-variant="mini" v-model="drawer" app>
      <v-toolbar flat class="transparent">
        <v-list class="pa-0">
          <v-list-tile avatar>
            <v-list-tile-avatar>
              <img style="border-radius: 0;" src="/static/logo.png" />
            </v-list-tile-avatar>
            <v-list-tile-content>
              <v-list-tile-title>{{"ZWave2MQTT v" + version}}</v-list-tile-title>
            </v-list-tile-content>
          </v-list-tile>
        </v-list>
      </v-toolbar>
      <v-divider></v-divider>
      <v-list>
        <v-list-tile
          v-for="item in pages"
          :key="item.title"
          :to="item.path == '#' ? '' : item.path"
        >
          <v-list-tile-action>
            <v-icon>{{ item.icon }}</v-icon>
          </v-list-tile-action>
          <v-list-tile-content>
            <v-list-tile-title>{{ item.title }}</v-list-tile-title>
          </v-list-tile-content>
        </v-list-tile>
      </v-list>
      <v-footer absolute v-if="!mini" class="pa-3">
        <div>Innovation System &copy; {{ new Date().getFullYear() }}</div>
      </v-footer>
    </v-navigation-drawer>

    <v-toolbar fixed app>
      <v-toolbar-side-icon @click="toggleDrawer"></v-toolbar-side-icon>
      <v-toolbar-title>{{title}}</v-toolbar-title>

      <v-spacer></v-spacer>

      <v-tooltip bottom>
        <v-icon
          dark
          medium
          style="cursor:default;"
          :color="statusColor || 'primary'"
          slot="activator"
        >swap_horizontal_circle</v-icon>
        <span>{{status}}</span>
      </v-tooltip>
    </v-toolbar>
    <main>
      <v-content>
        <router-view
          @import="importFile"
          @export="exportConfiguration"
          @showSnackbar="showSnackbar"
          :socket="socket"
          :socketEvents="socketEvents"
          :socketActions="socketActions"
        />
      </v-content>
    </main>

    <v-snackbar
      :timeout="3000"
      :bottom="true"
      :multi-line="false"
      :vertical="false"
      v-model="snackbar"
    >
      {{ snackbarText }}
      <v-btn flat @click.native="snackbar = false">Close</v-btn>
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
      var contentType = ext == 'xml' ? 'text/xml' : 'application/octet-stream'
      var a = document.createElement('a')

      var blob = new Blob([ext == 'xml' ? data : JSON.stringify(data)], {
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
        driver: 'DRIVER_READY',
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
      snackbarText: ''
    }
  },
  watch: {
    $route: function (value) {
      this.title = value.name || ''
    }
  },
  beforeMount () {
    this.title = this.$route.name || ''

    var self = this

    this.socket = io(ConfigApis.getSocketIP())

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
  },
  beforeDestroy () {
    if (this.socket) this.socket.close()
  }
}
</script>
