<template>
  <v-container fluid>
    <!-- <v-card>
      <v-card-text>
        <v-container fluid>
          <v-row justify="start">
            <v-col class="text-center" cols="12" sm="3" md="2">
              <div class="h6">Home ID</div>
              <div class="body-1 font-weight-bold">{{ appInfo.homeid }}</div>
            </v-col>
            <v-col class="text-center" cols="12" sm="3" md="2">
              <div class="h6">Home Hex</div>
              <div class="body-1 font-weight-bold">{{ appInfo.homeHex }}</div>
            </v-col>
            <v-col class="text-center" cols="12" sm="3" md="2">
              <div class="h6">App Version</div>
              <div class="body-1 font-weight-bold">
                {{ appInfo.appVersion }}
              </div>
            </v-col>
            <v-col class="text-center" cols="12" sm="3" md="2">
              <div class="h6">Zwavejs Version</div>
              <div class="body-1 font-weight-bold">
                {{ appInfo.zwaveVersion }}
              </div>
            </v-col>
            <v-col class="text-center" cols="12" sm="3" md="2">
              <div class="h6">Zwavejs-server Version</div>
              <div class="body-1 font-weight-bold">
                {{ appInfo.serverVersion }}
              </div>
            </v-col>
          </v-row>

          <v-row justify="start">
            <v-col cols="12" sm="4" md="3" style="text-align:center">
              <v-btn
                depressed
                color="primary"
                @click="addRemoveShowDialog = true"
              >
                Add/Remove Device
              </v-btn>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-text-field
                label="Controller status"
                readonly
                v-model="appInfo.controllerStatus"
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

        <DialogAddRemove
          v-model="addRemoveShowDialog"
          :nodeAddedOrRemoved="addRemoveNode"
          @close="onAddRemoveClose"
          @apiRequest="apiRequest"
        />

        <nodes-table
          :nodes="nodes"
          :node-actions="node_actions"
          :socket="socket"
          v-on="$listeners"
          @exportNodes="exportConfiguration"
          @importNodes="importConfiguration"
        />
      </v-card-text>
    </v-card> -->

    <v-toolbar v-if="!$vuetify.breakpoint.mobile" flat dense>
      <v-btn color="blue" text @click="addRemoveShowDialog = true">
        <v-icon style="margin-right:0.3rem">add_circle_outline</v-icon
        >Add/Remove Device
      </v-btn>

      <v-btn text>
        <v-icon style="margin-right:0.3rem">remove_red_eye</v-icon>
        Hidden: <small style="opacity:0.8">hide</small>
      </v-btn>

      <v-btn text>
        <v-icon style="margin-right:0.3rem">view_week</v-icon>
        Columns: <small style="opacity:0.8">all</small>
      </v-btn>

      <v-btn text>
        <v-icon style="margin-right:0.2rem">filter_alt</v-icon>
        Filter: <small style="opacity:0.8">none</small>
      </v-btn>

      <v-btn text>
        <v-icon style="margin-right:0.3rem">input</v-icon>
        Import / Export
      </v-btn>

      <v-spacer></v-spacer>

      <v-btn color="purple" text>
        Advanced
        <v-icon style="margin-left:0.3rem">more_vert</v-icon>
      </v-btn>
    </v-toolbar>
    <v-toolbar v-if="$vuetify.breakpoint.mobile" flat dense>
      <v-btn color="blue" icon @click="addRemoveShowDialog = true">
        <v-icon>add_circle_outline</v-icon>
      </v-btn>

      <v-btn icon>
        <v-icon>remove_red_eye</v-icon>
      </v-btn>

      <v-btn icon>
        <v-icon>view_week</v-icon>
      </v-btn>

      <v-btn icon>
        <v-icon>filter_alt</v-icon>
      </v-btn>

      <v-btn icon>
        <v-icon>input</v-icon>
      </v-btn>

      <v-spacer></v-spacer>

      <v-btn color="purple" icon>
        <v-icon>more_vert</v-icon>
      </v-btn>
    </v-toolbar>
  </v-container>
</template>

<script>
import ConfigApis from '@/apis/ConfigApis'
import { mapGetters, mapMutations } from 'vuex'

// import DialogAddRemove from '@/components/dialogs/DialogAddRemove'
// import NodesTable from '@/components/nodes-table'
import { Settings } from '@/modules/Settings'
import { socketEvents } from '@/plugins/socket'

export default {
  name: 'ControlPanel',
  props: {
    socket: Object
  },
  components: {
    // NodesTable,
    // DialogAddRemove
  },
  computed: {
    ...mapGetters(['nodes', 'appInfo', 'zwave']),
    timeoutMs () {
      return this.zwave.commandsTimeout * 1000 + 800 // add small buffer
    },
    controllerStatus () {
      return this.appInfo.controllerStatus
    }
  },
  watch: {},
  data () {
    return {
      settings: new Settings(localStorage),
      bindedSocketEvents: {}, // keep track of the events-handlers
      addRemoveShowDialog: false,
      addRemoveNode: null,
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
    ...mapMutations(['showSnackbar']),
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
    onAddRemoveClose () {
      this.addRemoveShowDialog = false
      this.addRemoveNode = null
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
              'Send this command to all nodes?',
              'info',
              {
                cancelText: 'No'
              }
            )
          }

          if (!broadcast) {
            const { nodeId } = await this.$listeners.showConfirm(
              'Choose a node',
              '',
              'info',
              {
                confirmText: 'Ok',
                inputs: [
                  {
                    type: 'list',
                    items: this.nodes,
                    label: 'Node',
                    hint: 'Select a node',
                    required: true,
                    key: 'nodeId',
                    itemText: '_name',
                    itemValue: 'id'
                  }
                ]
              }
            )

            if (isNaN(nodeId)) {
              this.showSnackbar('Node ID must be an integer value')
              return
            }
            args.push(nodeId)
          }
        }

        if (
          this.cnt_action === 'startInclusion' ||
          this.cnt_action === 'replaceFailedNode'
        ) {
          const secure = await this.$listeners.showConfirm(
            'Node inclusion',
            'Start inclusion in secure mode?',
            'info',
            {
              cancelText: 'No'
            }
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
          const { target } = await this.$listeners.showConfirm(
            'Choose target',
            '',
            'info',
            {
              confirmText: 'Ok',
              inputs: [
                {
                  type: 'number',
                  label: 'Target',
                  default: 0,
                  rules: [v => v >= 0 || 'Invalid target'],
                  hint:
                    'The firmware target (i.e. chip) to upgrade. 0 updates the Z-Wave chip, >=1 updates others if they exist',
                  required: true,
                  key: 'target'
                }
              ]
            }
          )

          try {
            const { data, file } = await this.$listeners.import('buffer')
            args.push(file.name)
            args.push(data)
            args.push(target)
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
    apiRequest (apiName, args) {
      this.$emit('apiRequest', apiName, args)
    },
    saveConfiguration () {
      this.apiRequest('writeConfig', [])
    },
    jsonToList (obj) {
      let s = ''
      for (const k in obj) s += k + ': ' + obj[k] + '\n'

      return s
    },
    onApiResponse (data) {
      if (data.success) {
        switch (data.api) {
          case 'getDriverStatistics':
            this.$listeners.showConfirm(
              'Driver statistics',
              this.jsonToList(data.result)
            )
            break
          case 'getNodeStatistics':
            this.$listeners.showConfirm(
              'Node statistics',
              this.jsonToList(data.result)
            )
            break
          default:
            this.showSnackbar('Successfully call api ' + data.api)
        }
      } else {
        this.showSnackbar(
          'Error while calling api ' + data.api + ': ' + data.message
        )
      }
    },
    onNodeAddedRemoved (node) {
      this.addRemoveNode = node
    },
    bindEvent (eventName, handler) {
      this.socket.on(socketEvents[eventName], handler)
      this.bindedSocketEvents[eventName] = handler
    },
    unbindEvents () {
      for (const event in this.bindedSocketEvents) {
        this.socket.off(event, this.bindedSocketEvents[event])
      }
    }
  },
  mounted () {
    const onApiResponse = this.onApiResponse.bind(this)
    const onNodeAddedRemoved = this.onNodeAddedRemoved.bind(this)

    this.bindEvent('api', onApiResponse)
    this.bindEvent('nodeRemoved', onNodeAddedRemoved)
    this.bindEvent('nodeAdded', onNodeAddedRemoved)
  },
  beforeDestroy () {
    if (this.socket) {
      this.unbindEvents()
    }
  }
}
</script>
