<template>
  <v-container fluid>
    <v-card>
      <v-card-text>
        <v-container fluid>
          <v-row justify="start">
            <v-col class="text-center" cols="12" sm="3" md="2">
              <div class="h6">Home ID</div>
              <div class="body-1 font-weight-bold">{{ homeid }}</div>
            </v-col>
            <v-col class="text-center" cols="12" sm="3" md="2">
              <div class="h6">Home Hex</div>
              <div class="body-1 font-weight-bold">{{ homeHex }}</div>
            </v-col>
            <v-col class="text-center" cols="12" sm="3" md="2">
              <div class="h6">App Version</div>
              <div class="body-1 font-weight-bold">{{ appVersion }}</div>
            </v-col>
            <v-col class="text-center" cols="12" sm="3" md="2">
              <div class="h6">Zwavejs Version</div>
              <div class="body-1 font-weight-bold">{{ zwaveVersion }}</div>
            </v-col>
          </v-row>

          <v-row justify="start">
            <v-col cols="12" sm="6" md="3">
              <v-text-field
                label="Controller status"
                readonly
                v-model="cnt_status"
              ></v-text-field>
            </v-col>

            <v-col cols="12" sm="6" md="3">
              <v-select
                label="Actions"
                append-outer-icon="send"
                v-model="cnt_action"
                :items="cnt_actions.concat(node_actions)"
                @click:append-outer="sendCntAction"
              ></v-select>
            </v-col>
          </v-row>
        </v-container>

        <nodes-table
          :nodes="nodes"
          :node-actions="node_actions"
          :socket="socket"
          @node-selected="selectNode"
          @export="exportConfiguration"
          @import="importConfiguration"
        />

        <v-tabs style="margin-top:10px" v-model="currentTab" fixed-tabs>
          <v-tab key="scenes">Scenes</v-tab>
          <v-tab key="debug">Debug</v-tab>

          <!-- TABS -->
          <v-tabs-items v-model="currentTab">
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

import AnsiUp from 'ansi_up'

import DialogSceneValue from '@/components/dialogs/DialogSceneValue'
import NodesTable from '@/components/nodes-table'
import { Settings } from '@/modules/Settings'
import { socketEvents, inboundEvents as socketActions } from '@/plugins/socket'

const ansiUp = new AnsiUp()

const MAX_DEBUG_LINES = 300

export default {
  name: 'ControlPanel',
  props: {
    socket: Object
  },
  components: {
    DialogSceneValue,
    NodesTable
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
    }
  },
  watch: {
    dialogValue (val) {
      val || this.closeDialog()
    },
    selectedNode () {
      if (this.selectedNode) {
        this.selectedDevice = null
      }
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
      settings: new Settings(localStorage),
      nodes: [],
      scenes: [],
      debug: [],
      homeid: '',
      homeHex: '',
      appVersion: '',
      zwaveVersion: '',
      debugActive: false,
      selectedScene: null,
      cnt_status: 'Unknown',
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
      currentTab: 0,
      node_actions: [
        {
          text: 'Heal node',
          value: 'healNode'
        },
        {
          text: 'Re-interview Node',
          value: 'refreshInfo'
        },
        {
          text: 'Refresh values',
          value: 'refreshValues'
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
          text: 'Replace failed node',
          value: 'replaceFailedNode'
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
      selectedNode: null,
      rules: {
        required: value => {
          let valid = false

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
    selectNode ({ node }) {
      this.selectedNode = node ? this.nodes.find(n => n.id === node.id) : null
    },
    getValue (v) {
      const node = this.nodes[v.nodeId]

      if (node && node.values) {
        return node.values.find(i => i.id === v.id)
      } else {
        return null
      }
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
          const { data } = await this.$listeners.import('json')
          const response = await ConfigApis.importConfig({ data: data })
          this.showSnackbar(response.message)
        } catch (error) {
          console.log(error)
        }
      }
    },
    exportConfiguration () {
      const self = this
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
          const { data } = await this.$listeners.import('json')
          if (data instanceof Array) {
            this.apiRequest('_setScenes', [data])
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
        const data = {
          api: apiName,
          args: args
        }
        this.socket.emit(socketActions.zwave, data)
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
      const node = this.nodes[item.nodeId]

      let value = node.values.find(v => v.id === item.id)

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
    closeDialog () {
      this.dialogValue = false
      setTimeout(() => {
        this.editedValue = {}
        this.editedIndex = -1
      }, 300)
    },
    saveValue () {
      const value = this.editedValue.value
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
        const args = []
        let broadcast = false
        const askId = this.node_actions.find(a => a.value === this.cnt_action)
        if (askId) {
          // don't send replaceFailed as broadcast
          if (
            this.cnt_action !== 'replaceFailedNode' &&
            this.cnt_action !== 'beginFirmwareUpdate'
          ) {
            broadcast = await this.$listeners.showConfirm(
              'Broadcast',
              'Send this command to all nodes?'
            )
          }

          if (!broadcast) {
            const id = parseInt(prompt('Node ID'))

            if (isNaN(id)) {
              this.showMessage('Node ID must be an integer value')
              return
            }
            args.push(id)
          }
        }

        if (
          this.cnt_action === 'startInclusion' ||
          this.cnt_action === 'replaceFailedNode'
        ) {
          const secure = await this.$listeners.showConfirm(
            'Node inclusion',
            'Start inclusion in secure mode?'
          )
          args.push(secure)
        } else if (this.cnt_action === 'hardReset') {
          const ok = await this.$listeners.showConfirm(
            'Hard Reset',
            'Your controller will be reset to factory and all paired devices will be removed',
            { color: 'red' }
          )
          if (!ok) {
            return
          }
        } else if (this.cnt_action === 'beginFirmwareUpdate') {
          try {
            const { data, file } = await this.$listeners.import('buffer')
            args.push(file.name)
            args.push(data)
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
    saveConfiguration () {
      this.apiRequest('writeConfig', [])
    },
    jsonToList (obj) {
      let s = ''
      for (const k in obj) s += k + ': ' + obj[k] + '\n'

      return s
    },
    initNode (n) {
      const values = []
      // transform object in array
      for (const k in n.values) {
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
    const self = this

    this.socket.on(socketEvents.controller, data => {
      self.cnt_status = data
    })

    this.socket.on(socketEvents.connected, info => {
      self.homeid = info.homeid
      self.homeHex = info.name
      self.appVersion = info.appVersion
      self.zwaveVersion = info.zwaveVersion
    })

    this.socket.on(socketEvents.nodeRemoved, node => {
      if (self.selectedNode && self.selectedNode.id === node.id) {
        self.selectedNode = null
      }
      self.$set(self.nodes, node.id, node)
    })

    this.socket.on(socketEvents.debug, data => {
      if (self.debugActive) {
        data = ansiUp.ansi_to_html(data)
        data = data.replace(/\n/g, '</br>')
        // \b[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}Z\b
        self.debug.push(data)

        if (self.debug.length > MAX_DEBUG_LINES) self.debug.shift()

        const textarea = document.getElementById('debug_window')
        if (textarea) {
          // textarea could be hidden
          textarea.scrollTop = textarea.scrollHeight
        }
      }
    })

    this.socket.on(socketEvents.init, data => {
      // convert node values in array
      const nodes = data.nodes
      for (let i = 0; i < nodes.length; i++) {
        self.initNode(nodes[i])
      }
      self.nodes = nodes
      self.cnt_status = data.error ? data.error : data.cntStatus
      self.homeid = data.info.homeid
      self.homeHex = data.info.name
      self.appVersion = data.info.appVersion
      self.zwaveVersion = data.info.zwaveVersion
    })

    this.socket.on(socketEvents.nodeUpdated, data => {
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

    this.socket.on(socketEvents.valueRemoved, data => {
      const valueId = self.getValue(data)

      if (valueId) {
        const node = self.nodes[data.nodeId]
        const index = node.values.indexOf(valueId)

        if (index >= 0) {
          node.values.splice(index, 1)
        }
      }
    })

    this.socket.on(socketEvents.valueUpdated, data => {
      const valueId = self.getValue(data)

      if (valueId) {
        // this value is waiting for an update
        if (valueId.toUpdate) {
          valueId.toUpdate = false
          self.showSnackbar('Value updated')
        }
        valueId.newValue = data.value
        valueId.value = data.value
      } else {
        // means that this value has been added
        const node = self.nodes[data.nodeId]
        if (node) {
          data.newValue = data.value
          node.values.push(data)
        }
      }
    })

    this.socket.on(socketEvents.api, async data => {
      if (data.success) {
        switch (data.api) {
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

    this.socket.emit(socketActions.init, true)
  },
  beforeDestroy () {
    if (this.socket) {
      // unbind events
      for (const event in socketEvents) {
        this.socket.off(event)
      }
    }
  }
}
</script>
