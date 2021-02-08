<template>
  <v-dialog v-model="value" max-width="430px" persistent>
    <v-card>
      <v-card-title>
        <span class="headline">Advanced</span>
      </v-card-title>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn
          color="red darken-1"
          text
          @click="$emit('close')"
          >Close</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  props: {
    value: Boolean, // show or hide
    lastNodeFound: Object
  },
  data () {
    return {
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
  computed: {
    ...mapGetters(['appInfo', 'zwave']),
    timeoutMs () {
      return this.zwave.commandsTimeout * 1000 + 800 // add small buffer
    },
    controllerStatus () {
      return this.appInfo.controllerStatus
    }
  },
  watch: {
    lastNodeFound (node) {
      this.nodeFound = node

      // the add/remove dialog is waiting for a feedback
      if (this.waitTimeout) {
        this.showResults()
      }
    },
    commandEndDate (newVal) {
      if (this.commandTimer) {
        clearInterval(this.commandTimer)
      }
      this.commandTimer = setInterval(() => {
        const now = new Date()
        const s = Math.trunc((this.commandEndDate - now) / 1000)
        if (this.state === 'start') {
          this.alert = {
            type: 'info',
            text: `${this.modeName} started: ${s}s remaining`
          }
        }
        if (now > newVal) clearInterval(this.commandTimer)
      }, 100)
    },
    controllerStatus (status) {
      if (status.indexOf('clusion') > 0) {
        if (this.state === 'new') return // ignore initial status

        // inclusion/exclusion started, start the countdown timer
        if (status.indexOf('started') > 0) {
          this.commandEndDate = new Date(new Date().getTime() + this.timeoutMs)
          this.nodeFound = null
          this.state = 'start'
        } else if (status.indexOf('stopped') > 0) {
          // inclusion/exclusion stopped, check what happened
          this.commandEndDate = new Date()
          this.alert = {
            type: 'info',
            text: `${this.modeName} stopped, checking nodes…`
          }
          this.state = 'wait'
          this.waitTimeout = setTimeout(this.showResults, 5000) // add additional discovery time
        } else {
          // error
          this.commandEndDate = new Date()
          this.alert = {
            type: 'error',
            text: status // TODO: better formatting?
          }
          this.state = 'stop'
        }
      }
    }
  },
  methods: {
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
    jsonToList (obj) {
      let s = ''
      for (const k in obj) s += k + ': ' + obj[k] + '\n'

      return s
    }
  },
  beforeDestroy () {
    if (this.commandTimer) {
      clearInterval(this.commandTimer)
    }

    if (this.waitTimeout) {
      clearTimeout(this.waitTimeout)
    }
  }
}
</script>

<style scoped>
.option {
  margin-top: 1rem;
}
.option > small {
  color: #888;
  display: block;
  margin: -0.2rem 0 0 1.4rem;
}
</style>