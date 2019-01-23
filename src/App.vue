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
              <img style="border-radius: 0;" src="/static/logo.png" >
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
      <router-view @showSnackbar="showSnackbar"/>
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

import ConfigApis from '@/apis/ConfigApis'

export default {
  name: 'app',
  methods: {
    showSnackbar: function(text){
      this.snackbarText = text;
      this.snackbar = true;
    },
    importFile : function(callback)
    {
      var self = this;
      // Check for the various File API support.
      if(window.File && window.FileReader && window.FileList && window.Blob)
      {
        var input = document.createElement('input');
        input.type = "file";
        input.addEventListener("change", function(event)
        {
          var files = event.target.files;

          if(files && files.length > 0)
          {
            var file = files[0];
            var reader = new FileReader();

            reader.addEventListener("load", function(fileReaderEvent)
            {
              var jsonObject = {};
              var err;
              var data = fileReaderEvent.target.result;

              try {
                jsonObject = JSON.parse(data);
              } catch (e) {
                self.showSnackbar("Error while parsing input file, check console for more info")
                console.log(e);
                err = e;
              }

              callback(err, jsonObject);
            });

            reader.readAsText(file);
          }

        });

        input.click();
      }
      else
      {
        alert('Unable to load a file in this browser.');
      }
    },
    exportConfiguration: function(data, fileName){
      var contentType = 'application/octet-stream';
      var a = document.createElement('a');
      
      var blob = new Blob([JSON.stringify(data)], {'type': contentType});

      document.body.appendChild(a);
      a.href = window.URL.createObjectURL(blob);
      a.download = fileName + ".json";
      a.target="_self";
      a.click();
    }
  },
  data () {
    return {
      pages: [
        { icon: 'widgets', title: 'Control Panel', path: '/' },
        { icon: 'settings', title: 'Settings', path: '/settings' },
        // { icon: 'wifi', title: 'MQTT', path: '/mqtt_clients' },
        // { icon: 'info', title: 'Status', path: '/status' },
      ],
      drawer: false,
      title: 'Control Panel',
      mini: true,
      snackbar: false,
      snackbarText: "",
      items: [
        // {
        //   icon: "file_download",
        //   func: this.importConfiguration,
        //   tooltip: "Import Configuration"
        // },
        // {
        //   icon: "file_upload",
        //   func: this.exportConfiguration,
        //   tooltip: "Export Configuration",
        // },
        // {
        //   icon: "save",
        //   func: this.saveConfiguration,
        //   tooltip: "Save Configuration"
        // },
      ]
    }
  },
	watch: {
  	'$route': function(value) {
      switch (value.name) {
        case 'Settings':
        this.title = 'Settings';
        break;
        case 'ControlPanel':
        this.title = 'Control Panel';
        break;
        default:
        this.title = '';
      }
    }
  },
  created(){
    var self = this;
    ConfigApis.getConfig()
    .then(data => {
      if(!data.success){
        self.showSnackbar("Error while retriving configuration, check console");
        console.log(response);
      }else{
        self.$store.dispatch('init', data)
      }
    })
    .catch(e => {
      self.showSnackbar("Error while retriving configuration, check console");
      console.log(e);
    })
  },
}
</script>
