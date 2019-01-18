/* eslint-disable */

<template>
  <v-container fluid>
    <v-card>
      <v-card-text>

        <v-container fluid>
          <v-layout row>

            <v-flex xs1>
              <v-tooltip bottom>
                <v-icon
                size="50"
                slot="activator"
                style="cursor:default"
                :color="socket_status == 'connected' ? 'green' : (socket_status == 'disconnected' ? 'red' : 'yellow')"
                >swap_horizontal_circle</v-icon>
                <span>{{socket_status}}</span>
              </v-tooltip>
            </v-flex>

            <v-flex xs3>
              <v-select
              label="Actions"
              append-outer-icon="send"
              v-model="cnt_action"
              :items="cnt_actions"
              @click:append-outer="sendCntAction"
              ></v-select>
            </v-flex>
            <v-spacer></v-spacer>
            <v-btn
            color="primary"
            dark
            @click="saveConfiguration"
            class="mb-2"
            >Save Configuration</v-btn>
          </v-layout>
        </v-container>


        <v-data-table
        :headers="headers"
        :items="nodes"
        class="elevation-1"
        >
        <template slot="items" slot-scope="props">
          <tr style="cursor:pointer;" v-if="props.item" :active="selectedNode == props.item" @click="selectedNode == props.item ? selectedNode = null : selectedNode = props.item">
            <td>{{ props.item.node_id }}</td>
            <td>{{ props.item.type }}</td>
            <td>{{ props.item.ready ? (`${props.item.product} (${props.item.manufacturer})`) : '' }}</td>
            <td>{{ props.item.name }}</td>
            <td>{{ props.item.loc }}</td>
            <td>{{ props.item.status}}</td>
          </tr>
        </template>
      </v-data-table>

      <v-toolbar
      tabs
      class="elevation-0"
      >
      <v-tabs
      v-model="currentTab"
      color="transparent"
      fixed-tabs
      >
      <v-tab key="node">Node</v-tab>
      <v-tab key="groups">Groups</v-tab>
      <v-tab key="scenes">Scenes</v-tab>

    </v-tabs>
  </v-toolbar>

    <v-tabs-items v-model="currentTab">
      <v-tab-item
      key="node"
      >
      <v-container v-if="selectedNode" fluid>

        <v-layout row>
          <v-flex xs3>
            <v-select
            label="Node actions"
            append-outer-icon="send"
            v-model="node_action"
            :items="node_actions"
            @click:append-outer="sendNodeAction"
            ></v-select>
          </v-flex>
        </v-layout>

        <v-layout row>
          <v-flex xs2>
            <v-subheader>Name: {{selectedNode.name}}</v-subheader>
          </v-flex>
          <v-flex xs4>
            <v-text-field
            label="New name"
            append-outer-icon="send"
            v-model.trim="newName"
            @click:append-outer="updateName"
            ></v-text-field>
          </v-flex>
        </v-layout>

        <v-layout row>
          <v-flex xs2>
            <v-subheader>Location: {{selectedNode.loc}}</v-subheader>
          </v-flex>
          <v-flex xs4>
            <v-text-field
            label="New Location"
            append-outer-icon="send"
            v-model.trim="newLoc"
            @click:append-outer="updateLoc"
            ></v-text-field>
          </v-flex>
        </v-layout>

        <v-subheader>Values</v-subheader>

        <v-layout column>
          <v-layout v-for="(v, index) in selectedNode.values" :key="index" row>
            <v-flex xs8>
              <ValueID
              @updateValue="updateValue"
              v-model="selectedNode.values[index]"
              ></ValueID>
            </v-flex>
          </v-layout>
        </v-layout>
      </v-container>

      <v-container v-if="!selectedNode">
        <v-subheader>
          Click on a Node in the table
        </v-subheader>
      </v-container>


    </v-tab-item>

    <v-tab-item
    key="groups"
    >

  </v-tab-item>

  <v-tab-item
  key="scenes"
  >

</v-tab-item>
</v-tabs-items>

</v-card-text>
</v-card>
</v-container>
</template>

<script>

import { mapGetters, mapMutations } from 'vuex'
import ConfigApis from '@/apis/ConfigApis'
import value from '@/apis/ConfigApis'

import ValueID from '@/components/ValueId'

//https://github.com/socketio/socket.io-client/blob/master/docs/API.md
import io from 'socket.io-client';

export default {
  name: 'ControlPanel',
  components:{
    ValueID
  },
  computed: {
  },
  watch: {
    selectedNode(){
      if(this.selectedNode){
        this.newName = this.selectedNode.name;
        this.newLoc = this.selectedNode.loc;
        this.node_action = null;
      }
    }
  },
  data () {
    return {
      socket : null,
      nodes: [],
      currentTab: 0,
      socket_status: 'Disconnected',
      node_action: 'requestNetworkUpdate',
      node_actions:[
        {
          text: "Update neighbor",
          value: "requestNodeNeighborUpdate"
        },
        {
          text: "Update return route",
          value: "assignReturnRoute"
        },
        {
          text: "Delete return routes",
          value: "deleteAllReturnRoutes"
        },
        {
          text: "Send NIF",
          value: "sendNodeInformation"
        },
        {
          text: "Replace node",
          value: "replaceFailedNode"
        },
      ],
      cnt_action: 'healNetwork',
      cnt_actions:[
        {
          text: "Heal Network",
          value: "healNetwork"
        },
        {
          text: "Hard reset",
          value: "hardReset"
        },
        {
          text: "Soft reset",
          value: "softReset"
        }
      ],
      newName: '',
      newLoc: '',
      selectedNode: null,
      headers: [
        { text: 'ID', value: 'node_id'},
        { text: 'Type', value: 'type'},
        { text: 'Product', value: 'product'},
        { text: 'Name', value: 'name'},
        { text: 'Location', value: 'loc'},
        { text: 'Status', value: 'status'}
      ],
      rules: {
        required: (value) => {
          var valid = false;

          if(value instanceof Array)
          valid = value.length > 0;
          else
          valid = !isNaN(value) || !!value; //isNaN is for 0 as valid value

          return valid || 'This field is required.'
        }
      },
    }
  },
  methods: {
    showSnackbar(text){
      this.$emit('showSnackbar', text);
    },
    sendCntAction(){
      if(this.cnt_action){
        var data = {
          api: this.cnt_action,
          args: [],
        }
        this.socket.emit('ZWAVE_API', data)
      }
    },
    sendNodeAction(){
      if(this.selectedNode){
        var data = {
          api: this.node_action,
          args: [this.selectedNode.node_id],
        }
        this.socket.emit('ZWAVE_API', data)
      }
    },
    saveConfiguration(){
      var data = {
        api: 'writeConfig',
        args: [],
      }
      this.socket.emit('ZWAVE_API', data)
    },
    updateName(){
      var data = {
        api: 'setNodeName',
        args: [this.selectedNode.node_id, this.newName],
        refreshNode: true,
        node: this.selectedNode.node_id
      }
      this.socket.emit('ZWAVE_API', data)
    },
    updateLoc(){
      var data = {
        api: 'setNodeLocation',
        args: [this.selectedNode.node_id, this.newLoc],
        refreshNode: true,
        node: this.selectedNode.node_id
      }
      this.socket.emit('ZWAVE_API', data)
    },
    updateValue(v){
      var data = {
        api: 'setValue',
        args: [v.node_id, v.class_id, v.instance, v.index, v.type == "button" ? true : v.newValue],
      }
      v.toUpdate = true;

      this.socket.emit('ZWAVE_API', data);
    },
    initNode(n){
      if(n){
        var values = [];
        for (var k in n.values) {
          n.values[k].newValue = n.values[k].value;
          values.push(n.values[k]);
        }
        n.values = values;
      }
    }
  },
  mounted() {

    this.socket = io(ConfigApis.getSocketIP());

    this.socket.on('connect', () => {
      console.log("Socket connected");
      this.socket_status = "connected";
    });

    this.socket.on('disconnect', () => {
      console.log("Socket closed");
      this.socket_status = "disconnected";
    });

    this.socket.on('error', () => {
      console.log("Socket error");
    });

    this.socket.on('reconnecting', () => {
      console.log("Socket reconnecting");
      this.socket_status = "reconnecting";
    });

    this.socket.on('NODES', (data) => {
      //convert node values in array
      for (var i = 0; i < data.length; i++) {
        this.initNode(data[i])
      }
      this.nodes = data;
    });

    this.socket.on('NODE_UPDATED', (data) => {
      if(this.nodes[data.node_id]){
        delete data.values;
        Object.assign(this.nodes[data.node_id], data)
      }
      else{
        this.initNode(data);
        this.nodes[data.node_id] = data;
      }
    });

    this.socket.on('VALUE_UPDATED', (data) => {
      var node = this.nodes[data.node_id];
      if(node && node.values){
        var index = node.values.findIndex(v => v.value_id == data.value_id);
        if(index >= 0) {
          if(this.nodes[data.node_id].values[index].toUpdate){
            this.nodes[data.node_id].values[index].toUpdate = false;
            this.showSnackbar("Value updated");
          }

          if(!data.newValue)
          data.newValue = data.value;

          Object.assign(this.nodes[data.node_id].values[index], data);
        }
      }
    });

    this.socket.on('API_RETURN', (data) => {
      if(data.success){
        this.showSnackbar("Successfully call api " + data.api);
      }else{
        this.showSnackbar("Error when calling api " + data.api + ": " + data.message);
      }
    });

  },
  beforeDestroy() {
    if(this.socket) this.socket.close();
  }
}

</script>
