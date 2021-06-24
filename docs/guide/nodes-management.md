# Nodes Management

## Add a node

To add a node using the UI, go to Control Panel and from the actions dropdown menu select `Start inclusion`, click send (:airplane:) button to enable the inclusion mode in your controller, a popup will ask you if you want to start it in `Secure mode`. In the `Controller status` text field you should see `Non-secure/Secure inclusion started` when inclusion has been successfully enabled on the controller. Wait few seconds and once the interview finish your node will be visible in the table.

## Remove a node

To remove a node using the UI, go to Control Panel and from the actions dropdown menu select `Start exclusion`, click send (:airplane:) button to enable the exclusion mode in your controller and enable the exclusion mode in your device to. `Controller status` should show `Exclusion started` when exclusion has been successfully enabled on the controller. Wait few seconds and your node will be removed from the table.

## Remove a failed node

If a node is missing or marked as dead, you can forcibly remove the node from the controller by executing `Remove Failed Node`. This can only succeed if the node:

- is marked as **Dead** or **Asleep**
- does not respond to a ping

## Replace failed node

If you want to reuse the Node ID of a failed node for a new one, you can use the command `Replace Failed Node`. After removing the failed node, the controller will start inclusion mode and status will be `Waiting`, a popup will ask you if you want to start it in `Secure mode`. Now enable inclusion on your device to add it to the network by replacing the failed one. Like `Remove Failed Node`, this can only succeed if the node to replace:

- is marked as **Dead** or **Asleep**
- does not respond to a ping
