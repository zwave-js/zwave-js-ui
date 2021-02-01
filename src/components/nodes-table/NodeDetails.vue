<template>
  <v-container style="min-width:90%" grid-list-md>
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
          >Device ID:
          {{ `${node.deviceId} (${node.hexId})` }}
          <v-btn text @click="exportNode">
            Export
            <v-icon right dark color="primary">file_download</v-icon>
          </v-btn>
        </v-subheader>
      </v-flex>
    </v-layout>

    <v-layout row>
      <v-flex xs8 style="max-width:300px">
        <v-text-field
          label="Name"
          append-outer-icon="send"
          :error="!!nameError"
          :error-messages="nameError"
          v-model.trim="newName"
          clearable
          @click:clear="resetName"
          @click:append-outer="updateName"
        ></v-text-field>
      </v-flex>
    </v-layout>

    <v-layout row>
      <v-flex xs8 style="max-width:300px">
        <v-text-field
          label="Location"
          append-outer-icon="send"
          v-model.trim="newLoc"
          :error="!!locError"
          :error-messages="locError"
          clearable
          @click:clear="resetLocation"
          @click:append-outer="updateLoc"
        ></v-text-field>
      </v-flex>
    </v-layout>

    <!-- NODE VALUES -->

    <v-layout v-if="node.values && node.values.length > 0" column>
      <v-subheader>Values</v-subheader>

      <v-expansion-panels accordion multiple>
        <v-expansion-panel
          v-for="(group, className) in commandGroups"
          :key="className"
        >
          <v-expansion-panel-header>{{ className }}</v-expansion-panel-header>
          <v-expansion-panel-content>
            <v-card flat>
              <v-card-text>
                <v-row>
                  <v-col
                    cols="12"
                    v-for="(v, index) in group"
                    :key="index"
                    sm="6"
                    md="4"
                  >
                    <ValueID
                      @updateValue="updateValue"
                      v-model="group[index]"
                    ></ValueID>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </v-expansion-panel-content>
          <v-divider></v-divider>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-layout>
  </v-container>
</template>

<script>
import ValueID from '@/components/ValueId'
import { inboundEvents as socketActions } from '@/plugins/socket'
import { mapMutations } from 'vuex'

export default {
  props: {
    headers: Array,
    actions: Array,
    node: Object,
    socket: Object
  },
  components: {
    ValueID
  },
  data () {
    return {
      locError: null,
      nameError: null,
      newName: this.node.name,
      newLoc: this.node.loc,
      node_action: 'requestNetworkUpdate'
    }
  },
  computed: {
    commandGroups () {
      if (this.node) {
        const groups = {}
        for (const v of this.node.values) {
          const className = v.commandClassName
          if (!groups[className]) {
            groups[className] = []
          }
          groups[className].push(v)
        }
        return groups
      } else {
        return {}
      }
    },
    node_actions () {
      return this.actions
    }
  },
  watch: {
    node () {
      this.newName = this.node.name
      this.newLoc = this.node.loc
    },
    newLoc (val) {
      this.locError = this.validateTopic(val)
    },
    newName (val) {
      this.nameError = this.validateTopic(val)
    }
  },
  created () {
    this.node_action = null
  },
  methods: {
    ...mapMutations(['showSnackbar']),
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
    exportNode () {
      this.$listeners.export(this.node, 'node_' + this.node.id, 'json')
    },
    getValue (v) {
      // const node = this.nodes[v.nodeId]

      if (this.node && this.node.values) {
        return this.node.values.find(i => i.id === v.id)
      } else {
        return null
      }
    },
    resetLocation () {
      setTimeout(() => {
        this.newLoc = this.node.loc
      }, 10)
    },
    resetName () {
      setTimeout(() => {
        this.newName = this.node.name
      }, 10)
    },
    async sendNodeAction (action) {
      action = typeof action === 'string' ? action : this.node_action
      if (this.node) {
        const args = [this.node.id]

        if (this.node_action === 'beginFirmwareUpdate') {
          try {
            const { data, file } = await this.$listeners.import('buffer')
            args.push(file.name)
            args.push(data)
          } catch (error) {
            return
          }
        } else if (this.node_action === 'replaceFailedNode') {
          const secure = await this.$listeners.showConfirm(
            'Node inclusion',
            'Start inclusion in secure mode?'
          )
          args.push(secure)
        }

        this.apiRequest(action, args)
      }
    },
    updateLoc () {
      if (this.node && !this.locError) {
        this.apiRequest('_setNodeLocation', [this.node.id, this.newLoc])
      }
    },
    updateName () {
      if (this.node && !this.nameError) {
        this.apiRequest('_setNodeName', [this.node.id, this.newName])
      }
    },
    updateValue (v, customValue) {
      if (v) {
        // in this way I can check when the value receives an update
        v.toUpdate = true

        if (v.type === 'number') {
          v.newValue = Number(v.newValue)
        }

        // it's a button
        if (v.type === 'boolean' && !v.readable) {
          v.newValue = true
        }

        if (customValue !== undefined) {
          v.newValue = customValue
        }

        // update the value in store
        this.$store.dispatch('setValue', v)

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
    validateTopic (name) {
      const match = name
        ? name.match(/[/a-zA-Z\u00C0-\u024F\u1E00-\u1EFF0-9_-]+/g)
        : [name]

      return match[0] !== name ? 'Only a-zA-Z0-9_- chars are allowed' : null
    }
  }
}
</script>

<style></style>
