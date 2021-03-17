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
            <v-col cols="12" sm="4" md="3" style="text-align:center">
              <v-btn
                dark
                color="green"
                depressed
                @click="advancedShowDialog = true"
              >
                Advanced
              </v-btn>
            </v-col>
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
          :actions="actions"
          @action="onAction"
        />

        <nodes-table :socket="socket" v-on="$listeners" @action="sendAction" />
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
          text: 'Hard Reset',
          options: [{ name: 'Factory Reset', action: 'hardReset' }],
          icon: 'warning',
          color: 'red',
          desc:
            'Reset controller to factory defaults (all paired devices will be removed)'
        },
        {
          text: 'Refresh Values',
          options: [
            {
              name: 'Broadcast',
              action: 'refreshValues',
              args: {
                broadcast: true,
                confirm:
                  'This action will refresh values of all nodes in your network'
              }
            }
          ],
          icon: 'cached',
          desc: 'Update all CC values and metadata'
        },
        {
          text: 'Re-interview Node',
          options: [
            {
              name: 'Broadcast',
              action: 'refreshInfo',
              args: {
                broadcast: true,
                confirm:
                  'This action will re-interview all nodes in your network'
              }
            }
          ],
          icon: 'history',
          desc: 'Clear all info about this node and make a new full interview'
        },
        {
          text: 'Failed Nodes',
          options: [
            {
              name: 'Check all',
              action: 'isFailedNode',
              args: { broadcast: true }
            },
            {
              name: 'Remove all',
              action: 'removeFailedNode',
              args: {
                broadcast: true,
                confirm: 'This action will remove all failed nodes'
              }
            }
          ],
          icon: 'dangerous',
          desc:
            'Manage nodes that are dead and/or marked as failed with the controller'
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
    async onAction (action, args = {}) {
      if (action === 'import') {
        this.importConfiguration()
      } else if (action === 'export') {
        this.exportConfiguration()
      } else if (action === 'exportDump') {
        this.exportDump()
      } else {
        this.sendAction(action, args)
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
    exportDump () {
      this.$listeners.export(this.nodes, 'nodes_dump', 'json')
    },
    async sendAction (action, { nodeId, broadcast, confirm }) {
      if (action) {
        if (confirm) {
          const ok = await this.$listeners.showConfirm(
            'Info',
            confirm,
            'info',
            {
              cancelText: 'cancel',
              confirmText: 'ok'
            }
          )

          if (!ok) {
            return
          }
        }
        const args = []
        if (nodeId !== undefined) {
          if (!broadcast) {
            if (isNaN(nodeId)) {
              this.showSnackbar('Node ID must be an integer value')
              return
            }
            args.push(parseInt(nodeId))
          }
        }

        if (action === 'startInclusion' || action === 'replaceFailedNode') {
          const secure = await this.$listeners.showConfirm(
            'Node inclusion',
            'Start inclusion in secure mode?',
            'info',
            {
              cancelText: 'No'
            }
          )
          args.push(secure)
        } else if (action === 'hardReset') {
          const ok = await this.$listeners.showConfirm(
            'Hard Reset',
            'Your controller will be reset to factory and all paired devices will be removed',
            'alert',
            { confirmText: 'Ok' }
          )
          if (!ok) {
            return
          }
        } else if (action === 'beginFirmwareUpdate') {
          try {
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

            if (target === undefined) throw Error('Must specify a target')

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
            this.apiRequest(action, [nodeid])
          }
        } else {
          this.apiRequest(action, args)
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
