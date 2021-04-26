<template>
  <v-container grid-list-md>
    <v-row>
      <v-col cols="12" sm="6" md="4">
        <v-select
          label="Node Endpoint"
          hint="When adding associations with 'All' selected Root endpoint will be used"
          v-model="group.nodeEndpoint"
          persistent-hint
          :items="endpoints"
        ></v-select>
      </v-col>

      <v-col cols="12" sm="6" md="4">
        <v-select
          label="Group"
          hint="Node/Endpoint Group association to add/remove"
          persistent-hint
          v-model="group.group"
          @input="getAssociations"
          :items="endpointGroups"
          return-object
        >
          <template v-slot:selection="{ item }">
            {{ item.text }}
          </template>
          <template v-slot:item="{ item, attrs, on }">
            <v-list-item v-on="on" v-bind="attrs" two-line>
              <v-list-item-content>
                <v-list-item-title>{{ item.text }}</v-list-item-title>
                <v-list-item-subtitle
                  >Endpoint {{ item.endpoint }}</v-list-item-subtitle
                >
              </v-list-item-content>
            </v-list-item>
          </template>
        </v-select>
      </v-col>

      <v-col cols="12" sm="6" md="4">
        <v-combobox
          label="Target Node"
          v-model="group.target"
          :items="nodes"
          return-object
          hint="Node to add to the association group"
          persistent-hint
          item-text="_name"
        ></v-combobox>
      </v-col>

      <v-col
        v-if="group.group && group.group.multiChannel"
        cols="12"
        sm="6"
        md="4"
      >
        <v-select
          v-model.number="group.endpoint"
          persistent-hint
          label="Target Endpoint"
          hint="Target node endpoint"
          :items="targetEndpoints"
        ></v-select>
      </v-col>

      <v-col v-if="group.group && group.associations" cols="12" sm="6">
        <v-list subheader>
          <v-subheader>Associations</v-subheader>
          <template v-for="(ass, index) in group.associations">
            <v-list-item :key="`item-${index}`" dense>
              <v-list-item-content>
                <v-list-item-title
                  >Node:
                  <strong>{{
                    nodes[nodesMap.get(ass.nodeId)]._name || ass.nodeId
                  }}</strong></v-list-item-title
                >
                <v-list-item-subtitle
                  v-if="ass.endpoint >= 0"
                  class="text--primary"
                  >Endpoint:
                  <strong>{{ ass.endpoint }}</strong>
                </v-list-item-subtitle>
              </v-list-item-content>
              <v-list-item-icon>
                <v-icon @click="removeAssociation(ass)" color="red">
                  delete
                </v-icon>
              </v-list-item-icon>
            </v-list-item>
            <v-divider :key="`divider-${index}`"></v-divider>
          </template>
          <v-list-item v-if="group.associations.length === 0">
            <v-list-item-content>
              No assocaitions
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-col>

      <v-col cols="12">
        <v-btn
          v-if="group.target && group.group"
          rounded
          color="primary"
          @click="addAssociation"
          dark
          class="mb-2"
          >Add</v-btn
        >
        <v-btn
          v-if="group.target && group.group"
          rounded
          color="primary"
          @click="removeAssociation"
          dark
          class="mb-2"
          >Remove</v-btn
        >
        <v-btn
          rounded
          color="primary"
          @click="removeAllAssociations"
          dark
          class="mb-2"
          >Remove All</v-btn
        >
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { socketEvents, inboundEvents as socketActions } from '@/plugins/socket'
import { mapMutations, mapGetters } from 'vuex'
export default {
  props: {
    node: Object,
    socket: Object
  },
  data () {
    return {
      group: { node: this.node }
    }
  },
  computed: {
    ...mapGetters(['nodes', 'nodesMap']),
    endpoints () {
      const toReturn = [
        { text: 'All', value: null },
        { text: 'Root (0)', value: 0 }
      ]

      for (let i = 1; i <= this.node.endpointsCount; i++) {
        toReturn.push({ text: i, value: i })
      }

      return toReturn
    },
    targetEndpoints () {
      const targetNode = this.group.target
      const endpoints = [{ text: 'Root (0)', value: 0 }]

      for (let i = 1; i <= targetNode.endpointsCount; i++) {
        endpoints.push({ text: i, value: i })
      }

      return endpoints
    },
    endpointGroups () {
      let groups = []
      try {
        groups = this.group.node.groups
        const endpoint = this.group.nodeEndpoint

        if (endpoint !== null && endpoint >= 0) {
          groups = groups.filter(g => g.endpoint === endpoint)
        }
      } catch (error) {}

      return groups
    }
  },
  mounted () {
    const self = this
    this.socket.on(socketEvents.api, async data => {
      if (data.success && data.api === 'getAssociations') {
        self.$set(self.group, 'associations', data.result)
      }
    })
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
    resetGroup () {
      this.$set(this.group, 'associations', [])
      this.$delete(this.group, 'group')
      this.$delete(this.group, 'nodeEndpoint')
    },
    getSourceAddress () {
      return {
        nodeId: this.group.node.id,
        endpoint: this.group.group.endpoint || 0
      }
    },
    getAssociations () {
      const g = this.group
      if (g && g.node && g.group) {
        this.apiRequest('getAssociations', [
          this.getSourceAddress(),
          g.group.value
        ])
      }
    },
    addAssociation () {
      const g = this.group
      const target = !isNaN(g.target) ? parseInt(g.target) : g.target.id

      const association = { nodeId: target }

      if (g.group.multiChannel && g.endpoint >= 0) {
        association.endpoint = g.endpoint
      }

      if (g && g.node && target) {
        const args = [this.getSourceAddress(), g.group.value, [association]]

        this.apiRequest('addAssociations', args)

        // wait a moment before refresh to check if the node
        // has been added to the group correctly
        setTimeout(this.getAssociations, 1000)
      }
    },
    removeAssociation (association) {
      const g = this.group
      if (g && g.node) {
        if (!association) {
          const target = !isNaN(g.target) ? parseInt(g.target) : g.target.id

          if (isNaN(target)) return
          association = { nodeId: target }

          if (g.group.multiChannel && g.endpoint >= 0) {
            association.endpoint = g.endpoint
          }
        }

        const args = [this.getSourceAddress(), g.group.value, [association]]

        this.apiRequest('removeAssociations', args)
        // wait a moment before refresh to check if the node
        // has been added to the group correctly
        setTimeout(this.getAssociations, 1000)
      }
    },
    removeAllAssociations () {
      const g = this.group
      if (g && g.node) {
        const args = [g.node.id]

        this.apiRequest('removeAllAssociations', args)
        // wait a moment before refresh to check if the node
        // has been added to the group correctly
        setTimeout(this.getAssociations, 1000)
      }
    }
  }
}
</script>

<style></style>
