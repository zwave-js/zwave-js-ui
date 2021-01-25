<template>
  <v-layout column>
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
    <div style="margin:20px" class="subtitle-1" v-else>
      No Hass Devices
    </div>
  </v-layout>
</template>

<script>
import { inboundEvents as socketActions } from '@/plugins/socket'
export default {
  props: {
    node: Object,
    socket: Object
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
      selectedDevice: null
    }
  },
  computed: {
    hassDevices () {
      const devices = []
      if (this.node && this.node.hassDevices) {
        for (const id in this.node.hassDevices) {
          const d = JSON.parse(JSON.stringify(this.node.hassDevices[id]))
          d.id = id
          devices.push(d)
        }
      }

      return devices
    }
  },
  watch: {
    selectedDevice () {
      this.deviceJSON = this.selectedDevice
        ? JSON.stringify(this.selectedDevice, null, 2)
        : ''
    }
  },
  methods: {
    addDevice () {
      if (!this.errorDevice) {
        const newDevice = JSON.parse(this.deviceJSON)
        this.socket.emit(socketActions.hass, {
          apiName: 'add',
          device: newDevice,
          nodeId: this.node.id
        })
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
          nodeId: this.node.id
        })
      }
    },
    async disableDiscovery () {
      if (
        this.node &&
        (await this.$listeners.showConfirm(
          'Rediscover node',
          'Are you sure you want to disable discovery of all values? In order to make this persistent remember to click on Store'
        ))
      ) {
        this.socket.emit(socketActions.hass, {
          apiName: 'disableDiscovery',
          nodeId: this.node.id
        })
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
          nodeId: this.node.id
        })
      }
    },
    async rediscoverNode () {
      if (
        this.node &&
        (await this.$listeners.showConfirm(
          'Rediscover node',
          'Are you sure you want to re-discover all node values?'
        ))
      ) {
        this.socket.emit(socketActions.hass, {
          apiName: 'rediscoverNode',
          nodeId: this.node.id
        })
      }
    },
    storeDevices (remove) {
      this.socket.emit(socketActions.hass, {
        apiName: 'store',
        devices: this.node.hassDevices,
        nodeId: this.node.id,
        remove: remove
      })
    },
    updateDevice () {
      if (!this.errorDevice) {
        const updated = JSON.parse(this.deviceJSON)
        this.$set(this.node.hassDevices, this.selectedDevice.id, updated)
        this.socket.emit(socketActions.hass, {
          apiName: 'update',
          device: updated,
          nodeId: this.node.id
        })
      }
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
