<template>
  <v-container fluid>
    <v-card>
      <v-container grid-list-md>
        <v-row>
          <v-col cols="3" md="2">
            <v-text-field
              label="Nodes size"
              v-model.number="nodeSize"
              min="10"
              type="number"
            ></v-text-field>
          </v-col>
          <v-col cols="3" md="2">
            <v-text-field
              label="Font size"
              v-model.number="fontSize"
              min="10"
              type="number"
            ></v-text-field>
          </v-col>
          <v-col cols="3" md="2">
            <v-text-field
              label="Distance"
              v-model.number="force"
              min="100"
              type="number"
            ></v-text-field>
          </v-col>
          <v-col cols="3" md="2">
            <v-switch label="Show location" v-model="showLocation"></v-switch>
          </v-col>
        </v-row>
      </v-container>

      <zwave-graph
        id="mesh"
        :nodes="nodes.filter(n => !n.failed)"
        @node-click="nodeClick"
      />

      <div id="properties" draggable v-show="showProperties" class="details">
        <v-icon
          @click="showProperties = false"
          style="cursor:pointer;position:absolute;right:10px;top:10px"
          >clear</v-icon
        >
        <v-subheader>Node properties</v-subheader>
        <v-list
          v-if="selectedNode"
          dense
          style="min-width:300px;background:transparent"
        >
          <v-list-item>
            <v-list-item-content>ID</v-list-item-content>
            <v-list-item-content class="align-end">{{
              selectedNode.data.id
            }}</v-list-item-content>
          </v-list-item>
          <v-list-item>
            <v-list-item-content>Status</v-list-item-content>
            <v-list-item-content class="align-end">{{
              selectedNode.data.status
            }}</v-list-item-content>
          </v-list-item>
          <v-list-item>
            <v-list-item-content>Code</v-list-item-content>
            <v-list-item-content class="align-end">{{
              selectedNode.data.productLabel
            }}</v-list-item-content>
          </v-list-item>
          <v-list-item>
            <v-list-item-content>Product</v-list-item-content>
            <v-list-item-content class="align-end">{{
              selectedNode.data.productDescription
            }}</v-list-item-content>
          </v-list-item>
          <v-list-item>
            <v-list-item-content>Manufacturer</v-list-item-content>
            <v-list-item-content class="align-end">{{
              selectedNode.data.manufacturer
            }}</v-list-item-content>
          </v-list-item>
          <v-list-item>
            <v-list-item-content>Name</v-list-item-content>
            <v-list-item-content class="align-end">{{
              selectedNode.data.name
            }}</v-list-item-content>
          </v-list-item>
          <v-list-item>
            <v-list-item-content>Location</v-list-item-content>
            <v-list-item-content class="align-end">{{
              selectedNode.data.loc
            }}</v-list-item-content>
          </v-list-item>
        </v-list>
      </div>

      <!-- <v-speed-dial bottom fab right fixed v-model="fab">
        <template v-slot:activator>
          <v-btn color="blue darken-2" dark fab hover v-model="fab">
            <v-icon v-if="fab">close</v-icon>
            <v-icon v-else>add</v-icon>
          </v-btn>
        </template>
        <v-btn fab dark small color="green" @click="refresh">
          <v-icon>refresh</v-icon>
        </v-btn>
      </v-speed-dial> -->
    </v-card>
  </v-container>
</template>
<script>
import ZwaveGraph from '@/components/custom/ZwaveGraph.vue'
import { mapMutations, mapGetters } from 'vuex'

import { socketEvents, inboundEvents as socketActions } from '@/plugins/socket'

export default {
  name: 'Mesh',
  props: {
    socket: Object
  },
  components: {
    ZwaveGraph
  },
  watch: {
    nodes () {
      this.debounceRefresh()
    }
  },
  computed: {
    ...mapGetters(['nodes'])
  },
  data () {
    return {
      nodeSize: 20,
      fontSize: 10,
      force: 2000,
      fab: false,
      selectedNode: null,
      showProperties: false,
      showLocation: false,
      refreshTimeout: null
    }
  },
  methods: {
    ...mapMutations(['showSnackbar', 'setNeighbors']),
    nodeClick (e, node) {
      this.selectedNode = this.selectedNode === node ? null : node
      this.showProperties = !!this.selectedNode
    },
    debounceRefresh () {
      if (this.refreshTimeout) {
        clearTimeout(this.refreshTimeout)
      }

      this.refreshTimeout = setTimeout(this.refresh.bind(this), 500)
    },
    refresh () {
      this.socket.emit(socketActions.zwave, {
        api: 'refreshNeighbors',
        args: []
      })
    }
  },
  mounted () {
    this.socket.on(socketEvents.api, data => {
      if (data.success) {
        switch (data.api) {
          case 'refreshNeighbors': {
            const neighbors = data.result
            for (let i = 0; i < neighbors.length; i++) {
              this.setNeighbors({ nodeId: i, neighbors: neighbors[i] })
            }
            break
          }
        }
      } else {
        this.showSnackbar(
          'Error while calling api ' + data.api + ': ' + data.message
        )
      }
    })

    // make properties window draggable
    const propertiesDiv = document.getElementById('properties')
    const mesh = document.getElementById('mesh')
    let isDown = false
    let offset = [0, 0]

    // TODO: Update dimensions on screen resize
    const dimensions = [mesh.clientWidth, mesh.clientHeight]

    propertiesDiv.addEventListener(
      'mousedown',
      function (e) {
        isDown = true
        offset = [
          propertiesDiv.offsetLeft - e.clientX,
          propertiesDiv.offsetTop - e.clientY
        ]
      },
      true
    )

    document.addEventListener(
      'mouseup',
      function () {
        isDown = false
      },
      true
    )

    document.addEventListener(
      'mousemove',
      function (e) {
        e.preventDefault()
        if (isDown) {
          const l = e.clientX
          const r = e.clientY

          if (l > 0 && l < dimensions[0]) {
            propertiesDiv.style.left = l + offset[0] + 'px'
          }
          if (r > 0 && r < dimensions[1]) {
            propertiesDiv.style.top = r + offset[1] + 'px'
          }
        }
      },
      true
    )
  },
  beforeDestroy () {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout)
    }
    if (this.socket) {
      // unbind events
      this.socket.off(socketEvents.api)
    }
  }
}
</script>
