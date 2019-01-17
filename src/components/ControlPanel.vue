/* eslint-disable */

<template>
  <v-container fluid>
    <v-card>
      <v-card-text>

        <v-container fluid>
          <v-layout row>
            <v-flex xs3>
              <v-select
              label="Actions"
              append-outer-icon="send"
              v-model="cnt_action"
              :items="cnt_actions"
              @click:append-outer="sendCntAction"
              ></v-select>
            </v-flex>
          </v-layout>
        </v-container>


        <v-data-table
        :headers="headers"
        :items="nodes"
        class="elevation-1"
        >
        <template slot="items" slot-scope="props">
          <tr style="cursor:pointer;" v-if="props.item" :active="selectedNode == props.item" @click="selectedNode = props.item">
            <td>{{ props.item.node_id }}</td>
            <td>{{ props.item.type }}</td>
            <td>{{ `${props.item.product} (${props.item.manufacturer})` }}</td>
            <td>{{ props.item.name }}</td>
            <td>{{ props.item.loc }}</td>
            <td>{{ props.item.ready ? 'Yes' : 'No' }}</td>
          </tr>
        </template>
      </v-data-table>

      <v-container v-if="selectedNode" fluid>

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

          <!--BOOLEAN-->

          <v-layout v-for="(v, index) in selectedNode.values" :key="index" row>
            <v-flex v-if="v.read_only" xs4>
              <v-text-field
              :label="v.label"
              disabled
              :suffix="v.units"
              v-model="v.value"
              ></v-text-field>
            </v-flex>

            <v-flex v-if="!v.read_only" xs4>
              <v-text-field
              v-if="['byte', 'short', 'decimal', 'string'].indexOf(v.type) >= 0"
              :label="v.label"
              :type="v.type == 'string' ? 'text' : 'number'"
              append-outer-icon="send"
              :suffix="v.units"
              :min="v.min"
              :max="v.max"
              v-model="v.newValue"
              @click:append-outer="updateValue(v)"
              ></v-text-field>

              <v-select
              v-if="v.type == 'list'"
              :items="v.values"
              :label="v.label"
              append-outer-icon="send"
              v-model="v.newValue"
              @click:append-outer="updateValue(v)"
              ></v-select>

              <v-switch
              v-if="v.type == 'bool'"
              :label="v.label"
              v-model="v.newValue"
              @change="updateValue(v)"
              ></v-switch>

              <v-btn
              v-if="v.type == 'button'"
              color="primary"
              dark
              @click="updateValue(v)"
              class="mb-2"
              >{{v.label}}</v-btn>

            </v-flex>

            <v-tooltip v-if="v.help" bottom>
              <v-icon
              slot="activator"
              >help</v-icon>
              <span>{{v.help}}</span>
            </v-tooltip>

          </v-layout>


        </v-layout>

      </v-container>

    </v-card-text>
  </v-card>
</v-container>
</template>

<script>

import { mapGetters, mapMutations } from 'vuex'
import ConfigApis from '@/apis/ConfigApis'

//https://github.com/socketio/socket.io-client/blob/master/docs/API.md
import io from 'socket.io-client';

export default {
  name: 'ControlPanel',
  computed: {
  },
  watch: {
    selectedNode(){
      if(this.selectedNode){
        this.newName = this.selectedNode.name;
        this.newLoc = this.selectedNode.loc;
      }
    }
  },
  data () {
    return {
      socket : null,
      nodes: [],
      connected: false,
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
      reconnecting: false,
      selectedNode: null,
      headers: [
        { text: 'ID', value: 'node_id'},
        { text: 'Type', value: 'type'},
        { text: 'Product', value: 'product'},
        { text: 'Name', value: 'name'},
        { text: 'Location', value: 'loc'},
        { text: 'Status', value: 'ready'}
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
    }
  },
  mounted() {

    this.socket = io(ConfigApis.getSocketIP());

    this.socket.on('connect', () => {
      console.log("Socket connected");
      this.connected = true;
      this.reconnecting = false;
    });

    this.socket.on('disconnect', () => {
      console.log("Socket closed");
      this.connected = false;
    });

    this.socket.on('error', () => {
      console.log("Socket error");
      this.connected = false;
      this.reconnecting = false;
    });

    this.socket.on('reconnecting', () => {
      console.log("Socket reconnecting");
      this.reconnecting = true;
    });

    this.socket.on('NODES', (data) => {

      //convert node values in array
      for (var i = 0; i < data.length; i++) {
        var n = data[i];
        if(n){
          var values = [];
          for (var k in n.values) {
            n.values[k].newValue = n.values[k].value;
            values.push(n.values[k]);
          }
          n.values = values;
        }
      }

      this.nodes = data;
    });

    this.socket.on('NODE_UPDATED', (data) => {
      Object.assign(this.nodes[data.node_id], data);
    });

    this.socket.on('VALUE_UPDATED', (data) => {
      var node = this.nodes[data.node_id];
      if(node){
        var index = node.values.findIndex(v => v.value_id == data.value_id);
        if(index >= 0) {
          if(this.nodes[data.node_id].values[index].toUpdate){
            this.nodes[data.node_id].values[index].toUpdate = false;
            this.showSnackbar("Value updated");
          }
          Object.assign(this.nodes[data.node_id].values[index], data);
        }
      }
    });
  },
  beforeDestroy() {
    if(this.socket) this.socket.close();
  }
}

</script>
