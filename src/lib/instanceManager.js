const instances = {
  APP: 'app',
  ROUTER: 'router',
  STORE: 'store',
};

class InstanceManager {
  _instances = new Map();

  register(name, instance) {
    this._instances.set(name, instance);
  }

  unRegister(name) {
    this._instances.delete(name);
  }

  getInstance(name) {
    return this._instances.get(name);
  }
}

const manager = new InstanceManager();
export { manager, instances };
