<template>
  <v-app>

    <v-navigation-drawer
    clipped-left
    permanent
    stateless
    disable-resize-watcher
    :mini-variant.sync="mini"
    v-model="drawer"
    app
    >
    <v-toolbar flat class="transparent">
        <v-list class="pa-0">
          <v-list-tile avatar>
            <v-list-tile-avatar>
              <img src="/static/logo.png" >
            </v-list-tile-avatar>
            <v-list-tile-content>
              <v-list-tile-title>ZWave2MQTT</v-list-tile-title>
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
    </v-list>
    <v-footer absolute v-if="!mini" class="pa-3">
    <div>Innovation System &copy; {{ new Date().getFullYear() }}</div>
  </v-footer>
  </v-navigation-drawer>

<v-toolbar fixed app>
  <v-toolbar-side-icon @click.native.stop="mini = !mini"></v-toolbar-side-icon>
  <v-toolbar-title>{{title}}</v-toolbar-title>
  <v-spacer></v-spacer>

    <v-menu v-for="item in items" :key="item.text" bottom left>
      <v-btn slot="activator" icon @click.native="item.func">
        <v-tooltip bottom>
        <v-icon dark color="primary" slot="activator">{{item.icon}}</v-icon>
        <span>{{item.tooltip}}</span>
      </v-tooltip>
      </v-btn>

      <v-list v-if="item.menu">
        <v-list-tile
          v-for="(menu, i) in item.menu"
          :key="i"
          @click="menu.func"
        >
          <v-list-tile-title>{{ menu.title }}</v-list-tile-title>
        </v-list-tile>
      </v-list>

    </v-menu>

</v-toolbar>
<main>
  <v-content>
      <router-view @showSnackbar="showSnackbar" @createDevice="createDevice" @importFile="importFile"/>
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

import axios from 'axios'

import { loadProgressBar } from 'axios-progress-bar'

if(process.env.NODE_ENV === 'development')
  axios.defaults.baseURL = location.protocol + '//' + location.hostname + ':8091/api';
else
  axios.defaults.baseURL = '/api';

loadProgressBar();

export default {
  name: 'app',
  methods: {
    showSnackbar: function(text){
      this.snackbarText = text;
      this.snackbar = true;
    },
  },
  data () {
    return {
      pages: [
        { icon: 'local_offer', title: 'Settings', path: '/' },
        { icon: 'settings_ethernet', title: 'Modbus', path: '/clients' },
        { icon: 'wifi', title: 'MQTT', path: '/mqtt_clients' },
        { icon: 'info', title: 'Status', path: '/status' },
      ],
      drawer: false,
      title: 'Zwave',
      mini: true,
      snackbar: false,
      snackbarText: "",
      items: [
        {
          icon: "file_download",
          func: this.importConfiguration,
          tooltip: "Import Configuration"
        },
        {
          icon: "file_upload",
          func: this.exportConfiguration,
          tooltip: "Export Configuration",
        },
        {
          icon: "save",
          func: this.saveConfiguration,
          tooltip: "Save Configuration"
        },
      ]
    }
  },
	watch: {
  	'$route': function(value) {

      switch (value.name) {
        case 'Main':
        this.title = '';
        break;
        default:
        this.title = '';
      }
    }
  },
  beforeMount(){
    var self = this;
    axios.get(`/tags_config`)
    .then(response => {
      if(response.data.success)
        self.$store.dispatch('init', response.data)
      else {
        self.showSnackbar("Error while retriving Tags configuration, check console");
        console.log(response);
      }
    })
    .catch(e => {
      self.showSnackbar("Error while retriving Tags configuration, check console");
      console.log(e);
    })
  },
}
</script>
