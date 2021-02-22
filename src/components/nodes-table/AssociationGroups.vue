<template>
  <v-container grid-list-md>
    <v-row>
      <v-col cols="12" sm="6">
        <v-select
          label="Group"
          v-model="group.group"
          @input="getAssociations"
          :items="group.node.groups"
          return-object
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
                    nodes[ass.nodeId]._name || ass.nodeId
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

      <v-col cols="12" sm="6">
        <v-combobox
          label="Target"
          v-model="group.target"
          :items="sortedNodes.filter(n => n != group.node)"
          return-object
          hint="Select the node from the list or digit the node ID"
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
        <v-text-field
          v-model.number="group.endpoint"
          label="Endpoint"
          hint="Target node endpoint"
          type="number"
        />
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
import { mapMutations } from 'vuex'
export default {
  props: {
    node: Object,
    nodes: Array,
    socket: Object
  },
  data () {
    return {
      group: { node: this.node }
    }
  },
  computed: {
    sortedNodes () {
      return this.nodes
        .filter(n => !n.failed)
        .sort((n1, n2) =>
          n1._name.toLowerCase() < n2._name.toLowerCase() ? -1 : 1
        )
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
      this.$set(this.group, 'group', null)
    },
    getAssociations () {
      const g = this.group
      if (g && g.node && g.group) {
        this.apiRequest('getAssociations', [g.node.id, g.group.value])
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
        const args = [g.node.id, g.group.value, [association]]

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

        const args = [g.node.id, g.group.value, [association]]

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
