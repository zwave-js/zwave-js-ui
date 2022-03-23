# [6.6.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.5.2...v6.6.0) (2022-03-23)


### Bug Fixes

* ensure settings contains default and do not throw errors ([#2328](https://github.com/zwave-js/zwavejs2mqtt/issues/2328)) ([010f22e](https://github.com/zwave-js/zwavejs2mqtt/commit/010f22e03a4abebc16d4bf65ba64b9fb135b02be))
* only merge objects ([12d8960](https://github.com/zwave-js/zwavejs2mqtt/commit/12d8960503173a2ac71d196ff7ab0acf65dfb94d))
* **docker:** update Dockerfile.contrib to include nvmedit package ([#2290](https://github.com/zwave-js/zwavejs2mqtt/issues/2290)) ([ec6b2f6](https://github.com/zwave-js/zwavejs2mqtt/commit/ec6b2f6d62209360ef45b5fa5d68db67cf3fa1c6))
* **hass:** support for Multi Level Switch Start and Stop CC ([#2315](https://github.com/zwave-js/zwavejs2mqtt/issues/2315)) ([254d1e3](https://github.com/zwave-js/zwavejs2mqtt/commit/254d1e390092ed9f21e108aaffd5cbad09b2f60c))
* **ui:** tx/rx arrows bug ([777725f](https://github.com/zwave-js/zwavejs2mqtt/commit/777725f10e5d028d620dd2fbe33c9cd32c6f52b2))


### Features

* **ui:** flatten UI when elevation is not necessary ([#2317](https://github.com/zwave-js/zwavejs2mqtt/issues/2317)) by [@floutchito](https://github.com/floutchito) ([97ec643](https://github.com/zwave-js/zwavejs2mqtt/commit/97ec643ad2e068fa63d08e88568230b7cffa33da))
* bump zwave-js@8.11.7 ([#2289](https://github.com/zwave-js/zwavejs2mqtt/issues/2289)) ([068a4d9](https://github.com/zwave-js/zwavejs2mqtt/commit/068a4d9f467e04195763c8cd23838af86d3c4e1c))
* bump zwave-js@8.11.8 ([#2304](https://github.com/zwave-js/zwavejs2mqtt/issues/2304)) ([88470c5](https://github.com/zwave-js/zwavejs2mqtt/commit/88470c5a09eb0be47a5ac12fa4dba503828d5317))
* bump zwave-js@8.11.9 ([#2306](https://github.com/zwave-js/zwavejs2mqtt/issues/2306)) ([dfa5122](https://github.com/zwave-js/zwavejs2mqtt/commit/dfa5122dcbabc55d3e57d86167f4185045a7b43a))

## [6.5.2](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.5.1...v6.5.2) (2022-02-18)


### Bug Fixes

* **ui:** pressing enter reloads page ([8360ee7](https://github.com/zwave-js/zwavejs2mqtt/commit/8360ee767f212482addc227fea7c45e9bc204a6b)), closes [#2256](https://github.com/zwave-js/zwavejs2mqtt/issues/2256)


### Features

* bump @zwave-js/server@1.15.0 ([#2268](https://github.com/zwave-js/zwavejs2mqtt/issues/2268)) ([74e5ba7](https://github.com/zwave-js/zwavejs2mqtt/commit/74e5ba74b6e2e2f1208d92e13b3c8c3694870289))
* bump zwave-js@8.11.5 ([#2253](https://github.com/zwave-js/zwavejs2mqtt/issues/2253)) ([f23e32b](https://github.com/zwave-js/zwavejs2mqtt/commit/f23e32b8f7cababf232ad449f3e7416c0f1c99a9))
* bump zwave-js@8.11.6 ([#2261](https://github.com/zwave-js/zwavejs2mqtt/issues/2261)) ([a7fee79](https://github.com/zwave-js/zwavejs2mqtt/commit/a7fee7992e9590ae21fde243b9fc6226b0940706))

## [6.5.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.5.0...v6.5.1) (2022-02-08)


### Bug Fixes

* inclusion with name and location not working sometimes ([#2247](https://github.com/zwave-js/zwavejs2mqtt/issues/2247)) ([e2071fe](https://github.com/zwave-js/zwavejs2mqtt/commit/e2071fef2f91fd7510564aeed1a5fd8b1dadaa2c)), closes [#2210](https://github.com/zwave-js/zwavejs2mqtt/issues/2210)
* set max healthcheck rounds ([4d775c7](https://github.com/zwave-js/zwavejs2mqtt/commit/4d775c7c792e87072c05c185ec97ce0a48691011)), closes [#2234](https://github.com/zwave-js/zwavejs2mqtt/issues/2234)
* **ui:** prevent refresh neighbors automatically on mesh ([6c37bf6](https://github.com/zwave-js/zwavejs2mqtt/commit/6c37bf6c2418d8c274e14a804aab4a3890e4137b))
* **ui:** remove `custom` text in values ([b684ba9](https://github.com/zwave-js/zwavejs2mqtt/commit/b684ba9583f757fdab903cc487d245e6fe554636))


### Features

* **ui:** allow to filter nodes in mesh graph ([#2248](https://github.com/zwave-js/zwavejs2mqtt/issues/2248)) ([83eaede](https://github.com/zwave-js/zwavejs2mqtt/commit/83eaede76a8b6c927ce8ec8b5d2083f2948a20a5))
* bump zwave-js@8.11.3 ([#2229](https://github.com/zwave-js/zwavejs2mqtt/issues/2229)) ([ef00939](https://github.com/zwave-js/zwavejs2mqtt/commit/ef00939b0289c966370da75b76a55dafc20feb83))
* bump zwave-js@8.11.4 ([#2245](https://github.com/zwave-js/zwavejs2mqtt/issues/2245)) ([e6f81a9](https://github.com/zwave-js/zwavejs2mqtt/commit/e6f81a94b83fe218305bec2c6e96808bc3c5c1a1))

# [6.5.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.4.1...v6.5.0) (2022-01-31)


### Bug Fixes

* **ui:** name and location validation ([c0eb937](https://github.com/zwave-js/zwavejs2mqtt/commit/c0eb93705f61e71afd1ee2bd2a158296683fa87e))
* **ui:** skip node name/loc validation when mqtt is disabled ([e6d0435](https://github.com/zwave-js/zwavejs2mqtt/commit/e6d043543732fa94b4fbd67781d53fbea6dc6e0b))
* prevent replaceFailed resetting node name/loc ([f8a4b12](https://github.com/zwave-js/zwavejs2mqtt/commit/f8a4b1263ba311f71dc6ed2a9cd070e6151537db))


### Features

* implement health reporting ([#2205](https://github.com/zwave-js/zwavejs2mqtt/issues/2205)) ([4ca3403](https://github.com/zwave-js/zwavejs2mqtt/commit/4ca34032cfbe67cbc71bf1e327ac7f6a194886a3)), closes [#2113](https://github.com/zwave-js/zwavejs2mqtt/issues/2113)
* **ui:** move inclusion information to separete tab ([#2198](https://github.com/zwave-js/zwavejs2mqtt/issues/2198)) ([3c34e42](https://github.com/zwave-js/zwavejs2mqtt/commit/3c34e4277571ac7349029872270a08560bf09a67))

## [6.4.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.4.0...v6.4.1) (2022-01-18)


### Features

* bump zwave-js@8.11.1 ([#2193](https://github.com/zwave-js/zwavejs2mqtt/issues/2193)) ([d1332ea](https://github.com/zwave-js/zwavejs2mqtt/commit/d1332ea5bc94a78a7b6df931dee82f6858707b4d))
* set node name and location before inclusion and keep `nodes.json` up to date ([#2194](https://github.com/zwave-js/zwavejs2mqtt/issues/2194)) ([e15bcea](https://github.com/zwave-js/zwavejs2mqtt/commit/e15bcea1af3c614ea79fb886f9ab12df8c54c57a))

# [6.4.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.3.1...v6.4.0) (2022-01-14)


### Bug Fixes

* **ui:** hidden custom configuration ([ab5a488](https://github.com/zwave-js/zwavejs2mqtt/commit/ab5a488cef4f2428c5409f5b283d6734e968a6e5)), closes [#2175](https://github.com/zwave-js/zwavejs2mqtt/issues/2175)


### Features

* allow to override zwavejs log dir using `ZWAVEJS_LOG_DIR` env var ([#2174](https://github.com/zwave-js/zwavejs2mqtt/issues/2174)) ([d46e08e](https://github.com/zwave-js/zwavejs2mqtt/commit/d46e08eec09a6ee488cdd5a9f650c2ff660fc7fd))
* bump zwave-js@8.11.0 ([#2184](https://github.com/zwave-js/zwavejs2mqtt/issues/2184)) ([038229d](https://github.com/zwave-js/zwavejs2mqtt/commit/038229d63ebda25091b3d82ebdc5fc189f67fbc4))

## [6.3.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.3.0...v6.3.1) (2022-01-11)


### Bug Fixes

* **ui:** disable security classes not requested ([fce70c6](https://github.com/zwave-js/zwavejs2mqtt/commit/fce70c6a5f960367bc4b7d56ef08497b92677da6))
* **ui:** visualization issue on mobile ([c91708c](https://github.com/zwave-js/zwavejs2mqtt/commit/c91708c0791344967cd5e87e53f1fcfdb3143850))
* ensure node is ready before getting cc version ([#2168](https://github.com/zwave-js/zwavejs2mqtt/issues/2168)) ([835e2e0](https://github.com/zwave-js/zwavejs2mqtt/commit/835e2e06722c2d254a61f4cda7af4248feb63254)), closes [#2162](https://github.com/zwave-js/zwavejs2mqtt/issues/2162)


### Features

* bump zwave-js@8.10.2 ([#2171](https://github.com/zwave-js/zwavejs2mqtt/issues/2171)) ([8f17387](https://github.com/zwave-js/zwavejs2mqtt/commit/8f17387b9a44ba8155b47ba95196f8ffeb81369f))
* **ui:** show node metadata ([cff2059](https://github.com/zwave-js/zwavejs2mqtt/commit/cff205943d0c01af1069334a7cb96aa970c41a95))
* bump @zwave-js/server@1.14.1 ([#2167](https://github.com/zwave-js/zwavejs2mqtt/issues/2167)) ([2a3e0d4](https://github.com/zwave-js/zwavejs2mqtt/commit/2a3e0d4308b2376364c750b609bbcfdcd0eadb32))

# [6.3.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.2.0...v6.3.0) (2022-01-10)


### Bug Fixes

* restart driver after hard reset ([#2160](https://github.com/zwave-js/zwavejs2mqtt/issues/2160)) ([deac2b8](https://github.com/zwave-js/zwavejs2mqtt/commit/deac2b89ce0dc8d745dce3438b1d84c1ad3c5e4b)), closes [#2141](https://github.com/zwave-js/zwavejs2mqtt/issues/2141)
* **hass:** barrier State needs value_template ([#2148](https://github.com/zwave-js/zwavejs2mqtt/issues/2148)) ([dae3761](https://github.com/zwave-js/zwavejs2mqtt/commit/dae37613dcf5fa23547db44a2c4cc41255e7b5ae))
* **ui:** drop `failed` column ([#2134](https://github.com/zwave-js/zwavejs2mqtt/issues/2134)) ([bd8c933](https://github.com/zwave-js/zwavejs2mqtt/commit/bd8c933010ccd0e9c39d7392984c386ff25deaa7)), closes [#2130](https://github.com/zwave-js/zwavejs2mqtt/issues/2130)
* add missing NVM convert progress callback ([b849be9](https://github.com/zwave-js/zwavejs2mqtt/commit/b849be9f775fb204e266e35cedb552e8fa60eee2))
* **ui:** move firmware update to fw version column ([fb59d33](https://github.com/zwave-js/zwavejs2mqtt/commit/fb59d334b38bfe31f9e225de4237f19d87b53104))
* add missing origin to call api result ([5c8a1c0](https://github.com/zwave-js/zwavejs2mqtt/commit/5c8a1c0a48469a964feab9a1a33f28e3e8ced305)), closes [#278](https://github.com/zwave-js/zwavejs2mqtt/issues/278)
* **hass:** thermostat mode mapping ([#2109](https://github.com/zwave-js/zwavejs2mqtt/issues/2109)) ([9b23c1f](https://github.com/zwave-js/zwavejs2mqtt/commit/9b23c1f6139bbd7a34b7be76b004e62f03a12123))


### Features

* **ui:** add cc version ([#2158](https://github.com/zwave-js/zwavejs2mqtt/issues/2158)) ([83c4e42](https://github.com/zwave-js/zwavejs2mqtt/commit/83c4e42b365a2631b7e5484f9a0dadc79b14f981)), closes [#2147](https://github.com/zwave-js/zwavejs2mqtt/issues/2147)
* bump @zwave-js/server@1.14.0 ([#2098](https://github.com/zwave-js/zwavejs2mqtt/issues/2098)) ([814820a](https://github.com/zwave-js/zwavejs2mqtt/commit/814820a6311682c2f88d4cf6a08fad31a6d9a548))
* bump zwave-js@8.10.1 ([#2155](https://github.com/zwave-js/zwavejs2mqtt/issues/2155)) ([5c99018](https://github.com/zwave-js/zwavejs2mqtt/commit/5c99018191a5149c5079d3c273b67a5958774504))
* use new `restoreNVM` API to restore NVM backups ([#2120](https://github.com/zwave-js/zwavejs2mqtt/issues/2120)) ([18b49ea](https://github.com/zwave-js/zwavejs2mqtt/commit/18b49ea00c655b4031678b849ca74ac287dbc20d)), closes [#2119](https://github.com/zwave-js/zwavejs2mqtt/issues/2119)
* **ui:** visualize running firmware updates ([#2117](https://github.com/zwave-js/zwavejs2mqtt/issues/2117)) ([6238696](https://github.com/zwave-js/zwavejs2mqtt/commit/62386961a0d255541e119899350fbc903a7042eb)), closes [#2110](https://github.com/zwave-js/zwavejs2mqtt/issues/2110)
* bump zwave-js@8.9.2 ([#2112](https://github.com/zwave-js/zwavejs2mqtt/issues/2112)) ([202f9c4](https://github.com/zwave-js/zwavejs2mqtt/commit/202f9c44de3e7a36a504c16b8d4cc1d478890d05))

# [6.2.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.1.1...v6.2.0) (2021-12-23)


### Bug Fixes

* set zwave logs enabled by default ([#2092](https://github.com/zwave-js/zwavejs2mqtt/issues/2092)) ([4eb9726](https://github.com/zwave-js/zwavejs2mqtt/commit/4eb9726c270ae665c0cbf8459c0c5d7b5d12a62e))
* **ui:** battery and main icons ([c361667](https://github.com/zwave-js/zwavejs2mqtt/commit/c36166733a2b4551ab2b9fe4017e824eb2378a22))
* **ui:** use monospace in debug ([8caf502](https://github.com/zwave-js/zwavejs2mqtt/commit/8caf50269e6cb7eef4de31d760146da76f1ba68c))
* use `isListening` node prop to distinguish battery from mains ([22a3620](https://github.com/zwave-js/zwavejs2mqtt/commit/22a3620bfa761483edc3b485ac794a4298516c6a)), closes [#2071](https://github.com/zwave-js/zwavejs2mqtt/issues/2071)


### Features

* bump zwave-js@8.9.1 ([#2088](https://github.com/zwave-js/zwavejs2mqtt/issues/2088)) ([8720457](https://github.com/zwave-js/zwavejs2mqtt/commit/87204573c6c20bf46cb69cb7617b3a0871da06ca))
* **ui:** add active indicator with statistics tooltip ([#2083](https://github.com/zwave-js/zwavejs2mqtt/issues/2083)) ([e82be01](https://github.com/zwave-js/zwavejs2mqtt/commit/e82be01cb657f0dcefe56b973afdf284e8cad1e2))
* bump zw3ave-js@8.9.0-beta.2 ([80064b3](https://github.com/zwave-js/zwavejs2mqtt/commit/80064b3e0095e05f8aad10b6733b10057de19757))
* bump zwave-js@8.9.0-beta.3 ([3e06a81](https://github.com/zwave-js/zwavejs2mqtt/commit/3e06a8116ee3fc77f6fc822954f891aef0426e17))
* show driver errors on UI and prevent restart when zwave options are not valid ([#2069](https://github.com/zwave-js/zwavejs2mqtt/issues/2069)) ([e1e3172](https://github.com/zwave-js/zwavejs2mqtt/commit/e1e317205061a66c7c84a79e11776c53a9b13117))

## [6.1.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.1.0...v6.1.1) (2021-12-16)


### Features

* bump zwave-js@8.9.0-beta.1 ([4684356](https://github.com/zwave-js/zwavejs2mqtt/commit/4684356fe4419319bde22ea962baf96617e6ca8f))
* support for refreshInfo options ([1570667](https://github.com/zwave-js/zwavejs2mqtt/commit/15706676f5a598a5d308d1f55c41ea32c7d56447))

* fix(ui): always show Configuration CC (22aacb3)
* feat: bump zwave-js@8.9.0-beta.0 (#2031) (7ea362a)
* docs: fix lint (b0a1aa4)
* docs: added Domoticz as application using the MQTT Discover function. (#2019) (6588c89)

## [6.0.3](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.0.2...v6.0.3) (2021-12-03)


### Bug Fixes

* endpointGroups is not iterable and other possible null pointer errors ([6886825](https://github.com/zwave-js/zwavejs2mqtt/commit/68868255ec5d8d3c12d4de543a2c2596856607e3)), closes [#2012](https://github.com/zwave-js/zwavejs2mqtt/issues/2012)
* **ui:** typo in dialog ([#2001](https://github.com/zwave-js/zwavejs2mqtt/issues/2001)) ([0255fdc](https://github.com/zwave-js/zwavejs2mqtt/commit/0255fdc16bdeed58b68b92f89a2028bf90dc8058))


### Features

* bump @zwave-js/server@1.13.0 ([#2013](https://github.com/zwave-js/zwavejs2mqtt/issues/2013)) ([c0d14e1](https://github.com/zwave-js/zwavejs2mqtt/commit/c0d14e14ebdc92282827e4acad1776f1903eb615))
* bump zwave-js@8.8.3 ([#2016](https://github.com/zwave-js/zwavejs2mqtt/issues/2016)) ([9190839](https://github.com/zwave-js/zwavejs2mqtt/commit/91908396a68a4a0379c24327efd764057f5aa0f6))

## [6.0.2](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.0.1...v6.0.2) (2021-11-26)


### Features

* bump zwave-js@8.8.2 ([#1998](https://github.com/zwave-js/zwavejs2mqtt/issues/1998)) ([c6719ca](https://github.com/zwave-js/zwavejs2mqtt/commit/c6719ca853a2416714dac1adb2c10fca429e24e1))

## [6.0.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.0.0...v6.0.1) (2021-11-25)


### Features

* bump zwave-js@8.8.1 ([#1993](https://github.com/zwave-js/zwavejs2mqtt/issues/1993)) ([6a62b63](https://github.com/zwave-js/zwavejs2mqtt/commit/6a62b63849378397ff8458e9ac5d6fd039ee3412))

# [6.0.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.12.0...v6.0.0) (2021-11-25)


### Bug Fixes

* **ui:** spelling of Unauthenticated ([#1984](https://github.com/zwave-js/zwavejs2mqtt/issues/1984)) ([6cad38a](https://github.com/zwave-js/zwavejs2mqtt/commit/6cad38afdbfef310b4590f88d7d9a63b051bb113))
* hide some columns for controller node ([11099eb](https://github.com/zwave-js/zwavejs2mqtt/commit/11099eba3678be69a883fe52266661062ed43767)), closes [#1886](https://github.com/zwave-js/zwavejs2mqtt/issues/1886)
* https log ([af8009a](https://github.com/zwave-js/zwavejs2mqtt/commit/af8009aac6c3f47c7f20ca15ff9e068d1259e025))
* value not updating after set ([#1972](https://github.com/zwave-js/zwavejs2mqtt/issues/1972)) ([035975a](https://github.com/zwave-js/zwavejs2mqtt/commit/035975a83ec2a856c8ce49052eaa3d8b973ad360)), closes [#1971](https://github.com/zwave-js/zwavejs2mqtt/issues/1971)


### Features

* bump @zwave-js/server@1.12.0 ([#1987](https://github.com/zwave-js/zwavejs2mqtt/issues/1987)) ([5057281](https://github.com/zwave-js/zwavejs2mqtt/commit/50572817c456f0c08c9d47b6c9d8a2ae11dd2b22))
* bump zwave-js@8.7.7 ([#1974](https://github.com/zwave-js/zwavejs2mqtt/issues/1974)) ([95a419e](https://github.com/zwave-js/zwavejs2mqtt/commit/95a419e03c289abf1fe32ec9511d6f456b9cc188))
* bump zwave-js@8.8.0 ([#1991](https://github.com/zwave-js/zwavejs2mqtt/issues/1991)) ([913ea34](https://github.com/zwave-js/zwavejs2mqtt/commit/913ea344eb7d5aa356821a03da78dc89df3cf1f6))
* optimize socket events and mqtt disabled events ([#1970](https://github.com/zwave-js/zwavejs2mqtt/issues/1970)) ([b18067a](https://github.com/zwave-js/zwavejs2mqtt/commit/b18067abf095b12f6262b673210fc469c1f87362))


### BREAKING CHANGES

* Socket events names and content havee changed

* fix: handling of node props updates

* fix: ensure node id is always present in node updated event

* fix: add missing status event and typo

* fix: hass devices updates

* fix: make hass discovery happen only on node inited

* fix: use value written event

* fix: rename some methods

* fix: add check mqtt disabled in node inited

# [5.12.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.11.0...v5.12.0) (2021-11-16)


### Bug Fixes

* **ui:** provisioning info lost when editing an entry ([#1954](https://github.com/zwave-js/zwavejs2mqtt/issues/1954)) ([1fd057f](https://github.com/zwave-js/zwavejs2mqtt/commit/1fd057f2cab079149185e55a93bb9680dd51eab9)), closes [#1938](https://github.com/zwave-js/zwavejs2mqtt/issues/1938)
* correctly set node name and location when present on provisioning ([#1953](https://github.com/zwave-js/zwavejs2mqtt/issues/1953)) ([9459a56](https://github.com/zwave-js/zwavejs2mqtt/commit/9459a56f364028d6f18077b40b17165292120459)), closes [#1943](https://github.com/zwave-js/zwavejs2mqtt/issues/1943)


### Features

* add HTTPS setting and Qr improvements ([#1956](https://github.com/zwave-js/zwavejs2mqtt/issues/1956)) ([8efa99e](https://github.com/zwave-js/zwavejs2mqtt/commit/8efa99e366f6877f7cd1088e609b16f7a4f86e98))
* allow SSL key to be specified via env var ([#1940](https://github.com/zwave-js/zwavejs2mqtt/issues/1940)) ([f7bae9f](https://github.com/zwave-js/zwavejs2mqtt/commit/f7bae9ff063593c71d0c068b352d4c371ac95688))
* bump @zwave-js/server@1.11.0 ([#1965](https://github.com/zwave-js/zwavejs2mqtt/issues/1965)) ([f66204e](https://github.com/zwave-js/zwavejs2mqtt/commit/f66204eabe1a03c101cb92cbd78430e20ebb7840))
* bump zwave-js@8.7.6 ([#1964](https://github.com/zwave-js/zwavejs2mqtt/issues/1964)) ([ee50f1c](https://github.com/zwave-js/zwavejs2mqtt/commit/ee50f1c3002c6c227a1db1be0c11a56cec3df9f6))

# [5.11.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.10.1...v5.11.0) (2021-11-05)


### Bug Fixes

* **mqtt:** disable persistent mqtt storage that could prevent mqtt message to be published ([97af78b](https://github.com/zwave-js/zwavejs2mqtt/commit/97af78bf7cc974ef0051c871693daaf54687ce74))
* **ui:** correct zwavePlus column icon/toooltip ([#1899](https://github.com/zwave-js/zwavejs2mqtt/issues/1899)) ([3888984](https://github.com/zwave-js/zwavejs2mqtt/commit/388898439bd34aca2a7ff50369cbd5a8d4dbc4fb)), closes [#1885](https://github.com/zwave-js/zwavejs2mqtt/issues/1885)
* **ui:** fix typo on add/remove dialog ([#1924](https://github.com/zwave-js/zwavejs2mqtt/issues/1924)) ([dfe9f54](https://github.com/zwave-js/zwavejs2mqtt/commit/dfe9f547aa6bf46d10b1667fbd35bd1760d20764))
* **ui:** make provisioning list table full width ([cee836f](https://github.com/zwave-js/zwavejs2mqtt/commit/cee836fb2a58a5319ccdcb0afb26252d20f55763))
* **ui:** missing security keys check ([#1898](https://github.com/zwave-js/zwavejs2mqtt/issues/1898)) ([520d8fb](https://github.com/zwave-js/zwavejs2mqtt/commit/520d8fb794fb5271019bb09136b3aa854ee8736b)), closes [#1896](https://github.com/zwave-js/zwavejs2mqtt/issues/1896)


### Features

* add node added dialog and fix replace node ([#1926](https://github.com/zwave-js/zwavejs2mqtt/issues/1926)) ([22d9ba5](https://github.com/zwave-js/zwavejs2mqtt/commit/22d9ba5548a88ce97d21ada024bdeb4f7c8e5145))
* bump @zwave-js/server@1.10.8 ([#1932](https://github.com/zwave-js/zwavejs2mqtt/issues/1932)) ([9029996](https://github.com/zwave-js/zwavejs2mqtt/commit/90299964110f6c5390eb28ddce59fb4204806641))
* smart start ([#1922](https://github.com/zwave-js/zwavejs2mqtt/issues/1922)) ([8fb0269](https://github.com/zwave-js/zwavejs2mqtt/commit/8fb026996c1e84d5789bd26aae6807b2be885c48)), closes [#1895](https://github.com/zwave-js/zwavejs2mqtt/issues/1895) [#1916](https://github.com/zwave-js/zwavejs2mqtt/issues/1916)
* **ui:** use theme color for icon in table ([#1906](https://github.com/zwave-js/zwavejs2mqtt/issues/1906)) ([98131db](https://github.com/zwave-js/zwavejs2mqtt/commit/98131db9abf59fee1ac1cd813af7e6a989857cfc))

## [5.10.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.10.0...v5.10.1) (2021-10-26)


### Bug Fixes

* wrong security description in table ([#1888](https://github.com/zwave-js/zwavejs2mqtt/issues/1888)) ([1cc5b17](https://github.com/zwave-js/zwavejs2mqtt/commit/1cc5b17ffd0f441bebccbd1548bb7109ac0308c1))


### Features

* bump zwave-js@8.6.1 ([#1891](https://github.com/zwave-js/zwavejs2mqtt/issues/1891)) ([bcc9ef4](https://github.com/zwave-js/zwavejs2mqtt/commit/bcc9ef4cf9475e00434593075f0167a453e94bb2))

# [5.10.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.9.0...v5.10.0) (2021-10-25)


### Bug Fixes

* **mqtt:** try closing client graceflly and fix level store ([#1879](https://github.com/zwave-js/zwavejs2mqtt/issues/1879)) ([12b5b3f](https://github.com/zwave-js/zwavejs2mqtt/commit/12b5b3f7db9d95ce67323882ef4970376636a16f))
* alter softReset language to reflect new default ([#1850](https://github.com/zwave-js/zwavejs2mqtt/issues/1850)) ([b60d2c7](https://github.com/zwave-js/zwavejs2mqtt/commit/b60d2c74368d4ef09ff26dec543069c97f4c5aaf))
* docker contrib ([#1841](https://github.com/zwave-js/zwavejs2mqtt/issues/1841)) ([d8a1b0d](https://github.com/zwave-js/zwavejs2mqtt/commit/d8a1b0d336eb1639a242bf4bddc31a39b2f29383))
* make `enableSoftReset` option enabled by default ([#1864](https://github.com/zwave-js/zwavejs2mqtt/issues/1864)) ([8839162](https://github.com/zwave-js/zwavejs2mqtt/commit/8839162c055a31c97b2b363d65d58a74b9d4ce4c))
* race condition with node.batteryLevels ([#1845](https://github.com/zwave-js/zwavejs2mqtt/issues/1845)) ([63d8193](https://github.com/zwave-js/zwavejs2mqtt/commit/63d819349525ecedb77ef55573bc6a12c7ab2a39))


### Features

* bump zwave-js@8.5.1 ([bb962bb](https://github.com/zwave-js/zwavejs2mqtt/commit/bb962bbb5aeef74566f215690f82f0405eff7d7b))
* bump zwave-js@8.6.0 ([#1878](https://github.com/zwave-js/zwavejs2mqtt/issues/1878)) ([053f8e8](https://github.com/zwave-js/zwavejs2mqtt/commit/053f8e8d370460e794fdd1dedd2e3e5d7a1d421c))
* icons for status + color for interview stage ([#1846](https://github.com/zwave-js/zwavejs2mqtt/issues/1846)) ([85b70bb](https://github.com/zwave-js/zwavejs2mqtt/commit/85b70bb3013ab66f2e553bb7a2fdede559c48b3b))
* implement `softReset` ([#1844](https://github.com/zwave-js/zwavejs2mqtt/issues/1844)) ([03eaaf7](https://github.com/zwave-js/zwavejs2mqtt/commit/03eaaf7a5c15d378a01203a80be62d0d7a8e7051))
* support nodes with multiple batteries + more icons in table (rich values) ([#1777](https://github.com/zwave-js/zwavejs2mqtt/issues/1777)) ([aa80130](https://github.com/zwave-js/zwavejs2mqtt/commit/aa801308b4f30a55669196dfcc2edb7d9ee5e9a1))

# [5.9.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.8.0...v5.9.0) (2021-10-14)


### Bug Fixes

* mqtt store ([#1833](https://github.com/zwave-js/zwavejs2mqtt/issues/1833)) ([fb1fb32](https://github.com/zwave-js/zwavejs2mqtt/commit/fb1fb3212d0080d7b4946822ae4b1af89cf8226a))
* **ui:** remove useless functions from utils ([3d9099d](https://github.com/zwave-js/zwavejs2mqtt/commit/3d9099d0e840f7d08b17eb44034e616732bcdaa9))
* prevent multiple restarts when driver fails to initialize ([a89ef13](https://github.com/zwave-js/zwavejs2mqtt/commit/a89ef1359d268fe315444507d3b598e9a752a56a))
* **ui:** combobox settings not saved correctly when pasting ([17f518a](https://github.com/zwave-js/zwavejs2mqtt/commit/17f518a02b873a9dedf27baeb160321d81a9849c)), closes [#1800](https://github.com/zwave-js/zwavejs2mqtt/issues/1800)
* mode_state_template ([#1826](https://github.com/zwave-js/zwavejs2mqtt/issues/1826)) ([2a57da2](https://github.com/zwave-js/zwavejs2mqtt/commit/2a57da253b50be10d227556133205e0c1585b6d2)), closes [#1803](https://github.com/zwave-js/zwavejs2mqtt/issues/1803)
* **ui:** mesh forward check ([33137ac](https://github.com/zwave-js/zwavejs2mqtt/commit/33137ac94986cce240adc0a23ee9293b791a26aa))
* remove `binary` encoding when creating NVM backup ([f999ecb](https://github.com/zwave-js/zwavejs2mqtt/commit/f999ecbe5f89db0742dd6601e2475dd23a2a3ece))


### Features

* allow to load security keys from env ([#1797](https://github.com/zwave-js/zwavejs2mqtt/issues/1797)) ([fc00320](https://github.com/zwave-js/zwavejs2mqtt/commit/fc00320669a8e1efda83349170d5fdaf3282a447)), closes [#1757](https://github.com/zwave-js/zwavejs2mqtt/issues/1757)
* bump zwave-js@8.5.0 ([#1829](https://github.com/zwave-js/zwavejs2mqtt/issues/1829)) ([7722664](https://github.com/zwave-js/zwavejs2mqtt/commit/77226643e84c67f64e187f086b437109612bd588))
* emit driver ready status to mqtt ([#1838](https://github.com/zwave-js/zwavejs2mqtt/issues/1838)) ([c087212](https://github.com/zwave-js/zwavejs2mqtt/commit/c08721278dfbb783365984e46fbdfdb40b6e9130))

# [5.8.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.7.3...v5.8.0) (2021-10-08)


### Features

* backup/restore NVM ([#1795](https://github.com/zwave-js/zwavejs2mqtt/issues/1795)) ([ac84133](https://github.com/zwave-js/zwavejs2mqtt/commit/ac84133cb3245559da5536e46176f89e449bac02))
* directly download NVM backup file ([e8373a9](https://github.com/zwave-js/zwavejs2mqtt/commit/e8373a91e7af2edd77a80b1468e83ca70467b074))

## [5.7.3](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.7.2...v5.7.3) (2021-10-04)


### Bug Fixes

* ignore ZWAVEJS_EXTERNAL_CONFIG folder ([#1766](https://github.com/zwave-js/zwavejs2mqtt/issues/1766)) ([1b881e0](https://github.com/zwave-js/zwavejs2mqtt/commit/1b881e0a503c7b76ecd8764b6ab086c966c677de)), closes [#1762](https://github.com/zwave-js/zwavejs2mqtt/issues/1762)


### Features

* bump @zwave-js/server@1.10.6 ([#1767](https://github.com/zwave-js/zwavejs2mqtt/issues/1767)) ([18977cc](https://github.com/zwave-js/zwavejs2mqtt/commit/18977cc2c17f9fdad4a7d8c24bc8bed236c3648b))

## [5.7.2](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.7.1...v5.7.2) (2021-09-29)


### Bug Fixes

* correctly parse valueMetadata `states` when not defined ([4e8f61b](https://github.com/zwave-js/zwavejs2mqtt/commit/4e8f61b8fab58f6e42fe3f896783196d89a99502)), closes [#1758](https://github.com/zwave-js/zwavejs2mqtt/issues/1758)


### Features

* bump zwave-js@8.4.1 ([#1759](https://github.com/zwave-js/zwavejs2mqtt/issues/1759)) ([831dc93](https://github.com/zwave-js/zwavejs2mqtt/commit/831dc93b2f81d52d3f09ba15ed902f3e4129e890))

## [5.7.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.7.0...v5.7.1) (2021-09-27)


### Features

* add `DISABLE_LOG_ROTATION` env var to disable log rotation ([#1755](https://github.com/zwave-js/zwavejs2mqtt/issues/1755)) ([29f8f29](https://github.com/zwave-js/zwavejs2mqtt/commit/29f8f29f84ae546ca08dfa1b373bbddfb4186802))

# [5.7.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.6.2...v5.7.0) (2021-09-27)


### Bug Fixes

* **ui:** hide download/save button when file is not supported ([6b7d63e](https://github.com/zwave-js/zwavejs2mqtt/commit/6b7d63ebdf4013e10d9135d7610422616a71b5e8))


### Features

* add `/version` api ([#1747](https://github.com/zwave-js/zwavejs2mqtt/issues/1747)) ([532ba69](https://github.com/zwave-js/zwavejs2mqtt/commit/532ba6956fdcd06445ff4b5b2d4c3710f2be6982))
* bump @zwave-js/server@1.10.5 ([#1744](https://github.com/zwave-js/zwavejs2mqtt/issues/1744)) ([15ca748](https://github.com/zwave-js/zwavejs2mqtt/commit/15ca748d866da379f38e129684be8131083529e3))
* bump zwave-js@8.4.0 ([#1743](https://github.com/zwave-js/zwavejs2mqtt/issues/1743)) ([b8829ed](https://github.com/zwave-js/zwavejs2mqtt/commit/b8829ed6f08a79bd1219b3e7c9c8f69082eead5f))
* improve docs and references ([#1667](https://github.com/zwave-js/zwavejs2mqtt/issues/1667)) ([fd04689](https://github.com/zwave-js/zwavejs2mqtt/commit/fd046898b972c724127fd1aab867f8d477f874a6))
* log rotate ([#1746](https://github.com/zwave-js/zwavejs2mqtt/issues/1746)) ([b8f7f52](https://github.com/zwave-js/zwavejs2mqtt/commit/b8f7f52c78a95069244a9ee559c6673422416d6a))

## [5.6.2](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.6.1...v5.6.2) (2021-09-25)


### Bug Fixes

* icons are no longer displayed after css-loader major upgrade ([#1729](https://github.com/zwave-js/zwavejs2mqtt/issues/1729)) ([b38caa2](https://github.com/zwave-js/zwavejs2mqtt/commit/b38caa2437ed6402a0f62f831aa02e51be868b6b))

## [5.6.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.6.0...v5.6.1) (2021-09-24)


### Bug Fixes

* another try to workaround pkg bug ([#1727](https://github.com/zwave-js/zwavejs2mqtt/issues/1727)) ([81a0a7f](https://github.com/zwave-js/zwavejs2mqtt/commit/81a0a7f2af01baf36396229e90b8488cc765002f))
* workaround for pkg bug ([#1726](https://github.com/zwave-js/zwavejs2mqtt/issues/1726)) ([7d0bd6c](https://github.com/zwave-js/zwavejs2mqtt/commit/7d0bd6c23c46a46300d97d894e27d20f2acdf64d))
* **ui:** better check for forwarding nodes in mesh graph ([e5cf151](https://github.com/zwave-js/zwavejs2mqtt/commit/e5cf1515903adf3d4c6374e86efebe5509d0bf26))


### Features

* bump @zwave-js/server@1.10.4 ([#1714](https://github.com/zwave-js/zwavejs2mqtt/issues/1714)) ([176017d](https://github.com/zwave-js/zwavejs2mqtt/commit/176017df232ac21c6f43aa6e8e99ae147f1f796b))
* **ui:** show power source + battery level in nodes table ([#1675](https://github.com/zwave-js/zwavejs2mqtt/issues/1675)) ([713815d](https://github.com/zwave-js/zwavejs2mqtt/commit/713815da3711179e218171922f7adc84df9b77c0))

# [5.6.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.5.4...v5.6.0) (2021-09-15)


### Bug Fixes

* **ui:** make manage nodes dialog persistent and timoeut label ([#1688](https://github.com/zwave-js/zwavejs2mqtt/issues/1688)) ([75728a8](https://github.com/zwave-js/zwavejs2mqtt/commit/75728a8e9e22a72174013a2ca96194cd8f3e95b8))


### Features

* add `deviceConfigPriorityDir` zwave setting ([#1694](https://github.com/zwave-js/zwavejs2mqtt/issues/1694)) ([0d2c8bc](https://github.com/zwave-js/zwavejs2mqtt/commit/0d2c8bc7a47cb39f2fbc0fcd2713fa3d662575ca)), closes [#1686](https://github.com/zwave-js/zwavejs2mqtt/issues/1686)
* bump zwave-js@8.3.0 ([#1695](https://github.com/zwave-js/zwavejs2mqtt/issues/1695)) ([0a6a814](https://github.com/zwave-js/zwavejs2mqtt/commit/0a6a814699f3ea648c20d8d1679ab9c932d4d18c))
* bump zwave-js@8.3.1 ([#1696](https://github.com/zwave-js/zwavejs2mqtt/issues/1696)) ([d8eb97f](https://github.com/zwave-js/zwavejs2mqtt/commit/d8eb97f25533d3197499db82c7eb5e5c7de19fc0))
* **ui:** auto-format OZW keys when pasted into security keys ([#1685](https://github.com/zwave-js/zwavejs2mqtt/issues/1685)) ([8dea0da](https://github.com/zwave-js/zwavejs2mqtt/commit/8dea0da3ab08a076d8403ef1fb63919fe1e190ee))
* **ui:** show warning when security keys are missing ([39c40c8](https://github.com/zwave-js/zwavejs2mqtt/commit/39c40c8eab684cb20f3903eb4713438f3be5c8cf)), closes [#1687](https://github.com/zwave-js/zwavejs2mqtt/issues/1687)


### Reverts

* Revert "Release 5.6.0" ([21294f2](https://github.com/zwave-js/zwavejs2mqtt/commit/21294f27386346a7d82ac0320ee5de1cb38f9312))

## [5.5.4](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.5.3...v5.5.4) (2021-09-10)


### Bug Fixes

* better topic subscribe handling ([#1671](https://github.com/zwave-js/zwavejs2mqtt/issues/1671)) ([c27611e](https://github.com/zwave-js/zwavejs2mqtt/commit/c27611e4a76372a5e5369be9222711c79cfd87f9))
* user friendly firmware update errors ([c461f62](https://github.com/zwave-js/zwavejs2mqtt/commit/c461f62ee844a429b0225e18a33be4a7de10007a))


### Features

* **ui:** add links to docs in settings ([7fdfff4](https://github.com/zwave-js/zwavejs2mqtt/commit/7fdfff46f25511c1647e2616a193be3ed240f842))
* bump zwave-js@8.2.3 ([#1666](https://github.com/zwave-js/zwavejs2mqtt/issues/1666)) ([2341ea3](https://github.com/zwave-js/zwavejs2mqtt/commit/2341ea36ac6d2253d57367d47f0ead85ee6a32a7))

## [5.5.3](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.5.2...v5.5.3) (2021-09-03)


### Features

* **ui:** support for S0 only inclusion ([48deb0b](https://github.com/zwave-js/zwavejs2mqtt/commit/48deb0b3e7014d1522cc09fbcefc85f68ee11826)), closes [#1645](https://github.com/zwave-js/zwavejs2mqtt/issues/1645)
* bump zwave-js@8.2.2 ([#1644](https://github.com/zwave-js/zwavejs2mqtt/issues/1644)) ([16eb6fe](https://github.com/zwave-js/zwavejs2mqtt/commit/16eb6fe497b2880c0fa8a6978cb91ef4be38f007))

## [5.5.2](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.5.1...v5.5.2) (2021-08-30)


### Bug Fixes

* **ui:** dsk pin display error on small screens ([1398394](https://github.com/zwave-js/zwavejs2mqtt/commit/139839413403f304f0dd9637fc716713fe6476a6)), closes [#1417](https://github.com/zwave-js/zwavejs2mqtt/issues/1417)


### Features

* bump @zwave-js/server@1.10.3 ([#1631](https://github.com/zwave-js/zwavejs2mqtt/issues/1631)) ([d3e25b1](https://github.com/zwave-js/zwavejs2mqtt/commit/d3e25b141c21dbb7c085028357341c5204e69f08))
* **ui:** add `firmwareVersion` to nodes table ([b45c396](https://github.com/zwave-js/zwavejs2mqtt/commit/b45c396172df688d5da6d7a230c084334a4d8b14))
* bump @zwave-js/server@1.10.2 ([#1598](https://github.com/zwave-js/zwavejs2mqtt/issues/1598)) ([9a3a914](https://github.com/zwave-js/zwavejs2mqtt/commit/9a3a9145e846e5a1bf708abda6190d39f62763dc))

## [5.5.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.5.0...v5.5.1) (2021-08-25)


### Features

* zwave-js@8.2.1 ([6e6a74e](https://github.com/zwave-js/zwavejs2mqtt/commit/6e6a74ec7986b126218be547e3fa088ebc0b8e3a))

# [5.5.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.4.6...v5.5.0) (2021-08-25)


### Bug Fixes

* move lookup to manufacturer prop ([94b5101](https://github.com/zwave-js/zwavejs2mqtt/commit/94b510164deb7e816a9be03896a6c63fa5742fba))
* **ui:** handle replaceFailedNode errors ([22a5f1d](https://github.com/zwave-js/zwavejs2mqtt/commit/22a5f1d32ee55a7b937f3ea02bfae9758164c6cc))
* lookup manufacturer when unknown ([b436c4c](https://github.com/zwave-js/zwavejs2mqtt/commit/b436c4c4b1f60a360392bdd2f58416b757db57b0)), closes [#1571](https://github.com/zwave-js/zwavejs2mqtt/issues/1571)
* **hass:** mode_state_template quotes ([1e47d90](https://github.com/zwave-js/zwavejs2mqtt/commit/1e47d9058ec23faf0f05c421874c5f5879acfc45)), closes [#1578](https://github.com/zwave-js/zwavejs2mqtt/issues/1578)


### Features

* add `forceSecurity` falg support to Default inclusion strategy ([#1588](https://github.com/zwave-js/zwavejs2mqtt/issues/1588)) ([3c78d43](https://github.com/zwave-js/zwavejs2mqtt/commit/3c78d43000c1b06ecf5e7cd2110427c6259ad448))
* bump zwave-js/server@1.10.0 ([24b7d8d](https://github.com/zwave-js/zwavejs2mqtt/commit/24b7d8d674ce7d0b2c4c973d005f140748913ec9))
* support for S2 inclusion ([#1585](https://github.com/zwave-js/zwavejs2mqtt/issues/1585)) ([f507246](https://github.com/zwave-js/zwavejs2mqtt/commit/f5072469af70876219e3344d1d257af4576611f3))
* zwave-js@8.2.0 and @zwave-js/server@1.10.1 ([d9eed6e](https://github.com/zwave-js/zwavejs2mqtt/commit/d9eed6e0d469211d1ceecbf412067fd2631eb256))

## [5.4.6](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.4.5...v5.4.6) (2021-08-17)


### Bug Fixes

* use different icon for node name/location reset ([0b8e165](https://github.com/zwave-js/zwavejs2mqtt/commit/0b8e165f2e5853a4d5db832594ace696a86ca801)), closes [#1542](https://github.com/zwave-js/zwavejs2mqtt/issues/1542)

## [5.4.5](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.4.4...v5.4.5) (2021-08-05)


### Bug Fixes

* **hass:** discovery of Barrier State CC ([#1538](https://github.com/zwave-js/zwavejs2mqtt/issues/1538)) ([15c870a](https://github.com/zwave-js/zwavejs2mqtt/commit/15c870a6ea082106397be5e15e3fd19147976f1e)), closes [#1363](https://github.com/zwave-js/zwavejs2mqtt/issues/1363)


### Features

* bump zwave-js@8.0.8 ([74a3656](https://github.com/zwave-js/zwavejs2mqtt/commit/74a36566e1d244f8d91da92177a897ff492ce115))

## [5.4.4](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.4.3...v5.4.4) (2021-08-02)


### Bug Fixes

* catch "controller not ready" error in statistics event handler ([#1523](https://github.com/zwave-js/zwavejs2mqtt/issues/1523)) ([d3125c1](https://github.com/zwave-js/zwavejs2mqtt/commit/d3125c1824a0aaa1a8698b1f60f266d42d492b47))


### Features

* zwave-js@8.0.7 ([e0ec7e4](https://github.com/zwave-js/zwavejs2mqtt/commit/e0ec7e4d5cc0474ee75475699ca53ca94a8aaec3))

## [5.4.3](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.4.2...v5.4.3) (2021-07-30)


### Bug Fixes

* **hass:** barrier operator CC MQTT discovery ([#1485](https://github.com/zwave-js/zwavejs2mqtt/issues/1485)) ([45e07a6](https://github.com/zwave-js/zwavejs2mqtt/commit/45e07a620b39532e01d4fbbd9dd771b71f4faf17)), closes [#1363](https://github.com/zwave-js/zwavejs2mqtt/issues/1363)
* **ui:** typo in settings view ([#1483](https://github.com/zwave-js/zwavejs2mqtt/issues/1483)) ([ada0f65](https://github.com/zwave-js/zwavejs2mqtt/commit/ada0f65325966ea3f494513724e1252eaf505d23))
* change the GE/Jasco 14314 to use the fan dimmer hass discovery ([#1476](https://github.com/zwave-js/zwavejs2mqtt/issues/1476)) ([44ba47f](https://github.com/zwave-js/zwavejs2mqtt/commit/44ba47fdb2eaf6b88d7b91513cb7cebfee7be211))


### Features

* add `deviceConfig` to node ([#1482](https://github.com/zwave-js/zwavejs2mqtt/issues/1482)) ([1e6acb3](https://github.com/zwave-js/zwavejs2mqtt/commit/1e6acb3b0058dd77acda55d6e4c64b2610d14674))
* add `MQTT_NAME` env var ([#1481](https://github.com/zwave-js/zwavejs2mqtt/issues/1481)) ([5097a26](https://github.com/zwave-js/zwavejs2mqtt/commit/5097a26284788d8b0e3c8e717a1dc2029a838c9c))
* zwave-js@8.0.6 and zwavejs-server@1.9.2 ([8735cea](https://github.com/zwave-js/zwavejs2mqtt/commit/8735cea14c33069eca01f033ffcaa40793611499))

## [5.4.2](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.4.1...v5.4.2) (2021-07-22)


### Features

* zwave-js@8.0.5 ([55059c5](https://github.com/zwave-js/zwavejs2mqtt/commit/55059c524b180abcd7099e433e26fe71f5eb810b))

## [5.4.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.4.0...v5.4.1) (2021-07-22)


### Features

* zwave-js@8.0.4 ([8c179b9](https://github.com/zwave-js/zwavejs2mqtt/commit/8c179b9efbbba555a0b0392587b922ccecae8158))

# [5.4.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.3.0...v5.4.0) (2021-07-21)


### Bug Fixes

* ensure subscribe to topics ([#1466](https://github.com/zwave-js/zwavejs2mqtt/issues/1466)) ([3cb8130](https://github.com/zwave-js/zwavejs2mqtt/commit/3cb8130207a29d1d2af3aac5f44e23aa99b75727)), closes [#1464](https://github.com/zwave-js/zwavejs2mqtt/issues/1464) [#1322](https://github.com/zwave-js/zwavejs2mqtt/issues/1322)


### Features

* zwave-js@8.0.3 zwave-js-server@1.9.1 ([#1465](https://github.com/zwave-js/zwavejs2mqtt/issues/1465)) ([fd5c40e](https://github.com/zwave-js/zwavejs2mqtt/commit/fd5c40e858d24bb8e69be56da05d1dafac2888c5))

# [5.3.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.2.2...v5.3.0) (2021-07-20)


### Bug Fixes

* **ui:** removed missing debugger ([698958e](https://github.com/zwave-js/zwavejs2mqtt/commit/698958e55413af49f00ad93ec41b9612f7d20743))


### Features

* bump zwave-js@8.0.1 ([#1462](https://github.com/zwave-js/zwavejs2mqtt/issues/1462)) ([8b44175](https://github.com/zwave-js/zwavejs2mqtt/commit/8b44175a7ee61767bbd381c1b4dcd0a0b29bd537))

## [5.2.2](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.2.1...v5.2.2) (2021-07-14)


### Bug Fixes

* **hass:** revert [#1360](https://github.com/zwave-js/zwavejs2mqtt/issues/1360) "make dimmers turn on to previous brightness" ([#1399](https://github.com/zwave-js/zwavejs2mqtt/issues/1399)) ([1487e1f](https://github.com/zwave-js/zwavejs2mqtt/commit/1487e1f676df8eacd9b018e2940707e2d1a4fa93))


### Features

* **ui:** allow to add volume to setValue options ([#1422](https://github.com/zwave-js/zwavejs2mqtt/issues/1422)) ([1e29034](https://github.com/zwave-js/zwavejs2mqtt/commit/1e29034c996c9ae8d9f7dbea05fdfb887b3ea3c8))
* bump zwave-js@7.12.0 ([a17bae9](https://github.com/zwave-js/zwavejs2mqtt/commit/a17bae9dfed2d951a6a4187808c93116d0cb162a))

## [5.2.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.2.0...v5.2.1) (2021-06-30)


### Bug Fixes

* **ui:** change CAN color ([#1395](https://github.com/zwave-js/zwavejs2mqtt/issues/1395)) ([7e30131](https://github.com/zwave-js/zwavejs2mqtt/commit/7e30131fad5d25cfb2376f9a3108895b1b217d1d))
* check updates after driver is ready ([#1394](https://github.com/zwave-js/zwavejs2mqtt/issues/1394)) ([374d004](https://github.com/zwave-js/zwavejs2mqtt/commit/374d0041c2a5dd3ebba72496c06cee8c7bd1a7da))


### Features

* zwave-js@7.10.1 ([f0e53e4](https://github.com/zwave-js/zwavejs2mqtt/commit/f0e53e4d1d12040a446074767b1c890c0be1d7fe))

# [5.2.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.1.0...v5.2.0) (2021-06-29)


### Bug Fixes

* clear node groups ([#1391](https://github.com/zwave-js/zwavejs2mqtt/issues/1391)) ([cce8e81](https://github.com/zwave-js/zwavejs2mqtt/commit/cce8e8179ac59d61f08772eedae1ab51e9a0d2cf))
* **hass:** add default to central_scene ([#1383](https://github.com/zwave-js/zwavejs2mqtt/issues/1383)) ([a660e22](https://github.com/zwave-js/zwavejs2mqtt/commit/a660e229adf21e7b336eb7dd9432746bbee18a3b)), closes [#1020](https://github.com/zwave-js/zwavejs2mqtt/issues/1020)
* **hass:** remove second arg in default ([71f2285](https://github.com/zwave-js/zwavejs2mqtt/commit/71f228530bf153fedb616197c085fa40a0c91255))
* send heal node status when healing single node ([#1377](https://github.com/zwave-js/zwavejs2mqtt/issues/1377)) ([23daffa](https://github.com/zwave-js/zwavejs2mqtt/commit/23daffae2940a22f097339697f63e27187fcb90e)), closes [#1375](https://github.com/zwave-js/zwavejs2mqtt/issues/1375)
* sending 'start' or 'stop' MultilevelSwitchCC not working ([#1379](https://github.com/zwave-js/zwavejs2mqtt/issues/1379)) ([5c5dbdc](https://github.com/zwave-js/zwavejs2mqtt/commit/5c5dbdccab5e6517a3b936a5844d544c0b358194)), closes [#1372](https://github.com/zwave-js/zwavejs2mqtt/issues/1372)


### Features

* controller statistics ([#1393](https://github.com/zwave-js/zwavejs2mqtt/issues/1393)) ([f5bf037](https://github.com/zwave-js/zwavejs2mqtt/commit/f5bf037dcb3b4d69c103456f8d94852eba995351)), closes [#1376](https://github.com/zwave-js/zwavejs2mqtt/issues/1376)
* **ui:** broadcast refresh node info ([#1392](https://github.com/zwave-js/zwavejs2mqtt/issues/1392)) ([21a50a2](https://github.com/zwave-js/zwavejs2mqtt/commit/21a50a284dcb2b0c6d42fe58ab29fcd668ceb165))
* bump zwave-js 7.10.0 and zwave-js/server 1.8.0 ([cfb0760](https://github.com/zwave-js/zwavejs2mqtt/commit/cfb0760752f6d9b26cdeaa367e88ba47c29507fd))

# [5.1.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.0.4...v5.1.0) (2021-06-24)


### Bug Fixes

* **hass:** make dimmers turn on to previous brightness ([#1360](https://github.com/zwave-js/zwavejs2mqtt/issues/1360)) ([d7a3845](https://github.com/zwave-js/zwavejs2mqtt/commit/d7a3845c799e2c3d59d6159afff7376baf5fe803))
* add Z2MClientStatus type ([#1357](https://github.com/zwave-js/zwavejs2mqtt/issues/1357)) ([ee4343f](https://github.com/zwave-js/zwavejs2mqtt/commit/ee4343f17dca3f7b01ceee77ae46f9879ba2e10e))


### Features

* **ui:** allow to specify `setValue` options ([#1373](https://github.com/zwave-js/zwavejs2mqtt/issues/1373)) ([ff875e3](https://github.com/zwave-js/zwavejs2mqtt/commit/ff875e3926ee82c1607390519ad6630cb97e8f21))
* add option to writeValue api ([#1370](https://github.com/zwave-js/zwavejs2mqtt/issues/1370)) ([7f2d7c2](https://github.com/zwave-js/zwavejs2mqtt/commit/7f2d7c28ca061fc382ccb7a126735bf012a0da85)), closes [#1367](https://github.com/zwave-js/zwavejs2mqtt/issues/1367)
* bump zwave-js@7.8.0 ([e5efe5e](https://github.com/zwave-js/zwavejs2mqtt/commit/e5efe5ea5b29c067b99fa2682b6c04a348070a6a))
* bump zwave-js@7.9.0 ([239f76d](https://github.com/zwave-js/zwavejs2mqtt/commit/239f76d065e83f2eda8bdd6f8bff502ce51c52f4))
* preferred sensor scales ([#1369](https://github.com/zwave-js/zwavejs2mqtt/issues/1369)) ([60918d9](https://github.com/zwave-js/zwavejs2mqtt/commit/60918d975017643753838b9cc498f62cbaccdbca))
* **ui:** zwave plus column ([#1368](https://github.com/zwave-js/zwavejs2mqtt/issues/1368)) ([5ade568](https://github.com/zwave-js/zwavejs2mqtt/commit/5ade56879b235b630a68a3d77b0734acf693ac7e)), closes [#1358](https://github.com/zwave-js/zwavejs2mqtt/issues/1358)

## [5.0.4](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.0.3...v5.0.4) (2021-06-17)

## [5.0.3](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.0.2...v5.0.3) (2021-06-17)


### Bug Fixes

* **hass:** remove state_topic from covers ([#1348](https://github.com/zwave-js/zwavejs2mqtt/issues/1348)) ([d1159c3](https://github.com/zwave-js/zwavejs2mqtt/commit/d1159c3fc5fc72542af69c6cc65dc301fa3deee1)), closes [#1343](https://github.com/zwave-js/zwavejs2mqtt/issues/1343)


### Features

* bump zwave-js@7.7.5 ([fd394d4](https://github.com/zwave-js/zwavejs2mqtt/commit/fd394d481087595d09f59d80f836c978df319cfe))

## [5.0.2](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.0.1...v5.0.2) (2021-06-14)


### Bug Fixes

* entry in hass/devices.ts for cover discovery ([#1336](https://github.com/zwave-js/zwavejs2mqtt/issues/1336)) ([a5b444a](https://github.com/zwave-js/zwavejs2mqtt/commit/a5b444a06afff5077c5434dbd15705d0b60fdb12))
* force allowed apis to be a valid method of ZwaveClient ([#1328](https://github.com/zwave-js/zwavejs2mqtt/issues/1328)) ([16eb768](https://github.com/zwave-js/zwavejs2mqtt/commit/16eb768987bf09dd256d6d70a446556ed0771f37))
* place plugins route before history middleware ([#1339](https://github.com/zwave-js/zwavejs2mqtt/issues/1339)) ([c223331](https://github.com/zwave-js/zwavejs2mqtt/commit/c22333129db66a78fb7152e45b2ebd911a8f0d93))


### Features

* bump zwave-js@7.7.4 ([51cb50c](https://github.com/zwave-js/zwavejs2mqtt/commit/51cb50c201bd26c764c90aa8f1cf5a6d427ec4b4))

## [5.0.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v5.0.0...v5.0.1) (2021-06-11)


### Bug Fixes

* downgrade pkg@4.4.9 ([#1334](https://github.com/zwave-js/zwavejs2mqtt/issues/1334)) ([07568fc](https://github.com/zwave-js/zwavejs2mqtt/commit/07568fcb302431da3ab2030c9f2fd0b2b7258c48)), closes [#1326](https://github.com/zwave-js/zwavejs2mqtt/issues/1326)
* **discovery:** skip discovery of notifications without states ([#1333](https://github.com/zwave-js/zwavejs2mqtt/issues/1333)) ([218256e](https://github.com/zwave-js/zwavejs2mqtt/commit/218256e3306e5d308b8982d2c3cbe6be72699d5b)), closes [#1332](https://github.com/zwave-js/zwavejs2mqtt/issues/1332)
* downngrade to serialport@9.0.7 ([#1329](https://github.com/zwave-js/zwavejs2mqtt/issues/1329)) ([1c863d9](https://github.com/zwave-js/zwavejs2mqtt/commit/1c863d9c6c2dfe36a7c263c7960d5343d289c9a7)), closes [#1324](https://github.com/zwave-js/zwavejs2mqtt/issues/1324)
* **hass:** broken cover discovery ([#1331](https://github.com/zwave-js/zwavejs2mqtt/issues/1331)) ([b9d8ede](https://github.com/zwave-js/zwavejs2mqtt/commit/b9d8ede40767f5e6d0f170a139457c3690a02938)), closes [#1327](https://github.com/zwave-js/zwavejs2mqtt/issues/1327)

# [5.0.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v4.5.2...v5.0.0) (2021-06-10)


### Bug Fixes

* driver ready error and ts improvments ([#1323](https://github.com/zwave-js/zwavejs2mqtt/issues/1323)) ([f5832b9](https://github.com/zwave-js/zwavejs2mqtt/commit/f5832b9a90c9629fad0b9c941d2a7817ef816a6c)), closes [#1309](https://github.com/zwave-js/zwavejs2mqtt/issues/1309)
* plugins router must be recreated on restart ([#1321](https://github.com/zwave-js/zwavejs2mqtt/issues/1321)) ([6d40bdd](https://github.com/zwave-js/zwavejs2mqtt/commit/6d40bddbd2ad4af41423cd3098141189897cec20))
* **ui:** use strict check in toggle button ([#1320](https://github.com/zwave-js/zwavejs2mqtt/issues/1320)) ([130bbd7](https://github.com/zwave-js/zwavejs2mqtt/commit/130bbd770c44512887700aa765f176c7c8a1c4b6)), closes [#1065](https://github.com/zwave-js/zwavejs2mqtt/issues/1065)


### Features

* bump zwave-js@7.7.3 ([4997c2d](https://github.com/zwave-js/zwavejs2mqtt/commit/4997c2d453f3e50cc3a3dfb2e68b9fb7d32bb6fa))

## [4.5.2](https://github.com/zwave-js/zwavejs2mqtt/compare/v4.5.1...v4.5.2) (2021-06-07)


### Bug Fixes

* bump socket.io client and server ([a9d577c](https://github.com/zwave-js/zwavejs2mqtt/commit/a9d577c0459f3be2df25749b9cd8269f8f5d1909)), closes [#1300](https://github.com/zwave-js/zwavejs2mqtt/issues/1300)


### Features

* bump zwave-js@7.7.2 ([3b9d3df](https://github.com/zwave-js/zwavejs2mqtt/commit/3b9d3dfa74de7c352b84108e098bac336308caa8))

## [4.5.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v4.5.0...v4.5.1) (2021-05-31)


### Bug Fixes

* put deviceConfigPriorityDir where it belongs ([#1294](https://github.com/zwave-js/zwavejs2mqtt/issues/1294)) ([e60f7f4](https://github.com/zwave-js/zwavejs2mqtt/commit/e60f7f48c98db3a2544fed7036655d85aaea0537))


### Features

* bump zwave-js@7.7.1 ([a4a043b](https://github.com/zwave-js/zwavejs2mqtt/commit/a4a043b5046a9cf98c742d545c149cc323943cf9))

# [4.5.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v4.4.0...v4.5.0) (2021-05-27)


### Bug Fixes

* don't query neighbors on node ready event ([#1279](https://github.com/zwave-js/zwavejs2mqtt/issues/1279)) ([9a1ab96](https://github.com/zwave-js/zwavejs2mqtt/commit/9a1ab96e86adef551bb8227ca7435024aa8c8b58))
* stop RF when requesting neighbors ([#1283](https://github.com/zwave-js/zwavejs2mqtt/issues/1283)) ([1a35379](https://github.com/zwave-js/zwavejs2mqtt/commit/1a35379bb733abfa1132a9dd894bc70d11b3afdd))


### Features

* add `valueWritten` event to ZwaveClient ([#1268](https://github.com/zwave-js/zwavejs2mqtt/issues/1268)) ([1bb2acf](https://github.com/zwave-js/zwavejs2mqtt/commit/1bb2acf65ee74aad05aa275c01843b8016a71eb6))
* bump zwave-js@7.6.0 and zwave-js/server@1.7.0 ([#1278](https://github.com/zwave-js/zwavejs2mqtt/issues/1278)) ([34a8f57](https://github.com/zwave-js/zwavejs2mqtt/commit/34a8f5701d424b58ff18d10ba32d89e3c8a7839d))
* bump zwave-js@7.7.0 ([5238242](https://github.com/zwave-js/zwavejs2mqtt/commit/5238242de80197a865e5a9646d5d2aa2f7107e0e))
* **ui:** show nodes heal progress ([#1277](https://github.com/zwave-js/zwavejs2mqtt/issues/1277)) ([140136c](https://github.com/zwave-js/zwavejs2mqtt/commit/140136c64e386fba89e8ddf5be362beb59e5ba60)), closes [#993](https://github.com/zwave-js/zwavejs2mqtt/issues/993) [#1274](https://github.com/zwave-js/zwavejs2mqtt/issues/1274)

# [4.4.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v4.3.1...v4.4.0) (2021-05-25)


### Bug Fixes

* change default zwavejs log file name ([#1267](https://github.com/zwave-js/zwavejs2mqtt/issues/1267)) ([1a13e60](https://github.com/zwave-js/zwavejs2mqtt/commit/1a13e601a8b1b8188c583367e43177c85e6b46ea))


### Features

* **ui:** show nodes heal progress ([#1272](https://github.com/zwave-js/zwavejs2mqtt/issues/1272)) ([4356fc0](https://github.com/zwave-js/zwavejs2mqtt/commit/4356fc0b9ed8ec3814590d5dde0ba7a93abdfdc9)), closes [#993](https://github.com/zwave-js/zwavejs2mqtt/issues/993)
* zwave-js 7.5.2 and @zwave-js/server 1.6.0 ([882bd33](https://github.com/zwave-js/zwavejs2mqtt/commit/882bd33a3ed6c717aff9ca105694a4d10d2a5393))

## [4.3.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v4.3.0...v4.3.1) (2021-05-24)


### Bug Fixes

* add `zwaveClient` and `require` to `driverFunction` context ([#1256](https://github.com/zwave-js/zwavejs2mqtt/issues/1256)) ([592e5aa](https://github.com/zwave-js/zwavejs2mqtt/commit/592e5aab7cad040050aacfc78536e3834ec9e5e9))
* better restarts ([#1266](https://github.com/zwave-js/zwavejs2mqtt/issues/1266)) ([70c018b](https://github.com/zwave-js/zwavejs2mqtt/commit/70c018be4024255430bf1a1ed490672dc555a043)), closes [#1246](https://github.com/zwave-js/zwavejs2mqtt/issues/1246)
* detect driver failed and restart ([#1259](https://github.com/zwave-js/zwavejs2mqtt/issues/1259)) ([2ae945e](https://github.com/zwave-js/zwavejs2mqtt/commit/2ae945e18f3b41828082279ce071746cc15ab9cd)), closes [#1246](https://github.com/zwave-js/zwavejs2mqtt/issues/1246)


### Features

* bump zwave-js@7.5.1 ([5bfad71](https://github.com/zwave-js/zwavejs2mqtt/commit/5bfad714e0892936420a02cdc8dc43be1b96064a))
* ping node ([#1255](https://github.com/zwave-js/zwavejs2mqtt/issues/1255)) ([2fc61ef](https://github.com/zwave-js/zwavejs2mqtt/commit/2fc61efc87834ef37d1d1311b4b0be8bf797a15c)), closes [#1253](https://github.com/zwave-js/zwavejs2mqtt/issues/1253)

# [4.3.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v4.2.1...v4.3.0) (2021-05-19)


### Bug Fixes

* **ui:** group editors showing associations of last expanded node ([#1236](https://github.com/zwave-js/zwavejs2mqtt/issues/1236)) ([989bb87](https://github.com/zwave-js/zwavejs2mqtt/commit/989bb87d0c3c7b2a104680b2a4f3f313b72a3a75)), closes [#1231](https://github.com/zwave-js/zwavejs2mqtt/issues/1231)
* **ui:** moved Value Refresh button to right on NodeDetails ([#1213](https://github.com/zwave-js/zwavejs2mqtt/issues/1213)) ([332f811](https://github.com/zwave-js/zwavejs2mqtt/commit/332f81159935459985123e09b6855e84b186a05c))
* **ui:** show group id in dialog dropdown ([#1239](https://github.com/zwave-js/zwavejs2mqtt/issues/1239)) ([a41c8b3](https://github.com/zwave-js/zwavejs2mqtt/commit/a41c8b36d67d4424907afe3a4abbde22381f7f54)), closes [#1232](https://github.com/zwave-js/zwavejs2mqtt/issues/1232)
* **ui:** zwave graph better detection of neighbors changes ([#1243](https://github.com/zwave-js/zwavejs2mqtt/issues/1243)) ([c330559](https://github.com/zwave-js/zwavejs2mqtt/commit/c3305594bc9e4608aad6ef2ca51eab0158f087c3))
* allow `sendCommand` to accept string command classes ([#1230](https://github.com/zwave-js/zwavejs2mqtt/issues/1230)) ([a2e704c](https://github.com/zwave-js/zwavejs2mqtt/commit/a2e704c10465ad2a0064854d738e7d66abd2a1ec)), closes [#1219](https://github.com/zwave-js/zwavejs2mqtt/issues/1219)
* better types and checks for sendCommand CC ([#1234](https://github.com/zwave-js/zwavejs2mqtt/issues/1234)) ([6df119c](https://github.com/zwave-js/zwavejs2mqtt/commit/6df119cc9537992bfe3881e4b7d19c96ea43b312))


### Features

* **zwave-js:** bump zwave-js@7.5.0 ([#1237](https://github.com/zwave-js/zwavejs2mqtt/issues/1237)) ([7f2d7ea](https://github.com/zwave-js/zwavejs2mqtt/commit/7f2d7ea2554c630c778187e423d5a305002276ec))

## [4.2.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v4.2.0...v4.2.1) (2021-05-12)


### Bug Fixes

* battery devices not ready ([#1195](https://github.com/zwave-js/zwavejs2mqtt/issues/1195)) ([78dec83](https://github.com/zwave-js/zwavejs2mqtt/commit/78dec83a4df22718c5161a17353b1c2f1e48c869))

# [4.2.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v4.0.1...v4.2.0) (2021-05-11)


### Bug Fixes

* lint issues ([6417175](https://github.com/zwave-js/zwavejs2mqtt/commit/6417175023a87b0a03295bed92a9ecfbd978fed2))
* use `getNeighbors` method ([#1146](https://github.com/zwave-js/zwavejs2mqtt/issues/1146)) ([fa50cf1](https://github.com/zwave-js/zwavejs2mqtt/commit/fa50cf157de7cc5f0cc80db0c47de1682434d79f))
* **hass:** sending `true` to MultilevelSwitchCC doesn't restore old level ([#1134](https://github.com/zwave-js/zwavejs2mqtt/issues/1134)) ([13afb0a](https://github.com/zwave-js/zwavejs2mqtt/commit/13afb0a40b845c3afbae21708e24d06f5e6cc498))
* **ui:** typo in copy-able versions info ([#1135](https://github.com/zwave-js/zwavejs2mqtt/issues/1135)) ([8e2ccc0](https://github.com/zwave-js/zwavejs2mqtt/commit/8e2ccc0d88d826bb5155879d155c8c656c546594))


### Features

* **docker:** push image to ghcr ([#1136](https://github.com/zwave-js/zwavejs2mqtt/issues/1136)) ([ae3af3c](https://github.com/zwave-js/zwavejs2mqtt/commit/ae3af3c2b2e60054be094e2627832f042f7a0644))



## [4.0.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v4.0.0...v4.0.1) (2021-05-03)


### Bug Fixes

* **docker:** config update not working ([#1128](https://github.com/zwave-js/zwavejs2mqtt/issues/1128)) ([6fccb01](https://github.com/zwave-js/zwavejs2mqtt/commit/6fccb0183a63f1b7c5fa83346022e70051f73e37)), closes [#1122](https://github.com/zwave-js/zwavejs2mqtt/issues/1122)
* **ui:** pretty json exports ([#1129](https://github.com/zwave-js/zwavejs2mqtt/issues/1129)) ([94e9f9c](https://github.com/zwave-js/zwavejs2mqtt/commit/94e9f9c6fa1c1cd00d1f239a83fbc39abf55b5fb)), closes [#1119](https://github.com/zwave-js/zwavejs2mqtt/issues/1119)



# [4.0.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v3.5.0...v4.0.0) (2021-04-30)


### Bug Fixes

* **ui:** hide hass tab when gw is disabled ([#1117](https://github.com/zwave-js/zwavejs2mqtt/issues/1117)) ([7116911](https://github.com/zwave-js/zwavejs2mqtt/commit/711691191dcc7447a9283717fd3239b381e58bbc)), closes [#1102](https://github.com/zwave-js/zwavejs2mqtt/issues/1102)
* **ui:** valueid label color ([#1097](https://github.com/zwave-js/zwavejs2mqtt/issues/1097)) ([9acbcad](https://github.com/zwave-js/zwavejs2mqtt/commit/9acbcad3c531429a3770299c22dd4124afae2aaa)), closes [#1094](https://github.com/zwave-js/zwavejs2mqtt/issues/1094)


### Features

* allow loading custom device configs from `store/config` ([#1096](https://github.com/zwave-js/zwavejs2mqtt/issues/1096)) ([3988049](https://github.com/zwave-js/zwavejs2mqtt/commit/39880499c162e23e89cd434337ceccc0250a3bdd))
* support managing associations on endpoints ([#1095](https://github.com/zwave-js/zwavejs2mqtt/issues/1095)) ([4230b64](https://github.com/zwave-js/zwavejs2mqtt/commit/4230b641eff5242859bf9468d334690b68bf8080))
* zwave-js config updates ([#1115](https://github.com/zwave-js/zwavejs2mqtt/issues/1115)) ([0a65549](https://github.com/zwave-js/zwavejs2mqtt/commit/0a65549d395f3c1cc6d5c58738a8367864db7cbc))


### BREAKING CHANGES

* Signature of methods `getAssociations`, `addAssociations` and `removeAssociations` have changed. This will have no effect on normal users but for the ones that are using those apis via MQTT remember to check the changes in signature, now you also have to specify source endpoint instead of just the nodeId to refer to an association



# [3.5.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v3.4.0...v3.5.0) (2021-04-20)


### Bug Fixes

* update node groups on node ready ([#1076](https://github.com/zwave-js/zwavejs2mqtt/issues/1076)) ([f7f960c](https://github.com/zwave-js/zwavejs2mqtt/commit/f7f960c50b141468e60a36dcc946236ab6f41e74)), closes [#1072](https://github.com/zwave-js/zwavejs2mqtt/issues/1072)


### Features

* **ui:** create new directory/files in store ([#1083](https://github.com/zwave-js/zwavejs2mqtt/issues/1083)) ([0f8a3bc](https://github.com/zwave-js/zwavejs2mqtt/commit/0f8a3bc7506631a1ea7ec93245c6bc6d1a68e77a))



# [3.4.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v3.3.0...v3.4.0) (2021-04-17)


### Bug Fixes

* disable `saveUninitialized` in express session ([#1068](https://github.com/zwave-js/zwavejs2mqtt/issues/1068)) ([7d8814e](https://github.com/zwave-js/zwavejs2mqtt/commit/7d8814e835d8aab6a00828426eb49e565136ddce))
* prevent 404 errors in store when using nginx ([#1060](https://github.com/zwave-js/zwavejs2mqtt/issues/1060)) ([b8dd575](https://github.com/zwave-js/zwavejs2mqtt/commit/b8dd57519b98c7f09405791ed20e88b6b367ee9f))
* store sessions in a dedicated folder in store ([#1067](https://github.com/zwave-js/zwavejs2mqtt/issues/1067)) ([2f2c947](https://github.com/zwave-js/zwavejs2mqtt/commit/2f2c9470914d2d934768d328f747bf8e165f7a41))


### Features

* allow to send a custom function to driver ([#1063](https://github.com/zwave-js/zwavejs2mqtt/issues/1063)) ([79e50fd](https://github.com/zwave-js/zwavejs2mqtt/commit/79e50fd3c28ff47a30548b62f01f2234c1342795))
* allow to send custom Config CC get/set commands ([#1064](https://github.com/zwave-js/zwavejs2mqtt/issues/1064)) ([96e0662](https://github.com/zwave-js/zwavejs2mqtt/commit/96e06620dcf826a4724c0249471d0b24f738c48a))



# [3.3.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v3.2.1...v3.3.0) (2021-04-13)


### Bug Fixes

* manually add missing values on updates ([#1056](https://github.com/zwave-js/zwavejs2mqtt/issues/1056)) ([c2600df](https://github.com/zwave-js/zwavejs2mqtt/commit/c2600df5dbb7a8b84d902d4648b271a3304b1a40))
* notification event not publiished to mqtt ([#1055](https://github.com/zwave-js/zwavejs2mqtt/issues/1055)) ([bf8db55](https://github.com/zwave-js/zwavejs2mqtt/commit/bf8db559b2feb9f2c607e6080f368e2413f1054f)), closes [#1044](https://github.com/zwave-js/zwavejs2mqtt/issues/1044)
* **ui:** assume controller always forwards in mesh graph ([#1038](https://github.com/zwave-js/zwavejs2mqtt/issues/1038)) ([aca4af3](https://github.com/zwave-js/zwavejs2mqtt/commit/aca4af3f897f5244e7b0380870055e11761d82e0)), closes [#1034](https://github.com/zwave-js/zwavejs2mqtt/issues/1034) [#739](https://github.com/zwave-js/zwavejs2mqtt/issues/739)
* **ui-mesh:** better labels color based on current theme ([#1050](https://github.com/zwave-js/zwavejs2mqtt/issues/1050)) ([2bf47d8](https://github.com/zwave-js/zwavejs2mqtt/commit/2bf47d8ca741462b05c63f6721dc85535348e489)), closes [#1010](https://github.com/zwave-js/zwavejs2mqtt/issues/1010)


### Features

* **ui:** refresh CC values ([#1051](https://github.com/zwave-js/zwavejs2mqtt/issues/1051)) ([b3ad1a3](https://github.com/zwave-js/zwavejs2mqtt/commit/b3ad1a3625b35f3cad963a0aa3ca50f1a342ffe6))



## [3.2.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v3.2.0...v3.2.1) (2021-04-11)


### Bug Fixes

* this.stopExclusion is undefined ([#1036](https://github.com/zwave-js/zwavejs2mqtt/issues/1036)) ([58f4368](https://github.com/zwave-js/zwavejs2mqtt/commit/58f4368fa83751eb06056c783acaff973fa66770)), closes [#1031](https://github.com/zwave-js/zwavejs2mqtt/issues/1031)



# [3.2.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v3.1.0...v3.2.0) (2021-04-07)


### Bug Fixes

* **ui:** use transparent background on zwave graph groups ([#1009](https://github.com/zwave-js/zwavejs2mqtt/issues/1009)) ([d4b6445](https://github.com/zwave-js/zwavejs2mqtt/commit/d4b6445ad9861692c93ccd8c01416e572f39ee95))
* allow accent chars in topics ([#1007](https://github.com/zwave-js/zwavejs2mqtt/issues/1007)) ([79cf699](https://github.com/zwave-js/zwavejs2mqtt/commit/79cf69910e9a40ee8e00f5b2ecc3cd1ae6f57ba8)), closes [#1003](https://github.com/zwave-js/zwavejs2mqtt/issues/1003)
* applicationName used in statistics ([ada8abb](https://github.com/zwave-js/zwavejs2mqtt/commit/ada8abb24ce7edf6c61d87901e1908a4f628cbe8))


### Features

* make usage statistics opt-in ([#1002](https://github.com/zwave-js/zwavejs2mqtt/issues/1002)) ([9b75833](https://github.com/zwave-js/zwavejs2mqtt/commit/9b758336b1a060e01147833ef5c59f8d61f20cce))



# [3.1.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v3.0.3...v3.1.0) (2021-04-06)


### Bug Fixes

* **ui:** check if node is routing ([#999](https://github.com/zwave-js/zwavejs2mqtt/issues/999)) ([4cd4b7f](https://github.com/zwave-js/zwavejs2mqtt/commit/4cd4b7f0160bf47e7f5bc7846917752e80d9173a))
* statistics and new node interview events ([#997](https://github.com/zwave-js/zwavejs2mqtt/issues/997)) ([707230e](https://github.com/zwave-js/zwavejs2mqtt/commit/707230e4df8d7a146993db090c4faf18cd064461))
* **ui:** prevent sending removeFailed to sleeping nodes in broadcast ([#988](https://github.com/zwave-js/zwavejs2mqtt/issues/988)) ([7750cca](https://github.com/zwave-js/zwavejs2mqtt/commit/7750cca9ad0f3f1bbacd12d3af4c62b775760c33)), closes [#983](https://github.com/zwave-js/zwavejs2mqtt/issues/983)


### Features

* usage statistics ([#989](https://github.com/zwave-js/zwavejs2mqtt/issues/989)) ([22b0379](https://github.com/zwave-js/zwavejs2mqtt/commit/22b03799b67c7f8101ea9723d127ba87b3e8c0d0))



## [3.0.3](https://github.com/zwave-js/zwavejs2mqtt/compare/v3.0.2...v3.0.3) (2021-04-01)


### Bug Fixes

* better sanitize topics ([#981](https://github.com/zwave-js/zwavejs2mqtt/issues/981)) ([d8fa77d](https://github.com/zwave-js/zwavejs2mqtt/commit/d8fa77de15d23d4ae2ced53955ea64f0999d6fd5))
* correctly show heal process complete ([#980](https://github.com/zwave-js/zwavejs2mqtt/issues/980)) ([f2efd4e](https://github.com/zwave-js/zwavejs2mqtt/commit/f2efd4e96e38da0d1c3af43a8314226bafae0e2b)), closes [#969](https://github.com/zwave-js/zwavejs2mqtt/issues/969)
* prevent stopInclusion/Exclusion to throw ([#979](https://github.com/zwave-js/zwavejs2mqtt/issues/979)) ([6055834](https://github.com/zwave-js/zwavejs2mqtt/commit/6055834f341997b39560051d8c7cdcefa8649d1a)), closes [#959](https://github.com/zwave-js/zwavejs2mqtt/issues/959)



## [3.0.2](https://github.com/zwave-js/zwavejs2mqtt/compare/v3.0.1...v3.0.2) (2021-03-26)


### Bug Fixes

* revert PR [#920](https://github.com/zwave-js/zwavejs2mqtt/issues/920) "use prefixed node.id in mqtt discovery topic" ([#951](https://github.com/zwave-js/zwavejs2mqtt/issues/951)) ([2595701](https://github.com/zwave-js/zwavejs2mqtt/commit/2595701ca933c16247b0057d500805b209651344))
* undefined propertyName in notifications ([#950](https://github.com/zwave-js/zwavejs2mqtt/issues/950)) ([da63912](https://github.com/zwave-js/zwavejs2mqtt/commit/da63912fdb68d83fe5946eeef5cb752a3b7e06ef)), closes [#948](https://github.com/zwave-js/zwavejs2mqtt/issues/948)



## [3.0.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v3.0.0...v3.0.1) (2021-03-25)


### Bug Fixes

* **ui:** control panel table not rendered ([#944](https://github.com/zwave-js/zwavejs2mqtt/issues/944)) ([73a6631](https://github.com/zwave-js/zwavejs2mqtt/commit/73a66315fdd8abb6842716cb264d5ff3ea3ccb18)), closes [#940](https://github.com/zwave-js/zwavejs2mqtt/issues/940)



# [3.0.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v2.4.1...v3.0.0) (2021-03-24)


### Features

* move to zwavejs 7 ([#864](https://github.com/zwave-js/zwavejs2mqtt/issues/864)) ([0bff7a7](https://github.com/zwave-js/zwavejs2mqtt/commit/0bff7a7798e877f86ed158c60b0938a1f960800e))


### BREAKING CHANGES

* Most changes are already documented [here](https://zwave-js.github.io/node-zwave-js/#/getting-started/migrating-to-v7):
- Corrected parsing of Node Information Frames (NIF), reworked node properties
- No automatic query of all node values when restarting from cache, `interview completed` event is no longer emitted on startup
- Reworked "notification" event, node notifications are mapped to mqtt using a different topic/payload
- This version is incompatible with HA versions before 2021.4.x



## [2.4.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v2.4.0...v2.4.1) (2021-03-22)


### Bug Fixes

* **ui:** correctly show Include Node Info ([#923](https://github.com/zwave-js/zwavejs2mqtt/issues/923)) ([035bd0d](https://github.com/zwave-js/zwavejs2mqtt/commit/035bd0dc4ec20046a83a6be787a3675d5ec489f5)), closes [#917](https://github.com/zwave-js/zwavejs2mqtt/issues/917)
* **ui:** make version copyable from info box ([#927](https://github.com/zwave-js/zwavejs2mqtt/issues/927)) ([4d79d44](https://github.com/zwave-js/zwavejs2mqtt/commit/4d79d443c3407435fc3f0b5590f9ba02f3c7d3f5))
* **ui:** units in selects and selects always sending 0 ([#925](https://github.com/zwave-js/zwavejs2mqtt/issues/925)) ([6162933](https://github.com/zwave-js/zwavejs2mqtt/commit/616293308cc2f1c6bb5d1a67fb75dc448ae6ceab))
* use prefixed node.id in mqtt discovery topic ([#920](https://github.com/zwave-js/zwavejs2mqtt/issues/920)) ([2c8bccb](https://github.com/zwave-js/zwavejs2mqtt/commit/2c8bccb4caec55e7bc9f1a596dd746969dcd3119))



# [2.4.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v2.3.0...v2.4.0) (2021-03-18)


### Bug Fixes

* **ui:** broken edit of scene values ([#898](https://github.com/zwave-js/zwavejs2mqtt/issues/898)) ([ed2d639](https://github.com/zwave-js/zwavejs2mqtt/commit/ed2d6390d1db4c1fd89880526cc93d8e617636b7))
* allow spaces in name and location ([#897](https://github.com/zwave-js/zwavejs2mqtt/issues/897)) ([18d6023](https://github.com/zwave-js/zwavejs2mqtt/commit/18d602341664229a9f78c2c44660d7b74d7df751)), closes [#877](https://github.com/zwave-js/zwavejs2mqtt/issues/877)


### Features

* **ui:** improved control panel ([#900](https://github.com/zwave-js/zwavejs2mqtt/issues/900)) ([3b3785e](https://github.com/zwave-js/zwavejs2mqtt/commit/3b3785eabe6a911710d1cefa371d3afd429eb196))



# [2.3.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v2.2.0...v2.3.0) (2021-03-15)


### Bug Fixes

* **hass:** remove `state_topic` on covers for HA 2020.3.2 ([#881](https://github.com/zwave-js/zwavejs2mqtt/issues/881)) ([2ab3d97](https://github.com/zwave-js/zwavejs2mqtt/commit/2ab3d979f4bc3f875a04ba3922ddbc0a6338d3ef))
* **ui:** allow manual entry of nodeid ([#885](https://github.com/zwave-js/zwavejs2mqtt/issues/885)) ([cd5691a](https://github.com/zwave-js/zwavejs2mqtt/commit/cd5691a5d99b89cd3c44dab032ce974de2b4ab18)), closes [#865](https://github.com/zwave-js/zwavejs2mqtt/issues/865)
* **ui:** disable swipe on node tabs ([#878](https://github.com/zwave-js/zwavejs2mqtt/issues/878)) ([eeb90d1](https://github.com/zwave-js/zwavejs2mqtt/commit/eeb90d120cfb1217598d74b1b802f02a30ea138c))
* **ui:** restore node debug info tab ([#886](https://github.com/zwave-js/zwavejs2mqtt/issues/886)) ([3bf1710](https://github.com/zwave-js/zwavejs2mqtt/commit/3bf17107b5956a7e7e74a172b851b5503e1f0955))
* **ui:** zwave graph when controller id != 1 ([#863](https://github.com/zwave-js/zwavejs2mqtt/issues/863)) ([74fb920](https://github.com/zwave-js/zwavejs2mqtt/commit/74fb920c0dd1421895b5f0f5fbdf2deb0adefd15)), closes [#862](https://github.com/zwave-js/zwavejs2mqtt/issues/862)
* better payload parsing ([#861](https://github.com/zwave-js/zwavejs2mqtt/issues/861)) ([199c558](https://github.com/zwave-js/zwavejs2mqtt/commit/199c5587e07f0ba31546daa7f9aa533be465c852))


### Features

* multicast/broadcast apis ([#25](https://github.com/zwave-js/zwavejs2mqtt/issues/25)) ([98e145d](https://github.com/zwave-js/zwavejs2mqtt/commit/98e145db9dcead56839147c9fc20bbbcac1e8f5d))



# [2.2.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v2.1.2...v2.2.0) (2021-03-09)


### Bug Fixes

* **ui:** redirects to main when auth is disabled ([#854](https://github.com/zwave-js/zwavejs2mqtt/issues/854)) ([8f4f181](https://github.com/zwave-js/zwavejs2mqtt/commit/8f4f181246b0269211568690afe888297b86c0e4))
* **ui:** show custom values and better read-only style ([#853](https://github.com/zwave-js/zwavejs2mqtt/issues/853)) ([bcd4554](https://github.com/zwave-js/zwavejs2mqtt/commit/bcd4554b3c9d02ca302ad83e4ad2bf1bb7c7d697)), closes [#844](https://github.com/zwave-js/zwavejs2mqtt/issues/844)
* **ui:** user friendlier list values management ([#843](https://github.com/zwave-js/zwavejs2mqtt/issues/843)) ([fb202db](https://github.com/zwave-js/zwavejs2mqtt/commit/fb202db128dd0c919b959efc622c908002f73b3b))


### Features

* **hass:** added `manual discovery` setting ([#851](https://github.com/zwave-js/zwavejs2mqtt/issues/851)) ([255e9b3](https://github.com/zwave-js/zwavejs2mqtt/commit/255e9b3327d4c350adc61ad63adc944c95e011dc)), closes [#819](https://github.com/zwave-js/zwavejs2mqtt/issues/819)
* **ui:** debug window ([#852](https://github.com/zwave-js/zwavejs2mqtt/issues/852)) ([42b2826](https://github.com/zwave-js/zwavejs2mqtt/commit/42b28269b54ed1de63c7c72ddd38849fdcf3e253))



## [2.1.2](https://github.com/zwave-js/zwavejs2mqtt/compare/v2.1.1...v2.1.2) (2021-03-08)


### Bug Fixes

* checks on `sendCommand` api ([#816](https://github.com/zwave-js/zwavejs2mqtt/issues/816)) ([92d502a](https://github.com/zwave-js/zwavejs2mqtt/commit/92d502a0ab9aef4efd713e1c9a6286aafd6ee449))
* prevent reset poll timers on node status updates ([#827](https://github.com/zwave-js/zwavejs2mqtt/issues/827)) ([c5c96bd](https://github.com/zwave-js/zwavejs2mqtt/commit/c5c96bdc039bb5385dd69bd5bae0f781792f9d68)), closes [#826](https://github.com/zwave-js/zwavejs2mqtt/issues/826)
* show hex number along with the `unknown` strings ([#801](https://github.com/zwave-js/zwavejs2mqtt/issues/801)) ([056bc80](https://github.com/zwave-js/zwavejs2mqtt/commit/056bc8065722f2847a41dde2b0356994f8d53a94))



## [2.1.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v2.1.0...v2.1.1) (2021-03-04)


### Bug Fixes

* **ui:** better visualization of read-only values ([#805](https://github.com/zwave-js/zwavejs2mqtt/issues/805)) ([82a9179](https://github.com/zwave-js/zwavejs2mqtt/commit/82a917967c00929b5053b8e578ee01e948d8008f))
* use isControllerNode instead of isController ([6858a08](https://github.com/zwave-js/zwavejs2mqtt/commit/6858a08e9f69d929d40c06dbd325b398e27ced25))
* **ui:** add missing type buffer ([13dbfef](https://github.com/zwave-js/zwavejs2mqtt/commit/13dbfef3023dbacb0c3124ea072d149830725117))
* assume controller always as listening ([#796](https://github.com/zwave-js/zwavejs2mqtt/issues/796)) ([d4f7780](https://github.com/zwave-js/zwavejs2mqtt/commit/d4f7780ac351b0dde2f8367beb7c203e3203985a)), closes [#739](https://github.com/zwave-js/zwavejs2mqtt/issues/739)
* read/parse buffers as hex strings ([#797](https://github.com/zwave-js/zwavejs2mqtt/issues/797)) ([521d2d2](https://github.com/zwave-js/zwavejs2mqtt/commit/521d2d2dd115f4c25b3f8f58db6328617f17d006))



# [2.1.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v2.0.1...v2.1.0) (2021-03-02)


### Bug Fixes

* **ui:** allow manual entry on config values with states ([#781](https://github.com/zwave-js/zwavejs2mqtt/issues/781)) ([a45f763](https://github.com/zwave-js/zwavejs2mqtt/commit/a45f763fad59ef2bbbe438a657b0e4ee34e1935a))
* **ui:** correctly get/set buffer values ([#795](https://github.com/zwave-js/zwavejs2mqtt/issues/795)) ([4f5a91f](https://github.com/zwave-js/zwavejs2mqtt/commit/4f5a91f607f4277d9b222341e73cb26a45c5d3a4))
* **ui:** show debug feedback ([714702c](https://github.com/zwave-js/zwavejs2mqtt/commit/714702c60e8df12f18456da68ba9bbf5f43908a2))
* **ui:** show scrollbars ([#792](https://github.com/zwave-js/zwavejs2mqtt/issues/792)) ([e974db2](https://github.com/zwave-js/zwavejs2mqtt/commit/e974db24f622aa78f475bfb5324e51abc6036518)), closes [#784](https://github.com/zwave-js/zwavejs2mqtt/issues/784)


### Features

* **ui:** allow to export nodes dump ([8a4a958](https://github.com/zwave-js/zwavejs2mqtt/commit/8a4a958795eb2cc317fcc99a6edab36a0cd07a65))



## [2.0.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v2.0.0...v2.0.1) (2021-03-01)


### Bug Fixes

* **ui:** nodes table display issues ([#780](https://github.com/zwave-js/zwavejs2mqtt/issues/780)) ([f02d8b6](https://github.com/zwave-js/zwavejs2mqtt/commit/f02d8b64ec835fa2b1f7f29350fc905a9d7dae94)), closes [#766](https://github.com/zwave-js/zwavejs2mqtt/issues/766)
* bug when importing nodes.json ([#768](https://github.com/zwave-js/zwavejs2mqtt/issues/768)) ([84550f2](https://github.com/zwave-js/zwavejs2mqtt/commit/84550f27da2d31ba5299cfb054c6f48aea1d527a))
* use node `available` in node status ([#762](https://github.com/zwave-js/zwavejs2mqtt/issues/762)) ([d4972e8](https://github.com/zwave-js/zwavejs2mqtt/commit/d4972e88a0170823ae9adc7755936e07bdce24c9))



# [2.0.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v1.4.0...v2.0.0) (2021-02-26)


### Code Refactoring

* make nodes a map instead of an array ([#710](https://github.com/zwave-js/zwavejs2mqtt/issues/710)) ([5a43abd](https://github.com/zwave-js/zwavejs2mqtt/commit/5a43abd94373d74095dc9afd596a66b7e27b608b))


### Features

* correctly parse `currentColor` value and improve rgb discovery ([#568](https://github.com/zwave-js/zwavejs2mqtt/issues/568)) ([7bedd3b](https://github.com/zwave-js/zwavejs2mqtt/commit/7bedd3b36403ff470a5e7317db68555b9edc4616))
* plugins improved support ([#688](https://github.com/zwave-js/zwavejs2mqtt/issues/688)) ([a213b25](https://github.com/zwave-js/zwavejs2mqtt/commit/a213b25cc340a9bd8c69dcf7a027662e3811081d))


### BREAKING CHANGES

* `plugins` are now stored in an array of `strings` on settings `gateway` prop instead of `zwave`
* `getNodes` function of ZwaveClient returns an array of available nodes but the index doesn't match the nodeId
`refreshNeighbours` returns a map nodeId -> neighbours[]
node removed socket event now returns the node removed
renamed `setNodeName` and `setNodeLocation` apis (removed the leading `_`) as now them also store the value to controller



# [1.4.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v1.3.0...v1.4.0) (2021-02-24)


### Bug Fixes

* **hass:** inovelli lzw42 multi color bulb discovery update ([#690](https://github.com/zwave-js/zwavejs2mqtt/issues/690)) ([9669cce](https://github.com/zwave-js/zwavejs2mqtt/commit/9669cce977e1412023c7bc9b53c9981ded1f225f))


### Features

* zwavejs@6.5.0 and nodeFilter setting support ([#728](https://github.com/zwave-js/zwavejs2mqtt/issues/728)) ([3f12c2a](https://github.com/zwave-js/zwavejs2mqtt/commit/3f12c2ab9a65f701458334b3f5db1183ae742f3c))



# [1.3.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v1.2.3...v1.3.0) (2021-02-23)


### Bug Fixes

* **hass:** improved climates discovery ([#692](https://github.com/zwave-js/zwavejs2mqtt/issues/692)) ([1c60355](https://github.com/zwave-js/zwavejs2mqtt/commit/1c603554e62903884840dcad2a429a88ca5ab441))
* **ui:** node details in mobile devices ([9fcc8e0](https://github.com/zwave-js/zwavejs2mqtt/commit/9fcc8e03cb93355266f0c5402f3b2848e30c4b9a))
* **ui:** overflow of tabs in mobile devices ([6806907](https://github.com/zwave-js/zwavejs2mqtt/commit/6806907bac52f60386545cb81733517107241ea1))


### Features

* **ui:** add link to zwavejs devices db ([#708](https://github.com/zwave-js/zwavejs2mqtt/issues/708)) ([ebb5036](https://github.com/zwave-js/zwavejs2mqtt/commit/ebb50364e9c8660b39bf2d2f8ec29f2859de4a9f))
* **ui:** update topics and clear retained functions ([246c078](https://github.com/zwave-js/zwavejs2mqtt/commit/246c0784196e29a98ea47ab22fad5e1306eab616))



## [1.2.3](https://github.com/zwave-js/zwavejs2mqtt/compare/v1.2.2...v1.2.3) (2021-02-22)


### Bug Fixes

* **discovery:** prioritized CCs discovery order  ([#625](https://github.com/zwave-js/zwavejs2mqtt/issues/625)) ([e238ae1](https://github.com/zwave-js/zwavejs2mqtt/commit/e238ae14cb38ee91e94291355c89935b8393b8c3))
* **hass:** barrier operator hass replace barrier states with integers ([#556](https://github.com/zwave-js/zwavejs2mqtt/issues/556)) ([11e1bde](https://github.com/zwave-js/zwavejs2mqtt/commit/11e1bde5259d8d710fec11efacf8a5851ddcaded))
* **ui:** duration dropdown ([#687](https://github.com/zwave-js/zwavejs2mqtt/issues/687)) ([27245ec](https://github.com/zwave-js/zwavejs2mqtt/commit/27245ec79a7c7ac6134c6403b82482d4deb82c25))
* **ui:** persistent hint in confirm dialog ([#685](https://github.com/zwave-js/zwavejs2mqtt/issues/685)) ([7b7529c](https://github.com/zwave-js/zwavejs2mqtt/commit/7b7529c84694da106540ed989194cab5a71045d6))
* **ui:** use button toggle for on/off value ids ([#686](https://github.com/zwave-js/zwavejs2mqtt/issues/686)) ([bba6335](https://github.com/zwave-js/zwavejs2mqtt/commit/bba633513d80a4d5d585863b01bdeca11fa71848))
* propertyKey may be zero ([#674](https://github.com/zwave-js/zwavejs2mqtt/issues/674)) ([c60a640](https://github.com/zwave-js/zwavejs2mqtt/commit/c60a6404732e24f4cc166e058ac71d7c43b23d86))
* **ui:** typo groups associations ([#650](https://github.com/zwave-js/zwavejs2mqtt/issues/650)) ([80163d1](https://github.com/zwave-js/zwavejs2mqtt/commit/80163d1b0de11f83007acc99f6a4f5c8366a8f5b))



## [1.2.2](https://github.com/zwave-js/zwavejs2mqtt/compare/v1.2.1...v1.2.2) (2021-02-19)


### Bug Fixes

* better app shutdown detection ([#639](https://github.com/zwave-js/zwavejs2mqtt/issues/639)) ([31477cc](https://github.com/zwave-js/zwavejs2mqtt/commit/31477ccaef3b56e0fe86bdc2d6cc173bfabd5713)), closes [#506](https://github.com/zwave-js/zwavejs2mqtt/issues/506)
* **ui:** set Control Panel as main page ([#640](https://github.com/zwave-js/zwavejs2mqtt/issues/640)) ([bbf6864](https://github.com/zwave-js/zwavejs2mqtt/commit/bbf6864576bdf46e4e35f74226f3846ad15b4d4a))



## [1.2.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v1.1.1...v1.2.1) (2021-02-18)


### Bug Fixes

* broken startup ui ([#623](https://github.com/zwave-js/zwavejs2mqtt/issues/623)) ([afbb346](https://github.com/zwave-js/zwavejs2mqtt/commit/afbb3462df44b6d4ef6ac8ea314734b6ac1d4c2e))
* firmware target not set correctly ([#601](https://github.com/zwave-js/zwavejs2mqtt/issues/601)) ([9d8b5d5](https://github.com/zwave-js/zwavejs2mqtt/commit/9d8b5d5a37184fa68c13cb3c320d05d32c72c257))
* generate the action template when an action map is given ([#547](https://github.com/zwave-js/zwavejs2mqtt/issues/547)) ([254121e](https://github.com/zwave-js/zwavejs2mqtt/commit/254121ee391ba7ec40bcf64de3d3f15920fb5fca))
* start zwavejs server when driver is ready ([#605](https://github.com/zwave-js/zwavejs2mqtt/issues/605)) ([aebd890](https://github.com/zwave-js/zwavejs2mqtt/commit/aebd8903d5c99ab51f5ee5f30e26258c375ae795)), closes [#602](https://github.com/zwave-js/zwavejs2mqtt/issues/602)
* **ui:** battery powered devices shown as main ([#590](https://github.com/zwave-js/zwavejs2mqtt/issues/590)) ([0235011](https://github.com/zwave-js/zwavejs2mqtt/commit/02350114292cd7ba163653076b6f54e6ec8c9662)), closes [#546](https://github.com/zwave-js/zwavejs2mqtt/issues/546)


### Features

* **ui:** authentication ([#591](https://github.com/zwave-js/zwavejs2mqtt/issues/591)) ([7eef6c5](https://github.com/zwave-js/zwavejs2mqtt/commit/7eef6c5aa75c93d4c26caf6c99ab6f5090b013b0))
* bump zwavejs server beta 7 and show version on ui ([#609](https://github.com/zwave-js/zwavejs2mqtt/issues/609)) ([bb255db](https://github.com/zwave-js/zwavejs2mqtt/commit/bb255dba6b318c6aa04d39f5a7ead10352968a28))



## [1.1.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v1.1.0...v1.1.1) (2021-02-10)


### Bug Fixes

* https in development mode ([5bb25b8](https://github.com/zwave-js/zwavejs2mqtt/commit/5bb25b897c54d7f430d8c6dce2dfe870b7d45a03))
* wrong filename when downloading file ([97c02b8](https://github.com/zwave-js/zwavejs2mqtt/commit/97c02b81bb29b29cea9cc224304763dedcc9aec6)), closes [#537](https://github.com/zwave-js/zwavejs2mqtt/issues/537)
* **ui:** no secure nodes shown as secure ([#523](https://github.com/zwave-js/zwavejs2mqtt/issues/523)) ([fd9ac7b](https://github.com/zwave-js/zwavejs2mqtt/commit/fd9ac7bce7fa46791848e41682e6fff6b45c0e2e)), closes [#522](https://github.com/zwave-js/zwavejs2mqtt/issues/522)
* lint issues ([08c1578](https://github.com/zwave-js/zwavejs2mqtt/commit/08c1578cfbaa1b9a46e683614f71572caacd4596))


### Features

* https support ([#535](https://github.com/zwave-js/zwavejs2mqtt/issues/535)) ([346d638](https://github.com/zwave-js/zwavejs2mqtt/commit/346d638a5c2de39780b337b21687105759c71d5c))
* **ui:** rearrange table columns ([#534](https://github.com/zwave-js/zwavejs2mqtt/issues/534)) ([d6cd9ec](https://github.com/zwave-js/zwavejs2mqtt/commit/d6cd9ece8853c74019a68e983f39bd3c86570eb4)), closes [#484](https://github.com/zwave-js/zwavejs2mqtt/issues/484)



# [1.1.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v1.0.5...v1.1.0) (2021-02-08)


### Bug Fixes

* mesh graph settings ([5a1d446](https://github.com/zwave-js/zwavejs2mqtt/commit/5a1d4460fdac64733d766271d734ab2d37f8914f))
* **ui:** rearrange settings ([3e7a6ac](https://github.com/zwave-js/zwavejs2mqtt/commit/3e7a6ace9e90be56326886eb762cf07d0f1a991f))
* **ui:** typo in retain ([b9d066b](https://github.com/zwave-js/zwavejs2mqtt/commit/b9d066b9f069ae81b4fab37d5bdb95fde8f0e7bd))
* /health return 200 if mqtt is disabled ([#500](https://github.com/zwave-js/zwavejs2mqtt/issues/500)) ([8e3a4e3](https://github.com/zwave-js/zwavejs2mqtt/commit/8e3a4e345bdc0172bc713df2be01fccbd8d6fc17)), closes [#469](https://github.com/zwave-js/zwavejs2mqtt/issues/469)
* add node id to node status payload ([#499](https://github.com/zwave-js/zwavejs2mqtt/issues/499)) ([bf8a545](https://github.com/zwave-js/zwavejs2mqtt/commit/bf8a5452f90019de9134f112b0aec5c20975930f)), closes [#492](https://github.com/zwave-js/zwavejs2mqtt/issues/492)
* allow to set custom firmware target ([#501](https://github.com/zwave-js/zwavejs2mqtt/issues/501)) ([0fb1888](https://github.com/zwave-js/zwavejs2mqtt/commit/0fb188856cc53c65e49f76c23b57ad5e35c13f7d)), closes [#483](https://github.com/zwave-js/zwavejs2mqtt/issues/483)
* use zwave-js guessFirmwareFileFormat function ([#498](https://github.com/zwave-js/zwavejs2mqtt/issues/498)) ([6a9931f](https://github.com/zwave-js/zwavejs2mqtt/commit/6a9931f3805b5848ac30af704c65031302a4776f))
* **ui:** disable Gateway label ([#482](https://github.com/zwave-js/zwavejs2mqtt/issues/482)) ([d69560f](https://github.com/zwave-js/zwavejs2mqtt/commit/d69560f2dd113f9fd72d6efeff6b40de967586bd)), closes [#471](https://github.com/zwave-js/zwavejs2mqtt/issues/471)
* **ui:** settings refactor, fix mesh node names ([#456](https://github.com/zwave-js/zwavejs2mqtt/issues/456)) ([24f9daa](https://github.com/zwave-js/zwavejs2mqtt/commit/24f9daa88fbf0e0e581d8e06a82664135ebee5b6)), closes [#455](https://github.com/zwave-js/zwavejs2mqtt/issues/455)


### Features

* allow to specify custom qos and retain ([#502](https://github.com/zwave-js/zwavejs2mqtt/issues/502)) ([4055c68](https://github.com/zwave-js/zwavejs2mqtt/commit/4055c6869d8a5f3322215e4ebdbe3469198cb4d7)), closes [#311](https://github.com/zwave-js/zwavejs2mqtt/issues/311)
* **ui:** improved mesh graph ([#458](https://github.com/zwave-js/zwavejs2mqtt/issues/458)) ([656e56d](https://github.com/zwave-js/zwavejs2mqtt/commit/656e56d544bbf9b896b10ce1c38c6b8e1f28b164)), closes [#384](https://github.com/zwave-js/zwavejs2mqtt/issues/384)
* **ui:** refactor add remove dialog ([#475](https://github.com/zwave-js/zwavejs2mqtt/issues/475)) ([0ecbea6](https://github.com/zwave-js/zwavejs2mqtt/commit/0ecbea61c51b7c65c2f9955a95e565e65854b35f))
* custom plugins loader ([#478](https://github.com/zwave-js/zwavejs2mqtt/issues/478)) ([020f82b](https://github.com/zwave-js/zwavejs2mqtt/commit/020f82b43476049e2fce116f3df88d3677863466))
* **ui:** add node debug info tab ([#462](https://github.com/zwave-js/zwavejs2mqtt/issues/462)) ([56e1c62](https://github.com/zwave-js/zwavejs2mqtt/commit/56e1c6272ab56fb46333607b862d857f04a28998))



## [1.0.5](https://github.com/zwave-js/zwavejs2mqtt/compare/v1.0.4...v1.0.5) (2021-02-04)


### Bug Fixes

* **ui:** better ui add/remove dialog feedback ([#451](https://github.com/zwave-js/zwavejs2mqtt/issues/451)) ([325be03](https://github.com/zwave-js/zwavejs2mqtt/commit/325be0394671deeef83de6e79794331846012862))



## [1.0.4](https://github.com/zwave-js/zwavejs2mqtt/compare/v1.0.3...v1.0.4) (2021-02-03)


### Bug Fixes

* binary sensor notification changes break double taps and other events ([#422](https://github.com/zwave-js/zwavejs2mqtt/issues/422)) ([c03a2fa](https://github.com/zwave-js/zwavejs2mqtt/commit/c03a2fa940db5976aab6cc0ea2fc8dacd4db13d1))
* ignore stateless valueId updates if from cache ([#435](https://github.com/zwave-js/zwavejs2mqtt/issues/435)) ([95de1b8](https://github.com/zwave-js/zwavejs2mqtt/commit/95de1b85bb537cb1564454a326e946d86a473187)), closes [#434](https://github.com/zwave-js/zwavejs2mqtt/issues/434)
* improve binary sensor code - add more sensors ([#433](https://github.com/zwave-js/zwavejs2mqtt/issues/433)) ([ed6fbe3](https://github.com/zwave-js/zwavejs2mqtt/commit/ed6fbe3796a1a7a4566500dadde43af7b48f6e65))
* **ui:** labels and mobile view ([#413](https://github.com/zwave-js/zwavejs2mqtt/issues/413)) ([cb2d735](https://github.com/zwave-js/zwavejs2mqtt/commit/cb2d73555e01ea5b175ecfd73f08e0eca257f59c))


### Features

* **ui:** improved add remove device UX ([#419](https://github.com/zwave-js/zwavejs2mqtt/issues/419)) ([e3e57b6](https://github.com/zwave-js/zwavejs2mqtt/commit/e3e57b6a56d2589a5d27a8d67647767f94d36078))



## [1.0.3](https://github.com/zwave-js/zwavejs2mqtt/compare/v1.0.2...v1.0.3) (2021-02-02)


### Features

* **ui:** show/hide node table columns ([#407](https://github.com/zwave-js/zwavejs2mqtt/issues/407)) ([56b0c1c](https://github.com/zwave-js/zwavejs2mqtt/commit/56b0c1cf67fa30d4094a6c6c1fb13f54628b3c9e))



## [1.0.2](https://github.com/zwave-js/zwavejs2mqtt/compare/v1.0.1...v1.0.2) (2021-02-01)


### Bug Fixes

* climate discovery without mode CC ([#408](https://github.com/zwave-js/zwavejs2mqtt/issues/408)) ([0cb5d5c](https://github.com/zwave-js/zwavejs2mqtt/commit/0cb5d5cbd8f649a7a0c8b826455cba67bf5c892b)), closes [#400](https://github.com/zwave-js/zwavejs2mqtt/issues/400)
* **ui:** use `No` instead of `Cancel` in broadcast popup ([#410](https://github.com/zwave-js/zwavejs2mqtt/issues/410)) ([4b868f6](https://github.com/zwave-js/zwavejs2mqtt/commit/4b868f63d0c842c5e7e5c09c3d05a024d75b179d))


### Features

* **hass:** use binary sensors when notifications has only two states ([#396](https://github.com/zwave-js/zwavejs2mqtt/issues/396)) ([557ec80](https://github.com/zwave-js/zwavejs2mqtt/commit/557ec801979a001209fea5d3d32a66421798a0b0))



## [1.0.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v1.0.0...v1.0.1) (2021-01-29)


### Bug Fixes

* **security:** better path sanitize on store ([9403cb1](https://github.com/zwave-js/zwavejs2mqtt/commit/9403cb1ec8614f845ced8894ac04efea182f1e0a))
* **security:** throw if path is not safe ([f69d2bb](https://github.com/zwave-js/zwavejs2mqtt/commit/f69d2bb80ba875947bd273c599ae53d554075975))



# [1.0.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v1.0.0-rc.1...v1.0.0) (2021-01-29)


### Bug Fixes

* bettter support for device_class ([0f5ebac](https://github.com/zwave-js/zwavejs2mqtt/commit/0f5ebac0612b9a985f242a84e1355d85e357a620))
* gateway values not working ([#317](https://github.com/zwave-js/zwavejs2mqtt/issues/317)) ([df4a288](https://github.com/zwave-js/zwavejs2mqtt/commit/df4a288f7d8b47441c3f60c7539b6627d2051a87)), closes [#312](https://github.com/zwave-js/zwavejs2mqtt/issues/312)
* notifications topic ([f01e598](https://github.com/zwave-js/zwavejs2mqtt/commit/f01e5988b01443fd1b0984359876aa3b78398015)), closes [#334](https://github.com/zwave-js/zwavejs2mqtt/issues/334)
* rate limit store requests and sanitize path ([#357](https://github.com/zwave-js/zwavejs2mqtt/issues/357)) ([d76a8c2](https://github.com/zwave-js/zwavejs2mqtt/commit/d76a8c2a02409a015107cba2169b1834d74ed3bb))
* safer subscribe ([#372](https://github.com/zwave-js/zwavejs2mqtt/issues/372)) ([e113d76](https://github.com/zwave-js/zwavejs2mqtt/commit/e113d76148bc68507993309ac0ead24b7937747e)), closes [#361](https://github.com/zwave-js/zwavejs2mqtt/issues/361)
* sanitize path regex ([a465c6c](https://github.com/zwave-js/zwavejs2mqtt/commit/a465c6c1197a05fd56732f0e309f8ba78f3d465d))
* start zwave-server only after driver start ([8c7249e](https://github.com/zwave-js/zwavejs2mqtt/commit/8c7249e2bb17161132663a258e71aff4d0d04b64))
* typos ([#379](https://github.com/zwave-js/zwavejs2mqtt/issues/379)) ([b48c5c0](https://github.com/zwave-js/zwavejs2mqtt/commit/b48c5c03408d48dd14babdb3e43e1d593b52d0c4))
* unknown manufacturer ([#376](https://github.com/zwave-js/zwavejs2mqtt/issues/376)) ([e880354](https://github.com/zwave-js/zwavejs2mqtt/commit/e880354b39ef8780aa217b47ca3e8b8f691f924a)), closes [#373](https://github.com/zwave-js/zwavejs2mqtt/issues/373) [#347](https://github.com/zwave-js/zwavejs2mqtt/issues/347)
* **hass:** change currentValue to targetValue in the fan template docs ([91eef10](https://github.com/zwave-js/zwavejs2mqtt/commit/91eef10f24c6568aefd51aad5c77f7e771d8eb53))
* **ui:** replaced class_id with commandClass ([d6471c8](https://github.com/zwave-js/zwavejs2mqtt/commit/d6471c8835d0afe8d4255d266aa153413dbb02eb))
* **ui:** show default on list items ([ade28bd](https://github.com/zwave-js/zwavejs2mqtt/commit/ade28bd5c1ea8d525786b30b771ca5d3a7b72568))
* **ui:** table visualization on mobile devices ([6de59f4](https://github.com/zwave-js/zwavejs2mqtt/commit/6de59f4bbcde5d648688581c32cd8b26340e01d3))
* **ui:** unable to add values to gateway values table ([af67ac9](https://github.com/zwave-js/zwavejs2mqtt/commit/af67ac9a99736f7ec71dffdeb1f20d07a9d16828))
* **ui:** undefined scene value with booleans ([cd11214](https://github.com/zwave-js/zwavejs2mqtt/commit/cd11214073d224281658c155cab94c4dd5b4950e)), closes [#320](https://github.com/zwave-js/zwavejs2mqtt/issues/320)


### Features

* add pollValue api ([#343](https://github.com/zwave-js/zwavejs2mqtt/issues/343)) ([2356de9](https://github.com/zwave-js/zwavejs2mqtt/commit/2356de99eb25b8f0320999ac4b96348e6949d706)), closes [#309](https://github.com/zwave-js/zwavejs2mqtt/issues/309)
* send custom command api ([#360](https://github.com/zwave-js/zwavejs2mqtt/issues/360)) ([b60f585](https://github.com/zwave-js/zwavejs2mqtt/commit/b60f585d810435a0c149d488976a6e916ad7d631)), closes [#336](https://github.com/zwave-js/zwavejs2mqtt/issues/336)
* **ui:** better valueIds descriptions ([#359](https://github.com/zwave-js/zwavejs2mqtt/issues/359)) ([bf940a7](https://github.com/zwave-js/zwavejs2mqtt/commit/bf940a7187e169ff0283daee9975fff18845c8c6))
* **ui:** show confirm improvments ([#355](https://github.com/zwave-js/zwavejs2mqtt/issues/355)) ([454da10](https://github.com/zwave-js/zwavejs2mqtt/commit/454da10c05e47c50ff938bdcfbeea44ccb402f45))
* add valueId, node and logger to parse functions ([#319](https://github.com/zwave-js/zwavejs2mqtt/issues/319)) ([e9583fa](https://github.com/zwave-js/zwavejs2mqtt/commit/e9583fa2c732c974c3287e87353353ee7701189a))
* env var STORE_DIR and renamed OZW_NETWORK_KEY to NETWORK_KEY ([#308](https://github.com/zwave-js/zwavejs2mqtt/issues/308)) ([58c2cb9](https://github.com/zwave-js/zwavejs2mqtt/commit/58c2cb9541058f09011df0febc87f567f03abe0f)), closes [#85](https://github.com/zwave-js/zwavejs2mqtt/issues/85)
* node table UI optimizations ([#332](https://github.com/zwave-js/zwavejs2mqtt/issues/332)) ([ccd606e](https://github.com/zwave-js/zwavejs2mqtt/commit/ccd606e2875399887379a7b14edc20e93524b4c8)), closes [#342](https://github.com/zwave-js/zwavejs2mqtt/issues/342)



# [1.0.0-rc.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v1.0.0-rc.0...v1.0.0-rc.1) (2021-01-21)


### Bug Fixes

* **hass:** dimmers and rgb dimmers ([#290](https://github.com/zwave-js/zwavejs2mqtt/issues/290)) ([fbc792e](https://github.com/zwave-js/zwavejs2mqtt/commit/fbc792ebe938f70544cc50aba34710d74e6f88e5)), closes [#295](https://github.com/zwave-js/zwavejs2mqtt/issues/295)
* **ui:** renamed refreshInfo to re-interview node ([8928145](https://github.com/zwave-js/zwavejs2mqtt/commit/89281455b3b97682bd87f40c910e30cf96e8d654))
* remove markNodeAsFailed api ([#289](https://github.com/zwave-js/zwavejs2mqtt/issues/289)) ([3c6b99e](https://github.com/zwave-js/zwavejs2mqtt/commit/3c6b99ec307f09924a962c4bdfc29d0509a95462))
* topics and hass ids/names fixes ([#247](https://github.com/zwave-js/zwavejs2mqtt/issues/247)) ([a072c73](https://github.com/zwave-js/zwavejs2mqtt/commit/a072c7325e8dd030d2aa375a84a82d16a160c378)), closes [#239](https://github.com/zwave-js/zwavejs2mqtt/issues/239) [#232](https://github.com/zwave-js/zwavejs2mqtt/issues/232)


### Features

* **hass:** create discovery for CC basic 0x20 ([#250](https://github.com/zwave-js/zwavejs2mqtt/issues/250)) ([7d2d667](https://github.com/zwave-js/zwavejs2mqtt/commit/7d2d667653eeb37f423ca1cffb530a1b095b372d))



# [1.0.0-rc.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v1.0.0-beta.0...v1.0.0-rc.0) (2021-01-20)


### Bug Fixes

* **ui:** zip name download ([e2cecdc](https://github.com/zwave-js/zwavejs2mqtt/commit/e2cecdc024860330fc0bdf88cf7ac586f0e4fdff))
* custom scroll and blob type when downalod ([#283](https://github.com/zwave-js/zwavejs2mqtt/issues/283)) ([d031ce9](https://github.com/zwave-js/zwavejs2mqtt/commit/d031ce9caf59ab81947ab926f5eff48c8444c4cd))
* **ui:** add zwave lib version and restyled table ([#282](https://github.com/zwave-js/zwavejs2mqtt/issues/282)) ([9b66d04](https://github.com/zwave-js/zwavejs2mqtt/commit/9b66d0400f0f014ea6aed875cf021c7e57250282)), closes [#276](https://github.com/zwave-js/zwavejs2mqtt/issues/276)
* add `origin` payload to api response payload ([#281](https://github.com/zwave-js/zwavejs2mqtt/issues/281)) ([f241d85](https://github.com/zwave-js/zwavejs2mqtt/commit/f241d8580231e9d93946132afd7c86983d04330a)), closes [#278](https://github.com/zwave-js/zwavejs2mqtt/issues/278)
* **hass:** command template of fan dimmer ([0d0fbd6](https://github.com/zwave-js/zwavejs2mqtt/commit/0d0fbd678070dc2e979a809363815628b5a8a5d8))
* better node initialization ([#240](https://github.com/zwave-js/zwavejs2mqtt/issues/240)) ([3724e3f](https://github.com/zwave-js/zwavejs2mqtt/commit/3724e3fd454b3df2fee733c50e89988993dca761))
* duration type handling ([#230](https://github.com/zwave-js/zwavejs2mqtt/issues/230)) ([fb92155](https://github.com/zwave-js/zwavejs2mqtt/commit/fb921554c50050b128ec8a024280e0f671f8e3cd)), closes [#185](https://github.com/zwave-js/zwavejs2mqtt/issues/185)
* ensure args is array when calling api with mqtt ([8371752](https://github.com/zwave-js/zwavejs2mqtt/commit/8371752b9e9f20f596606aec6d9bfedf3d9b0b5d)), closes [#251](https://github.com/zwave-js/zwavejs2mqtt/issues/251)
* hexColor parsing ([#272](https://github.com/zwave-js/zwavejs2mqtt/issues/272)) ([0187e09](https://github.com/zwave-js/zwavejs2mqtt/commit/0187e0980dc5f2ed960818282511ac78d4b88c85))
* respect ignore location setting in hass entities ([#234](https://github.com/zwave-js/zwavejs2mqtt/issues/234)) ([6e2a0f7](https://github.com/zwave-js/zwavejs2mqtt/commit/6e2a0f726aa8f14bc06258860c002e6373697f05))
* set retain to false on api responses ([b6fb04d](https://github.com/zwave-js/zwavejs2mqtt/commit/b6fb04de2efe35a259ae6e32763e7ec1292a6ee5)), closes [#268](https://github.com/zwave-js/zwavejs2mqtt/issues/268)
* **ui:** inconsistent, unsorted node selection ([#258](https://github.com/zwave-js/zwavejs2mqtt/issues/258)) ([f8042ed](https://github.com/zwave-js/zwavejs2mqtt/commit/f8042ed605b70558d08b49685d5e78870ee251e9))
* notification log ([193deb9](https://github.com/zwave-js/zwavejs2mqtt/commit/193deb96553498052e061fed57ff2089cfbad932))


### Features

* markNodeAsFailed api ([#263](https://github.com/zwave-js/zwavejs2mqtt/issues/263)) ([c00f50a](https://github.com/zwave-js/zwavejs2mqtt/commit/c00f50a323c60e0d49656faac89e734fbee53f06))
* refreshValues api ([#246](https://github.com/zwave-js/zwavejs2mqtt/issues/246)) ([43fdce0](https://github.com/zwave-js/zwavejs2mqtt/commit/43fdce017cf571e8e5a74ad739cd50a8e967cf7e))
* store explorer ([#166](https://github.com/zwave-js/zwavejs2mqtt/issues/166)) ([d98fd7e](https://github.com/zwave-js/zwavejs2mqtt/commit/d98fd7e8541a722b89a0e65fcfaca14b6b589cb2))
* zwave-js server support ([#248](https://github.com/zwave-js/zwavejs2mqtt/issues/248)) ([3ad9ee6](https://github.com/zwave-js/zwavejs2mqtt/commit/3ad9ee60e0861cd47108ea5c50e677bc57f31b58))
* **docker:** Improve documentation by linking to the readme ([#274](https://github.com/zwave-js/zwavejs2mqtt/issues/274)) ([cec2d0d](https://github.com/zwave-js/zwavejs2mqtt/commit/cec2d0d3bafe908af74ca852aac68c305833656c))
* ui and hass discovery rgb valueId support ([#238](https://github.com/zwave-js/zwavejs2mqtt/issues/238)) ([a56f044](https://github.com/zwave-js/zwavejs2mqtt/commit/a56f044f4abd24d4bb9937485c6fb3c510e7906c)), closes [#78](https://github.com/zwave-js/zwavejs2mqtt/issues/78)



# [1.0.0-beta.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v1.0.0-alpha.2...v1.0.0-beta.0) (2021-01-13)


### Bug Fixes

* **ui:** error in filter options for null strings ([#225](https://github.com/zwave-js/zwavejs2mqtt/issues/225)) ([165ca0e](https://github.com/zwave-js/zwavejs2mqtt/commit/165ca0eb00813cffcadcf036d2702d6f32c4e7ad))
* climate discovery [#172](https://github.com/zwave-js/zwavejs2mqtt/issues/172) ([3c86e2e](https://github.com/zwave-js/zwavejs2mqtt/commit/3c86e2e8ab4983c1c6135c0d9e37949b9c892065))
* correclty parse durations ([595b97e](https://github.com/zwave-js/zwavejs2mqtt/commit/595b97ea40b516ff69dad261cf70e9f134aceedf)), closes [#185](https://github.com/zwave-js/zwavejs2mqtt/issues/185)
* correctly parse node notification ([#170](https://github.com/zwave-js/zwavejs2mqtt/issues/170)) ([af41778](https://github.com/zwave-js/zwavejs2mqtt/commit/af41778ddf216e289ab1f246079cc4b09c981646))
* defaults settings values ([#153](https://github.com/zwave-js/zwavejs2mqtt/issues/153)) ([88d50dc](https://github.com/zwave-js/zwavejs2mqtt/commit/88d50dc493682bd5d4cce642e79acf7045af14f9)), closes [#147](https://github.com/zwave-js/zwavejs2mqtt/issues/147)
* ensure target node exist when creating links ([#167](https://github.com/zwave-js/zwavejs2mqtt/issues/167)) ([375bae8](https://github.com/zwave-js/zwavejs2mqtt/commit/375bae832b02fcc4369efaa19849bae199ce30ec))
* entity names with empty location ([#218](https://github.com/zwave-js/zwavejs2mqtt/issues/218)) ([bfbda11](https://github.com/zwave-js/zwavejs2mqtt/commit/bfbda11cf737bd2619dd68f3c207a527e839b25c)), closes [#162](https://github.com/zwave-js/zwavejs2mqtt/issues/162)
* logging issues and moved log settings in new `general` panel ([#219](https://github.com/zwave-js/zwavejs2mqtt/issues/219)) ([07e4232](https://github.com/zwave-js/zwavejs2mqtt/commit/07e42326ac340f624053f54f922eeb1a8501aece))
* prevent empty node object to break import ([#165](https://github.com/zwave-js/zwavejs2mqtt/issues/165)) ([649ab30](https://github.com/zwave-js/zwavejs2mqtt/commit/649ab300000694b1f9d535cdf9c5621df151e51c)), closes [#156](https://github.com/zwave-js/zwavejs2mqtt/issues/156)
* set retain to false for stateless valueIds ([#215](https://github.com/zwave-js/zwavejs2mqtt/issues/215)) ([cf71d1f](https://github.com/zwave-js/zwavejs2mqtt/commit/cf71d1fa6af252c1cff156de68b13b5d7ce21137))
* show app version in control panel ([#142](https://github.com/zwave-js/zwavejs2mqtt/issues/142)) ([9af90d0](https://github.com/zwave-js/zwavejs2mqtt/commit/9af90d0a2910663a80ee9aefa5fb1bb434ccba64))
* undefined 'value notification' args.newValue ([#212](https://github.com/zwave-js/zwavejs2mqtt/issues/212)) ([f30ad83](https://github.com/zwave-js/zwavejs2mqtt/commit/f30ad83912679ace3428d91fca93a0aa1de9d5a8))
* **hass:** remove Thermofloor Z-trm2fx specific configuration (fix [#202](https://github.com/zwave-js/zwavejs2mqtt/issues/202)) ([#203](https://github.com/zwave-js/zwavejs2mqtt/issues/203)) ([ccd6989](https://github.com/zwave-js/zwavejs2mqtt/commit/ccd69894d52765f269d018811db966823e5b0ec0))
* **ui:** new location/name style ([#201](https://github.com/zwave-js/zwavejs2mqtt/issues/201)) ([21c2015](https://github.com/zwave-js/zwavejs2mqtt/commit/21c20157cf13e999646f7e2b22b01ea7c6de4567))
* **ui:** Off button posting true ([#204](https://github.com/zwave-js/zwavejs2mqtt/issues/204)) ([409ff52](https://github.com/zwave-js/zwavejs2mqtt/commit/409ff529028828b3c2f39fe40ed5ef950a21e81b))
* prevent infinite loop [#174](https://github.com/zwave-js/zwavejs2mqtt/issues/174) ([4f31a1b](https://github.com/zwave-js/zwavejs2mqtt/commit/4f31a1b5ea55e21f37825158e5ee83489d0bcd6c))
* set default node props to null instead of '' [#184](https://github.com/zwave-js/zwavejs2mqtt/issues/184) ([63aabbb](https://github.com/zwave-js/zwavejs2mqtt/commit/63aabbbe4c19c5251e8cd0f5bf780ef74cf39277))
* use yarn link instead of yalc in Dockerfile.contrib ([#181](https://github.com/zwave-js/zwavejs2mqtt/issues/181)) ([107471b](https://github.com/zwave-js/zwavejs2mqtt/commit/107471b162e4527517a3b1761086b065a91627b2))
* **docker:** run new build:full command to build zwave-js ([#154](https://github.com/zwave-js/zwavejs2mqtt/issues/154)) ([8a193ca](https://github.com/zwave-js/zwavejs2mqtt/commit/8a193ca50af4723c1acf4d9222834c92a851078f))
* **hass:** lock payload and state ([#168](https://github.com/zwave-js/zwavejs2mqtt/issues/168)) ([04952ea](https://github.com/zwave-js/zwavejs2mqtt/commit/04952ea13414e6a2d075dc2e07ec610ff4f066fc))
* **ui:** use buttons for boolean valueIds ([#151](https://github.com/zwave-js/zwavejs2mqtt/issues/151)) ([6da9a58](https://github.com/zwave-js/zwavejs2mqtt/commit/6da9a58df3a84082b1aa29195835547ff7b4e268)), closes [#133](https://github.com/zwave-js/zwavejs2mqtt/issues/133)


### Features

* add directions to access the UI from within HA ([#205](https://github.com/zwave-js/zwavejs2mqtt/issues/205)) ([51f715c](https://github.com/zwave-js/zwavejs2mqtt/commit/51f715cf9d9528bf883668aada587266d49170fa))
* allow `/` in mqtt prefix [#213](https://github.com/zwave-js/zwavejs2mqtt/issues/213) ([#214](https://github.com/zwave-js/zwavejs2mqtt/issues/214)) ([277b542](https://github.com/zwave-js/zwavejs2mqtt/commit/277b542cdd7bb603e30617b5a3a5d5ae4946b4be))
* **hass:** entities name template configuration ([#100](https://github.com/zwave-js/zwavejs2mqtt/issues/100)) ([3a63e2e](https://github.com/zwave-js/zwavejs2mqtt/commit/3a63e2eec448eee020e8016d8cc90a8f738bec00))
* **hass:** support for Battery isLow binary sensor ([#126](https://github.com/zwave-js/zwavejs2mqtt/issues/126)) ([5c511b6](https://github.com/zwave-js/zwavejs2mqtt/commit/5c511b63882c5cdcec21d929545f07ef038b4f96))
* **ui:** Group nodes by column values ([#199](https://github.com/zwave-js/zwavejs2mqtt/issues/199)) ([a2dcf32](https://github.com/zwave-js/zwavejs2mqtt/commit/a2dcf3210a9a36ece06b3d0bdf8eb36c22aabe62))
* expose node info under topic /nodeinfo ([#159](https://github.com/zwave-js/zwavejs2mqtt/issues/159)) ([8f326de](https://github.com/zwave-js/zwavejs2mqtt/commit/8f326de2a8c4f6dcce49180c7b8c6d772128558b))
* move docs to github pages using docsify ([#122](https://github.com/zwave-js/zwavejs2mqtt/issues/122)) ([3e9425d](https://github.com/zwave-js/zwavejs2mqtt/commit/3e9425d9396e6a8451080b798c06ea7d134c9f8e))



# [1.0.0-alpha.2](https://github.com/zwave-js/zwavejs2mqtt/compare/v1.0.0-alpha.1...v1.0.0-alpha.2) (2020-12-29)


### Bug Fixes

* always include endpoint in topic when using named topics [#69](https://github.com/zwave-js/zwavejs2mqtt/issues/69) ([#74](https://github.com/zwave-js/zwavejs2mqtt/issues/74)) ([35e755e](https://github.com/zwave-js/zwavejs2mqtt/commit/35e755ef1904daf327ecbd954bbc3a0c9ca6933c))
* better zwave valueid parsing ([967a28f](https://github.com/zwave-js/zwavejs2mqtt/commit/967a28f706e891604de1dd676c0fe83563964c48))
* broken logs and print stack if present ([052a043](https://github.com/zwave-js/zwavejs2mqtt/commit/052a0438ab87cee830dd586ae24fa8f7c38177b1))
* missing discovery [#109](https://github.com/zwave-js/zwavejs2mqtt/issues/109) [#108](https://github.com/zwave-js/zwavejs2mqtt/issues/108) ([#112](https://github.com/zwave-js/zwavejs2mqtt/issues/112)) ([45bcdfe](https://github.com/zwave-js/zwavejs2mqtt/commit/45bcdfe699251147cb42dc9a68000a272a123815))
* prevent undefined values on refreshInfo ([efab02e](https://github.com/zwave-js/zwavejs2mqtt/commit/efab02ef11b526808ebf21ba197ac9b08ce2d09b))
* read only list values in UI and better logging ([#102](https://github.com/zwave-js/zwavejs2mqtt/issues/102)) ([03f5610](https://github.com/zwave-js/zwavejs2mqtt/commit/03f56107d8ef5163d7c67dba5bc41b6ab48ec8e6))
* typo in units ([6205a9a](https://github.com/zwave-js/zwavejs2mqtt/commit/6205a9a7a0e0095a62340df4fa2ae3cacd2c775a))
* writeValue logs undefined valueId ([e1bcbcb](https://github.com/zwave-js/zwavejs2mqtt/commit/e1bcbcb00780372996057b824e79cfe21b2d4688))
* **hass:** better notifications names ([#98](https://github.com/zwave-js/zwavejs2mqtt/issues/98)) ([a0365a9](https://github.com/zwave-js/zwavejs2mqtt/commit/a0365a948437caec9d15f7a4f75e85298b05b0e6))
* **hass:** discovery issues caused by spaces in topic ([#99](https://github.com/zwave-js/zwavejs2mqtt/issues/99)) ([528a51c](https://github.com/zwave-js/zwavejs2mqtt/commit/528a51cb5a3fc6319158e992694df2b8c361ee70))
* **ui:** remove empty layout ([ffa300b](https://github.com/zwave-js/zwavejs2mqtt/commit/ffa300bf77fefa150d5a07ac2b2c0b61325d29ff))
* startup error in setupLogging() ([#96](https://github.com/zwave-js/zwavejs2mqtt/issues/96)) ([1b5c880](https://github.com/zwave-js/zwavejs2mqtt/commit/1b5c88093fb97bae2e80d384945f29a11516d218))


### Features

* **hass:** translate Notification CC values to string ([#105](https://github.com/zwave-js/zwavejs2mqtt/issues/105)) ([0bc3d5e](https://github.com/zwave-js/zwavejs2mqtt/commit/0bc3d5e0c9b43bbf9c09ee2d36e7507f9dca2150))
* **ui:** add nodes table filter + persistent UI settings ([#90](https://github.com/zwave-js/zwavejs2mqtt/issues/90)) ([91998e0](https://github.com/zwave-js/zwavejs2mqtt/commit/91998e04aab334b99d5a7f8026dec30de9492533))
* allow custom ZwaveOptions ([f1bf0b4](https://github.com/zwave-js/zwavejs2mqtt/commit/f1bf0b4d614fac90cf2d27e67086f562f1b9ff02))
* **docker:** allow to update devices of driver during build ([#86](https://github.com/zwave-js/zwavejs2mqtt/issues/86)) ([e7ad93b](https://github.com/zwave-js/zwavejs2mqtt/commit/e7ad93b804471b3db17fd3ac0d71db8ccc9e82b4))
* **ui:** group values by command classes ([#103](https://github.com/zwave-js/zwavejs2mqtt/issues/103)) ([306b380](https://github.com/zwave-js/zwavejs2mqtt/commit/306b3803d31e13e6dbdd8c0780740552135497b1))


### BREAKING CHANGES

* **hass:** Hass entities ids will change
Co-authored-by: V Aretakis <vassilis@aretakis.eu>
* **hass:** entities names could change



# [1.0.0-alpha.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v1.0.0-alpha.0...v1.0.0-alpha.1) (2020-12-18)


### Bug Fixes

* catch errors from zwave driver contructor [#61](https://github.com/zwave-js/zwavejs2mqtt/issues/61) ([#75](https://github.com/zwave-js/zwavejs2mqtt/issues/75)) ([80093c5](https://github.com/zwave-js/zwavejs2mqtt/commit/80093c5c309b4737d41c7a8f4b4e33ecf1b629a4))
* empty endpoint ([#65](https://github.com/zwave-js/zwavejs2mqtt/issues/65)) ([36638d2](https://github.com/zwave-js/zwavejs2mqtt/commit/36638d2b720a16236588158a6aafccc507b723ae))
* ensure node ready when discovering values ([#54](https://github.com/zwave-js/zwavejs2mqtt/issues/54)) ([4076085](https://github.com/zwave-js/zwavejs2mqtt/commit/4076085965cc2db2c9d6df91909c7a9fad04bfb0))
* improve hass discovery of climates ([#68](https://github.com/zwave-js/zwavejs2mqtt/issues/68)) ([962f212](https://github.com/zwave-js/zwavejs2mqtt/commit/962f2125fc913ad3b25eeda8ea4a819089cc1fa1))
* network key generation [#80](https://github.com/zwave-js/zwavejs2mqtt/issues/80) ([#83](https://github.com/zwave-js/zwavejs2mqtt/issues/83)) ([1dd6551](https://github.com/zwave-js/zwavejs2mqtt/commit/1dd6551d60e4e8997df990e2b87f7bfe3113eddf))
* Remove Refresh values button ([#56](https://github.com/zwave-js/zwavejs2mqtt/issues/56)) ([cca3d36](https://github.com/zwave-js/zwavejs2mqtt/commit/cca3d36b41618b8597f0623cd252377d7af99385))
* replace `read_only` with `writable` ([b9a6315](https://github.com/zwave-js/zwavejs2mqtt/commit/b9a6315becfab23221428c47c81b5ac27926fed1))
* socket events constants ([5619cb3](https://github.com/zwave-js/zwavejs2mqtt/commit/5619cb3edef8c5e46b36f5b75fe62130bfea90d7))


### Features

* move to winston logger ([#67](https://github.com/zwave-js/zwavejs2mqtt/issues/67)) ([023fccf](https://github.com/zwave-js/zwavejs2mqtt/commit/023fccfa27353796396fdc1328396e4f15ecf2a4))
* **ui:** export node json for debug reasons ([#76](https://github.com/zwave-js/zwavejs2mqtt/issues/76)) ([05e30d2](https://github.com/zwave-js/zwavejs2mqtt/commit/05e30d2e3667a1bfe32b43c94f3872f693d24c3f))
* add node Location and node Name to mqtt payload ([#57](https://github.com/zwave-js/zwavejs2mqtt/issues/57)) ([0d65ed6](https://github.com/zwave-js/zwavejs2mqtt/commit/0d65ed64d3e558163edc94fc193b127fa7bb1730))
* publish app version to mqtt [#53](https://github.com/zwave-js/zwavejs2mqtt/issues/53) ([2f051a2](https://github.com/zwave-js/zwavejs2mqtt/commit/2f051a2e09600428db36dad6b4b0c8d277c70b52))



# [1.0.0-alpha.0](https://github.com/zwave-js/zwavejs2mqtt/compare/f70724f109153aa9776347c7610f4d8a03d64ad1...v1.0.0-alpha.0) (2020-12-04)


### Bug Fixes

* **hass:** meterScale [#38](https://github.com/zwave-js/zwavejs2mqtt/issues/38) ([8a621bd](https://github.com/zwave-js/zwavejs2mqtt/commit/8a621bdf7c61903b4859101b3d0f723ee4e3cd67))
* **hass:** metertype discovery ([311d0b4](https://github.com/zwave-js/zwavejs2mqtt/commit/311d0b446977acd05aba736abbbef0e8e897523a))
* add more hass modes maps ([720a9c0](https://github.com/zwave-js/zwavejs2mqtt/commit/720a9c0b1e15b0e889f9d98facacc187174ac5f8))
* allow `/` char in name and location [#790](https://github.com/zwave-js/zwavejs2mqtt/issues/790) ([#796](https://github.com/zwave-js/zwavejs2mqtt/issues/796)) ([a760246](https://github.com/zwave-js/zwavejs2mqtt/commit/a760246ada0bda5d390e97e156fbaf015bbd5bfe))
* better handle node ready event ([3ab18c5](https://github.com/zwave-js/zwavejs2mqtt/commit/3ab18c5de7452b6d76e4b628b1feff898952db14))
* better logging and remove associations only if present ([7702b9a](https://github.com/zwave-js/zwavejs2mqtt/commit/7702b9aec371d8f5440564758d0f9bc1c9515d30))
* broken page refresh 404 [#42](https://github.com/zwave-js/zwavejs2mqtt/issues/42) ([6ef44b7](https://github.com/zwave-js/zwavejs2mqtt/commit/6ef44b7883cd93920ba678ba0f6c6c5deeb224bf))
* categories of valueids [#31](https://github.com/zwave-js/zwavejs2mqtt/issues/31) ([8bb5936](https://github.com/zwave-js/zwavejs2mqtt/commit/8bb5936980d6d8432d227adb0068ccc01695ca3a))
* change default hass birth/will topic ([#639](https://github.com/zwave-js/zwavejs2mqtt/issues/639)) ([5c15a4f](https://github.com/zwave-js/zwavejs2mqtt/commit/5c15a4fa0c3e21284990b550eb032501a3916b15))
* correctly parse numbers when sending values [#1128](https://github.com/zwave-js/zwavejs2mqtt/issues/1128) ([0f1a97e](https://github.com/zwave-js/zwavejs2mqtt/commit/0f1a97e77de43ed5bad6fde43b77825125a98136))
* dinamically update ui on value added/removed ([f7c5873](https://github.com/zwave-js/zwavejs2mqtt/commit/f7c5873eca999e1555bf07776bf0f8b9df1f29c3))
* discover values after node ready ([dd1fe56](https://github.com/zwave-js/zwavejs2mqtt/commit/dd1fe56f0de57cca9a088b220ad3ad6283888b24))
* duplicate nodestatus call in initNode ([a8a984b](https://github.com/zwave-js/zwavejs2mqtt/commit/a8a984b4b13079da65bb16762214ee4f7d72e7ae))
* ensure deviceClass is not null ([dedd327](https://github.com/zwave-js/zwavejs2mqtt/commit/dedd327696a53242a4c879b81b139b84adeacb75))
* ensure temperature and mode are defined ([fe08a27](https://github.com/zwave-js/zwavejs2mqtt/commit/fe08a27f00013ba33356edee23270200e4dece29))
* error in guessFirmwareFormat ([d3c8531](https://github.com/zwave-js/zwavejs2mqtt/commit/d3c853122d091ab7fc00e8f339f389daec54f3a1))
* extended allowed charaters in name/loc [#720](https://github.com/zwave-js/zwavejs2mqtt/issues/720) ([#724](https://github.com/zwave-js/zwavejs2mqtt/issues/724)) ([6a055e9](https://github.com/zwave-js/zwavejs2mqtt/commit/6a055e9db440700f8644b21e394f7f08d060a3ff))
* extract firmware update ([af55b9b](https://github.com/zwave-js/zwavejs2mqtt/commit/af55b9be2c3dea4d2f28ccbcf89657c904ba7b6b))
* firmware update, `data` is not a buffer ([bba0f06](https://github.com/zwave-js/zwavejs2mqtt/commit/bba0f06c1c054be6b5a4dd3a0ff6c75a155ae4d5))
* health check zwave client ([eb6e6eb](https://github.com/zwave-js/zwavejs2mqtt/commit/eb6e6eb254c71c90e8247265fa289f7b665f6485))
* Honeywell 39358 Fan Control will be discovered as a fan an not a light ([#545](https://github.com/zwave-js/zwavejs2mqtt/issues/545)) ([f3e6456](https://github.com/zwave-js/zwavejs2mqtt/commit/f3e645660c0d531a54324199c4422053b8879089))
* ignoreUpdates on getGroups when initing node ([64c78ea](https://github.com/zwave-js/zwavejs2mqtt/commit/64c78ea5aa662a08258997e853ecbaf18e79480a))
* improved watch logic of customDevices [#670](https://github.com/zwave-js/zwavejs2mqtt/issues/670) ([#675](https://github.com/zwave-js/zwavejs2mqtt/issues/675)) ([086b69b](https://github.com/zwave-js/zwavejs2mqtt/commit/086b69b5a9e544f53c86ac0fc5ad3cf1b0cc5f7e))
* lint issues ([a6f05c5](https://github.com/zwave-js/zwavejs2mqtt/commit/a6f05c5187c1f50b14dd8b51cd63302c25045697))
* manually send MultilevelSwitchCCStopLevelChange cc ([4a02554](https://github.com/zwave-js/zwavejs2mqtt/commit/4a02554636c623271425e2a58d6981d12f9c7f56))
* mesh failed removed and initializing colors ([#701](https://github.com/zwave-js/zwavejs2mqtt/issues/701)) ([26d7df3](https://github.com/zwave-js/zwavejs2mqtt/commit/26d7df3fd31cf580b6a25aa1db2a5db6a990ad69))
* mismatch between sample code and text ([#575](https://github.com/zwave-js/zwavejs2mqtt/issues/575)) ([6afdc23](https://github.com/zwave-js/zwavejs2mqtt/commit/6afdc2322bbf105c36882b39dd2bfe86c9de3104))
* mqttClient connect/close methods ([#34](https://github.com/zwave-js/zwavejs2mqtt/issues/34)) ([1ccab66](https://github.com/zwave-js/zwavejs2mqtt/commit/1ccab668170275f1a0195a622fe20d921bbd8de2))
* MultilevelSwitchCCStopLevelChange import ([116d426](https://github.com/zwave-js/zwavejs2mqtt/commit/116d426322f3d9a3bcf068cd51b756dc79d67055))
* offline icons not showing [#508](https://github.com/zwave-js/zwavejs2mqtt/issues/508) ([#537](https://github.com/zwave-js/zwavejs2mqtt/issues/537)) ([84dc857](https://github.com/zwave-js/zwavejs2mqtt/commit/84dc8572510c31622fb10cc140c667d1e6aaf227))
* quiet down custom-devices-related logs ([#689](https://github.com/zwave-js/zwavejs2mqtt/issues/689)) ([7aa06e0](https://github.com/zwave-js/zwavejs2mqtt/commit/7aa06e03d440c87e4ae2ff9e0ddc30145f001795))
* readonly fields not updating on changes in UI [#480](https://github.com/zwave-js/zwavejs2mqtt/issues/480) ([#538](https://github.com/zwave-js/zwavejs2mqtt/issues/538)) ([a303841](https://github.com/zwave-js/zwavejs2mqtt/commit/a303841fb06c5f86e69614144b9b18dc7c8a0835))
* remove refreshNodeInfo and auto heal options ([#603](https://github.com/zwave-js/zwavejs2mqtt/issues/603)) ([449b03a](https://github.com/zwave-js/zwavejs2mqtt/commit/449b03a62f353b5c900e1879956ccab459bf56d3))
* removeAllAssociations and removeNodeFromAllAssociations ([d7cdc28](https://github.com/zwave-js/zwavejs2mqtt/commit/d7cdc28c0573bc8da0bbf344ddac05cb0a05ea9c))
* removeAssociation with multi instance devices ([#644](https://github.com/zwave-js/zwavejs2mqtt/issues/644)) ([0b7c942](https://github.com/zwave-js/zwavejs2mqtt/commit/0b7c9423bb6c51ecc2d6458150d2f7f13b309e8a))
* replace currTemp.units.contains() with currTemp.units.includes() ([#733](https://github.com/zwave-js/zwavejs2mqtt/issues/733)) ([b7dc921](https://github.com/zwave-js/zwavejs2mqtt/commit/b7dc921d5d9c12dbb77fd296009921e1283f48b9))
* revert to use start/stopLevelChange ([4c1bcda](https://github.com/zwave-js/zwavejs2mqtt/commit/4c1bcda05ea09459a67a6ecf05e29c96cbf83751))
* Rows per page not set correctly ([#793](https://github.com/zwave-js/zwavejs2mqtt/issues/793)) ([5cffb01](https://github.com/zwave-js/zwavejs2mqtt/commit/5cffb01f70c494d0a1318ebbeca8138bd776a837)), closes [#792](https://github.com/zwave-js/zwavejs2mqtt/issues/792)
* set node ready after adding all values ([eac3095](https://github.com/zwave-js/zwavejs2mqtt/commit/eac3095907362da5c9998b0494422d843c5e20a4))
* set node status to initializing when firstly added ([#634](https://github.com/zwave-js/zwavejs2mqtt/issues/634)) ([deb65ec](https://github.com/zwave-js/zwavejs2mqtt/commit/deb65ec5b1a32a6bfc0c10576549b7bffa85dcc8))
* set temperature_unit in climate discovery [#731](https://github.com/zwave-js/zwavejs2mqtt/issues/731) ([#732](https://github.com/zwave-js/zwavejs2mqtt/issues/732)) ([d6710fd](https://github.com/zwave-js/zwavejs2mqtt/commit/d6710fddb856172c969ac5067d675d797ef44767))
* some nits ([7cde312](https://github.com/zwave-js/zwavejs2mqtt/commit/7cde312be1d34e731aca22c3753cbd2927d8b52e))
* start/restart management [#27](https://github.com/zwave-js/zwavejs2mqtt/issues/27) ([5275ca2](https://github.com/zwave-js/zwavejs2mqtt/commit/5275ca261a44cce64bec3e1d8b54a38782077c4f))
* typo in comment ([#789](https://github.com/zwave-js/zwavejs2mqtt/issues/789)) ([cfd9f85](https://github.com/zwave-js/zwavejs2mqtt/commit/cfd9f85c8abe4b8c48504d77e32326cc9301fd93))
* undefined deviceConfig error ([d8a26da](https://github.com/zwave-js/zwavejs2mqtt/commit/d8a26dab5fe5ded81d7ce64f252c1b04c7f073ec))
* update last active on value changes ([#798](https://github.com/zwave-js/zwavejs2mqtt/issues/798)) ([fb1a905](https://github.com/zwave-js/zwavejs2mqtt/commit/fb1a905b454f16eb000ba19db4a2f422f5b12ab2))
* update valueIds on metadata updated ([a76c096](https://github.com/zwave-js/zwavejs2mqtt/commit/a76c096f7312f2be7041045f9d66f6e81bc8bd63))
* use ids without node prefix ([bb3057e](https://github.com/zwave-js/zwavejs2mqtt/commit/bb3057e344d363e598376daa12ff99e7bc21eadb))
* use isNaN ([6922fca](https://github.com/zwave-js/zwavejs2mqtt/commit/6922fcad5fa8a939d877a2af72f3a0c035ef460a))
* **hass:** 2gig thermostat valueIds ([#39](https://github.com/zwave-js/zwavejs2mqtt/issues/39)) ([e1a4642](https://github.com/zwave-js/zwavejs2mqtt/commit/e1a4642c4e378d83a4e261f3d6085e587aca2a42))
* **ui:** allow to omit endpoint in multi channel associations ([3def708](https://github.com/zwave-js/zwavejs2mqtt/commit/3def708f8c86c638333ddcd0069a77d93951cb56))
* **ui:** better associations user interface ([29ba832](https://github.com/zwave-js/zwavejs2mqtt/commit/29ba832b7fd6df5190662a0f9dddf1e2b865b4ad))
* **ui:** prompt secure in node action ([864dbe3](https://github.com/zwave-js/zwavejs2mqtt/commit/864dbe38b6ad56396ceb8a5936436b459704bd38))
* **ui:** remove duplicated associations list ([17280f5](https://github.com/zwave-js/zwavejs2mqtt/commit/17280f561ff3e6bb03fe33f4ef608e61d3b7a125))
* **ui:** vuetify deprecation `.native` ([#797](https://github.com/zwave-js/zwavejs2mqtt/issues/797)) ([6ffc26c](https://github.com/zwave-js/zwavejs2mqtt/commit/6ffc26cdc7006732725cf4bb7370fc6be52618df))
* 'Just value' payload for bool values [#214](https://github.com/zwave-js/zwavejs2mqtt/issues/214) ([e1f61f8](https://github.com/zwave-js/zwavejs2mqtt/commit/e1f61f81f8a9ec330f5ad3a18a8450f5299cd81b))
* add missing field in ci action ([#449](https://github.com/zwave-js/zwavejs2mqtt/issues/449)) ([2a7ef6f](https://github.com/zwave-js/zwavejs2mqtt/commit/2a7ef6f69523111c0744b829a130f06eb5ef8797))
* Add nodeid to device identifiers ([4c864a2](https://github.com/zwave-js/zwavejs2mqtt/commit/4c864a2fedadea3b62df56b1233723c4b404e754))
* Added exclusion to commands timeout and refactored var names ([63d869d](https://github.com/zwave-js/zwavejs2mqtt/commit/63d869d9b92d0edea2c697db3f154caa00b2901c))
* Alarms hass discovery and undefined units bug [#232](https://github.com/zwave-js/zwavejs2mqtt/issues/232) [#231](https://github.com/zwave-js/zwavejs2mqtt/issues/231) ([fa2b022](https://github.com/zwave-js/zwavejs2mqtt/commit/fa2b0222b1c63bbd044df2a77faec5654c84e569))
* allow empty node name/location [#463](https://github.com/zwave-js/zwavejs2mqtt/issues/463) ([#468](https://github.com/zwave-js/zwavejs2mqtt/issues/468)) ([e90aeb6](https://github.com/zwave-js/zwavejs2mqtt/commit/e90aeb62d67a134e9e937917fa58bde1a32342d4))
* autoCompact not working on both store ([0c37c7e](https://github.com/zwave-js/zwavejs2mqtt/commit/0c37c7ec97af4bcec55c062fc2c6af2916510614))
* Buffer support on write requests [#194](https://github.com/zwave-js/zwavejs2mqtt/issues/194) ([513c51a](https://github.com/zwave-js/zwavejs2mqtt/commit/513c51a7959b43c3816162516fb11febc612d41a))
* Catch errors on node status [#256](https://github.com/zwave-js/zwavejs2mqtt/issues/256) ([7b82d4d](https://github.com/zwave-js/zwavejs2mqtt/commit/7b82d4d1c5ff9f369717fa249bcb3fcac7f430c9))
* Crash when sending wrong value type on write request [#186](https://github.com/zwave-js/zwavejs2mqtt/issues/186) ([914daa8](https://github.com/zwave-js/zwavejs2mqtt/commit/914daa89d83ecf62f55a4640259a146c56aba330))
* Custom devices not working and no hassDevices found after refreshNodeInfo fixes [#277](https://github.com/zwave-js/zwavejs2mqtt/issues/277) [#262](https://github.com/zwave-js/zwavejs2mqtt/issues/262) ([913ec33](https://github.com/zwave-js/zwavejs2mqtt/commit/913ec33502cb8726ead5865f78d464a1ddc404d8))
* Disable host checks in webpack to allow connecting externally in dev ([3f11ae2](https://github.com/zwave-js/zwavejs2mqtt/commit/3f11ae208848f0788b90235e5e0449107d214f1a))
* Discovery when payload is set to 'Just Value' ([3f535a4](https://github.com/zwave-js/zwavejs2mqtt/commit/3f535a46139e5ad45eee4abede1f22d460e3062a))
* docker build ([#493](https://github.com/zwave-js/zwavejs2mqtt/issues/493)) ([8afe2e7](https://github.com/zwave-js/zwavejs2mqtt/commit/8afe2e7a63b4cc1f9b43ba6cf71dd7bd80987aee))
* Error map used before definition ([a82492b](https://github.com/zwave-js/zwavejs2mqtt/commit/a82492b52b25b85dadcbd3e67a3da2ba562dc37c))
* Force using JSON payload when HassDiscovery is enabled ([72d202b](https://github.com/zwave-js/zwavejs2mqtt/commit/72d202b16cec8a79a49f6ba9457921e43214d29e))
* Hass auto discovery improvments ([bf3d61e](https://github.com/zwave-js/zwavejs2mqtt/commit/bf3d61e01e29be7c7401d40d7f9eb7862ab0a8a8))
* Hass discovery for SENSOR_ALARM cmd class ([7313543](https://github.com/zwave-js/zwavejs2mqtt/commit/731354352252fbd0fd51d7d34fc11f8cca99d5ec))
* Improved meter and sensorMultilevel hass auto discovery [#213](https://github.com/zwave-js/zwavejs2mqtt/issues/213) ([3913831](https://github.com/zwave-js/zwavejs2mqtt/commit/39138317e9d0b04ef9ba9fb1ebdcad282892431a))
* Integer list when payload is set to Zwave object ([c7fcfa9](https://github.com/zwave-js/zwavejs2mqtt/commit/c7fcfa98673830eaefffe182fd86bfd8a2aac588))
* lgtm alerts ([#458](https://github.com/zwave-js/zwavejs2mqtt/issues/458)) ([ac44aed](https://github.com/zwave-js/zwavejs2mqtt/commit/ac44aed7bf6cbdbf26609b583f4d4552bd0e089d))
* Locks hass discovery [#294](https://github.com/zwave-js/zwavejs2mqtt/issues/294) ([0ede845](https://github.com/zwave-js/zwavejs2mqtt/commit/0ede845b98aacffa4fc0e3de999b3ad3567b00d0))
* Make sound switch discovery only for volume [#254](https://github.com/zwave-js/zwavejs2mqtt/issues/254) ([77c4295](https://github.com/zwave-js/zwavejs2mqtt/commit/77c4295f9a326b1ede31c7fc08afbe64bc575899))
* map temperature units to hass values ([#394](https://github.com/zwave-js/zwavejs2mqtt/issues/394)) ([07f405e](https://github.com/zwave-js/zwavejs2mqtt/commit/07f405ecdaa2f6b11547a1654718762c3e635592))
* mesh link color with dark mode [#444](https://github.com/zwave-js/zwavejs2mqtt/issues/444) ([#446](https://github.com/zwave-js/zwavejs2mqtt/issues/446)) ([edec08f](https://github.com/zwave-js/zwavejs2mqtt/commit/edec08f241d1c4a4456db84fadd9f5e1327def77))
* Mqtt client close when not connected ([56d3a55](https://github.com/zwave-js/zwavejs2mqtt/commit/56d3a554b2088b2f8ab4851aec8380764a9cd712))
* Mqtt client not closing correctly ([e361976](https://github.com/zwave-js/zwavejs2mqtt/commit/e361976dd34b5262d8d3eb3219df9818073b842d))
* node select background color [#452](https://github.com/zwave-js/zwavejs2mqtt/issues/452) ([#454](https://github.com/zwave-js/zwavejs2mqtt/issues/454)) ([a21f027](https://github.com/zwave-js/zwavejs2mqtt/commit/a21f027b68e22833597e15bdfc38f1c32df9afc8))
* payload parse of rgb dimmers [#488](https://github.com/zwave-js/zwavejs2mqtt/issues/488) ([#516](https://github.com/zwave-js/zwavejs2mqtt/issues/516)) ([d8cca1a](https://github.com/zwave-js/zwavejs2mqtt/commit/d8cca1ab22280cdd12ded5101a48891d5caa76d4))
* pkg release script [#296](https://github.com/zwave-js/zwavejs2mqtt/issues/296) ([f302d3f](https://github.com/zwave-js/zwavejs2mqtt/commit/f302d3f370eceefdca6ab7a6a5710faf4c4a87a1))
* point debug output to stdout not stderror ([#423](https://github.com/zwave-js/zwavejs2mqtt/issues/423)) ([88f7414](https://github.com/zwave-js/zwavejs2mqtt/commit/88f741483f3bf6c18267997870dddf0afd0145df))
* Prevent duplicated command timeouts ([f8e9a20](https://github.com/zwave-js/zwavejs2mqtt/commit/f8e9a207bc64ab1e956c0bd202fd73277d453676))
* Prevent TypeError on undefined values [#324](https://github.com/zwave-js/zwavejs2mqtt/issues/324) ([f405067](https://github.com/zwave-js/zwavejs2mqtt/commit/f40506776e8813e6a2ca902c6864c09d69794a71))
* regex for release branch tag ([#499](https://github.com/zwave-js/zwavejs2mqtt/issues/499)) ([089e3f0](https://github.com/zwave-js/zwavejs2mqtt/commit/089e3f0abb3774cf38d70124c89499789833a169))
* Remove refreshNodeInfo from initNode to prevent loops ([61b549d](https://github.com/zwave-js/zwavejs2mqtt/commit/61b549deea1a8c0999e07563d3a18ffdb1e66e43))
* Replace space with underscore in zwave events names ([68f7e45](https://github.com/zwave-js/zwavejs2mqtt/commit/68f7e453d7c9bc4b9348d42b2d918631d6fe2116))
* respect the qos+retain config ([#432](https://github.com/zwave-js/zwavejs2mqtt/issues/432)) ([305d297](https://github.com/zwave-js/zwavejs2mqtt/commit/305d2972ede8ee1dc502db4866c97cc335fe094e))
* secret for ci action ([#448](https://github.com/zwave-js/zwavejs2mqtt/issues/448)) ([bc9ad43](https://github.com/zwave-js/zwavejs2mqtt/commit/bc9ad430b3a9ecc508928514e2e9789a6dbe5637))
* Support for climate devices with only setpoint [#199](https://github.com/zwave-js/zwavejs2mqtt/issues/199) ([9e0102e](https://github.com/zwave-js/zwavejs2mqtt/commit/9e0102ed64f16899a28cc79739f039cc223e54b3))
* Support for NodeJS 12 [#189](https://github.com/zwave-js/zwavejs2mqtt/issues/189) ([334d1d1](https://github.com/zwave-js/zwavejs2mqtt/commit/334d1d13bbc27923824a08a0c7a413bfa7e6a1be))
* Template value ([0db8d89](https://github.com/zwave-js/zwavejs2mqtt/commit/0db8d89496f08a5c1beaa2d331cbef38070f0d9a))
* typo ([9627cbd](https://github.com/zwave-js/zwavejs2mqtt/commit/9627cbddec1d7972fecb8491c5978be1d815739c))
* Typo ([cbe607a](https://github.com/zwave-js/zwavejs2mqtt/commit/cbe607aa0f6fe5ccc9c3669f4a8d9d5e53907040))
* Typo ([541f48b](https://github.com/zwave-js/zwavejs2mqtt/commit/541f48b0f03c2f7201dbbab4f086c222c0ad76b1))
* Unbind to socket events ([348ab6b](https://github.com/zwave-js/zwavejs2mqtt/commit/348ab6b11a3ee476b7e0a1bc3759ba5e1a056134))
* Undefined `this` in deviceInfo ([d33f0a1](https://github.com/zwave-js/zwavejs2mqtt/commit/d33f0a129ef38175f0da9d03e7d6546da7ca6e5a))
* Undefined error when removeNode event and no node is selected ([c0500d2](https://github.com/zwave-js/zwavejs2mqtt/commit/c0500d277fcaafdbce307857f7324da132b04b23))
* Undefined node action [#248](https://github.com/zwave-js/zwavejs2mqtt/issues/248) ([ff10f9e](https://github.com/zwave-js/zwavejs2mqtt/commit/ff10f9ebe845dbc2dc6810bf2449c573e13a6b36))
* Update mqtt-nedb-store ([211affa](https://github.com/zwave-js/zwavejs2mqtt/commit/211affa8e3b8ac5305340dd58aa669046ae0e758))
* Update network graph when node added/removed ([7b4801c](https://github.com/zwave-js/zwavejs2mqtt/commit/7b4801ced21880900b296e1c7353259b94d0e772))
* Use light dimmers for sound switch volume [#254](https://github.com/zwave-js/zwavejs2mqtt/issues/254) ([3a08226](https://github.com/zwave-js/zwavejs2mqtt/commit/3a082265bd511dbe7957d50ee90b3d63bb427338))
* Use lower case for node prefix in identifier ([1ee4ef9](https://github.com/zwave-js/zwavejs2mqtt/commit/1ee4ef9d5acc7a10c1e7157101c3ed29ae150682))
* Use readonly fields intead of disabled [#480](https://github.com/zwave-js/zwavejs2mqtt/issues/480) ([#481](https://github.com/zwave-js/zwavejs2mqtt/issues/481)) ([66d94cc](https://github.com/zwave-js/zwavejs2mqtt/commit/66d94cc09a5021a2e5058def735c2ba5419fe516))
* Validation of node names and location to match hass requirements [#344](https://github.com/zwave-js/zwavejs2mqtt/issues/344) ([fa0af36](https://github.com/zwave-js/zwavejs2mqtt/commit/fa0af3684d8937176084c29141d10bcbc7b0fb04))
* Watch for file changes when using customDevices.json ([ba5f150](https://github.com/zwave-js/zwavejs2mqtt/commit/ba5f150b9b30427ecf004146fec325f149213d5b))


### Features

* allow a zwave plugin to be defined exposing the zwave client to external js ([#364](https://github.com/zwave-js/zwavejs2mqtt/issues/364)) ([ea5442d](https://github.com/zwave-js/zwavejs2mqtt/commit/ea5442d5ac7b4a9ad0f8d5a2f2ab5bd176dac8b6))
* arbitrary zwave config ([#367](https://github.com/zwave-js/zwavejs2mqtt/issues/367)) ([032392f](https://github.com/zwave-js/zwavejs2mqtt/commit/032392f607a391e448dd1929433f438ddee30509))
* auto discover climates devices ([2d0167e](https://github.com/zwave-js/zwavejs2mqtt/commit/2d0167e3df94d9af14fe6d3664ef702c2cd86434))
* broadcast actions [#596](https://github.com/zwave-js/zwavejs2mqtt/issues/596) ([#602](https://github.com/zwave-js/zwavejs2mqtt/issues/602)) ([692017c](https://github.com/zwave-js/zwavejs2mqtt/commit/692017cc6e8a9c1b290c5ac5c8d11c725fea7c86))
* change meta theme-color based on theme [#669](https://github.com/zwave-js/zwavejs2mqtt/issues/669) ([#671](https://github.com/zwave-js/zwavejs2mqtt/issues/671)) ([97d9a33](https://github.com/zwave-js/zwavejs2mqtt/commit/97d9a33f88735dc61d466b64af0325f4393ff8d7))
* disable discovery [#405](https://github.com/zwave-js/zwavejs2mqtt/issues/405) ([#476](https://github.com/zwave-js/zwavejs2mqtt/issues/476)) ([c72f250](https://github.com/zwave-js/zwavejs2mqtt/commit/c72f2506ed72d0088fde234a2ae5015fbf96154a))
* hass barrier_operator class support [#445](https://github.com/zwave-js/zwavejs2mqtt/issues/445) ([#467](https://github.com/zwave-js/zwavejs2mqtt/issues/467)) ([03423f8](https://github.com/zwave-js/zwavejs2mqtt/commit/03423f8db508060817934473c0562c3780d599c5))
* hass discovery ([#20](https://github.com/zwave-js/zwavejs2mqtt/issues/20)) ([3794e34](https://github.com/zwave-js/zwavejs2mqtt/commit/3794e342b0e8141328fb85ad1f8e99857f7a7cd3)), closes [#35](https://github.com/zwave-js/zwavejs2mqtt/issues/35) [#36](https://github.com/zwave-js/zwavejs2mqtt/issues/36)
* hass scene_activation command class support [#445](https://github.com/zwave-js/zwavejs2mqtt/issues/445) ([#482](https://github.com/zwave-js/zwavejs2mqtt/issues/482)) ([f750ca6](https://github.com/zwave-js/zwavejs2mqtt/commit/f750ca6ec1d8a4955da3de0e493d41585a21033c))
* hide/show location in mesh nodes ([#404](https://github.com/zwave-js/zwavejs2mqtt/issues/404)) ([cd9cf84](https://github.com/zwave-js/zwavejs2mqtt/commit/cd9cf848ba757bf736ac5ef58b0a691676b565ae))
* improve docker build performances ([#572](https://github.com/zwave-js/zwavejs2mqtt/issues/572)) ([2e2ec46](https://github.com/zwave-js/zwavejs2mqtt/commit/2e2ec462b5861207b1d8a31bf924cbab55a5a602))
* improve HASS discovery of cover devices ([#783](https://github.com/zwave-js/zwavejs2mqtt/issues/783)) ([17bfbfe](https://github.com/zwave-js/zwavejs2mqtt/commit/17bfbfead49884536b3f22089a158907ba6c5653))
* improve support for Inovelli LWZ42 ([#574](https://github.com/zwave-js/zwavejs2mqtt/issues/574)) ([e508bbb](https://github.com/zwave-js/zwavejs2mqtt/commit/e508bbb836f0dd019323b40daff0d9b9449ad279))
* move to zwavejs ([#6](https://github.com/zwave-js/zwavejs2mqtt/issues/6)) ([32249fb](https://github.com/zwave-js/zwavejs2mqtt/commit/32249fbfdbc86735abff731b175df6773e02ee6b))
* OZW_NETWORK_KEY env var [#680](https://github.com/zwave-js/zwavejs2mqtt/issues/680) ([#725](https://github.com/zwave-js/zwavejs2mqtt/issues/725)) ([17119ed](https://github.com/zwave-js/zwavejs2mqtt/commit/17119ed39b63500be17b9f188ed71ce8386767c3))
* parse value functions [#739](https://github.com/zwave-js/zwavejs2mqtt/issues/739) ([#741](https://github.com/zwave-js/zwavejs2mqtt/issues/741)) ([c356a5b](https://github.com/zwave-js/zwavejs2mqtt/commit/c356a5bf10892eb8c8221249c3b95ee7bba61efe))
* random network key generator ([3868358](https://github.com/zwave-js/zwavejs2mqtt/commit/38683583907408e7451d33c004c0ee8826794e74))
* remove all associations ([93e8b70](https://github.com/zwave-js/zwavejs2mqtt/commit/93e8b7050d075e17ae09a308fb4d7d0e488d6fa0))
* replace failed node and show hexId in control panel ([#17](https://github.com/zwave-js/zwavejs2mqtt/issues/17)) ([78c5fbe](https://github.com/zwave-js/zwavejs2mqtt/commit/78c5fbe90ecefc3c8b68f4373104e6ec5e22da70)), closes [#18](https://github.com/zwave-js/zwavejs2mqtt/issues/18)
* socket manager and  better application startup ([#51](https://github.com/zwave-js/zwavejs2mqtt/issues/51)) ([19e6ac4](https://github.com/zwave-js/zwavejs2mqtt/commit/19e6ac47c52d6b44efdfd8bc05d26d18cb975db1))
* support start stop commands for multilevel switch ([2804c39](https://github.com/zwave-js/zwavejs2mqtt/commit/2804c39a7ef6a8972d668945ad9e1d706c228634))
* **hass:** add deviceId '881-21-2' for Eurotronic Spirit Z-Wave Plus device ([#799](https://github.com/zwave-js/zwavejs2mqtt/issues/799)) ([545102b](https://github.com/zwave-js/zwavejs2mqtt/commit/545102bd5119ec751434581eca369c7a3bff2e8b))
* **hass:** Eurotronic Stella Z thermostat ([#746](https://github.com/zwave-js/zwavejs2mqtt/issues/746)) ([7dbd4c8](https://github.com/zwave-js/zwavejs2mqtt/commit/7dbd4c84b5a385762ca836b10357ee406c9748ee))
* **hass:** Intermatic PE653 MultiWave Receiver ([#618](https://github.com/zwave-js/zwavejs2mqtt/issues/618)) ([7fe91b5](https://github.com/zwave-js/zwavejs2mqtt/commit/7fe91b53c3a9b1aa28d88067fc4abd449442ba43))
* **ui:** user friendly associations list ([455c07c](https://github.com/zwave-js/zwavejs2mqtt/commit/455c07c5bdc2e19722a319151335ae8b2185bd90))
* show version in log output ([#485](https://github.com/zwave-js/zwavejs2mqtt/issues/485)) ([7c9d556](https://github.com/zwave-js/zwavejs2mqtt/commit/7c9d556eececddeebe4f2be33641bd8250cb15e2))
* support more ENV VARS for configuration ([#788](https://github.com/zwave-js/zwavejs2mqtt/issues/788)) ([d7bdb2c](https://github.com/zwave-js/zwavejs2mqtt/commit/d7bdb2c430775b22d355990fb29c9862c1e3d0c8))
* **hass:** adding CT100 using 2GIG template ([#776](https://github.com/zwave-js/zwavejs2mqtt/issues/776)) ([3c7e7c5](https://github.com/zwave-js/zwavejs2mqtt/commit/3c7e7c5c5935d074a5919a65e5958a5ed608f1bc))
*  Show device id on node tab ([80103f4](https://github.com/zwave-js/zwavejs2mqtt/commit/80103f4f48a969f6d4ac4a420ae8951262c0ab5b))
* Add args to apis response [#301](https://github.com/zwave-js/zwavejs2mqtt/issues/301) ([0635ece](https://github.com/zwave-js/zwavejs2mqtt/commit/0635ece9ff994c7307415b16594812342997ab8c))
* Add getInfo api fix [#297](https://github.com/zwave-js/zwavejs2mqtt/issues/297) ([b57fb82](https://github.com/zwave-js/zwavejs2mqtt/commit/b57fb827da34ba873196d46d4efa3893b834b552))
* Add location to names in control panel associations ([fe9511e](https://github.com/zwave-js/zwavejs2mqtt/commit/fe9511e0da043b29e9a3561b43b4acf2f1575f5a))
* Add options to getInfo api [#333](https://github.com/zwave-js/zwavejs2mqtt/issues/333) ([5b3aaf2](https://github.com/zwave-js/zwavejs2mqtt/commit/5b3aaf24f201d46f3f2e527897fc6ba2b66b220b))
* Add status string to node status and lastUpdate value on zwave valueId object [#260](https://github.com/zwave-js/zwavejs2mqtt/issues/260) ([648da43](https://github.com/zwave-js/zwavejs2mqtt/commit/648da4380f114e2946ad33b243d9de7bafa134a0))
* Allow users to load custom hass devices configurations in store directory [#146](https://github.com/zwave-js/zwavejs2mqtt/issues/146) ([8579452](https://github.com/zwave-js/zwavejs2mqtt/commit/8579452ac3e745364066f11d70387460e5a6ce85))
* AutoUpdateConfigFile Zwave config option ([4a9c8c4](https://github.com/zwave-js/zwavejs2mqtt/commit/4a9c8c4e6d4e42e93801554458d02ded87ed7377))
* Button in UI to refresh node configuration params [#235](https://github.com/zwave-js/zwavejs2mqtt/issues/235) [#161](https://github.com/zwave-js/zwavejs2mqtt/issues/161) ([fb38f30](https://github.com/zwave-js/zwavejs2mqtt/commit/fb38f3071b6f9dace476a2ef5c57677f3fe86437))
* Command class sound switch 0x79 support [#254](https://github.com/zwave-js/zwavejs2mqtt/issues/254) ([fda13b9](https://github.com/zwave-js/zwavejs2mqtt/commit/fda13b9ae07d9c650fbe492427fe4f59fb4d69e6))
* getNodes api to get nodes array fix [#281](https://github.com/zwave-js/zwavejs2mqtt/issues/281) ([cccd17e](https://github.com/zwave-js/zwavejs2mqtt/commit/cccd17e6278a71a4a930908bbe499bc0076b5b2f))
* Handle nodes selection and nodes properties window ([1a03f72](https://github.com/zwave-js/zwavejs2mqtt/commit/1a03f72140eff0247305f0b3551b4a639c93c59f))
* Hass device Heatit TF 056 (Thermofloor) ([8f933ed](https://github.com/zwave-js/zwavejs2mqtt/commit/8f933edfaee40214ac9a0a04c00bf2dc7321f4aa))
* Hass discovery support Fibaro FGS222 Qubino flush shutter ([#340](https://github.com/zwave-js/zwavejs2mqtt/issues/340)) ([5d4ff48](https://github.com/zwave-js/zwavejs2mqtt/commit/5d4ff486c99a1f51429499e3c4f37e2ac7533461))
* Hass Graber/Bali/Spring Fashion and Qubino Covers ([#363](https://github.com/zwave-js/zwavejs2mqtt/issues/363)) ([f454167](https://github.com/zwave-js/zwavejs2mqtt/commit/f4541673c1fc2449f48f62ae2bfb5c60a06b2303))
* Health check endpoints [#264](https://github.com/zwave-js/zwavejs2mqtt/issues/264) ([3396b75](https://github.com/zwave-js/zwavejs2mqtt/commit/3396b75935631ce8490130985fdd6c59e7bb4f15))
* HRT4-ZW device from Hortmann. ([#347](https://github.com/zwave-js/zwavejs2mqtt/issues/347)) ([15d7b53](https://github.com/zwave-js/zwavejs2mqtt/commit/15d7b5311aa2320faff9f9ce50ead6ce995342a8))
* Inclusion timeout [#244](https://github.com/zwave-js/zwavejs2mqtt/issues/244) ([9b4fc8d](https://github.com/zwave-js/zwavejs2mqtt/commit/9b4fc8d1b8fce47f49a573f6cf43642045dc01a7))
* Mesh graph showing node neighbors ([5c73aa4](https://github.com/zwave-js/zwavejs2mqtt/commit/5c73aa4b94eea29d2cea03a5be623a3093d1d0f9))
* Nodes lastActive field [#319](https://github.com/zwave-js/zwavejs2mqtt/issues/319) ([6b07091](https://github.com/zwave-js/zwavejs2mqtt/commit/6b070915c98ed31f47340a3a6ebe55cc454360f7))
* Parse lock/unlock payloads coming from hass [#294](https://github.com/zwave-js/zwavejs2mqtt/issues/294) ([30f5b35](https://github.com/zwave-js/zwavejs2mqtt/commit/30f5b35551a9058ea1cee479ac57e691ce707ab5))
* Precision support and default set to 0.1 on hass discovery climate devices ([#326](https://github.com/zwave-js/zwavejs2mqtt/issues/326)) ([0d44d23](https://github.com/zwave-js/zwavejs2mqtt/commit/0d44d232ed85778b6eb547071b384b51cdd3a2fc))
* Publish zwave events to MQTT [#207](https://github.com/zwave-js/zwavejs2mqtt/issues/207) [#167](https://github.com/zwave-js/zwavejs2mqtt/issues/167) [#140](https://github.com/zwave-js/zwavejs2mqtt/issues/140) ([09cc9c7](https://github.com/zwave-js/zwavejs2mqtt/commit/09cc9c7c38d9c2836b9b16c24bf77508af0e8e03))
* Rediscover node button to update node discovered values after changing node name/location [#153](https://github.com/zwave-js/zwavejs2mqtt/issues/153) ([be5e356](https://github.com/zwave-js/zwavejs2mqtt/commit/be5e356eaf41b24530e4c487f6ed39e9f78fbb25))
* Refresh node info and auto healing options [#174](https://github.com/zwave-js/zwavejs2mqtt/issues/174) ([f70724f](https://github.com/zwave-js/zwavejs2mqtt/commit/f70724f109153aa9776347c7610f4d8a03d64ad1))
* Replace confirm dialog with Vuetify dialog fix [#202](https://github.com/zwave-js/zwavejs2mqtt/issues/202) ([a45900a](https://github.com/zwave-js/zwavejs2mqtt/commit/a45900aa9ac42528331e311f7a7d2662ef54363e))
* reverse proxy dynamic subpath ([#540](https://github.com/zwave-js/zwavejs2mqtt/issues/540)) ([b10e8c9](https://github.com/zwave-js/zwavejs2mqtt/commit/b10e8c91f775e14598ca003bc42b030642b8b355))
* show associations of multi-instance devices [#637](https://github.com/zwave-js/zwavejs2mqtt/issues/637) ([#640](https://github.com/zwave-js/zwavejs2mqtt/issues/640)) ([305ff61](https://github.com/zwave-js/zwavejs2mqtt/commit/305ff61d898958dfa37e8a2044324cb1c48f3b13))
* Show device id in device gateway values dropdown ([f2d112c](https://github.com/zwave-js/zwavejs2mqtt/commit/f2d112ca5bd29dcf3298ee2507c19a5cbc502124))
* Show node name and location of removed nodes [#341](https://github.com/zwave-js/zwavejs2mqtt/issues/341) ([5309dbb](https://github.com/zwave-js/zwavejs2mqtt/commit/5309dbb21294f9b7ec5d8d6d2359353d221d0c51))
* Show OZW version in control panel ([84fc35a](https://github.com/zwave-js/zwavejs2mqtt/commit/84fc35a74e1d94bc88d36a9969aef5567d66533e))
* subscribe using wildecards ([#475](https://github.com/zwave-js/zwavejs2mqtt/issues/475)) ([c87c8d2](https://github.com/zwave-js/zwavejs2mqtt/commit/c87c8d22bd15f4e139ef015ac5f6ed0b1268501a))
* Support dynamic reads of customDevices.json ([5812a39](https://github.com/zwave-js/zwavejs2mqtt/commit/5812a3955c042a92594c9e7b335aa425956bbf40))
* support dynamically set min_temp and max_temp in climate [#445](https://github.com/zwave-js/zwavejs2mqtt/issues/445) ([#507](https://github.com/zwave-js/zwavejs2mqtt/issues/507)) ([460ba97](https://github.com/zwave-js/zwavejs2mqtt/commit/460ba97aad5cd77534cdcba19a608d8b5b93bf3e))
* Support for fans in climate and better sensor multilevel discovery based on units [#218](https://github.com/zwave-js/zwavejs2mqtt/issues/218) [#213](https://github.com/zwave-js/zwavejs2mqtt/issues/213) ([e2bf5b0](https://github.com/zwave-js/zwavejs2mqtt/commit/e2bf5b065447f4fdef41857e40305a17d7b6ee93))
* Travis support ([ac6d8be](https://github.com/zwave-js/zwavejs2mqtt/commit/ac6d8be728d6ee742b5dc8cf2661227f5df2862d))
* update docker to ozw 1.6.240 ([#673](https://github.com/zwave-js/zwavejs2mqtt/issues/673)) ([9000f2e](https://github.com/zwave-js/zwavejs2mqtt/commit/9000f2e64897d4a29dd491925566d99d6d91c79a))


### BREAKING CHANGES

* Default Hass Birth/Will topic is changed from `hass/status` to `homeassistant/status` to reflect defaults of Hass 0.113



