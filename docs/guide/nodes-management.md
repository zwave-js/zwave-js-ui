# Nodes Management

## Add a node

To add a node using the UI, go to Control Panel and from the actions dropdown menu select `Start inclusion`, click send (:airplane:) button to enable the inclusion mode in your controller, a popup will ask you if you want to start it in `Secure mode`. In the `Controller status` text field you should see `Non-secure/Secure inclusion started` when inclusion has been successfully enabled on the controller. Wait few seconds and once the interview finish your node will be visible in the table.

## Remove a node

To remove a node using the UI, go to Control Panel and from the actions dropdown menu select `Start exclusion`, click send (:airplane:) button to enable the exclusion mode in your controller and enable the exclusion mode in your device to. `Controller status` should show `Exclusion started` when exclusion has been successfully enabled on the controller. Wait few seconds and your node will be removed from the table.

## Replace failed node

To replace a failed node from the UI you have to use the command `Replace Failed Node`, the controller will start inclusion mode and status will be `Waiting`, a popup will ask you if you want to start it in `Secure mode`. Now enable inclusion on your device to add it to the network by replacing the failed one.

## Remove a failed node

If a node is missing or marked as dead. There is a way to cleanup the controller by executing `Remove Failed Node`. This will forcebly delete the node from the controller.
It can only succeed if:

- Node has ben first marked as failed using `Has node failed`
- Marked as Dead by the controller

Alive and Sleeping nodes cannot be deleted.
