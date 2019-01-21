<template>

  <div v-if="value.read_only">
    <v-text-field
    :label="value.label"
    disabled
    :suffix="value.units"
    :hint="value.help || ''"
    v-model="value.value"
    ></v-text-field>
  </div>

  <div v-else>
      <v-text-field
      v-if="['byte', 'short', 'decimal', 'string'].indexOf(value.type) >= 0"
      :label="value.label"
      :type="value.type == 'string' ? 'text' : 'number'"
      :append-outer-icon="!disable_send ? 'send' : null"
      :suffix="value.units"
      :min="value.min"
      :max="value.max"
      :hint="value.help || ''"
      v-model="value.newValue"
      @click:append-outer="updateValue(value)"
      ></v-text-field>

      <v-select
      v-if="value.type == 'list'"
      :items="value.values"
      :label="value.label"
      :hint="value.help || ''"
      :append-outer-icon="!disable_send ? 'send' : null"
      v-model="value.newValue"
      @click:append-outer="updateValue(value)"
      ></v-select>

      <v-switch
      v-if="value.type == 'bool'"
      :label="value.label"
      :hint="value.help || ''"
      v-model="value.newValue"
      @change="updateValue(value)"
      ></v-switch>

      <v-btn
      v-if="value.type == 'button'"
      color="primary"
      :hint="value.help || ''"
      dark
      @click="updateValue(value)"
      class="mb-2"
      >{{value.label}}</v-btn>

  </div>
</template>

<script>
  export default {
    props: {
      value: {
        type: Object
      },
      disable_send: {
        type: Boolean
      }
    },
    methods: {
      updateValue(v){
        this.$emit('updateValue', v)
      },
    }
  }
</script>
