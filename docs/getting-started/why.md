# Why Zwave-js

1. Entirely written in JS (Typescript). This is good for many reasons:
   - We can drop the `node-openzwave-shared` that is maintained by me but would need a complete refactor and it's hard to maintain both projects.
   - It will not require to compile OZW and we can have more control of updates/versions with zwave-js releases.
   - JS it's straightforward to debug all through the stack rather than a black box that is abstracted by another library
2. Better support/collaboration: OZW is widely used and the author had many other related projects to maintain/support causing many delays or even no responses at all to some issues. Zwave is a good protocol but there are many devices compatibility issues and most of the issues on z2m were related to them. It's become really clear from the time building and maintaining z2m that the community is really important and have found working with @AlCalzone and the growing dev community around zwave-js to be really beneficial for fast paced change and this project is fully embraced by that community too.
3. Its device database keeps growing and uses configurations imported both from OpenHAB, OZW and Zwave Alliance.
4. Better code testing and overall features: it supports OTA Updates, Secure Node Replace and there is a work in progress for security S2 that are not supported by OZW
