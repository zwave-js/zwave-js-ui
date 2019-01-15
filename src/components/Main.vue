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
                <v-autocomplete
                v-model="zwave.port"
                label="Serial Port"
                hint="Ex /dev/ttyUSB0"
                persistent-hint
                :rules="[rules.required]"
                required
                :items="serial_ports"
                ></v-autocomplete>
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
        :rules="[rules.required]"
        hint="The prefix to add to each topic"
        required
        >
      </v-text-field>
    </v-flex>
    <v-flex xs12 sm6 md4>
      <v-autocomplete
      v-model="mqtt.qos"
      label="QoS"
      :rules="[rules.required]"
      required
      :items="[0,1,2]"
      ></v-autocomplete>
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
    :append-icon-cb="() => (e1 = !e1)"
    :type="e1 ? 'password' : 'text'"
    >
  </v-text-field>
</v-flex>
</v-layout>
</v-container>
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

export default {
  name: 'Main',
  computed: {
    requiredUser(){
      return (this.mqtt.auth && !!this.mqtt.username) || 'This field is required.'
    },
    requiredPassword(){
      return (this.mqtt.auth && !!this.mqtt.password) || 'This field is required.'
    },
    ...mapGetters([
      'zwave',
      'mqtt',
      'general',
      'serial_ports'
    ])
  },
  data () {
    return {
      valid_zwave: true,
      rules: {
        required: (value) => {
          var valid = false;

          if(value instanceof Array)
          valid = value.length > 0;
          else
          valid = !isNaN(value) || !!value; //isNaN is for 0 as valid value

          return valid || 'This field is required.'
        }
      },
    }
  },
  methods: {
    showSnackbar(text){
      this.$emit('showSnackbar', text);
    },
    update(){
      if (this.$refs.form_settings.validate()) {
        var self = this;
        ConfigApis.updateConfig({
          mqtt: self.mqtt,
          zwave: self.zwave
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
