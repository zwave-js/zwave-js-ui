/* eslint-disable */

<template>
  <v-container fluid>
    <v-card>
      <v-card-text>

        <v-form id="form_settings" @submit.prevent="update" v-model="valid_zwave" ref="form_settings" lazy-validation>
          <v-subheader>Zwave</v-subheader>
          <v-divider style="margin-bottom:10px;"></v-divider>
          <v-container style="display:inline-block">
            <v-layout style="margin-bottom:10px;" wrap>
              <v-flex xs6>
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
              <v-flex xs6 >
                <v-text-field
                v-model="zwave.networkKey"
                label="Network Key"
                >
              </v-text-field>
            </v-flex>
            <v-flex xs6>
              <v-switch
              hint="Enable zwave library logging"
              persistent-hint
              label="Logging"
              v-model="zwave.logging"
              ></v-switch>
            </v-flex>
            <v-flex xs6>
              <v-switch
              hint="Save configuration files zwcfg and zwscene .xml"
              persistent-hint
              label="Save configuration"
              v-model="zwave.saveConfig"
              ></v-switch>
            </v-flex>
          </v-layout>
        </v-container>

        <v-subheader>Mqtt</v-subheader>
        <v-divider style="margin-bottom:10px;"></v-divider>
        <v-container style="display:inline-block" grid-list-md>
          <v-layout style="margin-bottom:10px;" wrap>

            <v-flex xs12>
              <v-text-field
              v-model="mqtt.name"
              label="Name"
              :rules="[rules.required, rules.validName]"
              hint="Unique name that identify this gateway"
              required
              >
            </v-text-field>
          </v-flex>

          <v-flex xs12 sm6 md4>
            <v-text-field
            v-model="mqtt.host"
            label="Host url"
            :rules="[rules.required]"
            hint="The host url"
            required
            >
          </v-text-field>
        </v-flex>
        <v-flex xs12 sm6 md4>
          <v-text-field
          v-model.number="mqtt.port"
          label="Port"
          :rules="[rules.required]"
          hint="Host Port"
          required
          type="number"
          >
        </v-text-field>
      </v-flex>
      <v-flex xs12 sm6 md4>
        <v-text-field
        v-model.number="mqtt.reconnectPeriod"
        label="Reconnect period (ms)"
        hint="Reconnection period"
        :rules="[rules.required]"
        required
        type="number"
        >
      </v-text-field>
    </v-flex>
    <v-flex xs12 sm6 md4>
      <v-text-field
      v-model="mqtt.prefix"
      label="Prefix"
      :rules="[rules.required, rules.validName]"
      hint="The prefix to add to each topic"
      required
      >
    </v-text-field>
  </v-flex>
  <v-flex xs12 sm6 md4>
    <v-select
    v-model="mqtt.qos"
    label="QoS"
    :rules="[rules.required]"
    required
    :items="[0,1,2]"
    ></v-select>
  </v-flex>
  <v-flex xs12 sm6 md4>
    <v-switch
    hint="Set retain flag to true for outgoing messages"
    persistent-hint
    label="Retain"
    v-model="mqtt.retain"
    ></v-switch>
  </v-flex>
  <v-flex xs12>
    <v-switch
    hint="If true the client does not have a persistent session and all information are lost when the client disconnects for any reason"
    persistent-hint
    label="Clean"
    v-model="mqtt.clean"
    ></v-switch>
  </v-flex>
  <v-flex xs12>
    <v-switch
    hint="Does this client require auth?"
    persistent-hint
    label="Auth"
    v-model="mqtt.auth"
    ></v-switch>
  </v-flex>
  <v-flex v-if="mqtt.auth" xs12 sm6>
    <v-text-field
    v-model="mqtt.username"
    label="Username"
    :rules="[requiredUser]"
    required
    >
  </v-text-field>
</v-flex>
<v-flex v-if="mqtt.auth" xs12 sm6>
  <v-text-field
  v-model="mqtt.password"
  label="Password"
  :rules="[requiredPassword]"
  required
  :append-icon="e1 ? 'visibility' : 'visibility_off'"
  @click:append="() => (e1 = !e1)"
  :type="e1 ? 'password' : 'text'"
  >
</v-text-field>
</v-flex>
</v-layout>
</v-container>

<v-subheader>Gateway</v-subheader>
<v-divider style="margin-bottom:10px;"></v-divider>

<v-container style="display:inline-block" grid-list-md>
  <v-layout style="margin-bottom:10px;" wrap>
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
      :items="py_types"
      ></v-select>
    </v-flex>
  </v-layout>
  <v-flex xs6>
    <v-switch
    label="Send 'list' values as integer index"
    v-model="gateway.integerList"
    ></v-switch>
  </v-flex>
</v-container>

<v-btn v-if="gateway.type == 2" color="blue darken-1" flat @click="dialogValue = true">New Value</v-btn>

<DialogGatewayValue
@save="saveValue"
@close="closeDialog"
v-model="dialogValue"
:title="dialogTitle"
:editedValue="editedValue"
:devices="devices"
/>

<v-data-table
v-if="gateway.type == 2"
:headers="headers"
:items="gateway.values"
:rows-per-page-items="[10, 20, {'text':'All','value':-1}]"
class="elevation-1"
>
<template slot="items" slot-scope="props">
  <td>{{ deviceName(props.item.device) }}</td>
  <td>{{ props.item.value.label + ' (' + props.item.value.value_id + ')' }}</td>
  <td class="text-xs">{{ props.item.topic }}</td>
  <td class="text-xs">{{ props.item.postOperation || 'No operation' }}</td>
  <td class="text-xs">{{ props.item.isBroadcast ? 'Yes' : 'No' }}</td>
  <td class="text-xs">{{ props.item.enablePoll ? ("Intensity " + props.item.pollIntensity) : 'No' }}</td>
  <td class="justify-center layout px-0">
    <v-icon
    small
    class="mr-2"
    @click="editItem(props.item)"
    >
    edit
  </v-icon>
  <v-icon
  small
  @click="deleteItem(props.item)"
  >
  delete
</v-icon>
</td>
</template>
</v-data-table>


</v-form>
</v-card-text>
<v-card-actions>
  <v-spacer></v-spacer>
  <v-btn type="submit" form="form_settings">Update</v-btn>
</v-card-actions>
</v-card>
</v-container>
</template>

<script>

import { mapGetters, mapMutations } from 'vuex'
import ConfigApis from '@/apis/ConfigApis'

import DialogGatewayValue from '@/components/dialogs/DialogGatewayValue'

export default {
  name: 'Settings',
  components:{
    DialogGatewayValue
  },
  computed: {
    dialogTitle () {
      return this.editedIndex === -1 ? 'New Item' : 'Edit Item'
    },
    requiredUser(){
      return (this.mqtt.auth && !!this.mqtt.username) || 'This field is required.'
    },
    requiredPassword(){
      return (this.mqtt.auth && !!this.mqtt.password) || 'This field is required.'
    },
    ...mapGetters([
      'zwave',
      'mqtt',
      'gateway',
      'devices',
      'serial_ports'
    ])
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
      headers: [
        { text: 'Device', value: 'device'},
        { text: 'Value', value: 'value', sortable:false},
        { text: 'Topic', value: 'topic'},
        { text: 'Post Operation', value: 'postOperation'},
        { text: 'Broadcast', value: 'isBroadcast'},
        { text: 'Poll', value: 'enablePoll'},
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
        required: (value) => {
          var valid = false;

          if(value instanceof Array)
          valid = value.length > 0;
          else
          valid = !isNaN(value) || !!value; //isNaN is for 0 as valid value

          return valid || 'This field is required.'
        },
        validName: (value) => {
          return  !/[!@#$%^&*)(+=:,;"'\\|?{}£°§<>[\]/.\s]/g.test(value) || 'Name is not valid, only "a-z" "A-Z" "0-9" chars and "_" are allowed'
        },
      },
    }
  },
  methods: {
    showSnackbar(text){
      this.$emit('showSnackbar', text);
    },
    editItem (item) {
      this.editedIndex = this.gateway.values.indexOf(item)
      this.editedValue = Object.assign({}, item)
      this.dialogValue = true
    },
    deleteItem (item) {
      const index = this.gateway.values.indexOf(item)
      confirm('Are you sure you want to delete this item?') && this.gateway.values.splice(index, 1)
    },
    closeDialog () {
      this.dialogValue = false
      setTimeout(() => {
        this.editedValue = Object.assign({}, this.defaultItem)
        this.editedIndex = -1
      }, 300)
    },
    deviceName(deviceID){
      var device = this.devices.find(d => d.value == deviceID);
      return device ? device.name : "";
    },
    saveValue () {
      if (this.editedIndex > -1) {
        Object.assign(this.gateway.values[this.editedIndex], this.editedValue)
      } else {
        this.gateway.values.push(this.editedValue)
      }
      this.closeDialog()
    },
    update(){
      if (this.$refs.form_settings.validate()) {
        var self = this;
        ConfigApis.updateConfig({
          mqtt: self.mqtt,
          zwave: self.zwave,
          gateway: self.gateway
        })
        .then(data => {
          self.showSnackbar(data.message)
        })
        .catch(error => {
          console.log(error);
        }
      );
    }
  }
},
created (){

}
}

</script>
