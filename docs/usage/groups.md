# Multicast and Broadcast Groups

Z-Wave supports sending commands to multiple nodes simultaneously using **broadcast** (all nodes) and **multicast** (a subset of nodes). zwave-js-ui provides a Groups management interface to create and manage multicast groups, and automatically exposes broadcast nodes.

## Concepts

### Broadcast Nodes

Broadcast nodes send commands to **every node** in the network at once. They are created automatically when the Z-Wave driver starts:

- **Broadcast**: Sends to all standard Z-Wave nodes
- **Broadcast LR**: Sends to all Long Range nodes (only shown when the controller supports Long Range)

Broadcast commands are **write-only** — you can send commands but cannot read back the current state from a broadcast node.

### Multicast Groups

Multicast groups send commands to a **specific set of nodes** simultaneously. This is more efficient than sending individual commands and ensures all nodes react at the same time (e.g., turning on all lights in a room).

Key behaviors:

- Groups require at least **2 nodes**
- The exposed values are the **union** of all writeable actuator command classes across all member nodes, plus Basic CC (always added so heterogeneous groups can be controlled together). Nodes that don't support a particular CC simply ignore the command.
- **Value aggregation**: For each value, if all supporting member nodes have the same value, it is displayed. If values differ, it shows as undefined.
- Group IDs are assigned automatically above `0xFFF` (4096+) and are internal — the UI identifies groups by name, not by ID.

## Managing Groups

Navigate to the **Groups** page from the left sidebar menu.

### Creating a Group

1. Click the **Add** button in the toolbar
2. Enter a **group name**
3. Select **2 or more nodes** from the dropdown (controller node is excluded automatically)
4. Click **Confirm**

The group will appear in the table and a virtual node will be created in the Control Panel.

### Editing a Group

1. Select the group row in the table
2. Click the **Edit** button
3. Modify the name or node selection
4. Click **Confirm**

### Deleting a Group

1. Select the group row in the table
2. Click the **Delete** button
3. Confirm the deletion

### Exporting Groups

Click the **Export** button to download the `groups.json` file. Groups are automatically included in backups.

## Virtual Nodes in the Control Panel

Broadcast and multicast group nodes appear in the Control Panel alongside physical nodes. They are distinguished by:

- **Broadcast nodes**: Purple sensor icon in the ID column, "Broadcast" in the Manufacturer column
- **Multicast groups**: Purple three-dot icon in the ID column, "Multicast: [name]" in the Manufacturer column

Device-specific columns (battery, security, protocol, firmware, status, etc.) are hidden for virtual nodes since they don't apply.

### Controlling Virtual Nodes

Click on a virtual node to expand it. The **Node** tab shows all available value controls — the same controls used for physical nodes (dropdowns, number inputs, boolean toggles). Writing a value sends the command to all nodes in the group (or all nodes in the network for broadcast).

Only the **Node** and **Debug Info** tabs are shown for virtual nodes. Tabs like Help, Home Assistant, Groups (associations), OTA Updates, and Events are hidden as they don't apply to virtual nodes.

## MQTT Integration

Virtual node values are published to MQTT like regular node values. You can write to them by publishing to the corresponding set topic, which triggers a real Z-Wave broadcast or multicast command.

For example, with named topics, a multicast group named "Living Room Lights" would have topics like:

```text
zwave/Living Room Lights/Multilevel Switch/endpoint_0/targetValue
zwave/Living Room Lights/Multilevel Switch/endpoint_0/targetValue/set
```

Publishing `80` to the `/set` topic sends a multicast command to all group members.

> [!NOTE]
> This is an alternative to the existing [Broadcast](/guide/mqtt?id=broadcast) and [Multicast](/guide/mqtt?id=multicast) MQTT topics. The difference is that groups are pre-configured in the UI and their values are published as regular MQTT topics, making them easier to integrate with home automation systems. The existing broadcast/multicast MQTT APIs remain available for ad-hoc commands.

See the [MQTT documentation](/guide/mqtt?id=groups) for the full API reference.
