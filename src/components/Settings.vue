/* eslint-disable */

<template>
  <v-container fluid grid-list-md>
    <v-card>
      <v-card-text>
        <v-form
          id="form_settings"
          @submit.prevent="update"
          v-model="valid_zwave"
          ref="form_settings"
        >
          <v-expansion-panels accordion multiple>
            <v-expansion-panel key="zwave">
              <v-expansion-panel-header>Zwave</v-expansion-panel-header>
              <v-expansion-panel-content>
                <v-card flat>
                  <v-card-text>
                    <v-layout wrap>
                      <v-flex xs12 sm6>
                        <v-combobox
                          v-model="zwave.port"
                          label="Serial Port"
                          hint="Ex /dev/ttyUSB0"
                          persistent-hint
                          :rules="[rules.required]"
                          required
                          :items="serial_ports"
                        ></v-combobox>
                      </v-flex>
                      <v-flex xs12 sm6>
                        <v-text-field
                          v-model="zwave.networkKey"
                          label="Network Key"
                          :rules="[rules.validKey, rules.validLength]"
                          append-outer-icon="wifi_protected_setup"
                          @click:append-outer="randomKey"
                        ></v-text-field>
                      </v-flex>
                      <v-flex xs12 sm6>
                        <v-switch
                          hint="Enable zwave-js logging"
                          persistent-hint
                          label="Log Enabled"
                          v-model="zwave.logEnabled"
                        ></v-switch>
                      </v-flex>
                      <v-flex v-if="zwave.logEnabled" xs12 sm6>
                        <v-select
                          :items="logLevels"
                          v-model="zwave.logLevel"
                          label="Log Level"
                        ></v-select>
                      </v-flex>
                      <v-flex v-if="zwave.logEnabled" xs12 sm6>
                        <v-switch
                          hint="Store zwave logs in a file (stored in store folder)"
                          persistent-hint
                          label="Log to file"
                          v-model="zwave.logToFile"
                        ></v-switch>
                      </v-flex>
                      <v-flex xs6>
                        <v-text-field
                          v-model.number="zwave.commandsTimeout"
                          label="Commands timeout"
                          :rules="[rules.required]"
                          required
                          suffix="seconds"
                          hint="Seconds to wait before stop inclusion/exclusion mode"
                          type="number"
                        ></v-text-field>
                      </v-flex>
                      <input type="hidden" :value="zwave.plugin" />
                      <input type="hidden" :value="zwave.options" />
                    </v-layout>
                  </v-card-text>
                </v-card>
              </v-expansion-panel-content>
            </v-expansion-panel>

            <v-divider></v-divider>

            <v-container xs12 sm6 ml-1>
              <v-switch
                hint="Enable this to use Z2M only as Control Panel"
                persistent-hint
                label="Disable Gateway"
                v-model="mqtt.disabled"
              ></v-switch>
            </v-container>

            <v-expansion-panel key="mqtt" v-if="!mqtt.disabled">
              <v-expansion-panel-header>Mqtt</v-expansion-panel-header>
              <v-expansion-panel-content>
                <v-card flat>
                  <v-card-text>
                    <v-layout wrap>
                      <v-flex xs12 sm6 md4>
                        <v-text-field
                          v-model.trim="mqtt.name"
                          label="Name"
                          :rules="[rules.required, rules.validName]"
                          hint="Unique name that identify this gateway"
                          required
                        ></v-text-field>
                      </v-flex>
                      <v-flex xs12 sm6 md4>
                        <v-text-field
                          v-model.trim="mqtt.host"
                          label="Host url"
                          :rules="[rules.required]"
                          hint="The host url"
                          required
                        ></v-text-field>
                      </v-flex>
                      <v-flex xs12 sm6 md4>
                        <v-text-field
                          v-model.number="mqtt.port"
                          label="Port"
                          :rules="[rules.required]"
                          hint="Host Port"
                          required
                          type="number"
                        ></v-text-field>
                      </v-flex>
                      <v-flex xs12 sm6 md4>
                        <v-text-field
                          v-model.number="mqtt.reconnectPeriod"
                          label="Reconnect period (ms)"
                          hint="Reconnection period"
                          :rules="[rules.required]"
                          required
                          type="number"
                        ></v-text-field>
                      </v-flex>
                      <v-flex xs12 sm6 md4>
                        <v-text-field
                          v-model.trim="mqtt.prefix"
                          label="Prefix"
                          :rules="[rules.required, rules.validName]"
                          hint="The prefix to add to each topic"
                          required
                        ></v-text-field>
                      </v-flex>
                      <v-flex xs12 sm6 md4>
                        <v-select
                          v-model="mqtt.qos"
                          label="QoS"
                          :rules="[rules.required]"
                          required
                          :items="[0, 1, 2]"
                        ></v-select>
                      </v-flex>
                      <v-flex xs12 sm6>
                        <v-switch
                          hint="Set retain flag to true for outgoing messages"
                          persistent-hint
                          label="Retain"
                          v-model="mqtt.retain"
                        ></v-switch>
                      </v-flex>
                      <v-flex xs12 sm6>
                        <v-switch
                          hint="If true the client does not have a persistent session and all information are lost when the client disconnects for any reason"
                          persistent-hint
                          label="Clean"
                          v-model="mqtt.clean"
                        ></v-switch>
                      </v-flex>
                      <v-flex xs12 sm6>
                        <v-switch
                          hint="Enable persistent storage of packets (QoS > 0) while client is offline. If disabled the in memory store will be used."
                          persistent-hint
                          label="Store"
                          v-model="mqtt.store"
                        ></v-switch>
                      </v-flex>
                      <v-flex xs12 sm6 v-if="secure">
                        <v-switch
                          hint="Enable this when using self signed certificates"
                          persistent-hint
                          label="Allow self signed certs"
                          v-model="mqtt.allowSelfsigned"
                        ></v-switch>
                      </v-flex>
                      <v-flex xs12 sm6 md4 v-if="secure">
                        <file-input
                          label="Key.pem"
                          keyProp="_key"
                          v-model="mqtt.key"
                          @onFileSelect="onFileSelect"
                        ></file-input>
                      </v-flex>
                      <v-flex xs12 sm6 md4 v-if="secure">
                        <file-input
                          label="Cert.pem"
                          keyProp="_cert"
                          v-model="mqtt.cert"
                          @onFileSelect="onFileSelect"
                        ></file-input>
                      </v-flex>
                      <v-flex xs12 sm6 md4 v-if="secure">
                        <file-input
                          label="Ca.pem"
                          keyProp="_ca"
                          v-model="mqtt.ca"
                          @onFileSelect="onFileSelect"
                        ></file-input>
                      </v-flex>
                      <v-flex xs12 sm4>
                        <v-switch
                          hint="Does this client require auth?"
                          persistent-hint
                          label="Auth"
                          v-model="mqtt.auth"
                        ></v-switch>
                      </v-flex>
                      <v-flex v-if="mqtt.auth" xs12 sm4>
                        <v-text-field
                          v-model="mqtt.username"
                          label="Username"
                          :rules="[requiredUser]"
                          required
                        ></v-text-field>
                      </v-flex>
                      <v-flex v-if="mqtt.auth" xs12 sm4>
                        <v-text-field
                          v-model="mqtt.password"
                          label="Password"
                          :rules="[requiredPassword]"
                          required
                          :append-icon="e1 ? 'visibility' : 'visibility_off'"
                          @click:append="() => (e1 = !e1)"
                          :type="e1 ? 'password' : 'text'"
                        ></v-text-field>
                      </v-flex>
                    </v-layout>
                  </v-card-text>
                </v-card>
              </v-expansion-panel-content>
            </v-expansion-panel>

            <v-divider></v-divider>

            <v-expansion-panel key="gateway" v-if="!mqtt.disabled">
              <v-expansion-panel-header>Gateway</v-expansion-panel-header>
              <v-expansion-panel-content>
                <v-card flat>
                  <v-card-text>
                    <v-layout wrap>
                      <v-flex xs12>
                        <v-select
                          v-model="gateway.type"
                          label="Type"
                          :rules="[rules.required]"
                          required
                          :items="gw_types"
                        ></v-select>
                      </v-flex>
                      <v-flex xs12>
                        <v-select
                          v-model="gateway.payloadType"
                          label="Payload type"
                          required
                          :rules="[validPayload]"
                          :items="py_types"
                        ></v-select>
                      </v-flex>
                      <v-flex v-if="gateway.type === 0" xs6>
                        <v-switch
                          label="Use nodes name instead of numeric nodeIDs"
                          v-model="gateway.nodeNames"
                        ></v-switch>
                      </v-flex>
                      <v-flex xs6>
                        <v-switch
                          label="Ignore location"
                          hint="Don't add nodes location to values topic"
                          v-model="gateway.ignoreLoc"
                          persistent-hint
                        ></v-switch>
                      </v-flex>
                      <v-flex xs6>
                        <v-switch
                          label="Send Zwave events"
                          hint="Enable this to get all zwave events in MQTT on _EVENTS topic"
                          v-model="gateway.sendEvents"
                          persistent-hint
                        ></v-switch>
                      </v-flex>
                      <v-flex xs6>
                        <v-switch
                          label="Ignore status updates"
                          hint="Prevent gateway to send updates when a node changes it's status (dead/sleep, alive)"
                          v-model="gateway.ignoreStatus"
                          persistent-hint
                        ></v-switch>
                      </v-flex>
                      <v-flex v-if="gateway.type !== 2" xs6>
                        <v-switch
                          label="Include Node info"
                          hint="Include Node's Name and Location on Payload"
                          v-model="gateway.includeNodeInfo"
                          persistent-hint
                        ></v-switch>
                      </v-flex>
                      <v-flex xs6>
                        <v-switch
                          label="Publish node details"
                          hint="Details published under a topic, can help automations receive device info"
                          v-model="gateway.publishNodeDetails"
                          persistent-hint
                        ></v-switch>
                      </v-flex>
                      <v-flex xs6>
                        <v-switch
                          label="Hass Discovery"
                          hint="BETA: Automatically create devices in Hass using MQTT auto-discovery"
                          v-model="gateway.hassDiscovery"
                          persistent-hint
                        ></v-switch>
                      </v-flex>
                      <v-flex xs6 v-if="gateway.hassDiscovery">
                        <v-text-field
                          v-model="gateway.discoveryPrefix"
                          label="Discovery prefix"
                          hint="The prefix to use for Hass MQTT discovery. Leave empty to use the mqtt prefix"
                        ></v-text-field>
                      </v-flex>
                      <v-flex xs6 v-if="gateway.hassDiscovery">
                        <v-switch
                          label="Retained discovery"
                          hint="Set retain flag to true in discovery messages"
                          v-model="gateway.retainedDiscovery"
                          persistent-hint
                        ></v-switch>
                      </v-flex>
                      <v-flex xs6 v-if="gateway.hassDiscovery">
                        <v-text-field
                          v-model="gateway.entityTemplate"
                          label="Entity name template"
                          persistent-hint
                          hint="Template which generates entity names"
                        ></v-text-field>
                      </v-flex>
                      <v-flex xs6 v-if="gateway.hassDiscovery">
                        <div>
                          Default: <code>%loc-%n_%o</code> <br />-
                          <code>%nid</code>: Node ID <br />- <code>%n</code>:
                          Node Name <br />- <code>%loc</code>: Node Location
                          <br />- <code>%pk</code>: valueId property key
                          (fallback to device type) <br />- <code>%pn</code>:
                          valueId property name (fallback to device type)
                          <br />- <code>%o</code>: HASS object_id <br />-
                          <code>%l</code>: valueId label (fallback to object_id)
                        </div>
                      </v-flex>
                      <v-flex xs12 sm6>
                        <v-switch
                          hint="Enable gateway logging"
                          persistent-hint
                          label="Log enabled"
                          v-model="gateway.logEnabled"
                        ></v-switch>
                      </v-flex>
                      <v-flex xs12 sm6 v-if="gateway.logEnabled">
                        <v-select
                          :items="logLevels"
                          v-model="gateway.logLevel"
                          label="Log Level"
                        ></v-select>
                      </v-flex>
                      <v-flex xs12 sm6 v-if="gateway.logEnabled">
                        <v-switch
                          hint="Store logs in a file"
                          persistent-hint
                          label="Log to file"
                          v-model="gateway.logToFile"
                        ></v-switch>
                      </v-flex>
                    </v-layout>

                    <v-data-table
                      :headers="headers"
                      :items="gateway.values"
                      :items-per-page-options="[
                        10,
                        20,
                        { text: 'All', value: -1 }
                      ]"
                      class="elevation-1"
                    >
                      <template v-slot:item="{ item }">
                        <tr>
                          <td>{{ deviceName(item.device) }}</td>
                          <td>
                            {{ item.value.label + ' (' + item.value.id + ')' }}
                          </td>
                          <td class="text-xs">{{ item.topic }}</td>
                          <td class="text-xs">
                            {{ item.postOperation || 'No operation' }}
                          </td>
                          <td class="text-xs">
                            {{
                              item.enablePoll
                                ? 'Intensity ' + item.pollIntensity
                                : 'No'
                            }}
                          </td>
                          <td class="text-xs">
                            {{
                              item.verifyChanges ? 'Verified' : 'Not Verified'
                            }}
                          </td>
                          <td class="justify-center layout px-0">
                            <v-icon
                              small
                              class="mr-2"
                              color="green"
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
                  </v-card-text>
                  <v-card-actions>
                    <v-btn
                      color="blue darken-1"
                      text
                      @click="dialogValue = true"
                      >New Value</v-btn
                    >
                  </v-card-actions>
                </v-card>
              </v-expansion-panel-content>
            </v-expansion-panel>

            <v-divider></v-divider>
          </v-expansion-panels>

          <DialogGatewayValue
            @save="saveValue"
            @close="closeDialog"
            v-model="dialogValue"
            :gw_type="gateway.type"
            :title="dialogTitle"
            :editedValue="editedValue"
            :devices="devices"
          />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="purple darken-1" text @click="importSettings">
          Import
          <v-icon right dark>file_upload</v-icon>
        </v-btn>
        <v-btn color="green darken-1" text @click="exportSettings">
          Export
          <v-icon right dark>file_download</v-icon>
        </v-btn>
        <v-btn color="blue darken-1" text type="submit" form="form_settings">
          Save
          <v-icon right dark>save</v-icon>
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script>
import { mapGetters } from 'vuex'
import ConfigApis from '@/apis/ConfigApis'
import fileInput from '@/components/custom/file-input.vue'
import { parse } from 'native-url'

import DialogGatewayValue from '@/components/dialogs/DialogGatewayValue'

export default {
  name: 'Settings',
  components: {
    DialogGatewayValue,
    fileInput
  },
  computed: {
    secure () {
      if (!this.mqtt.host) return false
      const parsed = parse(this.mqtt.host)

      const secure =
        ['mqtts:', 'wss:', 'wxs:', 'alis:', 'tls:'].indexOf(parsed.protocol) >=
        0

      if (!secure) {
        // eslint-disable-next-line vue/no-side-effects-in-computed-properties
        this.mqtt.key = this.mqtt._key = this.mqtt.cert = this.mqtt._cert = this.mqtt.ca = this.mqtt._ca =
          ''
      }

      return secure
    },
    dialogTitle () {
      return this.editedIndex === -1 ? 'New Item' : 'Edit Item'
    },
    requiredUser () {
      return (
        (this.mqtt.auth && !!this.mqtt.username) || 'This field is required.'
      )
    },
    validPayload () {
      return (
        !this.gateway.hassDiscovery ||
        this.gateway.payloadType !== 2 ||
        "Hass discovery doesn't works with this payload type"
      )
    },
    requiredPassword () {
      return (
        (this.mqtt.auth && !!this.mqtt.password) || 'This field is required.'
      )
    },
    ...mapGetters(['zwave', 'mqtt', 'gateway', 'devices', 'serial_ports'])
  },
  watch: {
    dialogValue (val) {
      val || this.closeDialog()
    }
  },
  data () {
    return {
      valid_zwave: true,
      dialogValue: false,
      editedValue: {},
      editedIndex: -1,
      defaultValue: {},
      logLevels: [
        { text: 'Error', value: 'error' },
        { text: 'Warn', value: 'warn' },
        { text: 'Info', value: 'info' },
        { text: 'Verbose', value: 'verbose' },
        { text: 'Debug', value: 'debug' },
        { text: 'Silly', value: 'silly' }
      ],
      headers: [
        { text: 'Device', value: 'device' },
        { text: 'Value', value: 'value', sortable: false },
        { text: 'Topic', value: 'topic' },
        { text: 'Post Operation', value: 'postOperation' },
        { text: 'Poll', value: 'enablePoll' },
        { text: 'Changes', value: 'verifyChanges' },
        { text: 'Actions', sortable: false }
      ],
      e1: true,
      gw_types: [
        {
          text: 'ValueID topics',
          value: 0
        },
        {
          text: 'Named topics',
          value: 1
        },
        {
          text: 'Configured Manually',
          value: 2
        }
      ],
      py_types: [
        {
          text: 'JSON Time-Value',
          value: 0
        },
        {
          text: 'Entire Z-Wave value Object',
          value: 1
        },
        {
          text: 'Just value',
          value: 2
        }
      ],
      rules: {
        required: value => {
          let valid = false

          if (value instanceof Array) valid = value.length > 0
          else valid = !!value || value === 0

          return valid || 'This field is required.'
        },
        validName: value => {
          return (
            !/[!@#$%^&*)(+=:,;"'\\|?{}£°§<>[\]/.\s]/g.test(value) ||
            'Name is not valid, only "a-z" "A-Z" "0-9" chars and "_" are allowed'
          )
        },
        validLength: value => {
          return (
            !value || value.length === 32 || 'Key must be 32 charaters length'
          )
        },
        validKey: value => {
          return (
            !value ||
            !/[^A-F0-9]+/gi.test(value) ||
            'Key not valid. Must contain only hex chars'
          )
        }
      }
    }
  },
  methods: {
    randomKey () {
      let key = ''

      while (key.length < 32) {
        const x = Math.round(Math.random() * 255)
          .toString(16)
          .toUpperCase()
        key += x.length === 2 ? x : '0' + x
      }

      this.$set(this.zwave, 'networkKey', key)
    },
    readFile (file, callback) {
      const reader = new FileReader()

      reader.onload = e => callback(e.target.result)
      reader.readAsText(file)
    },
    onFileSelect (data) {
      const file = data.files[0]
      const self = this
      if (file) {
        this.readFile(file, text => (self.mqtt[data.key] = text))
      } else {
        self.mqtt[data.key] = ''
      }
    },
    showSnackbar (text) {
      this.$emit('showSnackbar', text)
    },
    async importSettings () {
      try {
        const { data } = await this.$listeners.import('json')
        if (data.zwave && data.mqtt && data.gateway) {
          this.$store.dispatch('import', data)
          this.showSnackbar('Configuration imported successfully')
        } else {
          this.showSnackbar('Imported settings not valid')
        }
      } catch (error) {}
    },
    exportSettings () {
      const settings = this.getSettingsJSON()
      this.$listeners.export(settings, 'settings')
    },
    getSettingsJSON () {
      return {
        mqtt: this.mqtt,
        gateway: this.gateway,
        zwave: this.zwave
      }
    },
    editItem (item) {
      this.editedIndex = this.gateway.values.indexOf(item)
      this.editedValue = Object.assign({}, item)
      this.dialogValue = true
    },
    async deleteItem (item) {
      const index = this.gateway.values.indexOf(item)
      ;(await this.$listeners.showConfirm(
        'Attention',
        'Are you sure you want to delete this item?',
        'alert'
      )) && this.gateway.values.splice(index, 1)
    },
    closeDialog () {
      this.dialogValue = false
      setTimeout(() => {
        this.editedValue = Object.assign({}, this.defaultValue)
        this.editedIndex = -1
      }, 300)
    },
    deviceName (deviceID) {
      const device = this.devices.find(d => d.value === deviceID)
      return device ? device.name : deviceID
    },
    saveValue () {
      if (this.editedIndex > -1) {
        this.$set(this.gateway.values, this.editedIndex, this.editedValue)
      } else {
        this.gateway.values.push(this.editedValue)
      }
      this.closeDialog()
    },
    update () {
      if (this.$refs.form_settings.validate()) {
        const self = this
        ConfigApis.updateConfig(self.getSettingsJSON())
          .then(data => {
            self.showSnackbar(data.message)
          })
          .catch(error => {
            console.log(error)
          })
      } else {
        this.showSnackbar('Your configuration contains errors, fix it')
      }
    }
  },
  mounted () {
    // hide socket status indicator from toolbar
    this.$emit('updateStatus')

    const self = this
    ConfigApis.getConfig()
      .then(data => {
        if (!data.success) {
          self.showSnackbar(
            'Error while retriving configuration, check console'
          )
          console.log(data)
        } else {
          self.$store.dispatch('init', data)
        }
      })
      .catch(e => {
        self.showSnackbar('Error while retriving configuration, check console')
        console.log(e)
      })
  }
}
</script>
