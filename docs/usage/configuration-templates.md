# Configuration Templates

Configuration Templates let you save device parameter configurations as reusable templates and apply them to any matching node. This is useful when you have multiple devices of the same type and want to ensure they all share the same settings, or when you want to quickly configure new devices as they are added to your network.

## Creating a template

Navigate to the **Configuration Templates** page from the main menu. Click the **Create Template** button in the top-right corner to open the wizard.

The wizard has three steps:

### Step 1 — Select Device

Choose a node from the dropdown. Only nodes that are ready and have configuration parameters are listed. Each entry shows the node name and its device label.

### Step 2 — Select Parameters

A table displays all writable configuration parameters for the selected device. All parameters are pre-selected by default. You can deselect any parameters you don't want to include in the template.

For each parameter, you can adjust the **Template Value** that will be stored. By default, the current value of the parameter on the selected node is used.

### Step 3 — Name & Settings

- **Template Name** — A descriptive name for the template (required).
- **Firmware Range** — Optionally restrict the template to devices within a firmware version range (e.g. `1.0` to `2.5`). When set, the template will only match nodes whose firmware version falls within the specified range.
- **Auto-apply** — Toggle to automatically apply this template to newly included matching devices.

Click **Create** to save the template.

## Managing templates

The main table lists all saved templates with the following columns:

| Column | Description |
| --- | --- |
| Name | Template name |
| Device | Manufacturer and product label |
| Firmware Range | The firmware version constraint, if set |
| Values | Number of configuration parameters stored |
| Auto-Apply | Toggle switch to enable or disable auto-apply |
| Devices | Number of currently matching nodes on the network |
| Created | Date the template was created |

From the **Actions** column you can:

- **Apply** — Apply the template to matching nodes (see below).
- **Edit** — Re-open the wizard to modify the template's parameters, name, firmware range, or auto-apply setting. The device cannot be changed after creation.
- **Delete** — Permanently remove the template.

## Auto-apply

When **Auto-apply** is enabled on a template, it will be automatically applied to matching devices whenever they become ready on the network — for example, after inclusion or a restart.

A template matches a node when:

- The node's device type (manufacturer, product type, and product ID) matches the template.
- The node's firmware version falls within the template's firmware range (if one is set).

> [!NOTE]
> Each template tracks a content hash. If you update a template's values or firmware range, the updated version will be re-applied to matching nodes the next time they become ready, even if a previous version was already applied.

## Applying a template

Click the **Apply** (play) icon on a template row to open the apply dialog. The dialog lists all matching nodes on your network, pre-selected for application.

You can deselect any nodes you don't want to apply the template to, then click **Run**. Each node will show a live status:

- **Pending** — Waiting to be processed.
- **Running** — Parameters are being written to the node.
- **Success** — All parameters were set successfully.
- **Warning** — Some parameters were set but others failed. Expand the details to see which parameters failed and why.
- **Error** — The operation failed entirely (e.g. the node is dead).

After all nodes have been processed, you can click **Retry Failed** to attempt the failed nodes again.

> [!NOTE]
> If no matching nodes are found on the network, a notification will be shown instead of opening the dialog.

## Import / Export

Use **Export** to download all templates as a JSON file. This is useful for backing up your templates or sharing them with others.

Use **Import** to load templates from a previously exported JSON file. Imported templates are assigned new identifiers to avoid conflicts with existing templates.
