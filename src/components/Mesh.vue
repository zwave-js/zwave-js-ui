<template>
  <v-container fluid>
    <v-card>
      <v-container grid-list-md>
        <v-layout row wrap>
          <v-flex xs3>
            <v-text-field label="Nodes size" v-model.number="nodeSize" min="10" type="number"></v-text-field>
          </v-flex>
          <v-flex xs3>
            <v-text-field label="Link size" v-model.number="fontSize" min="10" type="number"></v-text-field>
          </v-flex>
          <v-flex xs3>
              <v-btn color="success" @click="downloadSVG">Download SVG</v-btn>
          </v-flex>
        </v-layout>
      </v-container>

      <d3-network
        ref="mesh"
        :net-nodes="activeNodes"
        :net-links="links"
        :options="options"
        @node-click="nodeClick"
      />
      <v-speed-dial bottom fab right fixed v-model="fab">
        <v-btn slot="activator" color="blue darken-2" dark fab hover v-model="fab">
          <v-icon>add</v-icon>
          <v-icon>close</v-icon>
        </v-btn>
        <v-btn fab dark small color="green" @click="refresh">
          <v-icon>refresh</v-icon>
        </v-btn>
      </v-speed-dial>
    </v-card>
  </v-container>
</template>
<script>
import D3Network from 'vue-d3-network'

export default {
  name: 'Mesh',
  props: {
    socket: Object,
    socketActions: Object,
    socketEvents: Object
  },
  components: {
    D3Network
  },
  computed: {
    activeNodes () {
      return this.nodes.filter(n => n.node_id !== 0 && n.status !== 'Removed')
    },
    options () {
      return {
        canvas: false,
        force: 1500,
        offset: {
          x: 0,
          y: 0
        },
        nodeSize: this.nodeSize,
        fontSize: this.fontSize,
        linkWidth: 1,
        nodeLabels: true,
        linkLabels: false,
        strLinks: true,
        resizeListener: true
      }
    }
  },
  data () {
    return {
      nodeSize: 20,
      fontSize: 10,
      nodes: [],
      links: [],
      fab: false
    }
  },
  methods: {
    showSnackbar (text) {
      this.$emit('showSnackbar', text)
    },
    nodeClick (e, node) {
      this.selectedNode = this.nodes[node.id]
    },
    downloadSVG () {
      this.$refs.mesh.screenShot('myNetwork.svg', true, true)
    },
    convertNode (n) {
      return {
        id: n.node_id,
        _cssClass: this.nodeClass(n),
        name: n.product,
        node_id: n.node_id,
        status: n.status,
        failed: n.failed
      }
    },
    nodeClass (n) {
      if (n.node_id === 1) {
        return 'controller'
      }
      return n.status.toLowerCase()
    },
    apiRequest (apiName, args) {
      if (this.socket.connected) {
        var data = {
          api: apiName,
          args: args
        }
        this.socket.emit(this.socketActions.zwave, data)
      } else {
        this.showSnackbar('Socket disconnected')
      }
    },
    refresh () {
      this.socket.emit(this.socketActions.zwave, {
        api: 'refreshNeighborns',
        args: []
      })
    },
    updateLinks () {
      for (const source of this.nodes) {
        if (source.neighbors) {
          for (const target of source.neighbors) {
            this.links.push({
              sid: source.node_id,
              tid: target,
              _color: 'black'
            })
          }
        }
      }
    }
  },
  mounted () {
    var self = this

    this.socket.on(this.socketEvents.nodeRemoved, node => {
      self.$set(self.nodes, node.node_id, node)
    })

    this.socket.on(this.socketEvents.init, data => {
      var nodes = data.nodes
      for (var i = 0; i < nodes.length; i++) {
        self.nodes.push(self.convertNode(nodes[i]))
      }
    })

    this.socket.on(this.socketEvents.nodeUpdated, data => {
      var node = self.convertNode(data)
      if (!self.nodes[data.node_id]) {
        self.nodes.push(node)
      }
      self.$set(self.nodes, data.node_id, node)
    })

    this.socket.on(this.socketEvents.api, data => {
      if (data.success) {
        switch (data.api) {
          case 'refreshNeighborns':
            var neighbors = data.result
            for (var i = 0; i < neighbors.length; i++) {
              if (self.nodes[i]) {
                self.nodes[i].neighbors = neighbors[i]
              }
            }
            self.updateLinks()
            break
        }
      } else {
        self.showSnackbar(
          'Error while calling api ' + data.api + ': ' + data.message
        )
      }
    })

    this.socket.emit(this.socketActions.init, true)
    this.refresh()
  }
}
</script>
