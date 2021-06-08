// config/store.js

export type StoreKeys = "settings" | "scenes" | "nodes" | "users";

export interface StoreFile {
  file: string; 
  default: any
}

export interface User {
  username: string,
  passwordHash: string,
  token?: string
}

const store: Record<StoreKeys, StoreFile> = {
  settings : { file: 'settings.json', default: {} },
  scenes : { file: 'scenes.json', default: [] },
  nodes : { file: 'nodes.json', default: [] },
  users : { file: 'users.json', default: [] }
}

export default store
