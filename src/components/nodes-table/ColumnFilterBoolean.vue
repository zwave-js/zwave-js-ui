<template>
  <v-card-text>
    <v-row>
      <v-col>
        <v-checkbox
          :indeterminate="value.boolValue == null"
          v-model="value.boolValue"
          label="Boolean value"
          @change="$emit('change', value)"
        ></v-checkbox>
      </v-col>
    </v-row>
  </v-card-text>
</template>

<script>
import ColumnFilterHelper from '@/modules/ColumnFilterHelper'
export default {
  props: {
    value: {
      type: Object,
      default: () => ColumnFilterHelper.defaultFilter('string'),
      required: true
    }
  }
}
</script>
