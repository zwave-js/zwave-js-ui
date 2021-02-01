<template>
  <td :colspan="headers.length">
    <v-tabs style="margin-top:10px" v-model="currentTab" fixed-tabs>
      <v-tab key="node">Node</v-tab>
      <v-tab key="homeassistant">Home Assistant</v-tab>
      <v-tab key="groups">Groups</v-tab>
      <!-- TABS -->
      <v-tabs-items
        style="background: transparent; padding-bottom: 10px;"
        v-model="currentTab"
        :touchless="true"
      >
        <!-- TAB NODE -->
        <v-tab-item key="node">
          <node-details
            :headers="headers"
            :node="node"
            :actions="actions"
            :socket="socket"
            v-on="$listeners"
          ></node-details>
        </v-tab-item>

        <!-- TAB HOMEASSISTANT -->
        <v-tab-item key="homeassistant">
          <home-assistant :node="node" :socket="socket" v-on="$listeners" />
        </v-tab-item>

        <!-- TAB GROUPS -->
        <v-tab-item key="groups">
          <association-groups :node="node" :nodes="nodes" :socket="socket" />
        </v-tab-item>
      </v-tabs-items>
    </v-tabs>
  </td>
</template>

<script>
import AssociationGroups from '@/components/nodes-table/AssociationGroups'
import HomeAssistant from '@/components/nodes-table/HomeAssistant'
import NodeDetails from '@/components/nodes-table/NodeDetails'

export default {
  props: {
    actions: Array,
    headers: Array,
    node: Object,
    nodes: Array,
    socket: Object
  },
  components: {
    AssociationGroups,
    HomeAssistant,
    NodeDetails
  },
  data () {
    return {
      currentTab: 0
    }
  }
}
</script>

<style></style>
