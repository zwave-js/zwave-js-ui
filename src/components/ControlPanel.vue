<template>
  <v-container fluid>
    <v-card>
      <v-card-text>
        <v-container fluid>
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

            <v-btn
              color="purple"
              :text="$vuetify.breakpoint.mdAndUp"
              :icon="$vuetify.breakpoint.smAndDown"
              @click="advancedShowDialog = true"
            >
              <v-icon style="margin-right:0.2rem">label_important</v-icon>
              <span v-if="$vuetify.breakpoint.mdAndUp">Advanced</span>
            </v-btn>
          </v-row>
        </v-container>

        <DialogAddRemove
          v-model="addRemoveShowDialog"
          :nodeAddedOrRemoved="addRemoveNode"
          @close="onAddRemoveClose"
          @apiRequest="apiRequest"
        />

        <DialogAdvanced
          v-model="advancedShowDialog"
          @close="advancedShowDialog = false"
          @apiRequest="apiRequest"
          v-on="$listeners"
          :actions="actions"
          @action="onAction"
        />

        <nodes-table
          :node-actions="node_actions"
          :socket="socket"
          v-on="$listeners"
        />
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script>
import ConfigApis from '@/apis/ConfigApis'
import { mapGetters, mapMutations } from 'vuex'

import DialogAddRemove from '@/components/dialogs/DialogAddRemove'
import DialogAdvanced from '@/components/dialogs/DialogAdvanced'
import NodesTable from '@/components/nodes-table'
import { Settings } from '@/modules/Settings'
import { socketEvents } from '@/plugins/socket'

export default {
  name: 'ControlPanel',
  props: {
    socket: Object
  },
  components: {
    NodesTable,
    DialogAddRemove,
    DialogAdvanced
  },
  computed: {
    ...mapGetters(['nodes', 'zwave']),
    timeoutMs () {
      return this.zwave.commandsTimeout * 1000 + 800 // add small buffer
    }
  },
  watch: {},
  data () {
    return {
      settings: new Settings(localStorage),
      bindedSocketEvents: {}, // keep track of the events-handlers
      addRemoveShowDialog: false,
      addRemoveNode: null,
      advancedShowDialog: false,
      actions: [
        {
          text: 'Backup',
          options: [
            { name: 'Import', action: 'import' },
            { name: 'Export', action: 'export' }
          ],
          icon: 'save',
          desc: 'Save or load `nodes.json` file with names and locations'
        },
        {
          text: 'Dump',
          options: [{ name: 'Export', action: 'exportDump' }],
          icon: 'bug_report',
          desc: 'Export all nodes in a json file. Useful for debugging purposes'
        },
        {
          text: 'Heal Network',
          options: [
            { name: 'Begin', action: 'beginHealingNetwork' },
            { name: 'Stop', action: 'stopHealingNetwork' }
          ],
          icon: 'healing',
          desc: 'Force nodes to establish better connections to the controller'
        },
        {
          text: 'Refresh Values',
          options: [
            { name: 'Broadcast', action: 'refreshValues', broadcast: true }
          ],
          icon: 'cached',
          desc: 'Read the values from each node so it has proper state'
        },
        {
          text: 'Re-interview Nodes',
          options: [
            { name: 'Broadcast', action: 'refreshInfo', broadcast: true }
          ],
          icon: 'history',
          desc: 'Update the metadata and command class info for each node'
        },
        {
          text: 'Failed Nodes',
          options: [
            { name: 'Check', action: 'isFailedNode', broadcast: true },
            { name: 'Remove', action: 'removeFailedNode', broadcast: true }
          ],
          icon: 'dangerous',
          desc:
            'Manage nodes that are dead and/or marked as failed with the controller'
        },
        {
          text: 'Remove Associations',
          options: [
            {
              name: 'Broadcast',
              action: 'removeAllAssociations',
              broadcast: true
            }
          ],
          icon: 'link_off',
          desc: 'Clear associations for all paired devices'
        },
        {
          text: 'Hard Reset',
          options: [{ name: 'Factory Reset', action: 'hardReset' }],
          icon: 'warning',
          color: 'red',
          desc:
            'Reset controller to factory defaults (all paired devices will be removed)'
        }
      ],
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
    onAddRemoveClose () {
      this.addRemoveShowDialog = false
      this.addRemoveNode = null
    },
    async onAction (action, broadcast) {
      if (action === 'import') {
        this.importConfiguration()
      } else if (action === 'export') {
        this.exportConfiguration()
      } else if (action === 'exportDump') {
        this.exportDump()
      } else {
        if (broadcast) {
          for (let i = 0; i < this.nodes.length; i++) {
            const nodeid = this.nodes[i].id
            this.$emit('apiRequest', action, [nodeid])
          }
        } else {
          this.$emit('apiRequest', action, [])
        }
      }
      this.advancedShowDialog = false
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
    exportDump () {
      this.$listeners.export(this.nodes, 'nodes_dump', 'json')
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
                    allowManualEntry: true,
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
            args.push(parseInt(nodeId))
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
