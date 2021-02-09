<template>
  <v-dialog v-model="value" persistent max-width="800">
    <v-card>
      <v-card-title>
        <span class="headline">Advanced</span>
        <v-spacer></v-spacer>
        <v-btn icon @click="$emit('close')"><v-icon>close</v-icon></v-btn>
      </v-card-title>

      <v-card-text>
        <div :class="['action-grid', $vuetify.breakpoint.name]">
          <div v-for="(a, i) in actions" :key="i" style="text-align:center">
            <v-icon :color="a.color || 'purple'" x-large>{{ a.icon }}</v-icon>
            <div style="font-size:1.1rem">{{ a.text }}</div>
            <div
              style="font-size:0.7rem;color:#999;line-height:0.9rem;margin-top:-0.2rem"
            >
              {{ a.desc }}
            </div>
            <v-btn
              v-for="(o, i) in a.options"
              :key="i"
              @click="onAction(o.action, o.broadcast)"
              text
              :color="a.color || 'purple'"
              >{{ o.name }}</v-btn
            >
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
import ConfigApis from '@/apis/ConfigApis'
import { mapGetters, mapMutations } from 'vuex'

export default {
  props: {
    value: Boolean, // show or hide
    lastNodeFound: Object
  },
  data () {
    return {
      actions: [
        {
          text: 'Backup',
          options: [
            { name: 'Import', action: 'import' },
            { name: 'Export', action: 'export' }
          ],
          icon: 'save',
          desc: 'Save or load `nodes.json` file with names and locations'
        },
        {
          text: 'Heal Network',
          options: [
            { name: 'Begin', action: 'beginHealingNetwork' },
            { name: 'Stop', action: 'stopHealingNetwork' }
          ],
          icon: 'healing',
          desc: 'Force nodes to establish better connections to the controller'
        },
        {
          text: 'Refresh Values',
          options: [
            { name: 'Start', action: 'refreshValues', broadcast: true }
          ],
          icon: 'cached',
          desc: 'Read the values from each node so it has proper state'
        },
        {
          text: 'Re-interview Nodes',
          options: [{ name: 'Start', action: 'refreshInfo', broadcast: true }],
          icon: 'history',
          desc: 'Update the metadata and command class info for each node'
        },
        {
          text: 'Failed Nodes',
          options: [
            { name: 'Check', action: 'isFailedNode', broadcast: true },
            { name: 'Remove', action: 'removeFailedNode', broadcast: true }
          ],
          icon: 'dangerous',
          desc:
            'Manage nodes that are dead and/or marked as failed with the controller'
        },
        {
          text: 'Remove Associations',
          options: [
            { name: 'Start', action: 'removeAllAssociations', broadcast: true }
          ],
          icon: 'link_off',
          desc: 'Clear associations for all paired devices'
        },
        {
          text: 'Hard Reset',
          options: [{ name: 'Factory Reset', action: 'hardReset' }],
          icon: 'warning',
          color: 'red',
          desc:
            'Reset controller to factory defaults (all paired devices will be removed)'
        }
      ]
    }
  },
  computed: {
    ...mapGetters(['nodes'])
  },
  methods: {
    ...mapMutations(['showSnackbar']),
    async onAction (action, broadcast) {
      if (action === 'import') {
        this.importConfiguration()
      } else if (action === 'export') {
        this.exportConfiguration()
      } else {
        if (broadcast) {
          for (let i = 0; i < this.nodes.length; i++) {
            const nodeid = this.nodes[i].id
            this.$emit('apiRequest', action, [nodeid])
          }
        } else {
          this.$emit('apiRequest', action, [])
        }
      }
      this.$emit('close')
    },
    async importConfiguration () {
      if (
        await this.$listeners.showConfirm(
          'Attention',
          'This will override all existing nodes names and locations',
          'alert'
        )
      ) {
        try {
          const { data } = await this.$listeners.import('json')
          const response = await ConfigApis.importConfig({ data: data })
          this.showSnackbar(response.message)
        } catch (error) {
          console.log(error)
        }
      }
    },
    exportConfiguration () {
      const self = this
      ConfigApis.exportConfig()
        .then(data => {
          self.showSnackbar(data.message)
          if (data.success) {
            self.$listeners.export(data.data, 'nodes', 'json')
          }
        })
        .catch(error => {
          console.log(error)
        })
    }
  }
}
</script>

<style scoped>
.action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  column-gap: 1rem;
  row-gap: 1rem;
}
.action-grid.xs {
  grid-template-columns: repeat(1, 1fr);
}
.action-grid.sm {
  grid-template-columns: repeat(2, 1fr);
}
.option {
  margin-top: 1rem;
}
.option > small {
  color: #888;
  display: block;
  margin: -0.2rem 0 0 1.4rem;
}
</style>
