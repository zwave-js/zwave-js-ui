<template>
  <v-container fluid>
    <v-toolbar flat dense>
      <v-btn
        color="blue"
        :text="$vuetify.breakpoint.mdAndUp"
        :icon="$vuetify.breakpoint.smAndDown"
        @click="addRemoveShowDialog = true"
      >
        <v-icon style="margin-right:0.3rem">add_circle_outline</v-icon>
        <span v-if="$vuetify.breakpoint.mdAndUp">Add/Remove Device</span>
      </v-btn>

      <v-menu v-model="groupMenu" :close-on-content-click="true">
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" text>
            <v-icon style="margin-right:0.3rem">source</v-icon>
            <span v-if="$vuetify.breakpoint.mdAndUp">Group: </span
            ><small style="opacity:0.8">{{ groups[group].name }}</small>
          </v-btn>
        </template>
        <v-card style="min-width:170px">
          <v-card-title>Group by</v-card-title>
          <v-card-text style="padding-bottom:0">
            <v-radio-group v-model="group" style="margin-top:0">
              <v-radio
                v-for="(g, i) in groups"
                :key="i"
                :value="i"
                :label="g.name"
              />
            </v-radio-group>
          </v-card-text>
          <v-card-actions style="text-align:right">
            <v-btn text color="blue" @click="group = 0">Reset</v-btn>
          </v-card-actions>
        </v-card>
      </v-menu>

      <v-menu v-model="filterMenu" :close-on-content-click="false">
        <template v-slot:activator="{ on }">
          <v-btn v-on="on" text>
            <v-icon style="margin-right:0.2rem">filter_alt</v-icon>
            <span v-if="$vuetify.breakpoint.mdAndUp">Filter: </span>
            <small style="opacity:0.8">{{
              filterText
                ? filterText
                : filter === null || filter.length === 0
                ? 'none'
                : filter.length === 1
                ? filter[0]
                : 'hidden'
            }}</small>
          </v-btn>
        </template>
        <v-card style="min-width:330px">
          <v-card-title>Filter</v-card-title>
          <v-card-text>
            <v-text-field
              v-model="filterText"
              label="Name, manufacturer, or product"
            />
            <div style="display:flex">
              <div style="padding-top:1.3rem">Hide:</div>
              <v-checkbox
                style="margin-left:1rem"
                v-model="filter"
                hide-details
                label="Removed"
                value="removed"
              />
              <v-checkbox
                style="margin-left:2rem"
                v-model="filter"
                hide-details
                label="Dead"
                value="dead"
              />
            </div>
          </v-card-text>
          <v-card-actions style="text-align:right">
            <v-btn text color="blue" @click="onFilterReset">Reset</v-btn>
          </v-card-actions>
        </v-card>
      </v-menu>

      <v-spacer></v-spacer>

      <v-btn
        color="purple"
        :text="$vuetify.breakpoint.mdAndUp"
        :icon="$vuetify.breakpoint.smAndDown"
        @click="advancedShowDialog = true"
      >
        <v-icon style="margin-right:0.2rem">label_important</v-icon>
        <span v-if="$vuetify.breakpoint.mdAndUp">Advanced</span>
      </v-btn>
    </v-toolbar>

    <DialogAddRemove
      v-model="addRemoveShowDialog"
      :lastNodeFound="addRemoveNode"
      @close="onAddRemoveClose"
      @apiRequest="apiRequest"
    />

    <DialogAdvanced
      v-model="advancedShowDialog"
      @close="advancedShowDialog = false"
      @apiRequest="apiRequest"
      v-on="$listeners"
    />

    <div v-for="(groupOfNodes, key, i) in groupedNodes" :key="i">
      <v-banner class="node-group-head" v-if="key !== 'none'" single-line>{{
        key
      }}</v-banner>
      <div :class="['node-grid', $vuetify.breakpoint.name]">
        <NodeItem v-for="node in groupOfNodes" :key="node.id" :node="node" @click="onNodeClick(node)" />
      </div>
    </div>

    
    <DialogNode
      v-model="nodeShowDialog"
      :node="selectedNode"
      @close="nodeShowDialog = false"
      @apiRequest="apiRequest"
      v-on="$listeners"
    />

  </v-container>
</template>

<script>
import { mapGetters, mapMutations } from 'vuex'

import NodeItem from '@/components/NodeItem'
import DialogAddRemove from '@/components/dialogs/DialogAddRemove'
import DialogAdvanced from '@/components/dialogs/DialogAdvanced'
import DialogNode from '@/components/dialogs/DialogNode'

import { socketEvents } from '@/plugins/socket'

export default {
  name: 'ControlPanel',
  props: {
    socket: Object
  },
  components: {
    NodeItem,
    DialogAddRemove,
    DialogAdvanced,
    DialogNode
  },
  data () {
    return {
      bindedSocketEvents: {}, // keep track of the events-handlers

      addRemoveShowDialog: false,
      addRemoveNode: null,

      filterMenu: false,
      filter: ['removed'],
      filterText: null,

      groupMenu: false,
      group: 0,
      groups: [
        {
          name: 'None',
          value: 'none'
        },
        {
          name: 'Manufacturer',
          value: 'manu'
        },
        {
          name: 'Product',
          value: 'desc'
        },
        {
          name: 'Model',
          value: 'productLabel'
        },
        {
          name: 'Location',
          value: 'location'
        },
        {
          name: 'Status',
          value: 'status'
        }
      ],

      advancedShowDialog: false,

      nodeShowDialog: false,
      selectedNode: null
    }
  },
  computed: {
    ...mapGetters(['nodes']),
    viewNodes () {
      let nodes = [...this.nodes]
      const filter = this.filter || []
      if (filter.includes('removed')) {
        nodes = nodes.filter(x => x.status !== 'Removed')
      }
      if (filter.includes('dead')) {
        nodes = nodes.filter(x => x.status !== 'Dead')
      }
      if (this.filterText) {
        nodes = nodes.filter(x =>
          (x.name + x.manufacturer + x.productDescription + x.productLabel)
            .toLowerCase()
            .includes(this.filterText.toLowerCase())
        )
      }

      return nodes.map(x => ({
        ...x,
        color: this.getNodeColor(x),
        icon: this.getNodeIcon(x),
        manu:
          x.status === 'Removed' || x.status === 'Dead' ? '-' : x.manufacturer,
        desc:
          x.status === 'Removed' || x.status === 'Dead'
            ? 'Node'
            : x.productDescription,
        ago: x.lastActive ? this.timeago(new Date() - x.lastActive) : ' '
      }))
    },
    groupedNodes () {
      if (this.group === 0) {
        return { none: this.viewNodes }
      }

      return this.groupBy(this.viewNodes, this.groups[this.group].value)
    }
  },
  methods: {
    ...mapMutations(['showSnackbar']),
    onNodeClick (node) {
      console.debug(node)
      this.selectedNode = node
      this.nodeShowDialog = true
    },
    timeago (ms) {
      // TODO: move into util library
      let ago = Math.floor(ms / 1000)
      let part = 0

      if (ago < 5) return 'just now'
      if (ago < 60) return ago + 's ago'

      if (ago < 3600) {
        while (ago >= 60) {
          ago -= 60
          part += 1
        }
        return part + 'm ago'
      }

      if (ago < 86400) {
        while (ago >= 3600) {
          ago -= 3600
          part += 1
        }
        return part + 'h ago'
      }

      if (ago < 604800) {
        while (ago >= 172800) {
          ago -= 172800
          part += 1
        }
        return part + 'd ago'
      }

      return 'long ago'
    },
    groupBy (arr, criteria) {
      // TODO: move into util library
      return arr.reduce(function (obj, item) {
        const key =
          typeof criteria === 'function' ? criteria(item) : item[criteria]
        if (!Object.prototype.hasOwnProperty.call(obj, key)) {
          obj[key] = []
        }
        obj[key].push(item)
        return obj
      }, {})
    },
    getNodeColor (node) {
      switch (node.status) {
        case 'Awake':
        case 'Alive':
          return node.interviewStage === 'RestartFromCache' ? 'orange' : 'green'
        case 'Dead':
          return 'red'
        case 'Asleep':
          return node.interviewStage === 'RestartFromCache' ? 'orange' : 'blue'
        default:
          return 'gray'
      }
    },
    getNodeIcon (node) {
      switch (node.interviewStage) {
        case 'None':
          return 'remove_circle_outline'
        case 'RestartFromCache':
          return node.status === 'Dead' ? 'dangerous' : 'history'
        case 'Complete':
          return node.status === 'Asleep'
            ? 'nightlight_round'
            : 'check_circle_outline'
        case 'ProtocolInfo':
        case 'NodeInfo':
        case 'CommandClasses':
        case 'Neighbors':
          return 'arrow_circle_down'
        default:
          return node.status === 'Unknown' ? 'help_outline' : 'error_outline'
      }
    },
    onFilterReset () {
      this.filterText = null
      this.filter = ['removed']
    },
    onAddRemoveClose () {
      this.addRemoveShowDialog = false
      this.addRemoveNode = null
    },
    apiRequest (apiName, args) {
      this.$emit('apiRequest', apiName, args)
    },
    onApiResponse (data) {
      if (data.success) {
        switch (data.api) {
          case 'getDriverStatistics':
            this.$listeners.showConfirm(
              'Driver statistics',
              this.jsonToList(data.result)
            )
            break
          case 'getNodeStatistics':
            this.$listeners.showConfirm(
              'Node statistics',
              this.jsonToList(data.result)
            )
            break
          default:
            this.showSnackbar('Successfully call api ' + data.api)
        }
      } else {
        this.showSnackbar(
          'Error while calling api ' + data.api + ': ' + data.message
        )
      }
    },
    onNodeAddedRemoved (node) {
      this.addRemoveNode = node
    },
    bindEvent (eventName, handler) {
      this.socket.on(socketEvents[eventName], handler)
      this.bindedSocketEvents[eventName] = handler
    },
    unbindEvents () {
      for (const event in this.bindedSocketEvents) {
        this.socket.off(event, this.bindedSocketEvents[event])
      }
    }
  },
  mounted () {
    const onApiResponse = this.onApiResponse.bind(this)
    const onNodeAddedRemoved = this.onNodeAddedRemoved.bind(this)

    this.bindEvent('api', onApiResponse)
    this.bindEvent('nodeRemoved', onNodeAddedRemoved)
    this.bindEvent('nodeAdded', onNodeAddedRemoved)
  },
  beforeDestroy () {
    if (this.socket) {
      this.unbindEvents()
    }
  }
}
</script>

<style scoped>
.node-group-head {
  background-image: linear-gradient(to bottom, #ffffff22, #cccccc44);
}
.node-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  justify-items: stretch;
}
.node-grid.xs {
  grid-template-columns: repeat(1, 1fr);
}
.node-grid.sm {
  grid-template-columns: repeat(2, 1fr);
}
.node-grid.lg,
.node-grid.xl {
  grid-template-columns: repeat(4, 1fr);
}
</style>
