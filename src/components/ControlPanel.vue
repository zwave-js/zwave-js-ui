<template>
  <v-container fluid>
    <v-card>
      <v-card-text>
        <v-container fluid>
          <v-layout>
            <v-flex xs12 sm3 md2 mr-2>
              <v-text-field
                label="Home ID"
                readonly
                v-model="homeid"
              ></v-text-field>
            </v-flex>
            <v-flex xs12 sm3 md2 mr-2>
              <v-text-field
                label="Home Hex"
                readonly
                v-model="homeHex"
              ></v-text-field>
            </v-flex>
          </v-layout>

          <v-layout>
            <v-flex xs12 sm6 md3 mr-2>
              <v-text-field
                label="Controller status"
                readonly
                v-model="cnt_status"
              ></v-text-field>
            </v-flex>

            <v-flex xs12 sm6 md3>
              <v-select
                label="Actions"
                append-outer-icon="send"
                v-model="cnt_action"
                :items="cnt_actions.concat(node_actions)"
                @click:append-outer="sendCntAction"
              ></v-select>
            </v-flex>

            <v-flex xs12 sm6 md3 align-self-center>
              <v-btn icon @click="importConfiguration">
                <v-tooltip bottom>
                  <template v-slot:activator="{ on }">
                    <v-icon dark color="primary" v-on="on">file_upload</v-icon>
                  </template>
                  <span>Import nodes.json Configuration</span>
                </v-tooltip>
              </v-btn>
              <v-btn icon @click="exportConfiguration">
                <v-tooltip bottom>
                  <template v-slot:activator="{ on }">
                    <v-icon dark color="primary" v-on="on"
                      >file_download</v-icon
                    >
                  </template>
                  <span>Export nodes.json Configuration</span>
                </v-tooltip>
              </v-btn>
            </v-flex>
          </v-layout>
        </v-container>

        <v-layout row wrap>
          <v-flex xs12 ml-2>
            <v-switch label="Show hidden nodes" v-model="showHidden"></v-switch>
          </v-flex>
        </v-layout>

        <v-data-table
          :headers="headers"
          :items="tableNodes"
          :footer-props="{
            itemsPerPageOptions: [10, 20, { text: 'All', value: -1 }]
          }"
          :items-per-page.sync="nodeTableItems"
          item-key="id"
          class="elevation-1"
        >
          <template v-slot:item="{ item }">
            <tr
              :style="{
                cursor: 'pointer',
                background:
                  selectedNode === item
                    ? $vuetify.theme.themes.light.accent
                    : 'none'
              }"
              @click.stop="selectNode(item)"
            >
              <td>{{ item.id }}</td>
              <td>
                {{ item.ready ? item.manufacturer : '' }}
              </td>
              <td>
                {{ item.ready ? item.productDescription : '' }}
              </td>
              <td>
                {{ item.ready ? item.productLabel : '' }}
              </td>
              <td>{{ item.name || '' }}</td>
              <td>{{ item.loc || '' }}</td>
              <td>{{ item.isSecure ? 'Yes' : 'No' }}</td>
              <td>{{ item.isBeaming ? 'Yes' : 'No' }}</td>
              <td>{{ item.failed ? 'Yes' : 'No' }}</td>
              <td>{{ item.status }}</td>
              <td>{{ item.interviewStage }}</td>
              <td>
                {{
                  item.lastActive
                    ? new Date(item.lastActive).toLocaleString()
                    : 'Never'
                }}
              </td>
            </tr>
          </template>
        </v-data-table>

        <v-tabs style="margin-top:10px" v-model="currentTab" fixed-tabs>
          <v-tab key="node">Node</v-tab>
          <v-tab key="groups">Groups</v-tab>
          <v-tab key="scenes">Scenes</v-tab>
          <v-tab key="debug">Debug</v-tab>

          <!-- TABS -->
          <v-tabs-items v-model="currentTab">
            <!-- TAB NODE INFO -->
            <v-tab-item key="node">
              <v-container
                v-if="selectedNode"
                style="min-width:90%"
                grid-list-md
              >
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
                  <v-flex>
                    <v-subheader
                      >Device ID: {{ selectedNode.deviceId }}</v-subheader
                    >
                  </v-flex>
                </v-layout>

                <v-layout row>
                  <v-flex xs2 style="max-width:100px">
                    <v-subheader>Name: {{ selectedNode.name }}</v-subheader>
                  </v-flex>
                  <v-flex xs8 style="max-width:300px">
                    <v-text-field
                      label="New name"
                      append-outer-icon="send"
                      :error="!!nameError"
                      :error-messages="nameError"
                      v-model.trim="newName"
                      @click:append-outer="updateName"
                    ></v-text-field>
                  </v-flex>
                </v-layout>

                <v-layout row>
                  <v-flex xs2 style="max-width:100px">
                    <v-subheader>Location: {{ selectedNode.loc }}</v-subheader>
                  </v-flex>
                  <v-flex xs8 style="max-width:300px">
                    <v-text-field
                      label="New Location"
                      append-outer-icon="send"
                      v-model.trim="newLoc"
                      :error="!!locError"
                      :error-messages="locError"
                      @click:append-outer="updateLoc"
                    ></v-text-field>
                  </v-flex>
                </v-layout>

                <v-layout v-if="selectedNode.values" column>
                  <v-subheader>Values</v-subheader>

                  <v-expansion-panels accordion multiple>
                    <!-- USER VALUES -->
                    <v-expansion-panel>
                      <v-expansion-panel-header>User</v-expansion-panel-header>
                      <v-expansion-panel-content>
                        <v-card flat>
                          <v-card-text>
                            <v-layout row wrap>
                              <v-flex
                                v-for="(v, index) in userValues"
                                :key="index"
                                xs12
                                sm6
                                md4
                              >
                                <ValueID
                                  @updateValue="updateValue"
                                  v-model="userValues[index]"
                                ></ValueID>
                              </v-flex>
                            </v-layout>
                          </v-card-text>
                        </v-card>
                      </v-expansion-panel-content>
                    </v-expansion-panel>

                    <v-divider></v-divider>

                    <!-- CONFIG VALUES -->
                    <v-expansion-panel>
                      <v-expansion-panel-header v-slot="{ open }">
                        <v-row no-gutters>
                          <v-col style="max-width:150px">Configuration</v-col>
                          <v-col v-if="open">
                            <v-btn
                              rounded
                              color="primary"
                              @click.stop="
                                sendNodeAction('requestAllConfigParams')
                              "
                              dark
                              >Refresh values</v-btn
                            >
                          </v-col>
                        </v-row>
                      </v-expansion-panel-header>
                      <v-expansion-panel-content>
                        <v-card flat>
                          <v-card-text>
                            <v-layout row wrap>
                              <v-flex
                                v-for="(v, index) in configValues"
                                :key="index"
                                xs12
                                sm6
                                md4
                              >
                                <ValueID
                                  @updateValue="updateValue"
                                  v-model="configValues[index]"
                                ></ValueID>
                              </v-flex>
                            </v-layout>
                          </v-card-text>
                        </v-card>
                      </v-expansion-panel-content>
                    </v-expansion-panel>

                    <v-divider></v-divider>

                    <!-- SYSTEM VALUES -->
                    <v-expansion-panel>
                      <v-expansion-panel-header
                        >System</v-expansion-panel-header
                      >
                      <v-expansion-panel-content>
                        <v-card flat>
                          <v-card-text>
                            <v-layout row wrap>
                              <v-flex
                                v-for="(v, index) in systemValues"
                                :key="index"
                                xs12
                                sm6
                                md4
                              >
                                <ValueID
                                  @updateValue="updateValue"
                                  v-model="systemValues[index]"
                                ></ValueID>
                              </v-flex>
                            </v-layout>
                          </v-card-text>
                        </v-card>
                      </v-expansion-panel-content>
                    </v-expansion-panel>
                    <v-divider></v-divider>
                  </v-expansion-panels>
                </v-layout>

                <v-layout v-if="hassDevices.length > 0" column>
                  <v-subheader>Home Assistant - Devices</v-subheader>

                  <!-- HASS DEVICES -->
                  <v-layout v-if="hassDevices.length > 0" raw wrap>
                    <v-flex xs12 md6 pa-1>
                      <v-btn
                        color="blue darken-1"
                        text
                        @click="storeDevices(false)"
                        >Store</v-btn
                      >
                      <v-btn
                        color="red darken-1"
                        text
                        @click="storeDevices(true)"
                        >Remove Store</v-btn
                      >
                      <v-btn color="green darken-1" text @click="rediscoverNode"
                        >Rediscover Node</v-btn
                      >
                      <v-btn
                        color="yellow darken-1"
                        text
                        @click="disableDiscovery"
                        >Disable Discovery</v-btn
                      >

                      <v-data-table
                        :headers="headers_hass"
                        :items="hassDevices"
                        class="elevation-1"
                      >
                        <template v-slot:item="{ item }">
                          <tr
                            style="cursor:pointer;"
                            :active="selectedDevice == item"
                            @click="
                              selectedDevice == item
                                ? (selectedDevice = null)
                                : (selectedDevice = item)
                            "
                          >
                            <td class="text-xs">{{ item.id }}</td>
                            <td class="text-xs">{{ item.type }}</td>
                            <td class="text-xs">{{ item.object_id }}</td>
                            <td class="text-xs">
                              {{ item.persistent ? 'Yes' : 'No' }}
                            </td>
                            <td class="text-xs">
                              {{
                                item.ignoreDiscovery ? 'Disabled' : 'Enabled'
                              }}
                            </td>
                          </tr>
                        </template>
                      </v-data-table>
                    </v-flex>
                    <v-flex xs12 md6 pa-1>
                      <v-btn
                        v-if="!selectedDevice"
                        color="blue darken-1"
                        :disabled="errorDevice"
                        text
                        @click="addDevice"
                        >Add</v-btn
                      >
                      <v-btn
                        v-if="selectedDevice"
                        color="blue darken-1"
                        :disabled="errorDevice"
                        text
                        @click="updateDevice"
                        >Update</v-btn
                      >
                      <v-btn
                        v-if="selectedDevice"
                        color="green darken-1"
                        :disabled="errorDevice"
                        text
                        @click="rediscoverDevice"
                        >Rediscover</v-btn
                      >
                      <v-btn
                        v-if="selectedDevice"
                        color="red darken-1"
                        :disabled="errorDevice"
                        text
                        @click="deleteDevice"
                        >Delete</v-btn
                      >
                      <v-textarea
                        label="Hass Device JSON"
                        auto-grow
                        :rules="[validJSONdevice]"
                        v-model="deviceJSON"
                      ></v-textarea>
                    </v-flex>
                  </v-layout>
                </v-layout>
              </v-container>

              <v-container v-if="!selectedNode">
                <v-subheader>Click on a Node in the table</v-subheader>
              </v-container>
            </v-tab-item>

            <!-- TAB GROUPS -->
            <v-tab-item key="groups">
              <v-container grid-list-md>
                <v-layout wrap>
                  <v-flex xs12 sm6 md4>
                    <v-select
                      label="Node"
                      v-model="group.node"
                      :items="nodes.filter(n => !n.failed)"
                      return-object
                      @change="resetGroup"
                      item-text="_name"
                    ></v-select>
                  </v-flex>

                  <v-flex v-if="group.node" xs12 sm6 md4>
                    <v-select
                      label="Group"
                      v-model="group.group"
                      @input="getAssociations"
                      :items="group.node.groups"
                      return-object
                    ></v-select>
                  </v-flex>

                  <v-flex v-if="group.node && group.group" xs12 sm6 md4>
                    <v-combobox
                      label="Target"
                      v-model="group.target"
                      :items="nodes.filter(n => !n.failed && n != group.node)"
                      return-object
                      hint="Select the node from the list or digit the node ID"
                      persistent-hint
                      item-text="_name"
                    ></v-combobox>
                  </v-flex>

                  <v-flex
                    v-if="group.group && group.group.multiChannel"
                    xs12
                    sm6
                    md4
                  >
                    <v-text-field
                      v-model.number="group.targetInstance"
                      label="Channel ID"
                      hint="Target node channel ID"
                      type="number"
                    />
                  </v-flex>

                  <v-flex v-if="group.group && group.associations" xs12 sm6 md4>
                    <v-list subheader>
                    <v-subheader>Associations</v-subheader>
                    <v-template v-for="(ass, index) in group.associations" :key="index">
                     <v-list-item dense>
                         <v-list-item-content>
                          <v-list-item-title>Node: <b>{{ nodes[ass.nodeId]._name || ass.nodeId}}</b></v-list-item-title>
                          <v-list-item-subtitle
                          v-if="ass.endpoint >= 0"
                            class="text--primary"
                          >Endpoint: <b>{{ ass.endpoint }}</b></v-list-item-subtitle>
                        </v-list-item-content>
                        <v-list-item-icon>
                          <v-icon @click="removeAssociation(ass)" color="red">
                            delete
                          </v-icon>
                        </v-list-item-icon>
                     </v-list-item>
                     <v-divider></v-divider>
                   </v-template>
                    <v-list-item v-if="group.associations.length === 0">
                      <v-list-item-content>
                        No assocaitions
                      </v-list-item-content>
                     </v-list-item>
                   </v-list>
                  </v-flex>

                  <v-flex xs12>
                    <v-btn
                      v-if="group.node && group.target && group.group"
                      rounded
                      color="primary"
                      @click="addAssociation"
                      dark
                      class="mb-2"
                      >Add</v-btn
                    >
                    <v-btn
                      v-if="group.node && group.target && group.group"
                      rounded
                      color="primary"
                      @click="removeAssociation"
                      dark
                      class="mb-2"
                      >Remove</v-btn
                    >
                    <v-btn
                      v-if="group.node"
                      rounded
                      color="primary"
                      @click="removeAllAssociations"
                      dark
                      class="mb-2"
                      >Remove All</v-btn
                    >
                  </v-flex>
                </v-layout>
              </v-container>
            </v-tab-item>

            <!-- TAB SCENES -->
            <v-tab-item key="scenes">
              <v-container grid-list-md>
                <v-layout wrap>
                  <v-flex xs12>
                    <v-btn text @click="importScenes">
                      Import
                      <v-icon right dark color="primary">file_upload</v-icon>
                    </v-btn>
                    <v-btn text @click="exportScenes">
                      Export
                      <v-icon right dark color="primary">file_download</v-icon>
                    </v-btn>
                  </v-flex>

                  <v-flex xs12 sm6>
                    <v-select
                      label="Scene"
                      v-model="selectedScene"
                      :items="scenesWithId"
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
                    <v-btn color="red darken-1" text @click="removeScene"
                      >Delete</v-btn
                    >
                    <v-btn color="green darken-1" text @click="activateScene"
                      >Activate</v-btn
                    >
                    <v-btn
                      color="blue darken-1"
                      text
                      @click="dialogValue = true"
                      >New Value</v-btn
                    >
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
                  :headers="headers_scenes"
                  :items="scene_values"
                  class="elevation-1"
                >
                  <template v-slot:item="{ item }">
                    <tr>
                      <td class="text-xs">{{ item.id }}</td>
                      <td class="text-xs">{{ item.nodeId }}</td>
                      <td class="text-xs">{{ item.label }}</td>
                      <td class="text-xs">{{ item.value }}</td>
                      <td class="text-xs">
                        {{
                          item.timeout ? 'After ' + item.timeout + 's' : 'No'
                        }}
                      </td>
                      <td>
                        <v-icon
                          small
                          color="green"
                          class="mr-2"
                          @click="editItem(item)"
                          >edit</v-icon
                        >
                        <v-icon small color="red" @click="deleteItem(item)"
                          >delete</v-icon
                        >
                      </td>
                    </tr>
                  </template>
                </v-data-table>
              </v-container>
            </v-tab-item>

            <!-- TAB Debug -->
            <v-tab-item key="debug">
              <v-container grid-list-md>
                <v-layout wrap>
                  <v-flex xs12>
                    <v-btn
                      color="green darken-1"
                      text
                      @click="debugActive = true"
                      >Start</v-btn
                    >
                    <v-btn
                      color="red darken-1"
                      text
                      @click="debugActive = false"
                      >Stop</v-btn
                    >
                    <v-btn color="blue darken-1" text @click="debug = []"
                      >Clear</v-btn
                    >
                  </v-flex>
                  <v-flex xs12>
                    <div
                      id="debug_window"
                      style="height:400px;width:100%;overflow-y:scroll;"
                      class="body-1"
                      v-html="debug.join('')"
                    ></div>
                  </v-flex>
                </v-layout>
              </v-container>
            </v-tab-item>
          </v-tabs-items>
        </v-tabs>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script>
import ConfigApis from '@/apis/ConfigApis'

import ValueID from '@/components/ValueId'

import AnsiUp from 'ansi_up'

import DialogSceneValue from '@/components/dialogs/DialogSceneValue'

const ansiUp = new AnsiUp()

const MAX_DEBUG_LINES = 300

export default {
  name: 'ControlPanel',
  props: {
    socket: Object,
    socketActions: Object,
    socketEvents: Object
  },
  components: {
    ValueID,
    DialogSceneValue
  },
  computed: {
    scenesWithId () {
      return this.scenes.map(s => {
        s.label = `[${s.sceneid}] ${s.label}`
        return s
      })
    },
    dialogTitle () {
      return this.editedIndex === -1 ? 'New Value' : 'Edit Value'
    },
    tableNodes () {
      return this.showHidden ? this.nodes : this.nodes.filter(n => !n.failed)
    },
    hassDevices () {
      var devices = []
      if (this.selectedNode && this.selectedNode.hassDevices) {
        for (const id in this.selectedNode.hassDevices) {
          var d = JSON.parse(JSON.stringify(this.selectedNode.hassDevices[id]))
          d.id = id
          devices.push(d)
        }
      }

      return devices
    },
    userValues () {
      return this.selectedNode
        ? this.selectedNode.values.filter(v => v.genre === 'user')
        : []
    },
    systemValues () {
      return this.selectedNode
        ? this.selectedNode.values.filter(v => v.genre === 'system')
        : []
    },
    configValues () {
      return this.selectedNode
        ? this.selectedNode.values.filter(v => v.genre === 'config')
        : []
    }
  },
  watch: {
    nodeTableItems (val) {
      localStorage.setItem('nodes_itemsPerPage', val)
    },
    dialogValue (val) {
      val || this.closeDialog()
    },
    newName (val) {
      this.nameError = this.validateTopic(val)
    },
    newLoc (val) {
      this.locError = this.validateTopic(val)
    },
    selectedNode () {
      if (this.selectedNode) {
        this.newName = this.selectedNode.name
        this.newLoc = this.selectedNode.loc
        this.node_action = null
        this.selectedDevice = null
      }
    },
    selectedDevice () {
      this.deviceJSON = this.selectedDevice
        ? JSON.stringify(this.selectedDevice, null, 2)
        : ''
    },
    selectedScene () {
      this.refreshValues()
    },
    currentTab () {
      if (this.currentTab === 2) {
        this.refreshScenes()
      } else {
        this.selectedScene = null
        this.scene_values = []
      }

      if (this.currentTab === 3) {
        this.debugActive = true
      } else {
        this.debugActive = false
      }
    }
  },
  data () {
    return {
      nodes: [],
      scenes: [],
      debug: [],
      homeid: '',
      homeHex: '',
      ozwVersion: '',
      showHidden: false,
      debugActive: false,
      selectedScene: null,
      cnt_status: 'Unknown',
      nodeTableItems: 10,
      newScene: '',
      scene_values: [],
      dialogValue: false,
      editedValue: {},
      editedIndex: -1,
      headers_scenes: [
        { text: 'Value ID', value: 'id' },
        { text: 'Node', value: 'nodeId' },
        { text: 'Label', value: 'label' },
        { text: 'Value', value: 'value' },
        { text: 'Timeout', value: 'timeout' },
        { text: 'Actions', sortable: false }
      ],
      headers_hass: [
        { text: 'Id', value: 'id' },
        { text: 'Type', value: 'type' },
        { text: 'Object id', value: 'object_id' },
        { text: 'Persistent', value: 'persistent' },
        { text: 'Discovery', value: 'ignoreDiscovery' }
      ],
      selectedDevice: null,
      errorDevice: false,
      deviceJSON: '',
      group: {},
      currentTab: 0,
      node_action: 'requestNetworkUpdate',
      node_actions: [
        {
          text: 'Heal node',
          value: 'healNode'
        },
        {
          text: 'Refresh info',
          value: 'refreshInfo'
        },
        {
          text: 'Is Failed Node',
          value: 'isFailedNode'
        },
        {
          text: 'Remove failed node',
          value: 'removeFailedNode'
        },
        {
          text: 'Begin Firmware update',
          value: 'beginFirmwareUpdate'
        },
        {
          text: 'Abort Firmware update',
          value: 'abortFirmwareUpdate'
        },
        {
          text: 'Remove all associations',
          value: 'removeAllAssociations'
        },
        {
          text: 'Remove node from all associations',
          value: 'removeNodeFromAllAssociations'
        }
      ],
      cnt_action: 'healNetwork',
      cnt_actions: [
        {
          text: 'Start inclusion',
          value: 'startInclusion'
        },
        {
          text: 'Stop inclusion',
          value: 'stopInclusion'
        },
        {
          text: 'Start exclusion',
          value: 'startExclusion'
        },
        {
          text: 'Stop exclusion',
          value: 'stopExclusion'
        },
        {
          text: 'Heal Network',
          value: 'beginHealingNetwork'
        },
        {
          text: 'Stop Heal Network',
          value: 'stopHealingNetwork'
        },
        {
          text: 'Hard reset',
          value: 'hardReset'
        }
      ],
      newName: '',
      nameError: null,
      locError: null,
      newLoc: '',
      selectedNode: null,
      headers: [
        { text: 'ID', value: 'id' },
        { text: 'Manufacturer', value: 'manufacturer' },
        { text: 'Product', value: 'productDescription' },
        { text: 'Product code', value: 'product' },
        { text: 'Name', value: 'name' },
        { text: 'Location', value: 'loc' },
        { text: 'Secure', value: 'isSecure' },
        { text: 'Beaming', value: 'isBeaming' },
        { text: 'Failed', value: 'failed' },
        { text: 'Status', value: 'status' },
        { text: 'Interview stage', value: 'interviewStage' },
        { text: 'Last Active', value: 'lastActive' }
      ],
      rules: {
        required: value => {
          var valid = false

          if (value instanceof Array) valid = value.length > 0
          else valid = !isNaN(value) || !!value // isNaN is for 0 as valid value

          return valid || 'This field is required.'
        }
      }
    }
  },
  methods: {
    showSnackbar (text) {
      this.$emit('showSnackbar', text)
    },
    validateTopic (name) {
      var match = name
        ? name.match(/[/a-zA-Z\u00C0-\u024F\u1E00-\u1EFF0-9_-]+/g)
        : [name]

      return match[0] !== name ? 'Only a-zA-Z0-9_- chars are allowed' : null
    },
    selectNode (item) {
      if (!item) return

      if (this.selectedNode === item) {
        this.selectedNode = null
      } else {
        this.selectedNode = this.nodes.find(n => n.id === item.id)
      }
    },
    getValue (v) {
      var node = this.nodes[v.nodeId]

      if (node && node.values) {
        return node.values.find(i => i.id === v.id)
      } else {
        return null
      }
    },
    validJSONdevice () {
      var valid = true
      try {
        JSON.parse(this.deviceJSON)
      } catch (error) {
        valid = false
      }
      this.errorDevice = !valid

      return valid || 'JSON test failed'
    },
    async importConfiguration () {
      if (
        await this.$listeners.showConfirm(
          'Attention',
          'This will override all existing nodes names and locations',
          'alert'
        )
      ) {
        try {
          var data = await this.$listeners.import('json')
          var response = await ConfigApis.importConfig({ data: data })
          this.showSnackbar(response.message)
        } catch (error) {
          console.log(error)
        }
      }
    },
    exportConfiguration () {
      var self = this
      ConfigApis.exportConfig()
        .then(data => {
          self.showSnackbar(data.message)
          if (data.success) {
            self.$listeners.export(data.data, 'nodes', 'json')
          }
        })
        .catch(error => {
          console.log(error)
        })
    },
    async importScenes () {
      if (
        await this.$listeners.showConfirm(
          'Attention',
          'This operation will override all current scenes and cannot be undone',
          'alert'
        )
      ) {
        try {
          var scenes = await this.$listeners.import('json')
          if (scenes instanceof Array) {
            this.apiRequest('_setScenes', [scenes])
          } else {
            this.showSnackbar('Imported file not valid')
          }
        } catch (error) {}
      }
    },
    exportScenes () {
      this.$listeners.export(this.scenes, 'scenes')
    },
    apiRequest (apiName, args) {
      if (this.socket.connected) {
        var data = {
          api: apiName,
          args: args
        }
        this.socket.emit(this.socketActions.zwave, data)
      } else {
        this.showSnackbar('Socket disconnected')
      }
    },
    refreshValues () {
      if (this.selectedScene) {
        this.apiRequest('_sceneGetValues', [this.selectedScene])
      }
    },
    refreshScenes () {
      this.apiRequest('_getScenes', [])
    },
    createScene () {
      if (this.newScene) {
        this.apiRequest('_createScene', [this.newScene])
        this.refreshScenes()
        this.newScene = ''
      }
    },
    async removeScene () {
      if (
        this.selectedScene &&
        (await this.$listeners.showConfirm(
          'Attention',
          'Are you sure you want to delete this scene?',
          'alert'
        ))
      ) {
        this.apiRequest('_removeScene', [this.selectedScene])
        this.selectedScene = null
        this.refreshScenes()
      }
    },
    activateScene () {
      if (this.selectedScene) {
        this.apiRequest('_activateScene', [this.selectedScene])
      }
    },
    editItem (item) {
      this.editedIndex = this.scene_values.indexOf(item)
      var node = this.nodes[item.nodeId]

      var value = node.values.find(v => v.id === item.id)

      value = Object.assign({}, value)
      value.newValue = item.value

      this.editedValue = {
        node: node,
        value: value,
        timeout: this.scene_values[this.editedIndex].timeout
      }
      this.dialogValue = true
    },
    async deleteItem (value) {
      if (
        await this.$listeners.showConfirm(
          'Attention',
          'Are you sure you want to delete this item?',
          'alert'
        )
      ) {
        this.apiRequest('_removeSceneValue', [this.selectedScene, value])
        this.refreshValues()
      }
    },
    async deleteDevice () {
      var device = this.selectedDevice
      if (
        device &&
        (await this.$listeners.showConfirm(
          'Attention',
          'Are you sure you want to delete selected device?',
          'alert'
        ))
      ) {
        this.socket.emit(this.socketActions.hass, {
          apiName: 'delete',
          device: device,
          nodeId: this.selectedNode.id
        })
      }
    },
    async rediscoverNode () {
      var node = this.selectedNode
      if (
        node &&
        (await this.$listeners.showConfirm(
          'Rediscover node',
          'Are you sure you want to re-discover all node values?'
        ))
      ) {
        this.socket.emit(this.socketActions.hass, {
          apiName: 'rediscoverNode',
          nodeId: this.selectedNode.id
        })
      }
    },
    async disableDiscovery () {
      var node = this.selectedNode
      if (
        node &&
        (await this.$listeners.showConfirm(
          'Rediscover node',
          'Are you sure you want to disable discovery of all values? In order to make this persistent remember to click on Store'
        ))
      ) {
        this.socket.emit(this.socketActions.hass, {
          apiName: 'disableDiscovery',
          nodeId: this.selectedNode.id
        })
      }
    },
    async rediscoverDevice () {
      var device = this.selectedDevice
      if (
        device &&
        (await this.$listeners.showConfirm(
          'Are you sure you want to re-discover selected device?'
        ))
      ) {
        this.socket.emit(this.socketActions.hass, {
          apiName: 'discover',
          device: device,
          nodeId: this.selectedNode.id
        })
      }
    },
    updateDevice () {
      if (!this.errorDevice) {
        var updated = JSON.parse(this.deviceJSON)
        this.$set(
          this.selectedNode.hassDevices,
          this.selectedDevice.id,
          updated
        )
        this.socket.emit(this.socketActions.hass, {
          apiName: 'update',
          device: updated,
          nodeId: this.selectedNode.id
        })
      }
    },
    addDevice () {
      if (!this.errorDevice) {
        var newDevice = JSON.parse(this.deviceJSON)
        this.socket.emit(this.socketActions.hass, {
          apiName: 'add',
          device: newDevice,
          nodeId: this.selectedNode.id
        })
      }
    },
    storeDevices (remove) {
      this.socket.emit(this.socketActions.hass, {
        apiName: 'store',
        devices: this.selectedNode.hassDevices,
        nodeId: this.selectedNode.id,
        remove: remove
      })
    },
    closeDialog () {
      this.dialogValue = false
      setTimeout(() => {
        this.editedValue = {}
        this.editedIndex = -1
      }, 300)
    },
    saveValue () {
      var value = this.editedValue.value
      value.value = value.newValue

      // if value already exists it will be updated
      this.apiRequest('_addSceneValue', [
        this.selectedScene,
        value,
        value.value,
        this.editedValue.timeout
      ])
      this.refreshValues()

      this.closeDialog()
    },
    async sendCntAction () {
      if (this.cnt_action) {
        var args = []
        var broadcast = false
        var askId = this.node_actions.find(a => a.value === this.cnt_action)
        if (askId) {
          broadcast = await this.$listeners.showConfirm(
            'Broadcast',
            'Send this command to all nodes?'
          )

          if (!broadcast) {
            var id = parseInt(prompt('Node ID'))

            if (isNaN(id)) {
              this.showMessage('Node ID must be an integer value')
              return
            }
            args.push(id)
          }
        }

        if (this.cnt_action === 'startInclusion') {
          var secure = await this.$listeners.showConfirm(
            'Node inclusion',
            'Start inclusion in secure mode?'
          )
          args.push(secure)
        } else if (this.cnt_action === 'hardReset') {
          var ok = await this.$listeners.showConfirm(
            'Hard Reset',
            'Your controller will be reset to factory and all paired devices will be removed',
            { color: 'red' }
          )
          if (!ok) {
            return
          }
        } else if (this.cnt_action === 'beginFirmwareUpdate') {
          try {
            var dataBuffer = await this.$listeners.import('buffer')
            args.push(dataBuffer)
          } catch (error) {
            return
          }
        }

        if (broadcast) {
          for (let i = 0; i < this.nodes.length; i++) {
            const nodeid = this.nodes[i].id
            this.apiRequest(this.cnt_action, [nodeid])
          }
        } else {
          this.apiRequest(this.cnt_action, args)
        }
      }
    },
    async sendNodeAction (action) {
      action = typeof action === 'string' ? action : this.node_action
      if (this.selectedNode) {
        var args = [this.selectedNode.id]

        if (this.node_action === 'beginFirmwareUpdate') {
          try {
            var dataBuffer = await this.$listeners.import('buffer')
            args.push(dataBuffer)
          } catch (error) {
            return
          }
        }

        this.apiRequest(action, args)
      }
    },
    saveConfiguration () {
      this.apiRequest('writeConfig', [])
    },
    updateName () {
      if (this.selectedNode && !this.nameError) {
        this.apiRequest('_setNodeName', [this.selectedNode.id, this.newName])
      }
    },
    updateLoc () {
      if (this.selectedNode && !this.locError) {
        this.apiRequest('_setNodeLocation', [this.selectedNode.id, this.newLoc])
      }
    },
    resetGroup () {
      this.$set(this.group, 'associations', [])
      this.$set(this.group, 'group', null)
    },
    getAssociations () {
      var g = this.group
      if (g && g.node && g.group) {
        this.apiRequest('getAssociations', [g.node.id, g.group.value])
      }
    },
    addAssociation () {
      var g = this.group
      var target = !isNaN(g.target) ? parseInt(g.target) : g.target.id

      var association = { nodeId: target }

      if (g.group.multiChannel && g.targetInstance >= 0) {
        association.endpoint = g.targetInstance
      }

      if (g && g.node && target) {
        var args = [g.node.id, g.group.value, [association]]

        this.apiRequest('addAssociations', args)

        // wait a moment before refresh to check if the node
        // has been added to the group correctly
        setTimeout(this.getAssociations, 1000)
      }
    },
    removeAssociation (association) {
      var g = this.group
      if (g && g.node) {
        if (!association) {
          var target = !isNaN(g.target) ? parseInt(g.target) : g.target.id

          if (isNaN(target)) return
          association = { nodeId: target }

          if (g.group.multiChannel && g.targetInstance >= 0) {
            association.endpoint = g.targetInstance
          }
        }

        var args = [g.node.id, g.group.value, [association]]

        this.apiRequest('removeAssociations', args)
        // wait a moment before refresh to check if the node
        // has been added to the group correctly
        setTimeout(this.getAssociations, 1000)
      }
    },
    removeAllAssociations () {
      var g = this.group
      if (g && g.node) {
        var args = [g.node.id]

        this.apiRequest('removeAllAssociations', args)
        // wait a moment before refresh to check if the node
        // has been added to the group correctly
        setTimeout(this.getAssociations, 1000)
      }
    },
    updateValue (v) {
      v = this.getValue(v)

      if (v) {
        // in this way I can check when the value receives an update
        v.toUpdate = true

        if (v.type === 'number') {
          v.newValue = parseInt(v.newValue)
        }

        // it's a button
        if (v.type === 'boolean' && !v.readable) {
          v.newValue = true
        }

        this.apiRequest('writeValue', [
          {
            nodeId: v.nodeId,
            commandClass: v.commandClass,
            endpoint: v.endpoint,
            property: v.property,
            propertyKey: v.propertyKey
          },
          v.newValue
        ])
      }
    },
    jsonToList (obj) {
      var s = ''
      for (var k in obj) s += k + ': ' + obj[k] + '\n'

      return s
    },
    initNode (n) {
      var values = []
      for (var k in n.values) {
        n.values[k].newValue = n.values[k].value
        values.push(n.values[k])
      }
      n.values = values
      this.setName(n)
    },
    setName (n) {
      n._name = n.name
        ? n.name + (n.loc ? ' (' + n.loc + ')' : '')
        : 'NodeID_' + n.id
    }
  },
  mounted () {
    var self = this

    const itemsPerPage = parseInt(localStorage.getItem('nodes_itemsPerPage'))

    this.nodeTableItems = !isNaN(itemsPerPage) ? itemsPerPage : 10

    this.socket.on(this.socketEvents.controller, data => {
      self.cnt_status = data
    })

    this.socket.on(this.socketEvents.connected, info => {
      self.homeid = info.homeid
      self.homeHex = info.name
      self.ozwVersion = info.version
    })

    this.socket.on(this.socketEvents.nodeRemoved, node => {
      if (self.selectedNode && self.selectedNode.id === node.id) {
        self.selectedNode = null
      }
      self.$set(self.nodes, node.id, node)
    })

    this.socket.on(this.socketEvents.debug, data => {
      if (self.debugActive) {
        data = ansiUp.ansi_to_html(data)
        data = data.replace(/\n/g, '</br>')
        // \b[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}Z\b
        self.debug.push(data)

        if (self.debug.length > MAX_DEBUG_LINES) self.debug.shift()

        var textarea = document.getElementById('debug_window')
        if (textarea) {
          // textarea could be hidden
          textarea.scrollTop = textarea.scrollHeight
        }
      }
    })

    this.socket.on(this.socketEvents.init, data => {
      // convert node values in array
      var nodes = data.nodes
      for (var i = 0; i < nodes.length; i++) {
        self.initNode(nodes[i])
      }
      self.nodes = nodes
      self.cnt_status = data.error ? data.error : data.cntStatus
      self.homeid = data.info.homeid
      self.homeHex = data.info.name
      self.ozwVersion = data.info.version
    })

    this.socket.on(this.socketEvents.nodeUpdated, data => {
      self.initNode(data)
      if (!self.nodes[data.id] || self.nodes[data.id].failed) {
        // add missing nodes
        while (self.nodes.length < data.id) {
          self.nodes.push({
            id: self.nodes.length,
            failed: true,
            status: 'Removed'
          })
        }
      }
      self.$set(self.nodes, data.id, data)

      if (this.selectedNode && this.selectedNode.id === data.id) {
        this.selectedNode = self.nodes[data.id]
      }
    })

    this.socket.on(this.socketEvents.valueUpdated, data => {
      var valueId = self.getValue(data)

      if (valueId) {
        // this value is waiting for an update
        if (valueId.toUpdate) {
          valueId.toUpdate = false
          self.showSnackbar('Value updated')
        }
        valueId.newValue = data.value
        valueId.value = data.value
      }
    })

    this.socket.on(this.socketEvents.api, async data => {
      if (data.success) {
        switch (data.api) {
          case 'getAssociations':
            self.$set(self.group, 'associations', data.result)
            break
          case '_getScenes':
            self.scenes = data.result
            break
          case '_setScenes':
            self.scenes = data.result
            self.showSnackbar('Successfully updated scenes')
            break
          case '_sceneGetValues':
            self.scene_values = data.result
            break
          case 'getDriverStatistics':
            self.$listeners.showConfirm(
              'Driver statistics',
              self.jsonToList(data.result)
            )
            break
          case 'getNodeStatistics':
            self.$listeners.showConfirm(
              'Node statistics',
              self.jsonToList(data.result)
            )
            break
          default:
            self.showSnackbar('Successfully call api ' + data.api)
        }
      } else {
        self.showSnackbar(
          'Error while calling api ' + data.api + ': ' + data.message
        )
      }
    })

    this.socket.emit(this.socketActions.init, true)
  },
  beforeDestroy () {
    if (this.socket) {
      // unbind events
      for (const event in this.socketEvents) {
        this.socket.off(event)
      }
    }
  }
}
</script>
