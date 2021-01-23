<template>
  <td :colspan="headers.length">
    <v-container v-if="selectedNode" style="min-width:90%" grid-list-md>
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
            {{ `${selectedNode.deviceId} (${selectedNode.hexId})` }}
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

      <v-layout v-if="selectedNode.values" column>
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
                  <v-layout row wrap>
                    <v-flex
                      v-for="(v, index) in group"
                      :key="index"
                      xs12
                      sm6
                      md4
                    >
                      <ValueID
                        @updateValue="updateValue"
                        v-model="group[index]"
                      ></ValueID>
                    </v-flex>
                  </v-layout>
                </v-card-text>
              </v-card>
            </v-expansion-panel-content>
            <v-divider></v-divider>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-layout>

      <v-layout v-if="hassDevices.length > 0" column>
        <v-subheader>Home Assistant - Devices</v-subheader>

        <!-- HASS DEVICES -->
        <v-layout v-if="hassDevices.length > 0" raw wrap>
          <v-flex xs12 md6 pa-1>
            <v-btn color="blue darken-1" text @click="storeDevices(false)"
              >Store</v-btn
            >
            <v-btn color="red darken-1" text @click="storeDevices(true)"
              >Remove Store</v-btn
            >
            <v-btn color="green darken-1" text @click="rediscoverNode"
              >Rediscover Node</v-btn
            >
            <v-btn color="yellow darken-1" text @click="disableDiscovery"
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
                    {{ item.ignoreDiscovery ? 'Disabled' : 'Enabled' }}
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
  </td>
</template>

<script>
import ValueID from '@/components/ValueId'
import { inboundEvents as socketActions } from '@/plugins/socket'

export default {
  name: 'NodeDetails',
  props: {
    headers: Array,
    nodeActions: Array,
    selectedNode: Object,
    socket: Object
  },
  components: {
    ValueID
  },
  data () {
    return {
      deviceJSON: '',
      errorDevice: false,
      headers_hass: [
        { text: 'Id', value: 'id' },
        { text: 'Type', value: 'type' },
        { text: 'Object id', value: 'object_id' },
        { text: 'Persistent', value: 'persistent' },
        { text: 'Discovery', value: 'ignoreDiscovery' }
      ],
      locError: null,
      nameError: null,
      newName: '',
      newLoc: '',
      node_action: 'requestNetworkUpdate',
      selectedDevice: null
    }
  },
  computed: {
    commandGroups () {
      if (this.selectedNode) {
        const groups = {}
        for (const v of this.selectedNode.values) {
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
    hassDevices () {
      const devices = []
      if (this.selectedNode && this.selectedNode.hassDevices) {
        for (const id in this.selectedNode.hassDevices) {
          const d = JSON.parse(
            JSON.stringify(this.selectedNode.hassDevices[id])
          )
          d.id = id
          devices.push(d)
        }
      }

      return devices
    },
    node_actions () {
      return this.nodeActions
    }
  },
  watch: {
    newLoc (val) {
      this.locError = this.validateTopic(val)
    },
    newName (val) {
      this.nameError = this.validateTopic(val)
    },
    selectedDevice () {
      this.deviceJSON = this.selectedDevice
        ? JSON.stringify(this.selectedDevice, null, 2)
        : ''
    }
  },
  created () {
    this.newName = this.selectedNode.name
    this.newLoc = this.selectedNode.loc
    this.node_action = null
  },
  methods: {
    addDevice () {
      if (!this.errorDevice) {
        const newDevice = JSON.parse(this.deviceJSON)
        this.socket.emit(socketActions.hass, {
          apiName: 'add',
          device: newDevice,
          nodeId: this.selectedNode.id
        })
      }
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
    async deleteDevice () {
      const device = this.selectedDevice
      if (
        device &&
        (await this.$listeners.showConfirm(
          'Attention',
          'Are you sure you want to delete selected device?',
          'alert'
        ))
      ) {
        this.socket.emit(socketActions.hass, {
          apiName: 'delete',
          device: device,
          nodeId: this.selectedNode.id
        })
      }
    },
    async disableDiscovery () {
      const node = this.selectedNode
      if (
        node &&
        (await this.$listeners.showConfirm(
          'Rediscover node',
          'Are you sure you want to disable discovery of all values? In order to make this persistent remember to click on Store'
        ))
      ) {
        this.socket.emit(socketActions.hass, {
          apiName: 'disableDiscovery',
          nodeId: this.selectedNode.id
        })
      }
    },
    exportNode () {
      this.$listeners.export(
        this.selectedNode,
        'node_' + this.selectedNode.id,
        'json'
      )
    },
    getValue (v) {
      // const node = this.nodes[v.nodeId]
      const node = this.selectedNode

      if (node && node.values) {
        return node.values.find(i => i.id === v.id)
      } else {
        return null
      }
    },
    async rediscoverDevice () {
      const device = this.selectedDevice
      if (
        device &&
        (await this.$listeners.showConfirm(
          'Rediscover Device',
          'Are you sure you want to re-discover selected device?'
        ))
      ) {
        this.socket.emit(socketActions.hass, {
          apiName: 'discover',
          device: device,
          nodeId: this.selectedNode.id
        })
      }
    },
    async rediscoverNode () {
      const node = this.selectedNode
      if (
        node &&
        (await this.$listeners.showConfirm(
          'Rediscover node',
          'Are you sure you want to re-discover all node values?'
        ))
      ) {
        this.socket.emit(socketActions.hass, {
          apiName: 'rediscoverNode',
          nodeId: this.selectedNode.id
        })
      }
    },
    resetLocation () {
      setTimeout(() => {
        this.newLoc = this.selectedNode.loc
      }, 10)
    },
    resetName () {
      setTimeout(() => {
        this.newName = this.selectedNode.name
      }, 10)
    },
    async sendNodeAction (action) {
      action = typeof action === 'string' ? action : this.node_action
      if (this.selectedNode) {
        const args = [this.selectedNode.id]

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
    storeDevices (remove) {
      this.socket.emit(socketActions.hass, {
        apiName: 'store',
        devices: this.selectedNode.hassDevices,
        nodeId: this.selectedNode.id,
        remove: remove
      })
    },
    updateDevice () {
      if (!this.errorDevice) {
        const updated = JSON.parse(this.deviceJSON)
        this.$set(
          this.selectedNode.hassDevices,
          this.selectedDevice.id,
          updated
        )
        this.socket.emit(socketActions.hass, {
          apiName: 'update',
          device: updated,
          nodeId: this.selectedNode.id
        })
      }
    },
    updateLoc () {
      if (this.selectedNode && !this.locError) {
        this.apiRequest('_setNodeLocation', [this.selectedNode.id, this.newLoc])
      }
    },
    updateName () {
      if (this.selectedNode && !this.nameError) {
        this.apiRequest('_setNodeName', [this.selectedNode.id, this.newName])
      }
    },
    updateValue (v, customValue) {
      v = this.getValue(v)

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
    },
    validJSONdevice () {
      let valid = true
      try {
        JSON.parse(this.deviceJSON)
      } catch (error) {
        valid = false
      }
      this.errorDevice = !valid

      return this.deviceJSON === '' || valid || 'JSON test failed'
    }
  }
}
</script>

<style></style>
