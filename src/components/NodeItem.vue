<template>
  <div class="node-item" v-ripple @click="$emit('click')">
    <div class="node-col1">
      <div :class="node.color + '--text'">{{ node.id }}</div>
      <v-icon :color="node.color">{{ node.icon }}</v-icon>
    </div>
    <div class="node-col2">
      <div>{{ node.manu }}</div>
      <div>{{ node.desc }}</div>
      <div>{{ node.prod }}</div>
    </div>
    <div class="node-col3">
      <div>
        <v-icon v-if="node.sec" small>lock</v-icon>
        <v-icon v-if="node.beam" small>contactless</v-icon>
      </div>
      <div>{{ node.status }}</div>
      <div>{{ node.ago }}</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'NodeItem',
  props: {
    node: Object,
    socket: Object
  },
  components: {},
  data () {
    return {
      
    }
  }
}
</script>
<style scoped>
.node-item {
  flex: 1;
  min-width: 300px;
  border-radius: 5px;
  display: flex;
  margin: 0.3rem;
  border-width: 1px;
  border-color: #dfdfdf;
  border-style: solid;
  cursor:pointer;
}
.node-item.selected {
  border-color:#2196f3
}
.theme--dark .node-item {
  border-color: #333;
}

.node-col1 {
  min-width: 30px;
  text-align: center;
  background-color: #dfdfdf;
  margin-right: 0.4rem;
}
.theme--dark .node-col1 {
  background-color: #333;
}

.node-col1>:first-child{
  font-size:larger;padding-top:0.3rem;
}
.node-col1>:nth-child(2) {
  margin-top:-0.7rem
}

.node-col2 {
  flex: 1;
}
.node-col2>:first-child {
  color:#888;font-size:0.7rem;line-height:0.7rem;padding-top:0.4rem
}
.node-col2>:nth-child(2) {
  margin:2px 0 4px 0;line-height:1rem
}
.node-col2>:last-child {
  font-size:0.9rem;margin-top:-0.3rem
}
.node-col3 {
  text-align: right;
  padding-right: 0.4rem;
}
.node-col3>:first-child {
  opacity:0.8;height:24px
}
.node-col3>:nth-child(2) {
  line-height:0.95rem
}
.node-col3>:last-child {
  color:#777;font-size:0.7rem;margin-top:-0.1rem
}
</style>
