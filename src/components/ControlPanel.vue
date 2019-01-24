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
        :rows-per-page-items="[10, 20, {'text':'All','value':-1}]"
        item-key="node_id"
        class="elevation-1"
        >
        <template slot="items" slot-scope="props">
          <tr style="cursor:pointer;" v-if="props.item" :active="selectedNode == props.item" @click="selectedNode == props.item ? selectedNode = null : selectedNode = props.item">
            <td>{{ props.item.node_id }}</td>
            <td>{{ props.item.type }}</td>
            <td>{{ props.item.ready ? (props.item.product + ' (' + props.item.manufacturer + ')') : '' }}</td>
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

  <!-- TABS -->

  <v-tabs-items v-model="currentTab">

    <!-- TAB NODE INFO -->
    <v-tab-item key="node">
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

          <!-- USER VALUES -->
          <v-expansion-panel class="elevation-0">
            <v-expansion-panel-content>
              <div slot="header">User</div>
              <v-card>
                <v-card-text>
                  <v-flex v-for="(v, index) in selectedNode.values.filter(v => v.genre == 'user')" :key="index" xs12>
                    <ValueID
                    @updateValue="updateValue"
                    v-model="selectedNode.values[selectedNode.values.indexOf(v)]"
                    ></ValueID>
                  </v-flex>
                </v-card-text>
              </v-card>
            </v-expansion-panel-content>
          </v-expansion-panel>

          <v-divider></v-divider>

          <!-- CONFIG VALUES -->
          <v-expansion-panel class="elevation-0">
            <v-expansion-panel-content>
              <div slot="header">Configuration</div>
              <v-card>
                <v-card-text>
                  <v-flex v-for="(v, index) in selectedNode.values.filter(v => v.genre == 'config')" :key="index" xs12>
                    <ValueID
                    @updateValue="updateValue"
                    v-model="selectedNode.values[selectedNode.values.indexOf(v)]"
                    ></ValueID>
                  </v-flex>
                </v-card-text>
              </v-card>
            </v-expansion-panel-content>
          </v-expansion-panel>

          <v-divider></v-divider>

          <!-- SYSTEM VALUES -->
          <v-expansion-panel class="elevation-0">
            <v-expansion-panel-content>
              <div slot="header">System</div>
              <v-card>
                <v-card-text>
                  <v-flex v-for="(v, index) in selectedNode.values.filter(v => v.genre == 'system')" :key="index" xs12>
                    <ValueID
                    @updateValue="updateValue"
                    v-model="selectedNode.values[selectedNode.values.indexOf(v)]"
                    ></ValueID>
                  </v-flex>
                </v-card-text>
              </v-card>
            </v-expansion-panel-content>
          </v-expansion-panel>

          <v-divider></v-divider>

        </v-layout>
      </v-container>

      <v-container v-if="!selectedNode">
        <v-subheader>
          Click on a Node in the table
        </v-subheader>
      </v-container>


    </v-tab-item>

    <!-- TAB GROUPS -->
    <v-tab-item key="groups">

      <v-container grid-list-md>
        <v-layout wrap>

        <v-flex xs12 sm6>
          <v-select
          label="Node"
          v-model="group.node"
          :items="nodes.filter(n => !!n)"
          return-object
          @change="resetGroup"
          item-text="_name"
          ></v-select>
        </v-flex>

        <v-flex v-if="group.node" xs12 sm6>
          <v-select
          label="Group"
          v-model="group.group"
          @input="getAssociations"
          :items="group.node.groups"
          ></v-select>
        </v-flex>

        <v-flex v-if="group.group" xs12 sm6>
          <v-text-field
          label="Current associations"
          disabled
          :value="group.associations"
          ></v-text-field>
        </v-flex>

        <v-flex v-if="group.node" xs12 sm6>
          <v-select
          label="Target"
          v-model="group.target"
          :items="nodes.filter(n => !!n && n != group.node)"
          return-object
          item-text="_name"
          ></v-select>
        </v-flex>

        <v-flex xs12 sm6>
          <v-switch
          label="Multi instance"
          presistent-hint
          hint="Enable this target node supports multi instance associations"
          v-model="group.multiInstance"
          ></v-switch>
        </v-flex>

        <v-flex v-if="group.multiInstance" xs12 sm6>
          <v-text-field
          v-model.number="group.targetInstance"
          label="Instance ID"
          hint="Target node instance ID"
          type="number"
          />
        </v-flex>

        <v-flex v-if="group.node && group.target && group.group" xs12>
          <v-btn color="primary" @click.native="addAssociation" dark class="mb-2">Add</v-btn>
          <v-btn color="primary" @click.native="removeAssociation" dark class="mb-2">Remove</v-btn>
        </v-flex>

      </v-layout>
    </v-container>

    </v-tab-item>

    <!-- TAB SCENES -->
    <v-tab-item key="scenes">

      <v-container grid-list-md>
        <v-layout wrap>

          <v-flex xs12 sm6>
            <v-select
            label="Scene"
            v-model="selectedScene"
            :items="scenes"
            item-text="label"
            item-value="sceneid"
            ></v-select>
          </v-flex>

          <v-flex xs12 sm6>
            <v-text-field
            label="New Scene"
            append-outer-icon="send"
            @click:append-outer="createScene"
            v-model.trim="newScene"
            ></v-text-field>
          </v-flex>

          <v-flex v-if="selectedScene" xs12>
            <v-btn color="red darken-1" flat @click="removeScene">Delete</v-btn>
            <v-btn color="green darken-1" flat @click="activateScene">Activate</v-btn>
            <v-btn color="blue darken-1" flat @click="dialogValue = true">New Value</v-btn>
          </v-flex>

        </v-layout>

        <DialogSceneValue
        @save="saveValue"
        @close="closeDialog"
        v-model="dialogValue"
        :title="dialogTitle"
        :editedValue="editedValue"
        :nodes="nodes"
        />

        <v-data-table
          v-if="selectedScene"
          :headers="headers_values"
          :items="scene_values"
          class="elevation-1"
        >
          <template slot="items" slot-scope="props">
            <td class="text-xs">{{ props.item.value_id }}</td>
            <td class="text-xs">{{ props.item.node_id }}</td>
            <td class="text-xs">{{ props.item.label }}</td>
            <td class="text-xs">{{ props.item.value }}</td>
            <td class="text-xs">{{ props.item.timeout ? 'After ' + props.item.timeout + 's' : 'No' }}</td>
            <td class="justify-center layout px-0">
              <v-icon
                small
                class="mr-2"
                @click="editItem(props.item)"
              >
                edit
              </v-icon>
              <v-icon
                small
                @click="deleteItem(props.item)"
              >
                delete
              </v-icon>
            </td>
          </template>
        </v-data-table>

      </v-container>
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

import DialogSceneValue from '@/components/dialogs/DialogSceneValue'

//https://github.com/socketio/socket.io-client/blob/master/docs/API.md
import io from 'socket.io-client';

export default {
  name: 'ControlPanel',
  components:{
    ValueID,
    DialogSceneValue
  },
  computed: {
    dialogTitle () {
        return this.editedIndex === -1 ? 'New Value' : 'Edit Value'
    },
  },
  watch: {
    dialogValue (val) {
      val || this.closeDialog()
    },
    selectedNode(){
      if(this.selectedNode){
        this.newName = this.selectedNode.name;
        this.newLoc = this.selectedNode.loc;
        this.node_action = null;
      }
    },
    selectedScene(){
      this.refreshValues();
    },
    currentTab(){
      if(this.currentTab == 2){
        this.refreshScenes();
      }else{
        this.selectedScene = null;
        this.scene_values = [];
      }
    }
  },
  data () {
    return {
      socket : null,
      nodes: [],
      scenes: [],
      selectedScene: null,
      newScene: '',
      scene_values: [],
      dialogValue: false,
      editedValue: {},
      editedIndex: -1,
      headers_values: [
        { text: 'Value ID', value: 'value_id'},
        { text: 'Node', value: 'node_id'},
        { text: 'Label', value: 'label'},
        { text: 'Value', value: 'value'},
        { text: 'Timeout', value: 'timeout'},
        { text: 'Actions', sortable: false }
      ],
      group: {},
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
    apiRequest(apiName, args){
      var data = {
        api: apiName,
        args: args,
      }
      this.socket.emit('ZWAVE_API', data)
    },
    refreshValues(){
      if(this.selectedScene){
        this.apiRequest('sceneGetValues', [this.selectedScene]);
      }
    },
    refreshScenes(){
      this.apiRequest('getScenes', []);
    },
    createScene(){
      if(this.newScene){
        this.apiRequest('createScene', [this.newScene]);
        this.refreshScenes();
        this.newScene = "";
      }
    },
    removeScene(){
      if(this.selectedScene){
        this.apiRequest('removeScene', [this.selectedScene]);
        this.selectedScene = null;
        this.refreshScenes();
      }
    },
    activateScene(){
      if(this.selectedScene){
        this.apiRequest('activateScene', [this.selectedScene]);
      }
    },
    editItem (item) {
      this.editedIndex = this.scene_values.indexOf(item);
      var node = this.nodes[item.node_id];
      var value = node.values.find(v => v.value_id == item.value_id);

      value = Object.assign({}, value);
      value.newValue = item.value;

      this.editedValue = {node: node, value: value, timeout: this.scene_values[this.editedIndex].timeout};
      this.dialogValue = true;
    },
    deleteItem (value) {
      if(confirm('Are you sure you want to delete this item?')){
        this.apiRequest('removeSceneValue', [this.selectedScene, value.node_id, value.class_id, value.instance, value.index]);
        this.refreshValues();
      }
    },
    closeDialog () {
      this.dialogValue = false
      setTimeout(() => {
        this.editedValue = {};
        this.editedIndex = -1
      }, 300)
    },
    saveValue () {
      var value = this.editedValue.value;
      value.value = value.newValue;

      // if value already exists it will be updated
      this.apiRequest('addSceneValue', [this.selectedScene, value, value.value, this.editedValue.timeout]);
      this.refreshValues();

      this.closeDialog()
    },
    sendCntAction(){
      if(this.cnt_action){
        this.apiRequest(this.cnt_action, [])
      }
    },
    sendNodeAction(){
      if(this.selectedNode){
        this.apiRequest(this.node_action, [this.selectedNode.node_id])
      }
    },
    saveConfiguration(){
      this.apiRequest('writeConfig', []);
    },
    updateName(){
      if(this.selectedNode){
        this.apiRequest('setNodeName', [this.selectedNode.node_id, this.newName])
        this.apiRequest('refreshNodeInfo', [this.selectedNode.node_id]);
      }
    },
    updateLoc(){
      if(this.selectedNode){
        this.apiRequest('setNodeLocation', [this.selectedNode.node_id, this.newLoc])
        this.apiRequest('refreshNodeInfo', [this.selectedNode.node_id]);
      }
    },
    resetGroup(){
      this.$set(this.group, 'associations', []);
      this.$set(this.group, 'group', -1);
    },
    getAssociations(){
      var g = this.group;
      if(g && g.node){
        this.apiRequest('getAssociations', [g.node.node_id, g.group])
      }
    },
    addAssociation(){
      var g = this.group;
      if(g && g.node && g.target){
        var args = [g.node.node_id, g.group, g.target.node_id];

        if(g.multiInstance){
          args.push(g.targetInstance || 0)
        }

        this.apiRequest('addAssociation', args);

        // wait a moment before refresh to check if the node
        // has been added to the group correctly
        setTimeout(this.getAssociations, 500);
      }
    },
    removeAssociation(){
      var g = this.group;
      if(g && g.node && g.target){

        this.apiRequest('removeAssociation', [g.node.node_id, g.group, g.target.node_id])
        // wait a moment before refresh to check if the node
        // has been added to the group correctly
        setTimeout(this.getAssociations, 500);
      }
    },
    updateValue(v){
      this.apiRequest('setValue', [v.node_id, v.class_id, v.instance, v.index, v.type == "button" ? true : v.newValue])
      v.toUpdate = true;
    },
    initNode(n){
      if(n){
        var values = [];
        for (var k in n.values) {
          n.values[k].newValue = n.values[k].value;
          values.push(n.values[k]);
        }
        n.values = values;
        this.setName(n);
      }
    },
    setName(n){
      n._name = n.name || "NodeID_" + n.node_id
    }
  },
  mounted() {

    var self = this;

    this.socket = io(ConfigApis.getSocketIP());

    this.socket.on('connect', () => {
      console.log("Socket connected");
      self.socket_status = "connected";
    });

    this.socket.on('disconnect', () => {
      console.log("Socket closed");
      self.socket_status = "disconnected";
    });

    this.socket.on('error', () => {
      console.log("Socket error");
    });

    this.socket.on('reconnecting', () => {
      console.log("Socket reconnecting");
      self.socket_status = "reconnecting";
    });

    this.socket.on('NODES', (data) => {
      //convert node values in array
      for (var i = 0; i < data.length; i++) {
        self.initNode(data[i])
      }
      self.nodes = data;
    });

    this.socket.on('NODE_UPDATED', (data) => {
      if(self.nodes[data.node_id]){
        delete data.values;
        self.setName(data);
        Object.assign(self.nodes[data.node_id], data)
      }
      else{
        self.initNode(data);
        self.nodes[data.node_id] = data;
      }
    });

    this.socket.on('VALUE_UPDATED', (data) => {
      var node = self.nodes[data.node_id];
      if(node && node.values){
        var index = node.values.findIndex(v => v.value_id == data.value_id);
        if(index >= 0) {
          if(self.nodes[data.node_id].values[index].toUpdate){
            self.nodes[data.node_id].values[index].toUpdate = false;
            self.showSnackbar("Value updated");
          }

          if(!data.newValue)
          data.newValue = data.value;

          Object.assign(self.nodes[data.node_id].values[index], data);
        }
      }
    });

    this.socket.on('API_RETURN', (data) => {
      if(data.success){
        self.showSnackbar("Successfully call api " + data.api);
        switch(data.api){
          case "getAssociations":
          data.result = data.result.map(a => self.nodes[a]._name || a);
          self.$set(self.group, 'associations', data.result.join(', '));
          break;
          case "getScenes":
          self.scenes = data.result;
          break;
          case "sceneGetValues":
          self.scene_values = data.result;
          break;
        }
      }else{
        self.showSnackbar("Error while calling api " + data.api + ": " + data.message);
      }
    });

  },
  beforeDestroy() {
    if(this.socket) this.socket.close();
  }
}

</script>
