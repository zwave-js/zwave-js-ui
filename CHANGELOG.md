

## [11.2.1](https://github.com/zwave-js/zwave-js-ui/compare/v11.2.0...v11.2.1) (2025-08-27)


### Bug Fixes

* **ui:** reinterview badge visibility ([1ab4ee5](https://github.com/zwave-js/zwave-js-ui/commit/1ab4ee548516eb28e16aba620c0bd4ed38e5fbae))

# [11.2.0](https://github.com/zwave-js/zwave-js-ui/compare/v11.1.0...v11.2.0) (2025-08-27)


### Bug Fixes

* device firmware update target dropdown ([d23c179](https://github.com/zwave-js/zwave-js-ui/commit/d23c1799d114cf1f3e1b7ab42bc6adb17c5902bb)), closes [#4332](https://github.com/zwave-js/zwave-js-ui/issues/4332)
* **tests:** disable nodejs experimental strip types flag ([b51edb1](https://github.com/zwave-js/zwave-js-ui/commit/b51edb14702d620d1184efd87e7a7e4d070451c8))
* **ui:** config update icon style ([7e7caf7](https://github.com/zwave-js/zwave-js-ui/commit/7e7caf7b583aedcdf09af80efa0b3134b3626778)), closes [#4328](https://github.com/zwave-js/zwave-js-ui/issues/4328)
* **ui:** unable to set `Force security` in nodes manager dialog ([07059be](https://github.com/zwave-js/zwave-js-ui/commit/07059bef80c8660a381b1a941732f8308926c988)), closes [#4329](https://github.com/zwave-js/zwave-js-ui/issues/4329)
* **ui:** value id labels should not be ellipsed ([7b4a55a](https://github.com/zwave-js/zwave-js-ui/commit/7b4a55a6bc6fc3e379f7e68ef3ad96a53f7856b3)), closes [#4339](https://github.com/zwave-js/zwave-js-ui/issues/4339)


### Features

* bump zwave-js@15.11.0 ([#4330](https://github.com/zwave-js/zwave-js-ui/issues/4330)) ([a984133](https://github.com/zwave-js/zwave-js-ui/commit/a984133d6b51c3ecc1caa3a9501f3a20e9063329))
* bump zwave-js@15.12.0 ([#4348](https://github.com/zwave-js/zwave-js-ui/issues/4348)) ([b287a57](https://github.com/zwave-js/zwave-js-ui/commit/b287a57afeb699ee7b9f08549e94d6aee2305d04))
* **ui, zwaveclient:** learn/secondary controller mode ([#4097](https://github.com/zwave-js/zwave-js-ui/issues/4097)) ([c64197f](https://github.com/zwave-js/zwave-js-ui/commit/c64197fd20f70293e31e5c79c03cb95df5b89db9))

# [11.1.0](https://github.com/zwave-js/zwave-js-ui/compare/v11.0.1...v11.1.0) (2025-08-07)


### Bug Fixes

* **ui:** cancel editing in smart start still triggers an undate ([87bae75](https://github.com/zwave-js/zwave-js-ui/commit/87bae75ad4e9163a77a0d68a317d468b330076e1))
* **ui:** importing QR code not working ([dfc1f0f](https://github.com/zwave-js/zwave-js-ui/commit/dfc1f0f9f98a4a7437e7ec1922a6100862555292)), closes [#4324](https://github.com/zwave-js/zwave-js-ui/issues/4324)
* **ui:** unable to change some configuration values ([cb098e1](https://github.com/zwave-js/zwave-js-ui/commit/cb098e16b7be1fc2456c0758d3d1796669ce3847)), closes [#4322](https://github.com/zwave-js/zwave-js-ui/issues/4322)


### Features

* **ui:** add tooltip for default value indication in ValueId component ([facd64c](https://github.com/zwave-js/zwave-js-ui/commit/facd64ccadee03635850c2877060be779fbff586)), closes [#4313](https://github.com/zwave-js/zwave-js-ui/issues/4313)

## [11.0.1](https://github.com/zwave-js/zwave-js-ui/compare/v11.0.0...v11.0.1) (2025-08-01)


### Bug Fixes

* UI doesn't generate security keys ([1fae61b](https://github.com/zwave-js/zwave-js-ui/commit/1fae61b34c89f8e43ceee84aec17dee6e862efee))
* **ui:** add tooltips for buttons in NodeDetails component for better user guidance ([8b3d74d](https://github.com/zwave-js/zwave-js-ui/commit/8b3d74dd82073fe4a1e812dba69b3d3b734118f5))
* **ui:** adjust column widths and improve button layout in NodeDetails component ([c57ba61](https://github.com/zwave-js/zwave-js-ui/commit/c57ba6160444351418559036e5f3eec8db2b6c5f))
* **ui:** persist items-per-page in control panel ([d1e7691](https://github.com/zwave-js/zwave-js-ui/commit/d1e7691e83e12040f0f19cbb5103c97c3866ef8b)), closes [#4315](https://github.com/zwave-js/zwave-js-ui/issues/4315)
* **ui:** priority routes select menu not visible ([ba925ec](https://github.com/zwave-js/zwave-js-ui/commit/ba925ec6beb52c09a616931f2fe452210bcbd493)), closes [#4311](https://github.com/zwave-js/zwave-js-ui/issues/4311)
* **ui:** sticky to default scrollbars ([87657b4](https://github.com/zwave-js/zwave-js-ui/commit/87657b44ae2e08ec649dad52f0234776e86a25ff)), closes [#4316](https://github.com/zwave-js/zwave-js-ui/issues/4316)


### Features

* **ci:** add GitHub Actions workflow for testing application with fake Z-Wave stick ([#4314](https://github.com/zwave-js/zwave-js-ui/issues/4314)) ([1933677](https://github.com/zwave-js/zwave-js-ui/commit/19336772b3f1fb920a4586852451d7d66e17cedd))

# [11.0.0](https://github.com/zwave-js/zwave-js-ui/compare/v10.11.0...v11.0.0) (2025-07-30)


### Bug Fixes

* **ui:** nodes manager name/location step disabled next ([ac7dc4d](https://github.com/zwave-js/zwave-js-ui/commit/ac7dc4d445ae18c41be1d89ee517ea2041a80249))


### Features

* move to Vue/Vuetify 3 ([#4290](https://github.com/zwave-js/zwave-js-ui/issues/4290)) ([e6ef07c](https://github.com/zwave-js/zwave-js-ui/commit/e6ef07cb6396baa615cb6abdc6a6fac0edcfc600))
* **ui:** enhance button group with icons and conditional styling ([5b88a26](https://github.com/zwave-js/zwave-js-ui/commit/5b88a260043ba51472a1924766ea5c5a6a4b36ec))

# [10.11.0](https://github.com/zwave-js/zwave-js-ui/compare/v10.10.0...v10.11.0) (2025-07-29)


### Features

* bump @zwave-js/server@3.2.1 ([#4302](https://github.com/zwave-js/zwave-js-ui/issues/4302)) ([5a4324a](https://github.com/zwave-js/zwave-js-ui/commit/5a4324a10ad719fd7aef0469c43be32d95c2792f))
* download Zniffer capture after saving ([#4301](https://github.com/zwave-js/zwave-js-ui/issues/4301)) ([5206508](https://github.com/zwave-js/zwave-js-ui/commit/520650896d33dacfe03cecf3a7ce552a6bdcdcce))

# [10.10.0](https://github.com/zwave-js/zwave-js-ui/compare/v10.9.0...v10.10.0) (2025-07-24)


### Bug Fixes

* region check for OTA updates ([#4299](https://github.com/zwave-js/zwave-js-ui/issues/4299)) ([4c8cae9](https://github.com/zwave-js/zwave-js-ui/commit/4c8cae9c21c325025d6f979d0ac82f7fa4712d9c))


### Features

* bump zwave-js@15.10.0 ([#4300](https://github.com/zwave-js/zwave-js-ui/issues/4300)) ([88787c1](https://github.com/zwave-js/zwave-js-ui/commit/88787c11dc772a134c484489aeffe3c26dbc0aed))
* **ui:** validate number inputs against min/max from config ([#4288](https://github.com/zwave-js/zwave-js-ui/issues/4288)) ([6e71238](https://github.com/zwave-js/zwave-js-ui/commit/6e7123827cbb3c261790f0d10db766e8c671904d)), closes [#4285](https://github.com/zwave-js/zwave-js-ui/issues/4285)

# [10.9.0](https://github.com/zwave-js/zwave-js-ui/compare/v10.8.0...v10.9.0) (2025-07-11)


### Features

* add auto power levels option for RF configuration in settings ([#4281](https://github.com/zwave-js/zwave-js-ui/issues/4281)) ([e5007e8](https://github.com/zwave-js/zwave-js-ui/commit/e5007e88d76c63a787efb859959d35ce631071c1))
* bump zwave-js@15.9.0 ([#4283](https://github.com/zwave-js/zwave-js-ui/issues/4283)) ([7abd215](https://github.com/zwave-js/zwave-js-ui/commit/7abd215827f012df6eec15b544163f84dfd73eb1))
* make RF region setting mandatory, enable auto-powerlevel by default ([#4277](https://github.com/zwave-js/zwave-js-ui/issues/4277)) ([49d00ad](https://github.com/zwave-js/zwave-js-ui/commit/49d00ad0d7212861b64eacdc32408b28c4ec8a00))
* support OTW updates via update service ([#4243](https://github.com/zwave-js/zwave-js-ui/issues/4243)) ([205e227](https://github.com/zwave-js/zwave-js-ui/commit/205e227227b39ddc0169911b5eba47de4094691c))
* use default RF region from settings for OTA update check ([#4278](https://github.com/zwave-js/zwave-js-ui/issues/4278)) ([8083af3](https://github.com/zwave-js/zwave-js-ui/commit/8083af337c49e4e366c8cd295936b35033b045b0))

# [10.8.0](https://github.com/zwave-js/zwave-js-ui/compare/v10.7.0...v10.8.0) (2025-07-07)


### Bug Fixes

* **ui:** correct template syntax for total frames display in Zniffer component ([6e5f0a4](https://github.com/zwave-js/zwave-js-ui/commit/6e5f0a4a97edd2afe27729352ad0747b5b4d7b95))
* **ui:** enhance theme handling and protocol color management ([d0efbb1](https://github.com/zwave-js/zwave-js-ui/commit/d0efbb105cccd5e4faa875b40251e7240bda1a95))
* **ui:** typo in restart prompt ([#4263](https://github.com/zwave-js/zwave-js-ui/issues/4263)) ([9e4bc7e](https://github.com/zwave-js/zwave-js-ui/commit/9e4bc7efa202167faca5a3cbb2186b1f2ba6a506))


### Features

* bump zwave-js@15.8.0 ([#4264](https://github.com/zwave-js/zwave-js-ui/issues/4264)) ([cc15d30](https://github.com/zwave-js/zwave-js-ui/commit/cc15d3057467794b33ef22821e99880aafe31a45))
* implement automatic powerlevel setting for US/EU regions ([#4269](https://github.com/zwave-js/zwave-js-ui/issues/4269)) ([ef54a21](https://github.com/zwave-js/zwave-js-ui/commit/ef54a21d2b62d34305895e0f3c0724f3731403d3))
* **ui:** improve colors contrast in dark mode ([#4092](https://github.com/zwave-js/zwave-js-ui/issues/4092)) ([c630ea4](https://github.com/zwave-js/zwave-js-ui/commit/c630ea468bad4f9f5578714b16919acb0843e245))
* **ui:** support system preference color scheme ([#4266](https://github.com/zwave-js/zwave-js-ui/issues/4266)) ([03bad6c](https://github.com/zwave-js/zwave-js-ui/commit/03bad6cadf4da4f601c2357ea521798b3e0f485b))

# [10.7.0](https://github.com/zwave-js/zwave-js-ui/compare/v10.6.1...v10.7.0) (2025-06-18)


### Features

* bump zwave-js@15.7.0 ([#4261](https://github.com/zwave-js/zwave-js-ui/issues/4261)) ([328b1f1](https://github.com/zwave-js/zwave-js-ui/commit/328b1f131a1ce2e586fef79a08ff147fdbd05fc8))
* load and display saved Zniffer captures ([#4260](https://github.com/zwave-js/zwave-js-ui/issues/4260)) ([9476f51](https://github.com/zwave-js/zwave-js-ui/commit/9476f51e71db31b26fdb39d4dbb710f46c174b28))

## [10.6.1](https://github.com/zwave-js/zwave-js-ui/compare/v10.6.0...v10.6.1) (2025-05-29)


### Features

* add support for `disableOptimisticValueUpdate` driver option ([081ed29](https://github.com/zwave-js/zwave-js-ui/commit/081ed2977827b6fe19c5140d24c9aacf35b18cfc)), closes [#4247](https://github.com/zwave-js/zwave-js-ui/issues/4247)

# [10.6.0](https://github.com/zwave-js/zwave-js-ui/compare/v10.5.1...v10.6.0) (2025-05-28)


### Bug Fixes

* **discovery:** set unit_of_measurement to null for power_factor meter ([f6b55ae](https://github.com/zwave-js/zwave-js-ui/commit/f6b55ae9b5936fdc7ce34b6c0b15433be519dc9b)), closes [#4220](https://github.com/zwave-js/zwave-js-ui/issues/4220)


### Features

* bump zwave-js@15.5.0 ([#4244](https://github.com/zwave-js/zwave-js-ui/issues/4244)) ([5767c35](https://github.com/zwave-js/zwave-js-ui/commit/5767c351ef97efb7e5e1db533c25784019368517))
* bump zwave-js@15.6.0 ([#4248](https://github.com/zwave-js/zwave-js-ui/issues/4248)) ([2ebc153](https://github.com/zwave-js/zwave-js-ui/commit/2ebc15380115d3a50c3a6f0f91a25656ad246a28))

## [10.5.1](https://github.com/zwave-js/zwave-js-ui/compare/v10.5.0...v10.5.1) (2025-05-15)


### Bug Fixes

* **discovery:** override unit_of_measurement for power_factor meter discovery ([e093382](https://github.com/zwave-js/zwave-js-ui/commit/e0933825aa46da637c50ff1cb8a43ca378c18909)), closes [#4220](https://github.com/zwave-js/zwave-js-ui/issues/4220)
* otw update and node firmware update progress hangs on finish ([#4229](https://github.com/zwave-js/zwave-js-ui/issues/4229)) ([5f36bc9](https://github.com/zwave-js/zwave-js-ui/commit/5f36bc95d63d8bcb4ef6476a596313814b557527))


### Features

* bump zwave-js@15.4.2 ([#4239](https://github.com/zwave-js/zwave-js-ui/issues/4239)) ([9c1311a](https://github.com/zwave-js/zwave-js-ui/commit/9c1311ae02a7555f451e9800d435c41b26753e8f))

# [10.5.0](https://github.com/zwave-js/zwave-js-ui/compare/v10.4.2...v10.5.0) (2025-05-14)


### Bug Fixes

* **discovery:** cold/warmwhite support ([fe83a9a](https://github.com/zwave-js/zwave-js-ui/commit/fe83a9ae23165f13be8e7346e2e34f7f4a938a90)), closes [#4232](https://github.com/zwave-js/zwave-js-ui/issues/4232)
* **discovery:** correctly set `power_factor` device class ([e4000c3](https://github.com/zwave-js/zwave-js-ui/commit/e4000c30272b8e81f77b19bace118a575f3781b8)), closes [#4220](https://github.com/zwave-js/zwave-js-ui/issues/4220)
* **nodes-table:** disable RF Region selection when not supported ([cf88c28](https://github.com/zwave-js/zwave-js-ui/commit/cf88c28b03e407817f29eb9e4edab60eef41da19)), closes [#4235](https://github.com/zwave-js/zwave-js-ui/issues/4235)
* update vite-plugin-pwa to version 1.0.0 and remove service worker file ([18ba316](https://github.com/zwave-js/zwave-js-ui/commit/18ba316ea271340559f027188aba2e7bf9c988db))


### Features

* bump zwave-js@15.4.1 ([#4236](https://github.com/zwave-js/zwave-js-ui/issues/4236)) ([361f54d](https://github.com/zwave-js/zwave-js-ui/commit/361f54d512dda2578c4da15e212a0d2dd0892024))
* implement service worker update prompt ([ef7efd0](https://github.com/zwave-js/zwave-js-ui/commit/ef7efd072fef922a3cefbf80073079888dc3a69e))

## [10.4.2](https://github.com/zwave-js/zwave-js-ui/compare/v10.4.1...v10.4.2) (2025-05-08)


### Bug Fixes

* bump Z-Wave JS Server to 3.0.2 ([#4227](https://github.com/zwave-js/zwave-js-ui/issues/4227)) ([f349990](https://github.com/zwave-js/zwave-js-ui/commit/f34999065997e8c418f7c404c6a7a9d8777a626e))

## [10.4.1](https://github.com/zwave-js/zwave-js-ui/compare/v10.4.0...v10.4.1) (2025-05-07)


### Features

* bump zwave-js@15.3.1 ([#4226](https://github.com/zwave-js/zwave-js-ui/issues/4226)) ([90aa1f6](https://github.com/zwave-js/zwave-js-ui/commit/90aa1f653d5c71d03672ba914d1f2a750e182aa2))

# [10.4.0](https://github.com/zwave-js/zwave-js-ui/compare/v10.3.3...v10.4.0) (2025-05-05)


### Bug Fixes

* correct serialization of Uint8Array in MQTT messages ([#4215](https://github.com/zwave-js/zwave-js-ui/issues/4215)) ([d2c182d](https://github.com/zwave-js/zwave-js-ui/commit/d2c182d7ba1317060d2936fc07689e873a790a11))


### Features

* update zwave-js to 15.3.0, always add event handlers after `driver ready` event ([#4219](https://github.com/zwave-js/zwave-js-ui/issues/4219)) ([64ae6b4](https://github.com/zwave-js/zwave-js-ui/commit/64ae6b4fd5290e592839049c5bf884bfed38d0e2))


### Performance Improvements

* eliminate usage of zwave-js's `/safe` entrypoints and reduce bundle size by 60% ([#4214](https://github.com/zwave-js/zwave-js-ui/issues/4214)) ([60d08ce](https://github.com/zwave-js/zwave-js-ui/commit/60d08cea5ea50134983105701c0cddce53b874f9))

## [10.3.3](https://github.com/zwave-js/zwave-js-ui/compare/v10.3.2...v10.3.3) (2025-04-26)


### Features

* bump zwave-js@15.1.3 ([#4212](https://github.com/zwave-js/zwave-js-ui/issues/4212)) ([9a8bd58](https://github.com/zwave-js/zwave-js-ui/commit/9a8bd581c1dc03f0ec603f7c3ca1f08b372bf582))

## [10.3.2](https://github.com/zwave-js/zwave-js-ui/compare/v10.3.1...v10.3.2) (2025-04-26)


### Bug Fixes

* avoid error `isAnySendDataMessage is not a function` ([#4211](https://github.com/zwave-js/zwave-js-ui/issues/4211)) ([80f87dc](https://github.com/zwave-js/zwave-js-ui/commit/80f87dc915754d60b799cff47c9d40df00c1a776))

## [10.3.1](https://github.com/zwave-js/zwave-js-ui/compare/v10.3.0...v10.3.1) (2025-04-24)


### Features

* bump zwave-js@15.1.0 ([#4208](https://github.com/zwave-js/zwave-js-ui/issues/4208)) ([97683f2](https://github.com/zwave-js/zwave-js-ui/commit/97683f286630616ab575a3ff21cfbdbf3e2cb610))

# [10.3.0](https://github.com/zwave-js/zwave-js-ui/compare/v10.2.0...v10.3.0) (2025-04-22)


### Bug Fixes

* ignore messages from non-matching Z-UI clients in MQTT handling ([0e08e3a](https://github.com/zwave-js/zwave-js-ui/commit/0e08e3a79e02656f47dc5b058ec08c02bbf6d90f)), closes [#4196](https://github.com/zwave-js/zwave-js-ui/issues/4196)


### Features

* expose values of the controller node ([#4206](https://github.com/zwave-js/zwave-js-ui/issues/4206)) ([5fd7a94](https://github.com/zwave-js/zwave-js-ui/commit/5fd7a9425d535688d2377e0a524929df4bf34758))

# [10.2.0](https://github.com/zwave-js/zwave-js-ui/compare/v10.1.5...v10.2.0) (2025-04-14)


### Bug Fixes

* refresh LR powerlevel, not region after setting LR powerlevel ([#4198](https://github.com/zwave-js/zwave-js-ui/issues/4198)) ([741878a](https://github.com/zwave-js/zwave-js-ui/commit/741878a41dfb6763b98a2dc9f2ccd98235ccdffa))


### Features

* bump zwave-js@15.0.6 ([#4201](https://github.com/zwave-js/zwave-js-ui/issues/4201)) ([9df8b19](https://github.com/zwave-js/zwave-js-ui/commit/9df8b1916a7bcc7c61fbd6a372155e6f035ccf13))

## [10.1.5](https://github.com/zwave-js/zwave-js-ui/compare/v10.1.4...v10.1.5) (2025-04-07)


### Bug Fixes

* config path resolution inside pkg on Windows ([#4190](https://github.com/zwave-js/zwave-js-ui/issues/4190)) ([8a8847a](https://github.com/zwave-js/zwave-js-ui/commit/8a8847a43c56b4a94bb39ac0b6583e2e27b06c0f))


### Features

* bump zwave-js@15.0.5 ([#4191](https://github.com/zwave-js/zwave-js-ui/issues/4191)) ([7e351fe](https://github.com/zwave-js/zwave-js-ui/commit/7e351fe0bffb58d994571486c97402a40325e9a6))

## [10.1.4](https://github.com/zwave-js/zwave-js-ui/compare/v10.1.3...v10.1.4) (2025-04-02)


### Features

* bump zwave-js@15.0.4 ([#4185](https://github.com/zwave-js/zwave-js-ui/issues/4185)) ([90faddc](https://github.com/zwave-js/zwave-js-ui/commit/90faddc2a617ff7c77f578527a1d4481604b6aa3))

## [10.1.3](https://github.com/zwave-js/zwave-js-ui/compare/v10.1.2...v10.1.3) (2025-03-27)


### Bug Fixes

* **discovery:** improve check for updating thermostats discovery ([#4176](https://github.com/zwave-js/zwave-js-ui/issues/4176)) ([a6d908d](https://github.com/zwave-js/zwave-js-ui/commit/a6d908d9a13c05009a766f65f59617993b429155))
* **ui:** enhance help method to include min and max values ([3c64537](https://github.com/zwave-js/zwave-js-ui/commit/3c645378fa2c67807b4204692fccaf5d624e583c)), closes [#3789](https://github.com/zwave-js/zwave-js-ui/issues/3789)
* **ui:** restart button not visible when auth is not enabled ([f89158b](https://github.com/zwave-js/zwave-js-ui/commit/f89158b87310efa63a77f19365c0481fc0557b59)), closes [#4177](https://github.com/zwave-js/zwave-js-ui/issues/4177)

## [10.1.2](https://github.com/zwave-js/zwave-js-ui/compare/v10.1.1...v10.1.2) (2025-03-25)


### Bug Fixes

* remove leftover `console.log` statement ([#4171](https://github.com/zwave-js/zwave-js-ui/issues/4171)) ([b93c4da](https://github.com/zwave-js/zwave-js-ui/commit/b93c4da672ecf375d6fe332cfc2c1ee670ad8d2f))


### Features

* bump zwave-js@15.0.3 ([#4172](https://github.com/zwave-js/zwave-js-ui/issues/4172)) ([4f403ce](https://github.com/zwave-js/zwave-js-ui/commit/4f403ceea59d8d26dc20db9b364188cc945be238))

## [10.1.1](https://github.com/zwave-js/zwave-js-ui/compare/v10.1.0...v10.1.1) (2025-03-24)


### Bug Fixes

* normalize paths for pkg on Windows ([#4168](https://github.com/zwave-js/zwave-js-ui/issues/4168)) ([c1d935b](https://github.com/zwave-js/zwave-js-ui/commit/c1d935bb25bad0494a936c02f1834c0b8b187629))

# [10.1.0](https://github.com/zwave-js/zwave-js-ui/compare/v10.0.3...v10.1.0) (2025-03-21)


### Features

* bump zwave-js@15.0.2 to fix enum `Indicator` not defined in `pkg` bundle ([#4163](https://github.com/zwave-js/zwave-js-ui/issues/4163)) ([0ff07e0](https://github.com/zwave-js/zwave-js-ui/commit/0ff07e0ad6c8f0ff1b0149b2c121a158a1448bfb))
* support changing Zniffer LR channel config, dynamically populate frequency list ([#4139](https://github.com/zwave-js/zwave-js-ui/issues/4139)) ([58d03ed](https://github.com/zwave-js/zwave-js-ui/commit/58d03ed84c5fd5aeb4b49b2f9e1c82e59fb62542))

## [10.0.3](https://github.com/zwave-js/zwave-js-ui/compare/v10.0.2...v10.0.3) (2025-03-20)


### Bug Fixes

* config sync inside `pkg` binaries ([#4159](https://github.com/zwave-js/zwave-js-ui/issues/4159)) ([3ca34f6](https://github.com/zwave-js/zwave-js-ui/commit/3ca34f60778b1054e0cfcf27201b2a9c09ba9710))

## [10.0.2](https://github.com/zwave-js/zwave-js-ui/compare/v10.0.1...v10.0.2) (2025-03-19)


### Bug Fixes

* update Dockerfile to use Node.js 20 and streamline Alpine base image ([#4154](https://github.com/zwave-js/zwave-js-ui/issues/4154)) ([caf9f14](https://github.com/zwave-js/zwave-js-ui/commit/caf9f14d5d2fb7d76ecbb90491e2054e3e0b3de7))

## [10.0.1](https://github.com/zwave-js/zwave-js-ui/compare/v10.0.0...v10.0.1) (2025-03-19)


### Bug Fixes

* drop node 18 from workflows ([#4151](https://github.com/zwave-js/zwave-js-ui/issues/4151)) ([1d848df](https://github.com/zwave-js/zwave-js-ui/commit/1d848dfa34e5f9a7165e2ead229efd7a10f494c8))

# [10.0.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.33.1...v10.0.0) (2025-03-19)

## [9.33.1](https://github.com/zwave-js/zwave-js-ui/compare/v9.33.0...v9.33.1) (2025-03-18)


### Bug Fixes

* add type annotation for info parameter in customFormat logger ([24aca53](https://github.com/zwave-js/zwave-js-ui/commit/24aca5374d710663eb649f972efb58db9469aa49))
* explicitly add @zwave-js/core and @zwave-js/shared deps ([7522c29](https://github.com/zwave-js/zwave-js-ui/commit/7522c293b38f35d906ec69e07b91509f113183c2)), closes [#4145](https://github.com/zwave-js/zwave-js-ui/issues/4145)

# [9.33.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.32.0...v9.33.0) (2025-03-12)


### Features

* bump @zwave-js/server to 1.40.3 ([28c7b40](https://github.com/zwave-js/zwave-js-ui/commit/28c7b402024da145e2990bc105065d3fed37add5))
* bump zwave-js@14.3.12 ([#4143](https://github.com/zwave-js/zwave-js-ui/issues/4143)) ([abdc4d1](https://github.com/zwave-js/zwave-js-ui/commit/abdc4d11f2afa0f93becf9b77e7894ca47de1cb1))

# [9.32.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.31.0...v9.32.0) (2025-03-10)


### Features

* bump zwave-js@14.3.11 ([#4141](https://github.com/zwave-js/zwave-js-ui/issues/4141)) ([ce645d9](https://github.com/zwave-js/zwave-js-ui/commit/ce645d9dc7cacc1c9bbd62e66b4ad057677cc501))
* support changing max. LR powerlevel ([#4140](https://github.com/zwave-js/zwave-js-ui/issues/4140)) ([a95cc51](https://github.com/zwave-js/zwave-js-ui/commit/a95cc519c25a05ea721a4a8f8a097a513298150a))

# [9.31.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.30.1...v9.31.0) (2025-02-27)


### Bug Fixes

* **logger:** ensure maxFiles validation checks for valid format ([3d36c39](https://github.com/zwave-js/zwave-js-ui/commit/3d36c3915c814121376bb99c1d7bf43d1e062f69))
* **ui:** pressing save on settings on initial load could lead to clear actual settings ([65d1362](https://github.com/zwave-js/zwave-js-ui/commit/65d136259ba6da688873e262e531b60bb56e7745)), closes [#4128](https://github.com/zwave-js/zwave-js-ui/issues/4128)
* **ui:** sanitize search function to convert assignment to comparison in zniffer ([6a9b851](https://github.com/zwave-js/zwave-js-ui/commit/6a9b851ded4e22d437cc25d11260ecb6f5e52583)), closes [#4117](https://github.com/zwave-js/zwave-js-ui/issues/4117)
* **ui:** sort filtered nodes by name ([ca07b5d](https://github.com/zwave-js/zwave-js-ui/commit/ca07b5d3b9bd7cfcd757261547c2421b960a59b2)), closes [#4114](https://github.com/zwave-js/zwave-js-ui/issues/4114)


### Features

* add restart button on topbar ([#4132](https://github.com/zwave-js/zwave-js-ui/issues/4132)) ([d5af88d](https://github.com/zwave-js/zwave-js-ui/commit/d5af88d3e4940fe8eddf07ee5200a3d2890933cd))
* bump zwave-js@14.3.10 ([#4135](https://github.com/zwave-js/zwave-js-ui/issues/4135)) ([a208bac](https://github.com/zwave-js/zwave-js-ui/commit/a208bac5e0e4da44e396b0feccb5d9d147bb975d))
* bump zwave-js@14.3.9 ([#4131](https://github.com/zwave-js/zwave-js-ui/issues/4131)) ([831172a](https://github.com/zwave-js/zwave-js-ui/commit/831172a17d1b725625d7bc4b443f3ff88170eb1d))
* **ui:** show full date when hovering timestamp on zniffer ([#4118](https://github.com/zwave-js/zwave-js-ui/issues/4118)) ([4ebbbf8](https://github.com/zwave-js/zwave-js-ui/commit/4ebbbf8d99604aa7163aec674eecbf19ff9a4f13))

## [9.30.1](https://github.com/zwave-js/zwave-js-ui/compare/v9.30.0...v9.30.1) (2025-01-28)


### Features

* bump zwave-js@14.3.8 ([#4108](https://github.com/zwave-js/zwave-js-ui/issues/4108)) ([8b8837e](https://github.com/zwave-js/zwave-js-ui/commit/8b8837ecb53a932b4f923e80219799dcb69473f5))

# [9.30.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.29.1...v9.30.0) (2025-01-27)


### Bug Fixes

* **logger:** standardize module name formatting to uppercase ([dfa47a9](https://github.com/zwave-js/zwave-js-ui/commit/dfa47a949101fe23c79aff9e0b02faaad11592aa))
* store nodes preferences in `nodes.json` using homeHex ([#4104](https://github.com/zwave-js/zwave-js-ui/issues/4104)) ([e913f10](https://github.com/zwave-js/zwave-js-ui/commit/e913f10b0c1cb008de22148a07a5763e8633defa))
* **ui:** abort link reliability check on dialog close ([54224d2](https://github.com/zwave-js/zwave-js-ui/commit/54224d21a080ed19d3a6c214d95db23f2a86e3fb)), closes [#4105](https://github.com/zwave-js/zwave-js-ui/issues/4105)
* **ui:** cleaner popup text when refreshing associations ([abe7137](https://github.com/zwave-js/zwave-js-ui/commit/abe71370a31c31635144dff0b2731eea649842e6)), closes [#4100](https://github.com/zwave-js/zwave-js-ui/issues/4100)
* **ui:** move rebuild routes back to general actions ([c5d9691](https://github.com/zwave-js/zwave-js-ui/commit/c5d96914ebf2aafed52f675288b7ee15693647d9)), closes [#3559](https://github.com/zwave-js/zwave-js-ui/issues/3559)
* use `uncaughtException` to catch missing exceptions ([4905e0c](https://github.com/zwave-js/zwave-js-ui/commit/4905e0c2c64f8c7c60bf456cbae611ff16f99200)), closes [#4098](https://github.com/zwave-js/zwave-js-ui/issues/4098)


### Features

* bump @kvaster/zwavejs-prom plugin to 0.0.3 ([c373290](https://github.com/zwave-js/zwave-js-ui/commit/c373290a949122624307debe189d935af9de1acd)), closes [#4096](https://github.com/zwave-js/zwave-js-ui/issues/4096)
* **mqtt-discovery:** gateway values setting to enable by default Configuration CC entities ([#4106](https://github.com/zwave-js/zwave-js-ui/issues/4106)) ([81ebd61](https://github.com/zwave-js/zwave-js-ui/commit/81ebd61d6204f707f4628512b05dfe953e0796ed))

## [9.29.1](https://github.com/zwave-js/zwave-js-ui/compare/v9.29.0...v9.29.1) (2025-01-16)


### Bug Fixes

* do not allow to set `Unknown` and `Default (EU)` regions ([a9c8e3a](https://github.com/zwave-js/zwave-js-ui/commit/a9c8e3a3d14ebae3fc05bf7c9c290e1f627fdf0c))
* **ui:** allow to call rebuild routes against multiple nodes at once ([848a543](https://github.com/zwave-js/zwave-js-ui/commit/848a54387b255600b0d81bcaa99a703784bf23b1)), closes [#3559](https://github.com/zwave-js/zwave-js-ui/issues/3559)
* **ui:** editing Color Switch CC HEX color does not work ([ca030dc](https://github.com/zwave-js/zwave-js-ui/commit/ca030dceb3df16ce035cf46dbd17784d9a3dcc88)), closes [#4085](https://github.com/zwave-js/zwave-js-ui/issues/4085)
* **ui:** set default iterations for link reliability check to 100 ([#4082](https://github.com/zwave-js/zwave-js-ui/issues/4082)) ([f99c28b](https://github.com/zwave-js/zwave-js-ui/commit/f99c28b3341fb1c050b83d8b6e210d9bf215cfc6))
* **ui:** show rebuild node routes only when there are node selected ([ac1cbb3](https://github.com/zwave-js/zwave-js-ui/commit/ac1cbb30acac1dac563a136dd07368b2a6b2ab6a)), closes [#4087](https://github.com/zwave-js/zwave-js-ui/issues/4087)

# [9.29.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.28.0...v9.29.0) (2024-12-20)


### Bug Fixes

* increase key size to 2048 for certificate generation ([4222d04](https://github.com/zwave-js/zwave-js-ui/commit/4222d040e7e060ea7d24da257e51a1369ff48854))
* **ui:** cleanup CRC error frames apperance ([75fc924](https://github.com/zwave-js/zwave-js-ui/commit/75fc9246d50484e7192bec4f143b70e4960ef0a2))
* **ui:** remove unnecessary validation rule for config priority directory ([655fc92](https://github.com/zwave-js/zwave-js-ui/commit/655fc927900f0ee7e6276661a4465386c43d5d50))


### Features

* **ui:** add shortcut to replace a failed node from node advanced actions ([#4068](https://github.com/zwave-js/zwave-js-ui/issues/4068)) ([24b9082](https://github.com/zwave-js/zwave-js-ui/commit/24b9082a6f801e5972e28f7fd58669369ea063e2))

# [9.28.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.27.8...v9.28.0) (2024-12-11)


### Bug Fixes

* **ui:** correctly display CRC errors on zniffer ([#4039](https://github.com/zwave-js/zwave-js-ui/issues/4039)) ([f868b69](https://github.com/zwave-js/zwave-js-ui/commit/f868b694c8dfdcf5e2957a7db9bde39c2d99ca24))
* **ui:** typo on NodeDetails.vue ([#4052](https://github.com/zwave-js/zwave-js-ui/issues/4052)) ([9a22a9e](https://github.com/zwave-js/zwave-js-ui/commit/9a22a9e684a7baeffafb12f886b7295437f809bc))


### Features

* add default value for external Z-Wave JS config database path ([#4055](https://github.com/zwave-js/zwave-js-ui/issues/4055)) ([4b446b9](https://github.com/zwave-js/zwave-js-ui/commit/4b446b9beebe8e38e2dfb46fc95a42d4dcb4574f))

## [9.27.8](https://github.com/zwave-js/zwave-js-ui/compare/v9.27.7...v9.27.8) (2024-12-03)


### Bug Fixes

* hide rf region select when it's known ([a1e23bc](https://github.com/zwave-js/zwave-js-ui/commit/a1e23bcc4b637d58165665847fd8968e6c87c069)), closes [#4045](https://github.com/zwave-js/zwave-js-ui/issues/4045)
* wrong log module on log messages ([db352cb](https://github.com/zwave-js/zwave-js-ui/commit/db352cbeb8154d20eb2bb4982aec0a0caaede310))


### Features

* bump zwave-js@14.3.7 ([#4046](https://github.com/zwave-js/zwave-js-ui/issues/4046)) ([b544d38](https://github.com/zwave-js/zwave-js-ui/commit/b544d380a838257fda3526bb2deb0c917aca9a09))

## [9.27.7](https://github.com/zwave-js/zwave-js-ui/compare/v9.27.6...v9.27.7) (2024-11-22)


### Features

* bump zwave-js@14.3.6 ([#4032](https://github.com/zwave-js/zwave-js-ui/issues/4032)) ([6f8b617](https://github.com/zwave-js/zwave-js-ui/commit/6f8b617b07b09d59cb476e62751a53e8bb2108aa))

## [9.27.6](https://github.com/zwave-js/zwave-js-ui/compare/v9.27.5...v9.27.6) (2024-11-22)


### Features

* bump zwave-js@14.3.5 ([#4030](https://github.com/zwave-js/zwave-js-ui/issues/4030)) ([2d14560](https://github.com/zwave-js/zwave-js-ui/commit/2d145600b91e426485f64da1f75e5eee9a5f6349))

## [9.27.5](https://github.com/zwave-js/zwave-js-ui/compare/v9.27.4...v9.27.5) (2024-11-22)


### Bug Fixes

* missing @zwave-js/server package.json in bundle ([a0f9e0c](https://github.com/zwave-js/zwave-js-ui/commit/a0f9e0caddc012e476bbf7fbd45b6688cf67bd8c)), closes [#4027](https://github.com/zwave-js/zwave-js-ui/issues/4027)

## [9.27.4](https://github.com/zwave-js/zwave-js-ui/compare/v9.27.3...v9.27.4) (2024-11-21)


### Bug Fixes

* bump zwave-js and zwave-js-server ([#4024](https://github.com/zwave-js/zwave-js-ui/issues/4024)) ([9f9fc56](https://github.com/zwave-js/zwave-js-ui/commit/9f9fc56fa1a459ecc0ff20aad2ce52b61888648d))
* **ui:** vertical scrollbars not visible ([db1b647](https://github.com/zwave-js/zwave-js-ui/commit/db1b64727294cb482a5f9c7fb4ccaaabe8920328)), closes [#4014](https://github.com/zwave-js/zwave-js-ui/issues/4014)

## [9.27.3](https://github.com/zwave-js/zwave-js-ui/compare/v9.27.2...v9.27.3) (2024-11-20)


### Bug Fixes

* rollup not working on arm ([#4018](https://github.com/zwave-js/zwave-js-ui/issues/4018)) ([7048d05](https://github.com/zwave-js/zwave-js-ui/commit/7048d05198560fb1279ad82040470493628d7ce7))
* save value change options on ZWaveNode instance ([#4009](https://github.com/zwave-js/zwave-js-ui/issues/4009)) ([75981c1](https://github.com/zwave-js/zwave-js-ui/commit/75981c12edfb57d076c956a888d7d3edeaae8489))
* **ui:** better app logs spacing ([#4019](https://github.com/zwave-js/zwave-js-ui/issues/4019)) ([4b84b21](https://github.com/zwave-js/zwave-js-ui/commit/4b84b21a0bfb1f12a7e0ec5fc89949451c0e724d))

## [9.27.2](https://github.com/zwave-js/zwave-js-ui/compare/v9.27.1...v9.27.2) (2024-11-13)

## [9.27.1](https://github.com/zwave-js/zwave-js-ui/compare/v9.27.0...v9.27.1) (2024-11-12)


### Bug Fixes

* bump zwave-js to 14.3.2 ([#4000](https://github.com/zwave-js/zwave-js-ui/issues/4000)) ([db86eb9](https://github.com/zwave-js/zwave-js-ui/commit/db86eb9dc5403bd3b537da237e9677a34693eef0))
* replace `import.meta.url` with CJS shim ([#3996](https://github.com/zwave-js/zwave-js-ui/issues/3996)) ([c156075](https://github.com/zwave-js/zwave-js-ui/commit/c156075f1d664dadb426cbdfaa223dc603a49ecc))

# [9.27.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.26.0...v9.27.0) (2024-11-12)


### Bug Fixes

* **ui:** add support for `step` on value ids inputs ([1107718](https://github.com/zwave-js/zwave-js-ui/commit/1107718f674e222aa1b4efdfe4a397b68c37341d))


### Features

* allow to upload firmware in zip files ([#3985](https://github.com/zwave-js/zwave-js-ui/issues/3985)) ([5fecb60](https://github.com/zwave-js/zwave-js-ui/commit/5fecb603157fab6f70656ab4846a692a840f68bf))
* bump zwave-js@14.3.1 ([#3993](https://github.com/zwave-js/zwave-js-ui/issues/3993)) ([ce079d2](https://github.com/zwave-js/zwave-js-ui/commit/ce079d267a5eef633883aa2e171e8f8c14f87373))
* **ui:** allow to specify rf region in OTA fw updates when it's unknown ([#3984](https://github.com/zwave-js/zwave-js-ui/issues/3984)) ([b7a8c4d](https://github.com/zwave-js/zwave-js-ui/commit/b7a8c4df25b9806feea6d39ad06a7dff4fb1e690))
* **ui:** re-order Z-Wave settings, prevent setting invalid regions ([#3981](https://github.com/zwave-js/zwave-js-ui/issues/3981)) ([cf7142e](https://github.com/zwave-js/zwave-js-ui/commit/cf7142e534190511e41df057a11b7ff2edee86c3))
* zwave-js@14.3.0 and @zwave-js/server@1.40.0 ([#3960](https://github.com/zwave-js/zwave-js-ui/issues/3960)) ([b2c0372](https://github.com/zwave-js/zwave-js-ui/commit/b2c03724ff09c1e9add07df6f20292991feada6b))

# [9.26.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.25.0...v9.26.0) (2024-10-30)


### Features

* bump @zwave-js/server@1.39.0 ([#3970](https://github.com/zwave-js/zwave-js-ui/issues/3970)) ([ab24962](https://github.com/zwave-js/zwave-js-ui/commit/ab2496231ff3e8403d5b06e5f92df24b908781d6))
* bump zwave-js@13.10.2 ([#3965](https://github.com/zwave-js/zwave-js-ui/issues/3965)) ([f909f84](https://github.com/zwave-js/zwave-js-ui/commit/f909f84185cdad7bcf6e8b7d37c65da1b781cad2))
* bump zwave-js@13.10.3 ([#3968](https://github.com/zwave-js/zwave-js-ui/issues/3968)) ([885ea26](https://github.com/zwave-js/zwave-js-ui/commit/885ea266644412af3c81b859543f00c5148147bf))

# [9.25.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.24.0...v9.25.0) (2024-10-25)


### Features

* bump zwave-js@13.10.0 ([#3962](https://github.com/zwave-js/zwave-js-ui/issues/3962)) ([1f40beb](https://github.com/zwave-js/zwave-js-ui/commit/1f40beb44d5133a95b0b7cb3d95373559322bc93))
* bump zwave-js@13.10.1 ([#3964](https://github.com/zwave-js/zwave-js-ui/issues/3964)) ([5f7ee3e](https://github.com/zwave-js/zwave-js-ui/commit/5f7ee3e4121428e3f922e0be7d01906493c27fea))

# [9.24.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.23.0...v9.24.0) (2024-10-17)


### Bug Fixes

* re-use file transport instance when setup loggers ([#3928](https://github.com/zwave-js/zwave-js-ui/issues/3928)) ([ded941b](https://github.com/zwave-js/zwave-js-ui/commit/ded941bb6c28bc0947cf991cd72be173cb6e996e))
* remove OTA firmware update lock, allow parallel fw updates ([f929686](https://github.com/zwave-js/zwave-js-ui/commit/f9296865273497195444337f2e5772df2852c8c1)), closes [#3936](https://github.com/zwave-js/zwave-js-ui/issues/3936)
* **ui:** scanning of small QR codes ([#3946](https://github.com/zwave-js/zwave-js-ui/issues/3946)) ([6420ee4](https://github.com/zwave-js/zwave-js-ui/commit/6420ee4f0ee69549a55009c704641d1e7ef10120))
* **ui:** typo on NLWR, it's "next to last working route" ([#3951](https://github.com/zwave-js/zwave-js-ui/issues/3951)) ([b4baf4a](https://github.com/zwave-js/zwave-js-ui/commit/b4baf4af232db69f7017b0546cfb987355649a35))


### Features

* add option to allow disabling controller watchdog ([5b7cf9e](https://github.com/zwave-js/zwave-js-ui/commit/5b7cf9e2d01136d3d72600894c686c40d020df86)), closes [#3936](https://github.com/zwave-js/zwave-js-ui/issues/3936)
* allow to set `deletePriorityReturnRoutes` option when rebuilding return routes ([99f7b9a](https://github.com/zwave-js/zwave-js-ui/commit/99f7b9adf877235ef9077cf9f03ab2ac61f3894c)), closes [#3936](https://github.com/zwave-js/zwave-js-ui/issues/3936)
* bump zwave-js@13.9.1 ([#3955](https://github.com/zwave-js/zwave-js-ui/issues/3955)) ([2e0b76e](https://github.com/zwave-js/zwave-js-ui/commit/2e0b76e43d26d8dc384cd5615b6997b054d324dd))
* listen for `node info received` event ([#3954](https://github.com/zwave-js/zwave-js-ui/issues/3954)) ([8f873a2](https://github.com/zwave-js/zwave-js-ui/commit/8f873a2edf96fbe6a3b776653550012426311a18))

# [9.23.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.22.0...v9.23.0) (2024-10-14)


### Features

* bump zwave-js@13.9.0 ([#3948](https://github.com/zwave-js/zwave-js-ui/issues/3948)) ([d61e6ef](https://github.com/zwave-js/zwave-js-ui/commit/d61e6ef8b497b7e7b6d0026d743d27a0314824fd))

# [9.22.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.21.1...v9.22.0) (2024-10-11)


### Bug Fixes

* add controller status changes to controller events ([#3932](https://github.com/zwave-js/zwave-js-ui/issues/3932)) ([3f95e30](https://github.com/zwave-js/zwave-js-ui/commit/3f95e3083bd7ebef284a42a0a0327d3cc124e209))
* translate removal reason enum value to its name ([18bddac](https://github.com/zwave-js/zwave-js-ui/commit/18bddac35c48f94a4358fe9160fe01eb8d8ea66e)), closes [#3927](https://github.com/zwave-js/zwave-js-ui/issues/3927)


### Features

* bump zwave-js@13.5.0 ([#3930](https://github.com/zwave-js/zwave-js-ui/issues/3930)) ([75ad9e9](https://github.com/zwave-js/zwave-js-ui/commit/75ad9e97d0f83ceb074e0e3f981a053663df512b))
* bump zwave-js@13.8.0 ([#3941](https://github.com/zwave-js/zwave-js-ui/issues/3941)) ([7d1f11d](https://github.com/zwave-js/zwave-js-ui/commit/7d1f11db489ab9ea77f5cb4d2e6776c1f618f159))
* **ui:** allow to toggle auto-scroll on debug window ([#3933](https://github.com/zwave-js/zwave-js-ui/issues/3933)) ([b9b335c](https://github.com/zwave-js/zwave-js-ui/commit/b9b335c91ffead5ac38c4eab523fc28179fa86bb))

## [9.21.1](https://github.com/zwave-js/zwave-js-ui/compare/v9.21.0...v9.21.1) (2024-10-02)


### Bug Fixes

* **discovery:** correctly handle up/down commands for covers ([#3916](https://github.com/zwave-js/zwave-js-ui/issues/3916)) ([1582b2a](https://github.com/zwave-js/zwave-js-ui/commit/1582b2ad5eabcc9dae21e67257560d42f092f758))
* **ui:** hide dsk codes when streamer mode is enabled ([c0785b7](https://github.com/zwave-js/zwave-js-ui/commit/c0785b7a970e4cef79e1a3d1613e8ff64e5fe15c)), closes [#3921](https://github.com/zwave-js/zwave-js-ui/issues/3921)

# [9.21.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.20.0...v9.21.0) (2024-09-27)


### Bug Fixes

* **ui:** ui settings not persisted ([#3914](https://github.com/zwave-js/zwave-js-ui/issues/3914)) ([1bea0e7](https://github.com/zwave-js/zwave-js-ui/commit/1bea0e7fd44fff0bd0b33186b6850decb07c14f9))


### Features

* allow to upload a file to a specific folder ([#3915](https://github.com/zwave-js/zwave-js-ui/issues/3915)) ([c98c2c4](https://github.com/zwave-js/zwave-js-ui/commit/c98c2c4e1a94524b5d2e703e0fc7fe1e2a3e2a70))
* bump zwave-js@13.4.0 ([#3912](https://github.com/zwave-js/zwave-js-ui/issues/3912)) ([b9dd414](https://github.com/zwave-js/zwave-js-ui/commit/b9dd4146389da7f46fc16b4825f59a7fb8c59adb))

# [9.20.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.19.0...v9.20.0) (2024-09-23)


### Bug Fixes

* **discovery:** define units for scene and configuration values ([#3905](https://github.com/zwave-js/zwave-js-ui/issues/3905)) ([27c5e80](https://github.com/zwave-js/zwave-js-ui/commit/27c5e80b013a51d1e4e1bfbbccf0f8a172dc0183))
* **discovery:** improve covers discovery ([#3900](https://github.com/zwave-js/zwave-js-ui/issues/3900)) ([2557cbc](https://github.com/zwave-js/zwave-js-ui/commit/2557cbc57d078d6f441970083d07ecfe10613e24))
* **ui:** debug log text-area not fully visible ([5eda3b7](https://github.com/zwave-js/zwave-js-ui/commit/5eda3b7902ddac2e876cd4305922d94983578e74))
* **ui:** increese debug logs window height ([4c76e61](https://github.com/zwave-js/zwave-js-ui/commit/4c76e61cabb8930d248224f81cd8ab7e0a748638)), closes [#3908](https://github.com/zwave-js/zwave-js-ui/issues/3908)


### Features

* make default credentials for auth customizable ([#3902](https://github.com/zwave-js/zwave-js-ui/issues/3902)) ([572035a](https://github.com/zwave-js/zwave-js-ui/commit/572035ae2a106bb4bda9a9ca88401f177955e498))

# [9.19.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.18.1...v9.19.0) (2024-09-17)


### Bug Fixes

* `unknown` inclusion state ([f9418aa](https://github.com/zwave-js/zwave-js-ui/commit/f9418aac1220c92744a9aef7a6a7de0f2d166483)), closes [#3891](https://github.com/zwave-js/zwave-js-ui/issues/3891)
* remove obsolete @zwave-js/winston-daily-rotate-file in favor of original package ([#3897](https://github.com/zwave-js/zwave-js-ui/issues/3897)) ([7414c06](https://github.com/zwave-js/zwave-js-ui/commit/7414c066b9f51b48dbf792b9df537c7d9d30c03d))
* **ui:** correct legend wrt nlwr ([#3889](https://github.com/zwave-js/zwave-js-ui/issues/3889)) ([e10bc79](https://github.com/zwave-js/zwave-js-ui/commit/e10bc797b46f9455bc06f8e6fe39ac6e69bcee76))
* **ui:** improve network graph popup visibility ([#3896](https://github.com/zwave-js/zwave-js-ui/issues/3896)) ([ca84d51](https://github.com/zwave-js/zwave-js-ui/commit/ca84d5168ea8288d5c0c68566eead426f0d21cf0))
* **ui:** improve node route rebuilding description ([8d1957b](https://github.com/zwave-js/zwave-js-ui/commit/8d1957b2b008f05ba58235a951a5037ed0112e91)), closes [#3898](https://github.com/zwave-js/zwave-js-ui/issues/3898)
* **ui:** routed ack frames row style ([#3893](https://github.com/zwave-js/zwave-js-ui/issues/3893)) ([6e93060](https://github.com/zwave-js/zwave-js-ui/commit/6e93060c52caa0907720fb07b54e95ac03043bac))


### Features

* add INGRESS_TOKEN env variable to set the ingress session cookie ([#3892](https://github.com/zwave-js/zwave-js-ui/issues/3892)) ([66c930c](https://github.com/zwave-js/zwave-js-ui/commit/66c930c73e3b945fb29b9292ab4966d113f219c7))
* always show driver/app logs on debug UI even when log settings are disabled ([#3884](https://github.com/zwave-js/zwave-js-ui/issues/3884)) ([40a557e](https://github.com/zwave-js/zwave-js-ui/commit/40a557edb15d61f0633899bd783b1baebd873616))
* bump zwave-js@13.3.0 ([#3885](https://github.com/zwave-js/zwave-js-ui/issues/3885)) ([c4a9bfd](https://github.com/zwave-js/zwave-js-ui/commit/c4a9bfd54959324ca07ed9a8f301c40c3aca02f9))
* bump zwave-js@13.3.1 ([#3899](https://github.com/zwave-js/zwave-js-ui/issues/3899)) ([1362782](https://github.com/zwave-js/zwave-js-ui/commit/136278288f064898f7a72205a815b9827914b6c8))
* **discovery:** add `supported_color_modes` to lights ([#3895](https://github.com/zwave-js/zwave-js-ui/issues/3895)) ([b3df21c](https://github.com/zwave-js/zwave-js-ui/commit/b3df21cda0c1f9a3d358518fb709debb157334fe))

## [9.18.1](https://github.com/zwave-js/zwave-js-ui/compare/v9.18.0...v9.18.1) (2024-09-06)


### Bug Fixes

* **discovery:** use valueId endpoint device class for multilevel switch CC discovery ([#3877](https://github.com/zwave-js/zwave-js-ui/issues/3877)) ([a467854](https://github.com/zwave-js/zwave-js-ui/commit/a4678543e3b2ff3bb70f43aa2a5e88deb18428c2))

# [9.18.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.17.0...v9.18.0) (2024-08-30)


### Bug Fixes

* **ui:** allow to perform OTW update from controller advanced actions ([5e06fee](https://github.com/zwave-js/zwave-js-ui/commit/5e06fee50f2a9381422f62654f38082db52e7a49)), closes [#3844](https://github.com/zwave-js/zwave-js-ui/issues/3844)


### Features

* bump @zwave-js/server@1.38.0 ([#3872](https://github.com/zwave-js/zwave-js-ui/issues/3872)) ([978e2b3](https://github.com/zwave-js/zwave-js-ui/commit/978e2b38db47366173152c4eb56e836a62aa8ef0))
* bump zwave-js@13.2.0 ([#3849](https://github.com/zwave-js/zwave-js-ui/issues/3849)) ([cfcde4a](https://github.com/zwave-js/zwave-js-ui/commit/cfcde4a61113139ac2436e3d8338e9d0a6299397))
* **ui:** add streamer mode setting to hide sensitive informations ([#3867](https://github.com/zwave-js/zwave-js-ui/issues/3867)) ([f8387b4](https://github.com/zwave-js/zwave-js-ui/commit/f8387b4caeecc269aaf3d713f6043201de552ba8))
* **ui:** settings ui improvements ([#3871](https://github.com/zwave-js/zwave-js-ui/issues/3871)) ([fe93420](https://github.com/zwave-js/zwave-js-ui/commit/fe93420a596dc5dd96d55e1715b4326626c58ac7))

# [9.17.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.16.4...v9.17.0) (2024-08-07)


### Features

* bump zwave-js@13.0.3 ([#3832](https://github.com/zwave-js/zwave-js-ui/issues/3832)) ([2aa3adc](https://github.com/zwave-js/zwave-js-ui/commit/2aa3adc743cccb8b0474e6f64d306183ab379c2d))
* bump zwave-js@13.1.0 ([#3839](https://github.com/zwave-js/zwave-js-ui/issues/3839)) ([e590d88](https://github.com/zwave-js/zwave-js-ui/commit/e590d88ed996a8d0b8b0d0342edec9c28b29f529))
* use `inclusion state changed` event ([#3833](https://github.com/zwave-js/zwave-js-ui/issues/3833)) ([a452b02](https://github.com/zwave-js/zwave-js-ui/commit/a452b024f0f88b1afc523b691924c81e149f62f7))

## [9.16.4](https://github.com/zwave-js/zwave-js-ui/compare/v9.16.3...v9.16.4) (2024-07-30)


### Bug Fixes

* **ui:** log nodes rules to allow ids up to 4k ([942df8b](https://github.com/zwave-js/zwave-js-ui/commit/942df8b92c7cfcad8a5b8acae618dec0c13718ce)), closes [#3827](https://github.com/zwave-js/zwave-js-ui/issues/3827)

## [9.16.3](https://github.com/zwave-js/zwave-js-ui/compare/v9.16.2...v9.16.3) (2024-07-26)


### Bug Fixes

* **ui:** hidden security classes inputs when editing provisioning entry ([a038ab1](https://github.com/zwave-js/zwave-js-ui/commit/a038ab183e96199b85fb5048d214eea8f87618cf))
* **ui:** star image not visible on HA Addon ([2ffc1e5](https://github.com/zwave-js/zwave-js-ui/commit/2ffc1e55db98afb2a383bfb83813b72f0376fe19)), closes [#3492](https://github.com/zwave-js/zwave-js-ui/issues/3492)
* **ui:** trigger page reload on 401 (fix basic auth) ([#3825](https://github.com/zwave-js/zwave-js-ui/issues/3825)) ([176ef24](https://github.com/zwave-js/zwave-js-ui/commit/176ef248cdc87c1c7857a66c3fba37f34eca99ae))
* **ui:** wrong dsk error when editing provisioning entries ([549de6b](https://github.com/zwave-js/zwave-js-ui/commit/549de6bc8d387266c4befa6d4081ab652ea4fa19))

## [9.16.2](https://github.com/zwave-js/zwave-js-ui/compare/v9.16.1...v9.16.2) (2024-07-22)


### Bug Fixes

* **ui:** loading animation stay infinitely on ([3bcbd8b](https://github.com/zwave-js/zwave-js-ui/commit/3bcbd8b6c9e642828fec6aa38ecb467ae9448fcb)), closes [#3791](https://github.com/zwave-js/zwave-js-ui/issues/3791)
* **ui:** re-interview badge not working ([cac4a0d](https://github.com/zwave-js/zwave-js-ui/commit/cac4a0d118699bfb03399c55e7253ca672de3643)), closes [#3819](https://github.com/zwave-js/zwave-js-ui/issues/3819)
* **ui:** unable to add association ([903ed58](https://github.com/zwave-js/zwave-js-ui/commit/903ed5802ecd279cc86f8c29a2ce637245061ba6)), closes [#3822](https://github.com/zwave-js/zwave-js-ui/issues/3822)
* **ui:** use inverted checkbox to clarify settings ([#3823](https://github.com/zwave-js/zwave-js-ui/issues/3823)) ([7b48ad9](https://github.com/zwave-js/zwave-js-ui/commit/7b48ad9eb33dd4b6729fca269f2874d5eb226a7f))


### Features

* support link check modifications in zwave-js 13.0.2 ([#3824](https://github.com/zwave-js/zwave-js-ui/issues/3824)) ([0eb63a7](https://github.com/zwave-js/zwave-js-ui/commit/0eb63a71c4f1794a2ebf5a62494e720088947578))

## [9.16.1](https://github.com/zwave-js/zwave-js-ui/compare/v9.16.0...v9.16.1) (2024-07-19)


### Features

* bump zwave-js@13.0.1 ([#3818](https://github.com/zwave-js/zwave-js-ui/issues/3818)) ([044ddbf](https://github.com/zwave-js/zwave-js-ui/commit/044ddbf72d9905873de60d670164f3053e0267ec))

# [9.16.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.15.0...v9.16.0) (2024-07-18)


### Features

* support for Z-Wave JS v13 ([#3799](https://github.com/zwave-js/zwave-js-ui/issues/3799)) ([35f5e7c](https://github.com/zwave-js/zwave-js-ui/commit/35f5e7c43811bf3c7f5136c6c5b9d453aedbd97a))
* **ui:** show association error in association dialog ([#3804](https://github.com/zwave-js/zwave-js-ui/issues/3804)) ([f919273](https://github.com/zwave-js/zwave-js-ui/commit/f919273448bfc82745fba4e1a6029a933c75765a))

# [9.15.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.14.6...v9.15.0) (2024-07-17)


### Bug Fixes

* **ui:** do not allow to call `rebuildNodeRoutes` to multiple nodes ([9c80bd3](https://github.com/zwave-js/zwave-js-ui/commit/9c80bd30e322e7bdbe8de17d4a214c706b2eb28d)), closes [#3559](https://github.com/zwave-js/zwave-js-ui/issues/3559)
* **ui:** validate timezone on ui ([1c315ea](https://github.com/zwave-js/zwave-js-ui/commit/1c315ea34a6dc9a7dd1b87fc727e90ff04263b77)), closes [#3807](https://github.com/zwave-js/zwave-js-ui/issues/3807)


### Features

* bump zwave-js@12.12.5 ([#3811](https://github.com/zwave-js/zwave-js-ui/issues/3811)) ([7061e91](https://github.com/zwave-js/zwave-js-ui/commit/7061e91f069178d4e1269ef15417b80280bdf139))
* bump zwave-js@12.13.0 ([#3815](https://github.com/zwave-js/zwave-js-ui/issues/3815)) ([07404d5](https://github.com/zwave-js/zwave-js-ui/commit/07404d5db5e3e1497dcc4ab77a84a72a9c610b17))
* link reliability checks ([#3814](https://github.com/zwave-js/zwave-js-ui/issues/3814)) ([f2fc6d6](https://github.com/zwave-js/zwave-js-ui/commit/f2fc6d6984706c22ecb494ba7848a85c1af5b354))

## [9.14.6](https://github.com/zwave-js/zwave-js-ui/compare/v9.14.5...v9.14.6) (2024-07-11)


### Features

* bump zwave-js@12.12.4 ([#3806](https://github.com/zwave-js/zwave-js-ui/issues/3806)) ([5078b55](https://github.com/zwave-js/zwave-js-ui/commit/5078b55b38823e533763265188bbfa1bf2fcc2ad))

## [9.14.5](https://github.com/zwave-js/zwave-js-ui/compare/v9.14.4...v9.14.5) (2024-07-09)


### Features

* bump zwave-js@12.12.3 ([#3800](https://github.com/zwave-js/zwave-js-ui/issues/3800)) ([b5cf616](https://github.com/zwave-js/zwave-js-ui/commit/b5cf61652f1a87ada96b8bef0189050d15247700))

## [9.14.4](https://github.com/zwave-js/zwave-js-ui/compare/v9.14.3...v9.14.4) (2024-06-26)


### Bug Fixes

* **ui:** hide open in new window inside popup window ([28dc90b](https://github.com/zwave-js/zwave-js-ui/commit/28dc90badc2355c49c7294a8fe83fa8559b3808e))


### Features

* bump zwave-js@12.12.1 ([#3787](https://github.com/zwave-js/zwave-js-ui/issues/3787)) ([2010e1e](https://github.com/zwave-js/zwave-js-ui/commit/2010e1ecfb5f5fbbb9d059c76ca8db67b909926f))

## [9.14.3](https://github.com/zwave-js/zwave-js-ui/compare/v9.14.2...v9.14.3) (2024-06-25)


### Bug Fixes

* **ui:** configuration CC `Reset` button spacing ([f386c4f](https://github.com/zwave-js/zwave-js-ui/commit/f386c4f94c4727578919c2277a81f47b62ed6155))


### Features

* bump zwave-js@12.12.0 ([#3784](https://github.com/zwave-js/zwave-js-ui/issues/3784)) ([459be7a](https://github.com/zwave-js/zwave-js-ui/commit/459be7a5dcddd90dff4bf6bf917b0058fe0ccb39))
* show supported controller rf regions ([#3785](https://github.com/zwave-js/zwave-js-ui/issues/3785)) ([c7929e9](https://github.com/zwave-js/zwave-js-ui/commit/c7929e9c233a452fb09257f774b93284d185b67d))

## [9.14.2](https://github.com/zwave-js/zwave-js-ui/compare/v9.14.1...v9.14.2) (2024-06-22)


### Features

* bump zwave-js@12.11.2 ([#3782](https://github.com/zwave-js/zwave-js-ui/issues/3782)) ([e68e0cc](https://github.com/zwave-js/zwave-js-ui/commit/e68e0cce80be9fdd2036f06cadbad12552eea788))

## [9.14.1](https://github.com/zwave-js/zwave-js-ui/compare/v9.14.0...v9.14.1) (2024-06-19)


### Bug Fixes

* inclusion state not updating ([5a9a0f0](https://github.com/zwave-js/zwave-js-ui/commit/5a9a0f0f9cc6c48efeff3e71da4bba4ef1b542ac))
* **ui:** clarify export json options ([ed77c68](https://github.com/zwave-js/zwave-js-ui/commit/ed77c688feaed2f0a84aeec35e1c42dd8422ae34))
* **zniffer:** route display for inbound frames, show failed hop ([#3774](https://github.com/zwave-js/zwave-js-ui/issues/3774)) ([107f147](https://github.com/zwave-js/zwave-js-ui/commit/107f147f7fb8d958dc7d57a291dfbd703d6760d4))


### Features

* bump zwave-js@12.11.1 ([#3776](https://github.com/zwave-js/zwave-js-ui/issues/3776)) ([02b3881](https://github.com/zwave-js/zwave-js-ui/commit/02b3881b4fa59617a1f6ba87e1ce787b15c0c3da))
* **ui:** allow to change name/loc of provisioning entries binded to included nodes ([74b2fae](https://github.com/zwave-js/zwave-js-ui/commit/74b2fae044c6a1c0f5978a66e31e8d7e5e936462)), closes [#3699](https://github.com/zwave-js/zwave-js-ui/issues/3699)

# [9.14.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.13.4...v9.14.0) (2024-06-17)


### Bug Fixes

* do not remove controller event listeners ([#3767](https://github.com/zwave-js/zwave-js-ui/issues/3767)) ([9478c29](https://github.com/zwave-js/zwave-js-ui/commit/9478c298f4e44211159a9859ea93533ca817784c))
* ensure driver is ready in inclusion state interval ([628e49a](https://github.com/zwave-js/zwave-js-ui/commit/628e49add061f3c2d1550ff95b4ce5d9da0d5f7a))
* setting default region to EU ([#3756](https://github.com/zwave-js/zwave-js-ui/issues/3756)) ([247534b](https://github.com/zwave-js/zwave-js-ui/commit/247534bae2861ba3df084c4867db7d5193a50aac))


### Features

* add dump node action ([#3768](https://github.com/zwave-js/zwave-js-ui/issues/3768)) ([f07a854](https://github.com/zwave-js/zwave-js-ui/commit/f07a854e0b2f6be5a08ce746c4ef991dfca8e2b7))
* bump zwave-js@12.10.1 ([#3755](https://github.com/zwave-js/zwave-js-ui/issues/3755)) ([75808a9](https://github.com/zwave-js/zwave-js-ui/commit/75808a9210e183ae2de6b760ebd1bd7c68a14039))
* bump zwave-js@12.11.0 ([#3762](https://github.com/zwave-js/zwave-js-ui/issues/3762)) ([724045c](https://github.com/zwave-js/zwave-js-ui/commit/724045c8bbb1b36112893447e7f242cb50bf588a))
* **env:** add Long Range key overrides from env ([#3766](https://github.com/zwave-js/zwave-js-ui/issues/3766)) ([c12448c](https://github.com/zwave-js/zwave-js-ui/commit/c12448c6a9582cd8c807063739f152c724b0094a))

## [9.13.4](https://github.com/zwave-js/zwave-js-ui/compare/v9.13.3...v9.13.4) (2024-06-05)


### Bug Fixes

* set up events before calling `Zniffer.init()` ([#3745](https://github.com/zwave-js/zwave-js-ui/issues/3745)) ([66ff0e3](https://github.com/zwave-js/zwave-js-ui/commit/66ff0e3403a1db5e561bb198a01056f66b4979b5))


### Features

* bump zwave-js@12.10.0 ([#3752](https://github.com/zwave-js/zwave-js-ui/issues/3752)) ([184db69](https://github.com/zwave-js/zwave-js-ui/commit/184db696f63aa217d6d4e262497c21398f3d983d))

## [9.13.3](https://github.com/zwave-js/zwave-js-ui/compare/v9.13.2...v9.13.3) (2024-06-03)


### Bug Fixes

* **ui:** blank login screen ([478f1b6](https://github.com/zwave-js/zwave-js-ui/commit/478f1b64605f97fcc157df83caf15ff8c13dfad1)), closes [#3737](https://github.com/zwave-js/zwave-js-ui/issues/3737)
* **ui:** nodes table header from breaking line ([#3738](https://github.com/zwave-js/zwave-js-ui/issues/3738)) ([93e4ecf](https://github.com/zwave-js/zwave-js-ui/commit/93e4ecfa0bb53a33605da94077090b852b4b53e4))

## [9.13.2](https://github.com/zwave-js/zwave-js-ui/compare/v9.13.1...v9.13.2) (2024-05-31)


### Bug Fixes

* **ui:** frames table style optimizations ([73e6713](https://github.com/zwave-js/zwave-js-ui/commit/73e671310408de7fda2a1480df8d98a36f305ce5)), closes [#3732](https://github.com/zwave-js/zwave-js-ui/issues/3732)
* **ui:** hide protocol selection when editing smart start entry that doesn't support long range ([b939f97](https://github.com/zwave-js/zwave-js-ui/commit/b939f979a72242ab2da7106cc052c1943300b507)), closes [#3735](https://github.com/zwave-js/zwave-js-ui/issues/3735)
* **ui:** tz not fetched correctly ([a603a22](https://github.com/zwave-js/zwave-js-ui/commit/a603a22a7a981659bb06f7efdf1d6a0e7fb8ead0))


### Features

* **ui:** add skeleton loaders while initing ([94d5410](https://github.com/zwave-js/zwave-js-ui/commit/94d54106d504d822430be6e8883b30dda464f05e)), closes [#3733](https://github.com/zwave-js/zwave-js-ui/issues/3733)
* **ui:** button to copy keys from driver to zniffer ([0c5b1f1](https://github.com/zwave-js/zwave-js-ui/commit/0c5b1f131ded8cbe2e079ea034f6d700b355cce8)), closes [#3731](https://github.com/zwave-js/zwave-js-ui/issues/3731)

## [9.13.1](https://github.com/zwave-js/zwave-js-ui/compare/v9.13.0...v9.13.1) (2024-05-30)


### Bug Fixes

* **ui:** serial port validation ([f7f846e](https://github.com/zwave-js/zwave-js-ui/commit/f7f846e28f2f9d368f9c690d208df89a56cde717)), closes [#3728](https://github.com/zwave-js/zwave-js-ui/issues/3728)
* **zniffer:** possible error when zniffer is disabled ([6c42bf8](https://github.com/zwave-js/zwave-js-ui/commit/6c42bf86b3a4d1b01f3370af389a23f20f84ebce)), closes [#3729](https://github.com/zwave-js/zwave-js-ui/issues/3729)

# [9.13.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.12.0...v9.13.0) (2024-05-30)


### Bug Fixes

* **ui:** cleaner rebuild routes hint ([e51cf52](https://github.com/zwave-js/zwave-js-ui/commit/e51cf52bea1d1795f75fdf68abfbe9568131cfaf))
* **ui:** groups associations for LR nodes ([#3702](https://github.com/zwave-js/zwave-js-ui/issues/3702)) ([3b9505b](https://github.com/zwave-js/zwave-js-ui/commit/3b9505b91db14749a7379df090dba4a6c5907f6c))
* **ui:** move valueId spinner after control ([efbfe13](https://github.com/zwave-js/zwave-js-ui/commit/efbfe1386495d9e22413c3542a6249ed42353d71)), closes [#3726](https://github.com/zwave-js/zwave-js-ui/issues/3726)


### Features

* bump @zwave-js/server to 1.35.0 ([#3710](https://github.com/zwave-js/zwave-js-ui/issues/3710)) ([18b89db](https://github.com/zwave-js/zwave-js-ui/commit/18b89dbf5d5223590a586e46f753eb91d72a9cee))
* bump mqtt@5.6.0 ([a18d1a5](https://github.com/zwave-js/zwave-js-ui/commit/a18d1a555d1b9c64e7b4082c64bd2519bf570dbf))
* bump zwave-js@12.6.0 ([#3704](https://github.com/zwave-js/zwave-js-ui/issues/3704)) ([db51955](https://github.com/zwave-js/zwave-js-ui/commit/db519556c161c1e82c2f393abaea1f7324f6f196))
* bump zwave-js@12.7.0 ([#3712](https://github.com/zwave-js/zwave-js-ui/issues/3712)) ([68d1f6a](https://github.com/zwave-js/zwave-js-ui/commit/68d1f6a45acc80b69adf4bac9b5d5156554c1c81))
* bump zwave-js@12.8.1 ([#3715](https://github.com/zwave-js/zwave-js-ui/issues/3715)) ([3adf71a](https://github.com/zwave-js/zwave-js-ui/commit/3adf71a129da25663541d9107043dc40e3c18425))
* bump zwave-js@12.9.1 ([#3725](https://github.com/zwave-js/zwave-js-ui/issues/3725)) ([4e47111](https://github.com/zwave-js/zwave-js-ui/commit/4e471115f04180be398bbd7602b6b0c9467821ab))
* zniffer ([#3706](https://github.com/zwave-js/zwave-js-ui/issues/3706)) ([18ffbe2](https://github.com/zwave-js/zwave-js-ui/commit/18ffbe2d8b5bd3963c4eae48a0b9d0d653d34d71))

# [9.12.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.11.1...v9.12.0) (2024-04-29)


### Bug Fixes

* **ui:** add offset to smart start hover menu ([9f72cf3](https://github.com/zwave-js/zwave-js-ui/commit/9f72cf3625b2d0078e5d718fc8c9c736a2ca1b1c)), closes [#3688](https://github.com/zwave-js/zwave-js-ui/issues/3688)
* **ui:** cannot scroll down to channel values in controller info panel ([8d75372](https://github.com/zwave-js/zwave-js-ui/commit/8d75372440743858db56f59ce382c71e8036ea98)), closes [#3685](https://github.com/zwave-js/zwave-js-ui/issues/3685)
* **ui:** display missing zwlr keys ([315ab0f](https://github.com/zwave-js/zwave-js-ui/commit/315ab0ffaa55d937df51639ccdf88532b39c115c))
* **ui:** not able to sending actions from advanced dialog ([367b75f](https://github.com/zwave-js/zwave-js-ui/commit/367b75f6b96ea7b74208d0b852d6bd722560d99f)), closes [#3693](https://github.com/zwave-js/zwave-js-ui/issues/3693)
* **ui:** only allow healthchecks against controller and hide neighbors ([0209b55](https://github.com/zwave-js/zwave-js-ui/commit/0209b55ef3acfaf6b29db4c49c83eda95d2165eb)), closes [#3681](https://github.com/zwave-js/zwave-js-ui/issues/3681)
* **ui:** only check for missing keys that are valid LR keys ([#3689](https://github.com/zwave-js/zwave-js-ui/issues/3689)) ([1aaf299](https://github.com/zwave-js/zwave-js-ui/commit/1aaf2997f6aed145cfe753c136a84fe37bcd1363))
* **ui:** prevent changing requested security classes when switching protocol ([e327942](https://github.com/zwave-js/zwave-js-ui/commit/e327942edd0ab9234dede2e50bb4ad5458c27cd5))
* **ui:** use different dialog for node added popup ([2affdce](https://github.com/zwave-js/zwave-js-ui/commit/2affdcee295f75b60ee56a2b25e8c02bb88fa1f7)), closes [#3690](https://github.com/zwave-js/zwave-js-ui/issues/3690)
* **ui:** use vuetify's material design palette colors for protocol color ([#3692](https://github.com/zwave-js/zwave-js-ui/issues/3692)) ([2df5105](https://github.com/zwave-js/zwave-js-ui/commit/2df5105afda0dc879bd2231e9d02cb314f7f783a))


### Features

* bump zwave-js@12.5.6 ([#3683](https://github.com/zwave-js/zwave-js-ui/issues/3683)) ([1b0e49d](https://github.com/zwave-js/zwave-js-ui/commit/1b0e49d826a59115edb12842c66c1f9d3ecd9a56))
* **ui:** smart start view improvements ([#3684](https://github.com/zwave-js/zwave-js-ui/issues/3684)) ([425a817](https://github.com/zwave-js/zwave-js-ui/commit/425a817d9875e360a471270daa93741874bd500d))

## [9.11.1](https://github.com/zwave-js/zwave-js-ui/compare/v9.11.0...v9.11.1) (2024-04-19)


### Bug Fixes

* **ui:** add missing channel 3 serie to bgRssi chart ([3961d53](https://github.com/zwave-js/zwave-js-ui/commit/3961d537bb1a121ae204f4790bbde339ca9ce339))

# [9.11.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.10.3...v9.11.0) (2024-04-19)


### Bug Fixes

* **ui:** do not disable `active` field in smart start table ([eccd132](https://github.com/zwave-js/zwave-js-ui/commit/eccd1326086cbc41169160ec6adbe82d35780bc0))
* **ui:** ensure nodes manager events are not binded twice ([#3665](https://github.com/zwave-js/zwave-js-ui/issues/3665)) ([02f5227](https://github.com/zwave-js/zwave-js-ui/commit/02f5227025fd40b42b1f3d9e45a0b102fef8ba77))


### Features

* bump zwave-js@12.5.5 ([#3672](https://github.com/zwave-js/zwave-js-ui/issues/3672)) ([c10d532](https://github.com/zwave-js/zwave-js-ui/commit/c10d5329e63f2de44c496a410aafdca09b9871a2))
* **ui:** add channel 3 to background rsi chart ([b34856d](https://github.com/zwave-js/zwave-js-ui/commit/b34856d6efda60b886009b69a729035221df8e4f)), closes [#3669](https://github.com/zwave-js/zwave-js-ui/issues/3669)

## [9.10.3](https://github.com/zwave-js/zwave-js-ui/compare/v9.10.2...v9.10.3) (2024-04-12)


### Bug Fixes

* **ui:** downgrades show empty changelogs ([ee50c0e](https://github.com/zwave-js/zwave-js-ui/commit/ee50c0e8594e01d8f22a75b59806e39d1fc40622)), closes [#3663](https://github.com/zwave-js/zwave-js-ui/issues/3663)
* **ui:** typo in info message on node added ([a8aecb7](https://github.com/zwave-js/zwave-js-ui/commit/a8aecb782938e02bd65cd4acadecf0c2ff56f9b1))


### Features

* bump zwave-js@12.5.3 ([#3664](https://github.com/zwave-js/zwave-js-ui/issues/3664)) ([6a8619c](https://github.com/zwave-js/zwave-js-ui/commit/6a8619c1078a5d17a0375c17c3c60ba5996a5d9e))
* bump zwave-js@12.5.4 ([#3666](https://github.com/zwave-js/zwave-js-ui/issues/3666)) ([3827dfc](https://github.com/zwave-js/zwave-js-ui/commit/3827dfccd9f798f061dd9837bf258ad55916ef04))

## [9.10.2](https://github.com/zwave-js/zwave-js-ui/compare/v9.10.1...v9.10.2) (2024-04-04)


### Bug Fixes

* **discovery:** add `DISCOVERY_DISABLE_CC_CONFIGURATION` env var ([52241db](https://github.com/zwave-js/zwave-js-ui/commit/52241db40fe47e4ae06e8af218923a3e0fbc981f)), closes [#3571](https://github.com/zwave-js/zwave-js-ui/issues/3571)


### Features

* bump zwave-js@12.5.2 ([#3655](https://github.com/zwave-js/zwave-js-ui/issues/3655)) ([87d74f2](https://github.com/zwave-js/zwave-js-ui/commit/87d74f21e29986ead0abf9ea0102734186a3b221))

## [9.10.1](https://github.com/zwave-js/zwave-js-ui/compare/v9.10.0...v9.10.1) (2024-04-03)


### Features

* bump zwave-js@12.5.1 ([#3654](https://github.com/zwave-js/zwave-js-ui/issues/3654)) ([f7ceb63](https://github.com/zwave-js/zwave-js-ui/commit/f7ceb634019109e932a0d27077b5d9c7c3e7cc7d))

# [9.10.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.9.1...v9.10.0) (2024-04-03)


### Bug Fixes

* set driver ready to false immediatly on driver error ([9693ba5](https://github.com/zwave-js/zwave-js-ui/commit/9693ba57c1e3c00aa53dabc4e585c5b0788725c3)), closes [#3647](https://github.com/zwave-js/zwave-js-ui/issues/3647)


### Features

* long range support zwave-js@12.5.0 ([#3545](https://github.com/zwave-js/zwave-js-ui/issues/3545)) ([bbf5ee6](https://github.com/zwave-js/zwave-js-ui/commit/bbf5ee604a9b1df2d9f296d30deaadb69c42d036))

## [9.9.1](https://github.com/zwave-js/zwave-js-ui/compare/v9.9.0...v9.9.1) (2024-03-04)


### Bug Fixes

* better message in case association is not allowed ([#3624](https://github.com/zwave-js/zwave-js-ui/issues/3624)) ([abcfd41](https://github.com/zwave-js/zwave-js-ui/commit/abcfd41a286283efc8483974a64be23dbf064f11))
* create custom logs cleanup function ([#3610](https://github.com/zwave-js/zwave-js-ui/issues/3610)) ([64f32f0](https://github.com/zwave-js/zwave-js-ui/commit/64f32f0020f4a9da68576862fbaaadf2f1d7f96d))
* node name and location change not catched on value added ([#3612](https://github.com/zwave-js/zwave-js-ui/issues/3612)) ([fa37244](https://github.com/zwave-js/zwave-js-ui/commit/fa37244cd1addcd6f55625b516aec617f91ed8f4))

# [9.9.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.8.3...v9.9.0) (2024-02-15)


### Bug Fixes

* keep node name and location in sync ([#3592](https://github.com/zwave-js/zwave-js-ui/issues/3592)) ([697967b](https://github.com/zwave-js/zwave-js-ui/commit/697967bcf9270657dab71b8e9d7d7e46fdaaa298))
* **ui:** scrollbars size ([ff5875d](https://github.com/zwave-js/zwave-js-ui/commit/ff5875d9ebec2bd5ddb1b866bb978cabbe0f2967))


### Features

* bump zwave-js@12.4.4 ([#3597](https://github.com/zwave-js/zwave-js-ui/issues/3597)) ([55431cf](https://github.com/zwave-js/zwave-js-ui/commit/55431cf57aa640f0799c5bd16b796dcedaaa76c8))
* **ui:** search box in control panel table ([#3598](https://github.com/zwave-js/zwave-js-ui/issues/3598)) ([e72217d](https://github.com/zwave-js/zwave-js-ui/commit/e72217d8232be33d9ab4c10f4af0506cceef1f78))

## [9.8.3](https://github.com/zwave-js/zwave-js-ui/compare/v9.8.2...v9.8.3) (2024-02-06)


### Bug Fixes

* **discovery:** revert "improve MQTT discovery for scene CC" ([#3583](https://github.com/zwave-js/zwave-js-ui/issues/3583)) ([16b8c1f](https://github.com/zwave-js/zwave-js-ui/commit/16b8c1fc82bfb5ce99c7e0bf2bd1e78fa4161fa7))
* **mqtt-discovery:** modify thermostat_2gig to use endpoint 0 ([#3579](https://github.com/zwave-js/zwave-js-ui/issues/3579)) ([4ba9ead](https://github.com/zwave-js/zwave-js-ui/commit/4ba9ead46592497baed73d06e45122f598a8fd5e))
* **ui:** misleading `unconnected` label changed to `unknown` ([beaa1a2](https://github.com/zwave-js/zwave-js-ui/commit/beaa1a2090fdc017cff1c1d62850001a05392ef1)), closes [#3562](https://github.com/zwave-js/zwave-js-ui/issues/3562)
* **ui:** show nlwr route when lwr is unknown in overview ([#3584](https://github.com/zwave-js/zwave-js-ui/issues/3584)) ([a1f8cc2](https://github.com/zwave-js/zwave-js-ui/commit/a1f8cc2a9343b4eb6179f85033215d9d69f29a6e))


### Features

* **mqtt:** allow to set options in multicast/broadcast requests ([#3573](https://github.com/zwave-js/zwave-js-ui/issues/3573)) ([9ba5886](https://github.com/zwave-js/zwave-js-ui/commit/9ba5886bea16228921e0e545721f5d0d6a5bb922))

## [9.8.2](https://github.com/zwave-js/zwave-js-ui/compare/v9.8.1...v9.8.2) (2024-01-29)


### Bug Fixes

* **mqtt:** handel numbers to bool coerce and value conf on current value ([49ac0a3](https://github.com/zwave-js/zwave-js-ui/commit/49ac0a30e56cd780684414b32890772fd904b7f9))


### Features

* bump zwave-js@12.4.3 ([#3555](https://github.com/zwave-js/zwave-js-ui/issues/3555)) ([e9d3118](https://github.com/zwave-js/zwave-js-ui/commit/e9d31180fc9dd1cf503abde5ead1f7fa599285a2))
* **ui:** allow to toggle persistent/discovery fields from HA discovery table ([#3569](https://github.com/zwave-js/zwave-js-ui/issues/3569)) ([b86b84c](https://github.com/zwave-js/zwave-js-ui/commit/b86b84c571f7d9ad0ca81f0b7b30213c3f830c68))

## [9.8.1](https://github.com/zwave-js/zwave-js-ui/compare/v9.8.0...v9.8.1) (2024-01-25)


### Bug Fixes

* auth check api not working with proxy ([366b8dc](https://github.com/zwave-js/zwave-js-ui/commit/366b8dcb056fee10c1d32e9311a8161047f1fe10)), closes [#3553](https://github.com/zwave-js/zwave-js-ui/issues/3553)

# [9.8.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.7.1...v9.8.0) (2024-01-24)


### Bug Fixes

* allow to set a custom trust proxy value ([b1a34df](https://github.com/zwave-js/zwave-js-ui/commit/b1a34dfb634d43099b008279e70bba46783314f4))
* **discovery:** improve MQTT discovery for scene CC ([#3539](https://github.com/zwave-js/zwave-js-ui/issues/3539)) ([383ad83](https://github.com/zwave-js/zwave-js-ui/commit/383ad831a31c7b4f86ae51518fc14c04f390beb3))
* **ui:** add product code to fw update dialog ([22bd7ab](https://github.com/zwave-js/zwave-js-ui/commit/22bd7ab2555ad8645f79d87bdc2c409adec4d35f)), closes [#3488](https://github.com/zwave-js/zwave-js-ui/issues/3488)
* **ui:** bump mqtt@5.3.5 ([7d01148](https://github.com/zwave-js/zwave-js-ui/commit/7d01148f09140f4ba401eb773602d49d83bddb4f))
* **ui:** correct tx power validation limits ([ff08456](https://github.com/zwave-js/zwave-js-ui/commit/ff0845690b21b9fd61903ad57e01d20162fdf508))
* **ui:** ignore `**/api/**` from service worker cache ([#3519](https://github.com/zwave-js/zwave-js-ui/issues/3519)) ([2b7d53c](https://github.com/zwave-js/zwave-js-ui/commit/2b7d53c0c6d7a34f9183074f4e35c774f3344bd2))
* **ui:** power level and measured power at 0 dbm limits ([#3548](https://github.com/zwave-js/zwave-js-ui/issues/3548)) ([ae57c72](https://github.com/zwave-js/zwave-js-ui/commit/ae57c721525d6fe88a4dba105139261c72789ef6))
* **ui:** remove duplicated target in link ([76802d5](https://github.com/zwave-js/zwave-js-ui/commit/76802d575081127ec02f3860b22efbc1d73a01d4))


### Features

* add `TRUST_PROXY` env var ([3035d65](https://github.com/zwave-js/zwave-js-ui/commit/3035d653ebb25f7578219f3821d3f4f21b95c4dc)), closes [#3506](https://github.com/zwave-js/zwave-js-ui/issues/3506)
* bump zwave-js@12.4.2 ([#3550](https://github.com/zwave-js/zwave-js-ui/issues/3550)) ([7fc5c0f](https://github.com/zwave-js/zwave-js-ui/commit/7fc5c0f2e2d00385f84eb804d4b6f6e0c6e7151f))
* expose configuration properties via HASS discovery ([#3538](https://github.com/zwave-js/zwave-js-ui/issues/3538)) ([3048fed](https://github.com/zwave-js/zwave-js-ui/commit/3048fede52d4cd5ac3c32f7064712266f3bedcfc))
* show inclusion state on UI ([#3527](https://github.com/zwave-js/zwave-js-ui/issues/3527)) ([8906358](https://github.com/zwave-js/zwave-js-ui/commit/89063584b01ce6c6f1c3dd466ea49a73445cc63b))
* **ui:** custom browser TZ/LOCALE and UI persistent preferences ([#3525](https://github.com/zwave-js/zwave-js-ui/issues/3525)) ([f85f225](https://github.com/zwave-js/zwave-js-ui/commit/f85f225595187cb6ed0ddad19f61371e4f702199))

## [9.7.1](https://github.com/zwave-js/zwave-js-ui/compare/v9.7.0...v9.7.1) (2024-01-16)


### Bug Fixes

* **ui:** ensure all changelog links open on new tab ([#3521](https://github.com/zwave-js/zwave-js-ui/issues/3521)) ([51c53a1](https://github.com/zwave-js/zwave-js-ui/commit/51c53a1c9aeb76a0b3f8a6879b2b601f63f41bb2))
* **ui:** make all links open in a new page to make them work in hass-addon (tx Andrew) ([d7db465](https://github.com/zwave-js/zwave-js-ui/commit/d7db46570f9b57e3381cd75084a2cbc82ed32fc7))

# [9.7.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.6.2...v9.7.0) (2024-01-15)


### Bug Fixes

* **ui:** preferred scales alignment ([#3494](https://github.com/zwave-js/zwave-js-ui/issues/3494)) ([74d7c31](https://github.com/zwave-js/zwave-js-ui/commit/74d7c313b516b9dcae82f8a90275c1a14b2f461a))


### Features

* **discovery:** add support for availability topics ([#3510](https://github.com/zwave-js/zwave-js-ui/issues/3510)) ([e7ce406](https://github.com/zwave-js/zwave-js-ui/commit/e7ce406bbb2c742b2bc6af0d6c70bfc0a7b548d3))
* **ui:** show node info in fw update dialog ([#3500](https://github.com/zwave-js/zwave-js-ui/issues/3500)) ([7c75532](https://github.com/zwave-js/zwave-js-ui/commit/7c7553217ef02a117cc9bb8c54bd3c19b6be3a97))

## [9.6.2](https://github.com/zwave-js/zwave-js-ui/compare/v9.6.1...v9.6.2) (2023-12-22)


### Bug Fixes

* ignore `build` dir in NPM publish ([af5c542](https://github.com/zwave-js/zwave-js-ui/commit/af5c542b4b287051792da9f0a0eec7a11a6a0cd5))

## [9.6.1](https://github.com/zwave-js/zwave-js-ui/compare/v9.6.0...v9.6.1) (2023-12-22)


### Bug Fixes

* move optional deps to dev dependencies ([#3493](https://github.com/zwave-js/zwave-js-ui/issues/3493)) ([1ffe349](https://github.com/zwave-js/zwave-js-ui/commit/1ffe349dcd6f05001a934b37b1e34c74f6353c76))

# [9.6.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.5.1...v9.6.0) (2023-12-14)


### Bug Fixes

* check for undefined driver ([#3464](https://github.com/zwave-js/zwave-js-ui/issues/3464)) ([f499d5b](https://github.com/zwave-js/zwave-js-ui/commit/f499d5b4069074a6ecb5c3d8f4fef45ee39b8cee))
* **ui:** open in new window ([c618fd1](https://github.com/zwave-js/zwave-js-ui/commit/c618fd10cd5c5f5e2444ed097c64dcc9e7f4aa73))


### Features

* bump zwave-js@12.4.1 ([#3479](https://github.com/zwave-js/zwave-js-ui/issues/3479)) ([932495e](https://github.com/zwave-js/zwave-js-ui/commit/932495e99191256e792e9438fcca2304082c7bd4))
* create esbuild bundle for embedded devices ([#3480](https://github.com/zwave-js/zwave-js-ui/issues/3480)) ([68326d6](https://github.com/zwave-js/zwave-js-ui/commit/68326d635917895520be883013934d2789998d83))
* **ui:** compact view sort ([#3484](https://github.com/zwave-js/zwave-js-ui/issues/3484)) ([1f4cc1f](https://github.com/zwave-js/zwave-js-ui/commit/1f4cc1f9feaef9dbe6e393f37bfc12e755d51d97))

## [9.5.1](https://github.com/zwave-js/zwave-js-ui/compare/v9.5.0...v9.5.1) (2023-12-01)


### Bug Fixes

* pkg missing `axios` exec ([4856efd](https://github.com/zwave-js/zwave-js-ui/commit/4856efd3af76c50b5096b6a8bdf833bf3f7ee376)), closes [#3458](https://github.com/zwave-js/zwave-js-ui/issues/3458)

# [9.5.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.4.1...v9.5.0) (2023-11-30)


### Bug Fixes

* **ui:** open ota link in new page ([d7621c1](https://github.com/zwave-js/zwave-js-ui/commit/d7621c15dc0eecd91043fa2160d2fbd6bdf6a860)), closes [#3446](https://github.com/zwave-js/zwave-js-ui/issues/3446)


### Features

* bump zwave-js@12.3.2 ([#3452](https://github.com/zwave-js/zwave-js-ui/issues/3452)) ([8727b56](https://github.com/zwave-js/zwave-js-ui/commit/8727b561afcca59355be18fa04627f4ebbf9a2a1))
* bump zwave-js@12.4.0 ([#3457](https://github.com/zwave-js/zwave-js-ui/issues/3457)) ([1304124](https://github.com/zwave-js/zwave-js-ui/commit/1304124bc79ae9d5234ef0ed35304459d75f2da3))
* use `npm` instead of `yarn` ([#3447](https://github.com/zwave-js/zwave-js-ui/issues/3447)) ([1dc07ed](https://github.com/zwave-js/zwave-js-ui/commit/1dc07edb91a5fa124acc41f9dda2e5a0ae8a43d0))

## [9.4.1](https://github.com/zwave-js/zwave-js-ui/compare/v9.4.0...v9.4.1) (2023-11-27)


### Bug Fixes

* **docker:** skip install when node_modules is present ([#3429](https://github.com/zwave-js/zwave-js-ui/issues/3429)) ([65fe9a4](https://github.com/zwave-js/zwave-js-ui/commit/65fe9a4efffa9653b10225556c76b8edc96dc502))
* **docker:** try using custom alpine ([#3443](https://github.com/zwave-js/zwave-js-ui/issues/3443)) ([400cb4f](https://github.com/zwave-js/zwave-js-ui/commit/400cb4fcd97e0367d4b9fe5a22cb441574a9cae5))
* don't create `STORE_DIR/logs` if `ZWAVEJS_LOGS_DIR` is setted ([#3439](https://github.com/zwave-js/zwave-js-ui/issues/3439)) ([46773f7](https://github.com/zwave-js/zwave-js-ui/commit/46773f7c5a1447b490fe902657139f46b17761ff))


### Features

* bump zwave-js@12.3.1 ([#3444](https://github.com/zwave-js/zwave-js-ui/issues/3444)) ([662a2c8](https://github.com/zwave-js/zwave-js-ui/commit/662a2c8bd4d9583ae54afccd3b824a142973b3be))

# [9.4.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.3.2...v9.4.0) (2023-11-16)


### Bug Fixes

* **ui:** inconsistency in ota popup warning ([8378946](https://github.com/zwave-js/zwave-js-ui/commit/8378946ee7e6699007d4815369c4450cc8b198ee))
* **ui:** make versions tooltip above snackbar ([91376a3](https://github.com/zwave-js/zwave-js-ui/commit/91376a3a1c1c4fd2da1e9196282de8408ba6fc7a)), closes [#3416](https://github.com/zwave-js/zwave-js-ui/issues/3416)
* **ui:** prevent fab to overlap table pagination ([9dbe5bf](https://github.com/zwave-js/zwave-js-ui/commit/9dbe5bff0526c87c6e37729a2e5e420b0d051540)), closes [#3426](https://github.com/zwave-js/zwave-js-ui/issues/3426)
* user callbacks not working with MQTT ([#3424](https://github.com/zwave-js/zwave-js-ui/issues/3424)) ([3f630fd](https://github.com/zwave-js/zwave-js-ui/commit/3f630fd40e2e45bf554952727225947f73bd4571))


### Features

* add npm deploy and move backend source to `/api` folder ([#3422](https://github.com/zwave-js/zwave-js-ui/issues/3422)) ([fe7a2c5](https://github.com/zwave-js/zwave-js-ui/commit/fe7a2c5a2a5c0b5ef761b5b8bb05f774dd4a2c61))
* add setting to disable controller recovery feature ([#3423](https://github.com/zwave-js/zwave-js-ui/issues/3423)) ([f956deb](https://github.com/zwave-js/zwave-js-ui/commit/f956deb066c5d2b39e2562259d3d6a46baacd03b))
* **ui:** parse fw OTA changelog ([#3428](https://github.com/zwave-js/zwave-js-ui/issues/3428)) ([734ca0f](https://github.com/zwave-js/zwave-js-ui/commit/734ca0fc46a487d5b71df24bd4edc4300c986afb))

## [9.3.2](https://github.com/zwave-js/zwave-js-ui/compare/v9.3.1...v9.3.2) (2023-11-09)


### Bug Fixes

* scheduled jobs not running when mqtt disabled ([#3409](https://github.com/zwave-js/zwave-js-ui/issues/3409)) ([c3d00e6](https://github.com/zwave-js/zwave-js-ui/commit/c3d00e62551e654d2e3ac0aea5e9ba75f7c986ba))
* **ui:** add wakeup help ([9b3b766](https://github.com/zwave-js/zwave-js-ui/commit/9b3b766bf0d66373c6e381141d358f389150acd5)), closes [#3395](https://github.com/zwave-js/zwave-js-ui/issues/3395)


### Features

* bump zwave-js@12.3.0 ([#3396](https://github.com/zwave-js/zwave-js-ui/issues/3396)) ([49ccf97](https://github.com/zwave-js/zwave-js-ui/commit/49ccf974d414cbc3d3485b85140ec0c8f7330a7a))

## [9.3.1](https://github.com/zwave-js/zwave-js-ui/compare/v9.3.0...v9.3.1) (2023-10-30)


### Bug Fixes

* rebuild node routes doesn't update status on node object ([#3391](https://github.com/zwave-js/zwave-js-ui/issues/3391)) ([8f00446](https://github.com/zwave-js/zwave-js-ui/commit/8f00446949e1800791099487dfc4ab6890376a71))
* **ui:** ensure theme is in sync with local storage to prevent flickering ([6ad4d0d](https://github.com/zwave-js/zwave-js-ui/commit/6ad4d0dd1fb71a1615c32b7757601ef33884a935))
* **ui:** theme not persisted correctly ([#3390](https://github.com/zwave-js/zwave-js-ui/issues/3390)) ([c36ebc8](https://github.com/zwave-js/zwave-js-ui/commit/c36ebc8f499a89225e73a106ec32094dd5d66b9e))

# [9.3.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.2.3...v9.3.0) (2023-10-26)


### Bug Fixes

* **ui:** make topbar and actions sticky on popups ([87e88ef](https://github.com/zwave-js/zwave-js-ui/commit/87e88ef2a7ca3ff63d0b073e087022829da82fb6)), closes [#3372](https://github.com/zwave-js/zwave-js-ui/issues/3372)


### Features

* bump zwave-js@12.2.3 ([#3377](https://github.com/zwave-js/zwave-js-ui/issues/3377)) ([c3d85a4](https://github.com/zwave-js/zwave-js-ui/commit/c3d85a4d5bbc288b3bbbe7976af656aa583dbfa2))
* **ui:** persist ui settings and use system theme as default ([#3375](https://github.com/zwave-js/zwave-js-ui/issues/3375)) ([2eaa11c](https://github.com/zwave-js/zwave-js-ui/commit/2eaa11c46a18165703c17acf5c2582e645672d86))

## [9.2.3](https://github.com/zwave-js/zwave-js-ui/compare/v9.2.2...v9.2.3) (2023-10-20)


### Bug Fixes

* add all `EventListener` methods to `TypedEventEmitter` interface ([6e8a6ca](https://github.com/zwave-js/zwave-js-ui/commit/6e8a6caa60deace2fd96cd68390f6d3238e66047))


### Features

* bump zwave-js-server@1.33.0 ([#3368](https://github.com/zwave-js/zwave-js-ui/issues/3368)) ([2b8b2eb](https://github.com/zwave-js/zwave-js-ui/commit/2b8b2eb6d5bc1fbcb4592687aa03726450a6c1db))
* bump zwave-js@12.2.1 ([#3367](https://github.com/zwave-js/zwave-js-ui/issues/3367)) ([b055453](https://github.com/zwave-js/zwave-js-ui/commit/b0554535761157b54b6829ab218ac4500329d24b))

## [9.2.2](https://github.com/zwave-js/zwave-js-ui/compare/v9.2.1...v9.2.2) (2023-10-19)


### Bug Fixes

* set default host to undefined ([#3362](https://github.com/zwave-js/zwave-js-ui/issues/3362)) ([6a30ab0](https://github.com/zwave-js/zwave-js-ui/commit/6a30ab066a964b111283db4d44819bb59089102d))

## [9.2.1](https://github.com/zwave-js/zwave-js-ui/compare/v9.2.0...v9.2.1) (2023-10-18)


### Bug Fixes

* **ui:** clarify changelogs checkbox label ([d97d044](https://github.com/zwave-js/zwave-js-ui/commit/d97d044d42e2a183802f0a7727b74d7b89268394))
* **ui:** disable ota updates while upgrading ([#3357](https://github.com/zwave-js/zwave-js-ui/issues/3357)) ([d68f33a](https://github.com/zwave-js/zwave-js-ui/commit/d68f33a6308ccdee54f9b8c18f61f71971b13b00))
* **ui:** remove dependencies from changelog ([9c4e14a](https://github.com/zwave-js/zwave-js-ui/commit/9c4e14a54735324ded67cd328991211a9696c0dd))
* **ui:** show OTA result ([#3360](https://github.com/zwave-js/zwave-js-ui/issues/3360)) ([39f09bd](https://github.com/zwave-js/zwave-js-ui/commit/39f09bdfb04ca65909ac51c9e8e0b298ceeac936))

# [9.2.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.1.2...v9.2.0) (2023-10-18)


### Bug Fixes

* set default host to `::` ([#3348](https://github.com/zwave-js/zwave-js-ui/issues/3348)) ([68cc58e](https://github.com/zwave-js/zwave-js-ui/commit/68cc58e1f330681e691d390459eafa5f58a9e655))
* **ui:** firmware update OTA result not shown ([#3346](https://github.com/zwave-js/zwave-js-ui/issues/3346)) ([1406015](https://github.com/zwave-js/zwave-js-ui/commit/140601501dd38692e1eadba302c7ac79c0cf695d))
* **ui:** formatting in debug window ([#3344](https://github.com/zwave-js/zwave-js-ui/issues/3344)) ([cfd1dea](https://github.com/zwave-js/zwave-js-ui/commit/cfd1dea302b493747b1c5e659ff1c1c725378e06))
* **ui:** hide OTA downgrades by default and fix icon ([#3345](https://github.com/zwave-js/zwave-js-ui/issues/3345)) ([82f5ee4](https://github.com/zwave-js/zwave-js-ui/commit/82f5ee41b209e6c3661efa490eb6e83a86322177))


### Features

* allow to restore NVM raw ([#3337](https://github.com/zwave-js/zwave-js-ui/issues/3337)) ([0b8f33f](https://github.com/zwave-js/zwave-js-ui/commit/0b8f33f94bcf230489f6c0e8288bae7554011669))
* bump zwave-js@12.1.0 ([#3335](https://github.com/zwave-js/zwave-js-ui/issues/3335)) ([a16b962](https://github.com/zwave-js/zwave-js-ui/commit/a16b9622c3b950c8729a5968b22fef899b4a14ae))
* bump zwave-js@12.1.1 ([#3338](https://github.com/zwave-js/zwave-js-ui/issues/3338)) ([c224d11](https://github.com/zwave-js/zwave-js-ui/commit/c224d11abbb8e4c0fe6f8ce22164bcb48ca0af13))
* bump zwave-js@12.2.0 ([#3349](https://github.com/zwave-js/zwave-js-ui/issues/3349)) ([9f45b50](https://github.com/zwave-js/zwave-js-ui/commit/9f45b5035a76a963cc187e8a1cd26018810bdec0))
* parse multiple releases in changelogs ([#3351](https://github.com/zwave-js/zwave-js-ui/issues/3351)) ([e37d2cf](https://github.com/zwave-js/zwave-js-ui/commit/e37d2cf97ad9012140e43668f27379616180818b))

## [9.1.2](https://github.com/zwave-js/zwave-js-ui/compare/v9.1.1...v9.1.2) (2023-10-10)


### Features

* add setting to enable new version notification ([#3332](https://github.com/zwave-js/zwave-js-ui/issues/3332)) ([7e00e02](https://github.com/zwave-js/zwave-js-ui/commit/7e00e02ada3c5140a2f09533b2a79f8f8df988e5))

## [9.1.1](https://github.com/zwave-js/zwave-js-ui/compare/v9.1.0...v9.1.1) (2023-10-09)


### Bug Fixes

* possible startup bug `versions` of undefined ([5286879](https://github.com/zwave-js/zwave-js-ui/commit/5286879888c9880feb20a72cdf7752365ac4268c)), closes [#3328](https://github.com/zwave-js/zwave-js-ui/issues/3328)
* **ui:** add `v` prefix in server version changelog for consistency ([1741fac](https://github.com/zwave-js/zwave-js-ui/commit/1741fac56a5b4a75a5f3446c4988e77b63cfd374))
* **ui:** changelog spacing ([c6abd78](https://github.com/zwave-js/zwave-js-ui/commit/c6abd7818a0abd26d825b4ff7a6b381c920098a5))
* **ui:** cleanup device id display ([fa5a8e9](https://github.com/zwave-js/zwave-js-ui/commit/fa5a8e941e359d0f890aa8aed66f0d2d49ca1d60)), closes [#3314](https://github.com/zwave-js/zwave-js-ui/issues/3314)
* **ui:** typo on pinia store ([5b3a205](https://github.com/zwave-js/zwave-js-ui/commit/5b3a20569c60463bf545c3df5a1cf1bb47380978)), closes [#3327](https://github.com/zwave-js/zwave-js-ui/issues/3327)


### Features

* bump zwave-js@12.0.4 ([#3331](https://github.com/zwave-js/zwave-js-ui/issues/3331)) ([1f0dc2f](https://github.com/zwave-js/zwave-js-ui/commit/1f0dc2f5c40f3bcc7d6fe32f9c26e1cb2bacdcf4))

# [9.1.0](https://github.com/zwave-js/zwave-js-ui/compare/v9.0.3...v9.1.0) (2023-10-06)


### Bug Fixes

* issue when header not present in request ([ba835a7](https://github.com/zwave-js/zwave-js-ui/commit/ba835a7ee2b57728c6843336c1bd79ddabeda8a9))
* **ui:** missing `Heal` references in control panel ([#3318](https://github.com/zwave-js/zwave-js-ui/issues/3318)) ([a13d26f](https://github.com/zwave-js/zwave-js-ui/commit/a13d26f5869acf76fdfd15d2986ca58eb47d8380))


### Features

* add `response timeout` setting support ([#3325](https://github.com/zwave-js/zwave-js-ui/issues/3325)) ([74e5c39](https://github.com/zwave-js/zwave-js-ui/commit/74e5c39febc250f9a2cb8e5b96a4f066fee6a842))
* bump zwave-js@12.0.3 ([#3324](https://github.com/zwave-js/zwave-js-ui/issues/3324)) ([9937eb2](https://github.com/zwave-js/zwave-js-ui/commit/9937eb2878655d90bded51747647522fa5ead287))
* show releases changelog on login ([#3319](https://github.com/zwave-js/zwave-js-ui/issues/3319)) ([e672c5c](https://github.com/zwave-js/zwave-js-ui/commit/e672c5c3afcf401f5ecc0dde46fd7928c4dd089f))

## [9.0.3](https://github.com/zwave-js/zwave-js-ui/compare/v9.0.2...v9.0.3) (2023-09-29)


### Features

* bump zwave-js@12.0.2 ([#3312](https://github.com/zwave-js/zwave-js-ui/issues/3312)) ([f3e4c22](https://github.com/zwave-js/zwave-js-ui/commit/f3e4c2269e0494745e316cb4d9f657b577dc0438))

## [9.0.2](https://github.com/zwave-js/zwave-js-ui/compare/v9.0.1...v9.0.2) (2023-09-29)


### Bug Fixes

* auto redirect when using old paths ([#3308](https://github.com/zwave-js/zwave-js-ui/issues/3308)) ([e5793bd](https://github.com/zwave-js/zwave-js-ui/commit/e5793bdf4b5a0bfb4935eea211f220da52220adb))

## [9.0.1](https://github.com/zwave-js/zwave-js-ui/compare/v9.0.0...v9.0.1) (2023-09-27)


### Bug Fixes

* bump @zwave-js/server to 1.32.1 ([#3305](https://github.com/zwave-js/zwave-js-ui/issues/3305)) ([70cbd7a](https://github.com/zwave-js/zwave-js-ui/commit/70cbd7abc876517d922cbca3cf87561f2c3b6006))

# [9.0.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.26.0...v9.0.0) (2023-09-27)


### Bug Fixes

* **graph:** match text color with icon color on ZWave Graph legend ([#3299](https://github.com/zwave-js/zwave-js-ui/issues/3299)) ([f546160](https://github.com/zwave-js/zwave-js-ui/commit/f546160794002b33d27efbdc86efd506cec3afef))
* include error stack in unhandled rejections ([bd41112](https://github.com/zwave-js/zwave-js-ui/commit/bd41112afb19471fc7ea0bb212fe6fb0422be9a4)), closes [#3300](https://github.com/zwave-js/zwave-js-ui/issues/3300)

# [8.26.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.25.1...v8.26.0) (2023-09-21)


### Bug Fixes

* add missing return in `getNodeNeighbors` api ([e38b13f](https://github.com/zwave-js/zwave-js-ui/commit/e38b13fea8fb637f072771b31a71ec8e703964b7)), closes [#3276](https://github.com/zwave-js/zwave-js-ui/issues/3276)


### Features

* bump zwave-js@11.14.3 ([#3293](https://github.com/zwave-js/zwave-js-ui/issues/3293)) ([653913c](https://github.com/zwave-js/zwave-js-ui/commit/653913c7970e5de090677c1a543836d1687af87b))
* show controller status ([#3294](https://github.com/zwave-js/zwave-js-ui/issues/3294)) ([a43e74f](https://github.com/zwave-js/zwave-js-ui/commit/a43e74fc6b3b100729540832b04d79c652236319))

## [8.25.1](https://github.com/zwave-js/zwave-js-ui/compare/v8.25.0...v8.25.1) (2023-09-11)


### Bug Fixes

* **ui:** add missing webmanifest link in head ([40b25e9](https://github.com/zwave-js/zwave-js-ui/commit/40b25e96e73d3a88a603fa48e1f23b6a45a12e96))


### Features

* bump zwave-js@11.14.2 ([#3278](https://github.com/zwave-js/zwave-js-ui/issues/3278)) ([c8b47e0](https://github.com/zwave-js/zwave-js-ui/commit/c8b47e068eff24b41616ae6cd08fe7e6a3117ced))

# [8.25.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.24.2...v8.25.0) (2023-09-06)


### Bug Fixes

* **ui:** prevent undefined error in settings ([92c3623](https://github.com/zwave-js/zwave-js-ui/commit/92c36236424f5aa4dc745c4d0c136702b207175f)), closes [#3262](https://github.com/zwave-js/zwave-js-ui/issues/3262)


### Features

* vitejs and PWA support ([#3263](https://github.com/zwave-js/zwave-js-ui/issues/3263)) ([d409051](https://github.com/zwave-js/zwave-js-ui/commit/d409051b9e96939fa0510399e45693b331a34cf1))

## [8.24.2](https://github.com/zwave-js/zwave-js-ui/compare/v8.24.1...v8.24.2) (2023-09-04)


### Bug Fixes

* **ui:** better re-discover tooltip ([1e04cab](https://github.com/zwave-js/zwave-js-ui/commit/1e04cab0e551a9996081a94fe81e1545d614f656))


### Features

* bump zwave-js@11.14.0 ([#3261](https://github.com/zwave-js/zwave-js-ui/issues/3261)) ([4fa18a8](https://github.com/zwave-js/zwave-js-ui/commit/4fa18a89ac4f0fd922fd9218d2542e41b5d56ea3))

## [8.24.1](https://github.com/zwave-js/zwave-js-ui/compare/v8.24.0...v8.24.1) (2023-09-04)


### Bug Fixes

* **ui:** hide config update badge after re-interview ([#3260](https://github.com/zwave-js/zwave-js-ui/issues/3260)) ([94fc10e](https://github.com/zwave-js/zwave-js-ui/commit/94fc10e2f932cb6574041430a88613ecd11c3ee4))


### Features

* bump zwave-js@11.13.1 ([#3257](https://github.com/zwave-js/zwave-js-ui/issues/3257)) ([07d99cc](https://github.com/zwave-js/zwave-js-ui/commit/07d99ccea6c595d2303db6d5117836b1d10ef1d9))

# [8.24.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.23.2...v8.24.0) (2023-08-31)


### Bug Fixes

* **ui:** advanced actions colors ([77afac4](https://github.com/zwave-js/zwave-js-ui/commit/77afac40acdd42b573653e007daf19243ffda826)), closes [#3242](https://github.com/zwave-js/zwave-js-ui/issues/3242)
* **ui:** make rf region setting clearable ([58c24d4](https://github.com/zwave-js/zwave-js-ui/commit/58c24d4b5c04a7d87daf07b709f04b05019712cc)), closes [#3241](https://github.com/zwave-js/zwave-js-ui/issues/3241)
* **ui:** remove controller default powerlevel message ([#3244](https://github.com/zwave-js/zwave-js-ui/issues/3244)) ([88555cd](https://github.com/zwave-js/zwave-js-ui/commit/88555cd2ff351b8aad2e62a45da112423bb47d88))


### Features

* **ui:** show when devices needs to be re-interviewed ([#3252](https://github.com/zwave-js/zwave-js-ui/issues/3252)) ([b2c7f84](https://github.com/zwave-js/zwave-js-ui/commit/b2c7f84ad8debc8b23a2e6d27006a7febf2bd645))

## [8.23.2](https://github.com/zwave-js/zwave-js-ui/compare/v8.23.1...v8.23.2) (2023-08-29)

## [8.23.1](https://github.com/zwave-js/zwave-js-ui/compare/v8.23.0...v8.23.1) (2023-08-22)


### Features

* bump zwave-js@11.13.0 ([#3240](https://github.com/zwave-js/zwave-js-ui/issues/3240)) ([5066c85](https://github.com/zwave-js/zwave-js-ui/commit/5066c85d899aaa59b106e95b51903b80979f6ca1))

# [8.23.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.22.3...v8.23.0) (2023-08-17)


### Bug Fixes

* prevent to throw when setting `rf` options ([c838698](https://github.com/zwave-js/zwave-js-ui/commit/c8386982417dea662be7448965adcb3d3bcbd494))
* **ui:** remove controller from replace nodes list ([1a43b0a](https://github.com/zwave-js/zwave-js-ui/commit/1a43b0abbec4d035480036aa61c858401167bc16)), closes [#3223](https://github.com/zwave-js/zwave-js-ui/issues/3223)
* **ui:** soft reset hint ([a69139f](https://github.com/zwave-js/zwave-js-ui/commit/a69139f518f5069b95e918fda30f428aa50d65ca))


### Features

* add new controller rfregion and txpower settings ([#3224](https://github.com/zwave-js/zwave-js-ui/issues/3224)) ([62ecc4b](https://github.com/zwave-js/zwave-js-ui/commit/62ecc4b261b3dbfd5b912853f68d31d67c1f36c8))
* bump zwave-js@11.10.0 ([#3219](https://github.com/zwave-js/zwave-js-ui/issues/3219)) ([7c6a4ab](https://github.com/zwave-js/zwave-js-ui/commit/7c6a4abc5d8f53958ba8c20bd6a1bd0411f75dc0))
* bump zwave-js@11.11.0 ([67664f8](https://github.com/zwave-js/zwave-js-ui/commit/67664f889b2c8cafaa14bcb572982a8be6f8d615))
* bump zwave-js@11.12.0 ([c97e2dd](https://github.com/zwave-js/zwave-js-ui/commit/c97e2dd5fe7f223d7a7b98a810f36fe022b8c046))
* store default node set value options ([32f5828](https://github.com/zwave-js/zwave-js-ui/commit/32f58283b8623dce861ccb85abbc8d380d0a46d5)), closes [#3121](https://github.com/zwave-js/zwave-js-ui/issues/3121)

## [8.22.3](https://github.com/zwave-js/zwave-js-ui/compare/v8.22.2...v8.22.3) (2023-08-08)


### Bug Fixes

* scheduler not synced correctly ([#3176](https://github.com/zwave-js/zwave-js-ui/issues/3176)) ([5de915e](https://github.com/zwave-js/zwave-js-ui/commit/5de915e7d4813c4cd7d06bc8baa9600363f61c3f))

## [8.22.2](https://github.com/zwave-js/zwave-js-ui/compare/v8.22.1...v8.22.2) (2023-08-08)


### Features

* bump zwave-js@11.9.2 ([#3215](https://github.com/zwave-js/zwave-js-ui/issues/3215)) ([6b4e7aa](https://github.com/zwave-js/zwave-js-ui/commit/6b4e7aa133159875f0cd5b8108bc9aceb53d5a97))

## [8.22.1](https://github.com/zwave-js/zwave-js-ui/compare/v8.22.0...v8.22.1) (2023-08-07)


### Bug Fixes

* **mqtt:** mqtt throws error on connect ([483d858](https://github.com/zwave-js/zwave-js-ui/commit/483d85818a8d64f6d7f7404cf2c1dbf6f4fcdbb3)), closes [#3206](https://github.com/zwave-js/zwave-js-ui/issues/3206)
* **ui:** persist node panel position when dragged ([cdddb33](https://github.com/zwave-js/zwave-js-ui/commit/cdddb33a0afda314b0b63766d155e13157ae245a)), closes [#3191](https://github.com/zwave-js/zwave-js-ui/issues/3191)


### Features

* bump mqtt@5.0.2 ([#3210](https://github.com/zwave-js/zwave-js-ui/issues/3210)) ([b01f6ea](https://github.com/zwave-js/zwave-js-ui/commit/b01f6ea345e87f66785d6b75a402717c1f064e8c))
* bump zwave-js@11.8.1 ([#3205](https://github.com/zwave-js/zwave-js-ui/issues/3205)) ([538cd31](https://github.com/zwave-js/zwave-js-ui/commit/538cd3157c1cd7524f91cd5cc64eb1b379b2a1fe))
* bump zwave-js@11.9.0 ([#3207](https://github.com/zwave-js/zwave-js-ui/issues/3207)) ([08b1505](https://github.com/zwave-js/zwave-js-ui/commit/08b15052a9d3e52f4cb3be3e593fc2d28834e2cb))
* bump zwave-js@11.9.1 ([#3212](https://github.com/zwave-js/zwave-js-ui/issues/3212)) ([d1537e1](https://github.com/zwave-js/zwave-js-ui/commit/d1537e1612523bcaa59d3804a2d895a1afe3fff9))

# [8.22.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.21.2...v8.22.0) (2023-07-31)


### Bug Fixes

* **ui:** hide lastSeen from statistics arrows tooltip ([7859795](https://github.com/zwave-js/zwave-js-ui/commit/78597959cb3993e2a80829a258030300780747d7))
* **ui:** remove `check` action for failed nodes ([#3200](https://github.com/zwave-js/zwave-js-ui/issues/3200)) ([d6fc4d1](https://github.com/zwave-js/zwave-js-ui/commit/d6fc4d16c9c76a644d9b7062868f9cd140991331))
* **ui:** return routes set not working without a priority route ([#3188](https://github.com/zwave-js/zwave-js-ui/issues/3188)) ([be2ece4](https://github.com/zwave-js/zwave-js-ui/commit/be2ece42968127d33488642121a6d3314b499d81))


### Features

* allow to abort health checks and show steps results ([#3199](https://github.com/zwave-js/zwave-js-ui/issues/3199)) ([cc6ddce](https://github.com/zwave-js/zwave-js-ui/commit/cc6ddce00f1f319b1625b08deb28ea274559291b))
* bump zwave-js@11.8 and @zwave-js/server to 1.30.0 ([#3195](https://github.com/zwave-js/zwave-js-ui/issues/3195)) ([bffa740](https://github.com/zwave-js/zwave-js-ui/commit/bffa74001c45185aa7f1f3f956053a6e13aea698))

## [8.21.2](https://github.com/zwave-js/zwave-js-ui/compare/v8.21.1...v8.21.2) (2023-07-25)


### Bug Fixes

* typo on log ([1f01867](https://github.com/zwave-js/zwave-js-ui/commit/1f018677a512124e74fc9f5a4f0feaf83e9f07df))


### Features

* bump zwave-js@11.6.0 ([#3186](https://github.com/zwave-js/zwave-js-ui/issues/3186)) ([0ebf8a0](https://github.com/zwave-js/zwave-js-ui/commit/0ebf8a05c34e44c5cd30cb1b6c1f4e8b839c190b))

## [8.21.1](https://github.com/zwave-js/zwave-js-ui/compare/v8.21.0...v8.21.1) (2023-07-21)


### Bug Fixes

* misleading controller OTW error message ([1b7eadb](https://github.com/zwave-js/zwave-js-ui/commit/1b7eadbf40129dea92543951b45c49e191ae4575)), closes [#3181](https://github.com/zwave-js/zwave-js-ui/issues/3181)
* prevent edge case on zwave client restart ([#3180](https://github.com/zwave-js/zwave-js-ui/issues/3180)) ([01dd87b](https://github.com/zwave-js/zwave-js-ui/commit/01dd87ba70999fb192748965e859a5ce57c0bffb))


### Features

* bump zwave-js@11.5.1 ([#3179](https://github.com/zwave-js/zwave-js-ui/issues/3179)) ([edfdb00](https://github.com/zwave-js/zwave-js-ui/commit/edfdb003a205d2e1c8287006ea1b8141369764f4))
* bump zwave-js@11.5.3 ([259a0a3](https://github.com/zwave-js/zwave-js-ui/commit/259a0a3ae62019a321426ca13be5be77d24f7622))

# [8.21.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.20.0...v8.21.0) (2023-07-18)


### Bug Fixes

* add `destroyed` flag to client to prevent edge case on reconnect ([e83b146](https://github.com/zwave-js/zwave-js-ui/commit/e83b1464fefc33dae13ccaf7e994d44a04c009c1))
* minor typo in ping and heal messages ([#3170](https://github.com/zwave-js/zwave-js-ui/issues/3170)) ([3c7be58](https://github.com/zwave-js/zwave-js-ui/commit/3c7be58d3d288e53e945207735d51ff1e464fdbf))
* **ui:** cleaner alert message on NVM backup ([52d7766](https://github.com/zwave-js/zwave-js-ui/commit/52d7766432304470a1fb6f0105322462f65c0d62))
* **ui:** warn user before healing a node ([edc0125](https://github.com/zwave-js/zwave-js-ui/commit/edc0125800d97d31a996b0903de2e610d172f32f)), closes [#3175](https://github.com/zwave-js/zwave-js-ui/issues/3175)
* user callbacks on the server are set too early when recovering from a serial disconnect ([2a8bf03](https://github.com/zwave-js/zwave-js-ui/commit/2a8bf03334a0e6fa468190b509edfbaa80eefb8b)), closes [#3174](https://github.com/zwave-js/zwave-js-ui/issues/3174)


### Features

* bump zwave-js@11.5.0 ([06ac54a](https://github.com/zwave-js/zwave-js-ui/commit/06ac54a17f998a38423fa069df616373a08635d3))
* cache recently executed driver functions ([36b915c](https://github.com/zwave-js/zwave-js-ui/commit/36b915c42d2dc706d3eea65a273bdc88b123dd8e)), closes [#3160](https://github.com/zwave-js/zwave-js-ui/issues/3160)
* exponential backoff when restarting driver ([#3173](https://github.com/zwave-js/zwave-js-ui/issues/3173)) ([1f0f63c](https://github.com/zwave-js/zwave-js-ui/commit/1f0f63ce45bc2c6dcbafb2e4b889ef9b1f15908f))
* use new `lastSeen` zwaveNode prop ([#3178](https://github.com/zwave-js/zwave-js-ui/issues/3178)) ([9851875](https://github.com/zwave-js/zwave-js-ui/commit/985187537fb1321cf9f88e58824aae2a95e672b7))

# [8.20.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.19.0...v8.20.0) (2023-07-12)


### Bug Fixes

* **ui:** distinguish unknown/missing values ([5ea53a6](https://github.com/zwave-js/zwave-js-ui/commit/5ea53a605828006cad29b731e48c9477d381ee30)), closes [#3153](https://github.com/zwave-js/zwave-js-ui/issues/3153)
* **ui:** refresh schedule confirmation dialog is confusing ([3d528b1](https://github.com/zwave-js/zwave-js-ui/commit/3d528b17ef1b90068ad239feb20340c6131441eb)), closes [#3161](https://github.com/zwave-js/zwave-js-ui/issues/3161)


### Features

* better user callbacks management with HA ([#3150](https://github.com/zwave-js/zwave-js-ui/issues/3150)) ([07f7b0e](https://github.com/zwave-js/zwave-js-ui/commit/07f7b0e9855123aaae9704564d0e754cc8324088))
* bump zwave-js@11.1.0 and @zwave-js/server@1.29.1 ([9181505](https://github.com/zwave-js/zwave-js-ui/commit/9181505ed758bf81f514d7f7619df2fd19c27ebd))
* bump zwave-js@11.4.0 ([ca4d456](https://github.com/zwave-js/zwave-js-ui/commit/ca4d45628a98506743019c4489281b600f32e3c3))
* bump zwave-js@11.4.1 ([#3163](https://github.com/zwave-js/zwave-js-ui/issues/3163)) ([67ccdda](https://github.com/zwave-js/zwave-js-ui/commit/67ccdda2a3c2e3ad87aa04dcd668dc101cbd08b9))
* bump zwave-js@11.4.2 ([#3164](https://github.com/zwave-js/zwave-js-ui/issues/3164)) ([ad07d52](https://github.com/zwave-js/zwave-js-ui/commit/ad07d52439ec11424836c8f951db896c3aa2f3f0))
* custom return routes management ([#3154](https://github.com/zwave-js/zwave-js-ui/issues/3154)) ([a642934](https://github.com/zwave-js/zwave-js-ui/commit/a6429345ed5ba0cfda32536fe9fdaa7d72aa90a5))

# [8.19.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.18.1...v8.19.0) (2023-06-20)


### Bug Fixes

* authentication flow for JWT tokens ([#3140](https://github.com/zwave-js/zwave-js-ui/issues/3140)) ([6758a53](https://github.com/zwave-js/zwave-js-ui/commit/6758a53318f270ff1d4de070af33bc10ac473601))
* RUN driver function button not working ([7c0bd6e](https://github.com/zwave-js/zwave-js-ui/commit/7c0bd6eb60eff9abd6daf76dfa357e56f65c537d))
* **ui:** filter battery null values ([#3131](https://github.com/zwave-js/zwave-js-ui/issues/3131)) ([4721f91](https://github.com/zwave-js/zwave-js-ui/commit/4721f918ee0e21d629468356bee7082d6e426459))
* **ui:** next page button behind fab in control panel ([1415037](https://github.com/zwave-js/zwave-js-ui/commit/1415037240ad827c2de27d59148cc42b88ca29ee)), closes [#3147](https://github.com/zwave-js/zwave-js-ui/issues/3147)
* **ui:** use humburger button for SS fab ([8ffa0be](https://github.com/zwave-js/zwave-js-ui/commit/8ffa0be2ea3cc64c39bdcf2f42a62e85895b2a46))


### Features

* bump zwave-js@10.23.5 ([#3144](https://github.com/zwave-js/zwave-js-ui/issues/3144)) ([7b05851](https://github.com/zwave-js/zwave-js-ui/commit/7b05851892fa8b16c7831e8e1bf6e45234c7f84d))
* zwave-js v11 improvements ([#3143](https://github.com/zwave-js/zwave-js-ui/issues/3143)) ([652b08b](https://github.com/zwave-js/zwave-js-ui/commit/652b08beffff4febec2d6f14d7e96c4ea941016e))

## [8.18.1](https://github.com/zwave-js/zwave-js-ui/compare/v8.18.0...v8.18.1) (2023-06-12)


### Bug Fixes

* **ui:** cannot edit manually granted security classes ([9f42ec3](https://github.com/zwave-js/zwave-js-ui/commit/9f42ec37b828c4b79b9f80ec257bee68161d4984)), closes [#3122](https://github.com/zwave-js/zwave-js-ui/issues/3122)
* **ui:** cleaner s2 inclusion error in done step ([c6c9ee1](https://github.com/zwave-js/zwave-js-ui/commit/c6c9ee196d83e27ebf051d225de98be3c8dd9e7d)), closes [#3123](https://github.com/zwave-js/zwave-js-ui/issues/3123)
* **ui:** disable reset on read-only config ([f59d44f](https://github.com/zwave-js/zwave-js-ui/commit/f59d44f14f185fdcfd277d0a09644bf185b05f3f)), closes [#3117](https://github.com/zwave-js/zwave-js-ui/issues/3117)
* **ui:** driver function snippets select not working ([80be583](https://github.com/zwave-js/zwave-js-ui/commit/80be5834f8f3e0b9e21031a6fa59deebdb13ebb9))
* **ui:** line break support on valueId descriptions ([f9b6bf4](https://github.com/zwave-js/zwave-js-ui/commit/f9b6bf4104abf7df8c2972bc961187763241a987)), closes [#3116](https://github.com/zwave-js/zwave-js-ui/issues/3116)
* **ui:** network graph fill height ([300fb2e](https://github.com/zwave-js/zwave-js-ui/commit/300fb2e441e028748f215f70ff3b408e79e38fc6)), closes [#3125](https://github.com/zwave-js/zwave-js-ui/issues/3125)
* **ui:** reset button position ([42ecf30](https://github.com/zwave-js/zwave-js-ui/commit/42ecf30f6209c95e2bbf6bd9e6102781c78406c4)), closes [#3118](https://github.com/zwave-js/zwave-js-ui/issues/3118)
* **ui:** sync time action never visible on nodes ([9395466](https://github.com/zwave-js/zwave-js-ui/commit/939546627102fced961343fc8bec8fc92c6b0369))
* **ui:** use humburger button for control panel fab ([5c12eae](https://github.com/zwave-js/zwave-js-ui/commit/5c12eae71ba2e83456b93a12420eebad633a31f1))


### Features

* bump zwave-js@10.23.2 ([3565dfc](https://github.com/zwave-js/zwave-js-ui/commit/3565dfcb560b810ec3c2d5be35e82e9ef6e3ea11))
* **discovery:** add `state_class: measurement` to sensors ([#3139](https://github.com/zwave-js/zwave-js-ui/issues/3139)) ([e07078a](https://github.com/zwave-js/zwave-js-ui/commit/e07078a3e17c2cfe8d346e462bfd1d6421134756))

# [8.18.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.17.1...v8.18.0) (2023-06-01)


### Bug Fixes

* show error when add association fails ([7baeaf9](https://github.com/zwave-js/zwave-js-ui/commit/7baeaf93fa361dc0817951cdf7f3b5835ef1f1b8)), closes [#3112](https://github.com/zwave-js/zwave-js-ui/issues/3112)
* ts error ([baaf098](https://github.com/zwave-js/zwave-js-ui/commit/baaf09891473f2ebbceba7f47a6dd38c153ab4ff))
* **ui:** dialog nodes manager keyboard issues ([cf78a46](https://github.com/zwave-js/zwave-js-ui/commit/cf78a4626c84cb7a9e4b93dd7d7d66e073cc45cf)), closes [#3079](https://github.com/zwave-js/zwave-js-ui/issues/3079)
* **ui:** duplicated beforeDestroy hook ([aa6be2b](https://github.com/zwave-js/zwave-js-ui/commit/aa6be2b9f5251cca2982b9058a7bdc145b425011))
* **ui:** ping node show error when ping fails ([ef7fe17](https://github.com/zwave-js/zwave-js-ui/commit/ef7fe17b981c9adf49ba99902b24e7228666806a)), closes [#3099](https://github.com/zwave-js/zwave-js-ui/issues/3099)
* **ui:** prevent kepress listener to trigger when dialog not opened ([3a2998d](https://github.com/zwave-js/zwave-js-ui/commit/3a2998dec85d5bad6904d772e985a4a58a1d4aa2))


### Features

* bump zwave-js@10.22.3 ([#3114](https://github.com/zwave-js/zwave-js-ui/issues/3114)) ([92ff545](https://github.com/zwave-js/zwave-js-ui/commit/92ff545ed763f3ae244299fcb7f75e0c13c95025))
* bump zwave-js@10.23.0 ([4082fcf](https://github.com/zwave-js/zwave-js-ui/commit/4082fcf3dc978109028aa5282e61df74544c6f3a))
* bump zwave-js@10.23.1 ([#3115](https://github.com/zwave-js/zwave-js-ui/issues/3115)) ([87f1e34](https://github.com/zwave-js/zwave-js-ui/commit/87f1e343312b9fa5809ae85976b77a0726a9acd7))
* priority routes management ([#3104](https://github.com/zwave-js/zwave-js-ui/issues/3104)) ([cb5d751](https://github.com/zwave-js/zwave-js-ui/commit/cb5d751bf064d4f168d842d29f8fd39eb7d14623))

## [8.17.1](https://github.com/zwave-js/zwave-js-ui/compare/v8.17.0...v8.17.1) (2023-05-25)


### Bug Fixes

* **ui:** mesh graph styles ([94c3b67](https://github.com/zwave-js/zwave-js-ui/commit/94c3b67528a54108e044e2dcd6720b5560971267))


### Features

* bump zwave-js@10.22.2 ([#3102](https://github.com/zwave-js/zwave-js-ui/issues/3102)) ([410baf6](https://github.com/zwave-js/zwave-js-ui/commit/410baf64fed29159bb631c344471c281d1f1481e))

# [8.17.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.16.2...v8.17.0) (2023-05-24)


### Bug Fixes

* check if supervision result is null in `setEnabledSchedule` ([62d1f51](https://github.com/zwave-js/zwave-js-ui/commit/62d1f51c387f2ff16851577c9aa46ee86b6b9c8b))
* **discovery:** add exception for Simon IO 100 roller blind ([310b768](https://github.com/zwave-js/zwave-js-ui/commit/310b768c9faaf3ea321ae8876457f97fbe431f4c)), closes [#3088](https://github.com/zwave-js/zwave-js-ui/issues/3088)
* **ui:** improve keyboard navigation in nodes manager ([42baeff](https://github.com/zwave-js/zwave-js-ui/commit/42baeff17a5cce33a44a540655663b3cba1af5e6)), closes [#3079](https://github.com/zwave-js/zwave-js-ui/issues/3079)
* **ui:** schedule refresh message is backward ([1342a69](https://github.com/zwave-js/zwave-js-ui/commit/1342a698a5290e70f8c405051d5727ad95b193a7)), closes [#3093](https://github.com/zwave-js/zwave-js-ui/issues/3093)
* use isUnsupervisedOrSucceeded util ([e7cfc48](https://github.com/zwave-js/zwave-js-ui/commit/e7cfc488037ffffe5c3f62904fcab360e7c82dc8))


### Features

* add `ZUI_NO_CONSOLE` env var to disable console log ([f9c88dd](https://github.com/zwave-js/zwave-js-ui/commit/f9c88dd83eb276b145d102e68743feff127475a3)), closes [#3091](https://github.com/zwave-js/zwave-js-ui/issues/3091)
* bump zwave-js@10.22.1 ([#3101](https://github.com/zwave-js/zwave-js-ui/issues/3101)) ([cbb9e12](https://github.com/zwave-js/zwave-js-ui/commit/cbb9e12898c7803accda9b7ac736254752910ae0))
* **ui:** reset one/all configuration buttons ([765794e](https://github.com/zwave-js/zwave-js-ui/commit/765794e04b10c6ce76459bc29834184675b30fbc)), closes [#3076](https://github.com/zwave-js/zwave-js-ui/issues/3076)
* **ui:** rewrite network graph ([#3098](https://github.com/zwave-js/zwave-js-ui/issues/3098)) ([e483dfa](https://github.com/zwave-js/zwave-js-ui/commit/e483dfac09fa5a922098532c7c5054433a620e76))

## [8.16.2](https://github.com/zwave-js/zwave-js-ui/compare/v8.16.1...v8.16.2) (2023-05-19)


### Bug Fixes

* **ui:** boolean valueId may fail to set value ([c6a36e3](https://github.com/zwave-js/zwave-js-ui/commit/c6a36e3b8743f2e03c5633ea2c5ea0a6e0ef8190))
* **ui:** ensure mode is set when no one is enabled ([4a48b1f](https://github.com/zwave-js/zwave-js-ui/commit/4a48b1fcddd6dddc3d81179502cbdb736563a9ac))


### Features

* bump zwave-js@10.21.0 ([#3090](https://github.com/zwave-js/zwave-js-ui/issues/3090)) ([f8a681d](https://github.com/zwave-js/zwave-js-ui/commit/f8a681de979a56efc69279656f0e68308eae4667))

## [8.16.1](https://github.com/zwave-js/zwave-js-ui/compare/v8.16.0...v8.16.1) (2023-05-15)


### Bug Fixes

* **ui:** other visualization issues on inputs ([#3089](https://github.com/zwave-js/zwave-js-ui/issues/3089)) ([775ce59](https://github.com/zwave-js/zwave-js-ui/commit/775ce59308cbe8f208110db0db3b5332ab611cf9))
* **ui:** valueId inputs not showing correctly ([#3087](https://github.com/zwave-js/zwave-js-ui/issues/3087)) ([0abd62f](https://github.com/zwave-js/zwave-js-ui/commit/0abd62f51917732d55f64fdc47ede86fd205c5a1))
* use CharDevice for USB device ([#3020](https://github.com/zwave-js/zwave-js-ui/issues/3020)) ([c3eea2c](https://github.com/zwave-js/zwave-js-ui/commit/c3eea2cc6caa65edbb6001bf95d1a56f4b85e0c4))

# [8.16.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.15.0...v8.16.0) (2023-05-15)


### Features

* bump zwave-js@10.18.0 ([#3081](https://github.com/zwave-js/zwave-js-ui/issues/3081)) ([2311e70](https://github.com/zwave-js/zwave-js-ui/commit/2311e709315f61cba2c1bae35272c60b1e9bb6ac))
* bump zwave-js@10.20.0 ([46930e3](https://github.com/zwave-js/zwave-js-ui/commit/46930e305f864d9cfe7fb49f9a6886e11e39b960))
* reworked Schedule Entry Lock CC support ([#3078](https://github.com/zwave-js/zwave-js-ui/issues/3078)) ([401f4bc](https://github.com/zwave-js/zwave-js-ui/commit/401f4bc2f267db9b92f935b97bdf76738cc2bca4))

# [8.15.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.14.2...v8.15.0) (2023-05-04)


### Bug Fixes

* **ui:** show missing props on user codes ([a2f071a](https://github.com/zwave-js/zwave-js-ui/commit/a2f071a2cf1f4bf8505a2919d8f37385110d0114))


### Features

* bump zwave-js@10.17.0 ([#3073](https://github.com/zwave-js/zwave-js-ui/issues/3073)) ([d67858c](https://github.com/zwave-js/zwave-js-ui/commit/d67858c9f32352574ee5988eb090afdb28b61ab9))
* bump zwave-js@10.17.1 ([2eb5b8c](https://github.com/zwave-js/zwave-js-ui/commit/2eb5b8c762550607375ec95aad2fb8200228f74b))
* **ui:** support for Schedule Entry Lock CC ([#3065](https://github.com/zwave-js/zwave-js-ui/issues/3065)) ([4f1138f](https://github.com/zwave-js/zwave-js-ui/commit/4f1138faf210edda28cde0a167cf8ccb2c6367f1))
* **ui:** user codes management ([#3063](https://github.com/zwave-js/zwave-js-ui/issues/3063)) ([d3a8b9b](https://github.com/zwave-js/zwave-js-ui/commit/d3a8b9bb1d763771241b936b1e055505ee0a74fd))

## [8.14.2](https://github.com/zwave-js/zwave-js-ui/compare/v8.14.1...v8.14.2) (2023-04-26)


### Bug Fixes

* **ui:** add device info in expanded node compat view ([726c383](https://github.com/zwave-js/zwave-js-ui/commit/726c383478a5394aa478b4286d21b0324decf733)), closes [#3060](https://github.com/zwave-js/zwave-js-ui/issues/3060)
* **ui:** make login form pass manager friendly ([5a95b7b](https://github.com/zwave-js/zwave-js-ui/commit/5a95b7be95cd8e4df807fe956af9e0db2cbca5bd)), closes [#3053](https://github.com/zwave-js/zwave-js-ui/issues/3053)


### Features

* bump zwave-js@10.16.0 ([#3062](https://github.com/zwave-js/zwave-js-ui/issues/3062)) ([53c4e35](https://github.com/zwave-js/zwave-js-ui/commit/53c4e355f147dfe85d0c365b35b64d16c12f04d7))
* bump zwave-js/server@1.28.0 ([#3061](https://github.com/zwave-js/zwave-js-ui/issues/3061)) ([50306e6](https://github.com/zwave-js/zwave-js-ui/commit/50306e6f7529e2895383ef9f2335da364a1079fc))

## [8.14.1](https://github.com/zwave-js/zwave-js-ui/compare/v8.14.0...v8.14.1) (2023-04-19)


### Bug Fixes

* **ui:** set value not working ([f3e57e1](https://github.com/zwave-js/zwave-js-ui/commit/f3e57e14a4583572f590f6f2cc9e9cc9c8dc8b15)), closes [#3055](https://github.com/zwave-js/zwave-js-ui/issues/3055)

# [8.14.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.13.1...v8.14.0) (2023-04-17)


### Bug Fixes

* remove useless res.locals in error handler ([ea33475](https://github.com/zwave-js/zwave-js-ui/commit/ea3347588db94ceea8c37f9db2edb8a8ebd82c3a))
* **ui:** prefill targets in fw update ([9c35a8d](https://github.com/zwave-js/zwave-js-ui/commit/9c35a8d4240aca5af853d6f8d5cebe74832e8932))
* undefined CC version after re-interview/refresh values ([#3050](https://github.com/zwave-js/zwave-js-ui/issues/3050))Co-authored-by: AlCalzone <d.griesel@gmx.net> ([c3d8432](https://github.com/zwave-js/zwave-js-ui/commit/c3d8432f31cbce95527f12d7bd6053c7a11120c9)), closes [#3045](https://github.com/zwave-js/zwave-js-ui/issues/3045)
* valueId metadata out of sync with ui ([#3040](https://github.com/zwave-js/zwave-js-ui/issues/3040)) ([ff0e12b](https://github.com/zwave-js/zwave-js-ui/commit/ff0e12bd032140c33e17bc8db6a20fd5066c3c3e))


### Features

* allow to manually idle notifications ([6448cc8](https://github.com/zwave-js/zwave-js-ui/commit/6448cc8679ce2cc34d96e7cec71dc742a19b3db3)), closes [#3051](https://github.com/zwave-js/zwave-js-ui/issues/3051)
* bump zwave-js@10.14.1 ([#3039](https://github.com/zwave-js/zwave-js-ui/issues/3039)) ([6d8e57d](https://github.com/zwave-js/zwave-js-ui/commit/6d8e57de42270b002a612812cbf84d73e978381b))
* bump zwave-js@10.15.0 ([457bd9e](https://github.com/zwave-js/zwave-js-ui/commit/457bd9e0affbf18a6215ae14313ecae354d13790))

## [8.13.1](https://github.com/zwave-js/zwave-js-ui/compare/v8.13.0...v8.13.1) (2023-04-07)


### Bug Fixes

* **ui:** ignore rssi error on chart ([67cce90](https://github.com/zwave-js/zwave-js-ui/commit/67cce90c61338b7dce9b8214702f091c612a5ca9))


### Features

* bump zwave-js@10.14.0 ([#3036](https://github.com/zwave-js/zwave-js-ui/issues/3036)) ([002b300](https://github.com/zwave-js/zwave-js-ui/commit/002b300ce3ef016945c0384a71e062976e34ab5f))

# [8.13.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.12.0...v8.13.0) (2023-04-05)


### Bug Fixes

* **discovery:** door state binary sensor ([90316f4](https://github.com/zwave-js/zwave-js-ui/commit/90316f4ca6e6b8d8f638878b3236eaff5a7eece1)), closes [#3003](https://github.com/zwave-js/zwave-js-ui/issues/3003)


### Features

* add command to set current node date/time ([#3005](https://github.com/zwave-js/zwave-js-ui/issues/3005) ([d84fa03](https://github.com/zwave-js/zwave-js-ui/commit/d84fa0387b153e7b304088c3f908c657fac9dc4d))
* background RSSI chart ([#3033](https://github.com/zwave-js/zwave-js-ui/issues/3033))Co-authored-by: Dominic Griesel <dominic.griesel@nabucasa.com> ([e6a00ba](https://github.com/zwave-js/zwave-js-ui/commit/e6a00ba8ab3f7faf887285de0256572a434aab21)), closes [#3008](https://github.com/zwave-js/zwave-js-ui/issues/3008)
* bump zwave-js@10.13.0 ([d5f2920](https://github.com/zwave-js/zwave-js-ui/commit/d5f2920a398dd7e6f170deadf6c57d2f4e33a9d6))

# [8.12.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.11.1...v8.12.0) (2023-04-03)


### Bug Fixes

* allow to call zwave apis in boot loader mode ([a286a8f](https://github.com/zwave-js/zwave-js-ui/commit/a286a8f399e3cc52948f0afa31f7a976f6fdf12f)), closes [#3023](https://github.com/zwave-js/zwave-js-ui/issues/3023)
* remove driver ready check from `firmwareUpdateOTW` ([a793dd0](https://github.com/zwave-js/zwave-js-ui/commit/a793dd02a051459b99a186173e1dc07aa66e2b73))
* **ui:** better default node name in compact view ([71a9884](https://github.com/zwave-js/zwave-js-ui/commit/71a988421679dc7e61ca5959f5a661b6f6c48c53))
* **ui:** catch value write errors ([5195433](https://github.com/zwave-js/zwave-js-ui/commit/5195433469022574c810a33e907aa7978f6bf055)), closes [#3025](https://github.com/zwave-js/zwave-js-ui/issues/3025)
* **ui:** hide manage nodes when there are selected ones ([be89889](https://github.com/zwave-js/zwave-js-ui/commit/be89889b7ef49e310aa2ff4dd03b145e3ef0d030))
* **ui:** otw update not working in bootloader only mode ([89bb3e2](https://github.com/zwave-js/zwave-js-ui/commit/89bb3e2d3859d383f656a35eef490b81693e91ba)), closes [#3023](https://github.com/zwave-js/zwave-js-ui/issues/3023)


### Features

* **ui:** allow to send actions to selected nodes in table ([9806539](https://github.com/zwave-js/zwave-js-ui/commit/980653973e29e40f17f5b248da60693bb37e234a))
* use valueId stored timestamp in MQTT JSON payload ([7b373c3](https://github.com/zwave-js/zwave-js-ui/commit/7b373c3d5956e4b46e1ffa762566fe04546e7a47)), closes [#3029](https://github.com/zwave-js/zwave-js-ui/issues/3029)

## [8.11.1](https://github.com/zwave-js/zwave-js-ui/compare/v8.11.0...v8.11.1) (2023-03-24)


### Features

* bump zwave-js-server@1.27.0 ([#3018](https://github.com/zwave-js/zwave-js-ui/issues/3018)) ([0349aed](https://github.com/zwave-js/zwave-js-ui/commit/0349aedcc967a74ee3ea1f6a1b0f322b10ff7946))

# [8.11.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.10.1...v8.11.0) (2023-03-17)


### Bug Fixes

* **ui:** correctly print driver function result ([d6f42d7](https://github.com/zwave-js/zwave-js-ui/commit/d6f42d75aaf1d377fe52e13d9ec8c0f9b7b5ea93))


### Features

* ability to force query associations ([5154a02](https://github.com/zwave-js/zwave-js-ui/commit/5154a0276e41ae7b134a5a0db0b84df93327a00b)), closes [#2752](https://github.com/zwave-js/zwave-js-ui/issues/2752)
* add `shutdownZwaveAPI` command ([6755044](https://github.com/zwave-js/zwave-js-ui/commit/67550449c30190f698c433172e9ba23b923aadcd))
* add access-store-dir snippet ([83607e0](https://github.com/zwave-js/zwave-js-ui/commit/83607e0c6fc35af5248f4076ef3ab4bebc372da0))
* allow to upload a file in store ([c00dfcc](https://github.com/zwave-js/zwave-js-ui/commit/c00dfccbf76253d51fd29db9ad93a47944b7d48f))
* bump zwave-js@10.12.0 ([adc9dcc](https://github.com/zwave-js/zwave-js-ui/commit/adc9dcc8999a79b20ab12216d41ed53b800f53ad))
* **ui:** better scan of small qr codes ([#3007](https://github.com/zwave-js/zwave-js-ui/issues/3007) ([295bec0](https://github.com/zwave-js/zwave-js-ui/commit/295bec0c50d20697812036e40e662b281ec27f68)), closes [#2767](https://github.com/zwave-js/zwave-js-ui/issues/2767)
* **ui:** show low level security reason when node added with low security ([245f596](https://github.com/zwave-js/zwave-js-ui/commit/245f5963e27960584ec7c62c9ea1bfc918309ed0))

## [8.10.1](https://github.com/zwave-js/zwave-js-ui/compare/v8.10.0...v8.10.1) (2023-03-09)


### Bug Fixes

* broken inclusion process ([#2995](https://github.com/zwave-js/zwave-js-ui/issues/2995) ([51b806d](https://github.com/zwave-js/zwave-js-ui/commit/51b806de972a52aa042bd74d4a1965e8397984af)), closes [#2993](https://github.com/zwave-js/zwave-js-ui/issues/2993)
* possible issue on startup `cb` is not a function ([4f12e5e](https://github.com/zwave-js/zwave-js-ui/commit/4f12e5e4ab7f1750650c6b90788176bdc6627672)), closes [#2994](https://github.com/zwave-js/zwave-js-ui/issues/2994)


### Features

* **ui:** improve smart view for smaller screens ([2a77652](https://github.com/zwave-js/zwave-js-ui/commit/2a77652268f66d7a6f2fd9d3311eaef53d40eec5))

# [8.10.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.9.0...v8.10.0) (2023-03-08)


### Bug Fixes

* improve socket messages delivery ([#2978](https://github.com/zwave-js/zwave-js-ui/issues/2978) ([0b78aa6](https://github.com/zwave-js/zwave-js-ui/commit/0b78aa61150686c464a11a875201c68bff37b8c0)), closes [#2975](https://github.com/zwave-js/zwave-js-ui/issues/2975)
* prevent fw updates when update in progress ([#2984](https://github.com/zwave-js/zwave-js-ui/issues/2984)) ([dad95b4](https://github.com/zwave-js/zwave-js-ui/commit/dad95b481dda76e1e767a39ad781b85604062152)), closes [#2983](https://github.com/zwave-js/zwave-js-ui/issues/2983)
* toSubscribe being set to bool instead of map ([#2985](https://github.com/zwave-js/zwave-js-ui/issues/2985)) ([f6e3338](https://github.com/zwave-js/zwave-js-ui/commit/f6e333898bab88eb44d27e84aff2b7ea93106b91))
* **ui:** heal network action not working ([3e4df63](https://github.com/zwave-js/zwave-js-ui/commit/3e4df63075c973d12dd4928a6d054c0000969727)), closes [#2987](https://github.com/zwave-js/zwave-js-ui/issues/2987)


### Features

* bump zwave-js@10.11.0 ([e7556b4](https://github.com/zwave-js/zwave-js-ui/commit/e7556b4bb177a5271dd84d4f4f6d94804c551b6d))

# [8.9.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.8.6...v8.9.0) (2023-02-24)


### Bug Fixes

* **ui:** prevent error on expanded node ([8377e60](https://github.com/zwave-js/zwave-js-ui/commit/8377e600938e368eff77e0fce1c7ab9c54b8e1e9))


### Features

* **ui:** smart table view for smaller screens ([#2971](https://github.com/zwave-js/zwave-js-ui/issues/2971) ([a974a6f](https://github.com/zwave-js/zwave-js-ui/commit/a974a6f963a93fede0501abd5e11ad791726f35c))

## [8.8.6](https://github.com/zwave-js/zwave-js-ui/compare/v8.8.5...v8.8.6) (2023-02-21)


### Bug Fixes

* create symlink to current UI logfile ([#2959](https://github.com/zwave-js/zwave-js-ui/issues/2959)) ([e77346b](https://github.com/zwave-js/zwave-js-ui/commit/e77346bbe746036407a511af6912f5fa5cf97ce5))


### Features

* bump zwave-js-server@1.26.0 ([#2968](https://github.com/zwave-js/zwave-js-ui/issues/2968)) ([600f02f](https://github.com/zwave-js/zwave-js-ui/commit/600f02f88b689cf80a62514e4845b592e85deac2))
* **discovery:** danfoss thermostat support ([de7ab08](https://github.com/zwave-js/zwave-js-ui/commit/de7ab0859e4a51b07b883c5c32bdf1edb717cca1)), closes [#2834](https://github.com/zwave-js/zwave-js-ui/issues/2834)

## [8.8.5](https://github.com/zwave-js/zwave-js-ui/compare/v8.8.4...v8.8.5) (2023-02-09)


### Bug Fixes

* **discovery:** add `state_class` to kwh sensors ([#2953](https://github.com/zwave-js/zwave-js-ui/issues/2953)) ([f570d04](https://github.com/zwave-js/zwave-js-ui/commit/f570d04b5b19fcfc6cedd0f9450a2bbf01f3d6f9))
* throttle otw updates progress ([#2951](https://github.com/zwave-js/zwave-js-ui/issues/2951) ([c0a6f78](https://github.com/zwave-js/zwave-js-ui/commit/c0a6f7871eab8729da5ea610586d68162e594302))
* **ui:** footer overlaps buttons in settings ([6840532](https://github.com/zwave-js/zwave-js-ui/commit/684053281d4c749fd0367ba917c6fd8b35710f3f)), closes [#2949](https://github.com/zwave-js/zwave-js-ui/issues/2949)
* **ui:** only open first level on store ([5e7df02](https://github.com/zwave-js/zwave-js-ui/commit/5e7df02bade54a8cebf3a58178c954547fcae9c8)), closes [#2950](https://github.com/zwave-js/zwave-js-ui/issues/2950)
* **ui:** prismjs editor line numbers ([#2947](https://github.com/zwave-js/zwave-js-ui/issues/2947) ([d091834](https://github.com/zwave-js/zwave-js-ui/commit/d091834ad7512bf9be2b6c99051dcd09b6b8a864)), closes [#2945](https://github.com/zwave-js/zwave-js-ui/issues/2945)


### Features

* bump zwave-js@10.10.0 ([#2954](https://github.com/zwave-js/zwave-js-ui/issues/2954)) ([e0cf08c](https://github.com/zwave-js/zwave-js-ui/commit/e0cf08c3be2dd3bb758fa5a64914840bd424a8ee))

## [8.8.4](https://github.com/zwave-js/zwave-js-ui/compare/v8.8.3...v8.8.4) (2023-02-07)


### Bug Fixes

* catch lstat errors when parsing store files ([589e172](https://github.com/zwave-js/zwave-js-ui/commit/589e1728b5eb828eba9f8153f50b7b80f4cf615d)), closes [#2937](https://github.com/zwave-js/zwave-js-ui/issues/2937)
* **ui:** endpoints labels ([6b8fa3e](https://github.com/zwave-js/zwave-js-ui/commit/6b8fa3ec2a89405dceb65e54cf3c0242165a322d))
* **ui:** filter ota/otw file upload extensions ([6026645](https://github.com/zwave-js/zwave-js-ui/commit/60266459d1c2a23ffc0dfac1e7c512d74f4340e2)), closes [#2915](https://github.com/zwave-js/zwave-js-ui/issues/2915)
* **ui:** hide loading when healthcheck fails ([0992778](https://github.com/zwave-js/zwave-js-ui/commit/099277802baad9e0ba735d8e8503f680238fe48f)), closes [#2946](https://github.com/zwave-js/zwave-js-ui/issues/2946)
* **ui:** save button not visible on smartphones ([1d4e3bc](https://github.com/zwave-js/zwave-js-ui/commit/1d4e3bc04548e5a9f93de8b990e84be24f8258f9)), closes [#2944](https://github.com/zwave-js/zwave-js-ui/issues/2944)
* **ui:** visualization issues with custom configuration parameter setting ([0551c81](https://github.com/zwave-js/zwave-js-ui/commit/0551c8173c6d4e2703ce9ffa540b551846d04714)), closes [#2940](https://github.com/zwave-js/zwave-js-ui/issues/2940)


### Features

* add logins logs ([b1dc1a4](https://github.com/zwave-js/zwave-js-ui/commit/b1dc1a4f535fbba65020d8e45943bb1c8e7e4e33)), closes [#2933](https://github.com/zwave-js/zwave-js-ui/issues/2933)
* bump zwave-js@10.5.6 ([#2932](https://github.com/zwave-js/zwave-js-ui/issues/2932)) ([4594284](https://github.com/zwave-js/zwave-js-ui/commit/4594284189e402e4bdd17fb6918d06459a047be9))
* zwave-js@10.7.0, heal network options, endpoints labels ([#2941](https://github.com/zwave-js/zwave-js-ui/issues/2941) ([6bcf8e3](https://github.com/zwave-js/zwave-js-ui/commit/6bcf8e359deb5185540ee6edd2cbfca376c25afc))

## [8.8.3](https://github.com/zwave-js/zwave-js-ui/compare/v8.8.2...v8.8.3) (2023-01-31)


### Bug Fixes

* **mqtt:** set correct `device_class` on gas sensor ([892e49a](https://github.com/zwave-js/zwave-js-ui/commit/892e49a4bc2ec3012ff216d357456dca2b8355c9)), closes [#2930](https://github.com/zwave-js/zwave-js-ui/issues/2930)
* stopping network heal does not clear healing progress in ui ([6cddde3](https://github.com/zwave-js/zwave-js-ui/commit/6cddde35947d674584e7b017136f21ca2eac5f93)), closes [#2926](https://github.com/zwave-js/zwave-js-ui/issues/2926)
* **ui:** typo in smart start tab ([c0dd46c](https://github.com/zwave-js/zwave-js-ui/commit/c0dd46cc07f5f409208fb000966e398983f528f1)), closes [#2925](https://github.com/zwave-js/zwave-js-ui/issues/2925)


### Features

* bump zwave-js@10.5.5 ([#2931](https://github.com/zwave-js/zwave-js-ui/issues/2931)) ([abf2d14](https://github.com/zwave-js/zwave-js-ui/commit/abf2d148331ea391dcb9aea2d7101923518c694c))
* standardize node id in logs and filter in debug view ([#2923](https://github.com/zwave-js/zwave-js-ui/issues/2923)) ([2b326b5](https://github.com/zwave-js/zwave-js-ui/commit/2b326b51897572cab7cb7ae8e43607f074c238f4))

## [8.8.2](https://github.com/zwave-js/zwave-js-ui/compare/v8.8.1...v8.8.2) (2023-01-29)


### Features

* bump zwave-js-server@1.25.0 ([#2917](https://github.com/zwave-js/zwave-js-ui/issues/2917)) ([c391e1a](https://github.com/zwave-js/zwave-js-ui/commit/c391e1a1a76826a5ea7a1a2d7d78457ca360ebfb))
* bump zwave-js@10.5.4 ([#2919](https://github.com/zwave-js/zwave-js-ui/issues/2919)) ([32f4dc6](https://github.com/zwave-js/zwave-js-ui/commit/32f4dc601a9c61d8546987d4e817c18194410d49))
* intercept zwave-js server `hard reset` event ([#2879](https://github.com/zwave-js/zwave-js-ui/issues/2879)) ([8501609](https://github.com/zwave-js/zwave-js-ui/commit/8501609007ce8847baf5673ee96f044c6a81a469))

## [8.8.1](https://github.com/zwave-js/zwave-js-ui/compare/v8.8.0...v8.8.1) (2023-01-26)


### Bug Fixes

* catch unhandled rejections ([69f2709](https://github.com/zwave-js/zwave-js-ui/commit/69f2709f36baa753c4ae4231ac053a0e404bff65))
* **ui:** always show OTW result ([a72d467](https://github.com/zwave-js/zwave-js-ui/commit/a72d46748639f375f009a846c049c308f41ed92e))
* **ui:** move otw update to main advanced actions ([557cec1](https://github.com/zwave-js/zwave-js-ui/commit/557cec14a81bd8de823274a1d9ebaba31b5566bb))
* **ui:** otw update edge cases and ui sync ([#2911](https://github.com/zwave-js/zwave-js-ui/issues/2911)) ([f0b175e](https://github.com/zwave-js/zwave-js-ui/commit/f0b175e86b1b2a21f14fff54d121c88021459699))
* **ui:** prevent showing empty controller update result ([8ef4ab7](https://github.com/zwave-js/zwave-js-ui/commit/8ef4ab71c6b6df4cbcd82a4ff5e831c6d4836dff))
* **ui:** show different color for S0 security ([85b0371](https://github.com/zwave-js/zwave-js-ui/commit/85b0371c617ede5debbac7aa4d54468ebe8058ca)), closes [#2894](https://github.com/zwave-js/zwave-js-ui/issues/2894)


### Features

* bump zwave-js@10.5.0 ([#2913](https://github.com/zwave-js/zwave-js-ui/issues/2913)) ([bf7d623](https://github.com/zwave-js/zwave-js-ui/commit/bf7d623e2535dcfc2cc37cb0f771756bacece916))

# [8.8.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.7.0...v8.8.0) (2023-01-23)


### Bug Fixes

* **mqtt:** don't send `lastActive` from controller node ([fe4a377](https://github.com/zwave-js/zwave-js-ui/commit/fe4a377f49169794620456d5fbe8e2c268000257))
* **ui:** checkbox in columns not working ([26c423e](https://github.com/zwave-js/zwave-js-ui/commit/26c423e17d0b7b913e4d78eab115bc79069e5064)), closes [#2890](https://github.com/zwave-js/zwave-js-ui/issues/2890)
* **ui:** doubled scrollbars dimensions ([dda1dd4](https://github.com/zwave-js/zwave-js-ui/commit/dda1dd48e0b2668795a606de4aebdccb848f71cc)), closes [#2899](https://github.com/zwave-js/zwave-js-ui/issues/2899)
* **ui:** hide inclusion stopped alert on grant security classes ([2dee8de](https://github.com/zwave-js/zwave-js-ui/commit/2dee8de5dd41e4230c101fc743fa056755b5b7c7))


### Features

* allow to parse pre-filled dsk qr ([#2885](https://github.com/zwave-js/zwave-js-ui/issues/2885)) ([a6a9e52](https://github.com/zwave-js/zwave-js-ui/commit/a6a9e523ec45791cd901535e99bc9fbf194d61bb))
* bump zwave-js@10.4.0 ([87e594c](https://github.com/zwave-js/zwave-js-ui/commit/87e594c9f9716fd22c9da03d6ce4ec1ea791c9f3))
* **mqtt:** add node `lastActive` topic ([#2901](https://github.com/zwave-js/zwave-js-ui/issues/2901)) ([831df1f](https://github.com/zwave-js/zwave-js-ui/commit/831df1f7374a4ab182f29f1bfc8e46b64df6cc03))
* support for max files zwave setting ([#2880](https://github.com/zwave-js/zwave-js-ui/issues/2880)) ([87333e9](https://github.com/zwave-js/zwave-js-ui/commit/87333e92fd27b5d170ed89af94bb09718603a02a))
* support otw update ([#2886](https://github.com/zwave-js/zwave-js-ui/issues/2886)) ([999d863](https://github.com/zwave-js/zwave-js-ui/commit/999d863ca12f33a0278ecdb4350d2a336e4be85a))
* **ui:** allow to run driver function without closing dialog ([07d0c38](https://github.com/zwave-js/zwave-js-ui/commit/07d0c38dfe1c868672e3d00c50a21d64460d027f)), closes [#2889](https://github.com/zwave-js/zwave-js-ui/issues/2889)

# [8.7.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.6.3...v8.7.0) (2023-01-16)


### Bug Fixes

* **mqtt:** lock error when persistent store is enabled ([082209b](https://github.com/zwave-js/zwave-js-ui/commit/082209bb6ac84dc8573a13bca28fdfe2b49009e2))


### Features

* allow to run scheduled jobs on init ([3d2950c](https://github.com/zwave-js/zwave-js-ui/commit/3d2950c34101a321a1fa027c86f3d4b49219a7e1))
* scheduled jobs ([#2882](https://github.com/zwave-js/zwave-js-ui/issues/2882)) ([c9cabbb](https://github.com/zwave-js/zwave-js-ui/commit/c9cabbb8c2f3cd1a3c0cb1d3f472951e24d5a53c))

## [8.6.3](https://github.com/zwave-js/zwave-js-ui/compare/v8.6.2...v8.6.3) (2023-01-10)


### Bug Fixes

* **discovery:** errors with electricity device_class and HA 2023.1 ([#2881](https://github.com/zwave-js/zwave-js-ui/issues/2881)) ([402a560](https://github.com/zwave-js/zwave-js-ui/commit/402a5602df583c9327cf7731027fe82780e72f30))
* improved handling of battery levels updates ([#2860](https://github.com/zwave-js/zwave-js-ui/issues/2860)) ([08f994b](https://github.com/zwave-js/zwave-js-ui/commit/08f994b9003bdfe5638f43b2ca50cf40019c1306)), closes [#2845](https://github.com/zwave-js/zwave-js-ui/issues/2845)
* **ui:** automatically trim qr strings ([b1572ad](https://github.com/zwave-js/zwave-js-ui/commit/b1572ad4430573767288d183e85cb8203b36fb3b)), closes [#2766](https://github.com/zwave-js/zwave-js-ui/issues/2766)

## [8.6.2](https://github.com/zwave-js/zwave-js-ui/compare/v8.6.1...v8.6.2) (2022-12-23)

## [8.6.1](https://github.com/zwave-js/zwave-js-ui/compare/v8.6.0...v8.6.1) (2022-12-16)


### Bug Fixes

* **ui:** controller as default target in healthcheck ([1df4afb](https://github.com/zwave-js/zwave-js-ui/commit/1df4afb521dd81a774f7f22e43091ef7583ec3c5)), closes [#2842](https://github.com/zwave-js/zwave-js-ui/issues/2842)
* **ui:** progress bar never hides in healthcheck dialog ([01c659b](https://github.com/zwave-js/zwave-js-ui/commit/01c659bd33dbb3152880c9d749c17af4adc876f4)), closes [#2841](https://github.com/zwave-js/zwave-js-ui/issues/2841)


### Features

* **mqtt:** add mqtt support for inclusion callbacks ([#2848](https://github.com/zwave-js/zwave-js-ui/issues/2848)) ([47c0a72](https://github.com/zwave-js/zwave-js-ui/commit/47c0a72f05804c150c8c6c26f3dd93f4d690d31a)), closes [#2847](https://github.com/zwave-js/zwave-js-ui/issues/2847)

# [8.6.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.5.1...v8.6.0) (2022-12-09)


### Features

* **ui:** add value format to Custom ConfigCC ([#2837](https://github.com/zwave-js/zwave-js-ui/issues/2837)) ([11dc84d](https://github.com/zwave-js/zwave-js-ui/commit/11dc84dc36c5b5873153dcdd044dfc8e0248d2ea))

## [8.5.1](https://github.com/zwave-js/zwave-js-ui/compare/v8.5.0...v8.5.1) (2022-11-25)


### Bug Fixes

* **mqtt:** node added on fly not subscribed to changes ([#2820](https://github.com/zwave-js/zwave-js-ui/issues/2820)) ([954b395](https://github.com/zwave-js/zwave-js-ui/commit/954b395226ed37f1fead5c6efbd0d88eac2ddeb2))

# [8.5.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.4.1...v8.5.0) (2022-11-18)


### Bug Fixes

* correctly update node `last seen` ([b97dd0d](https://github.com/zwave-js/zwave-js-ui/commit/b97dd0d30de2a106eb8c68fa326d9a48db27fd11)), closes [#2800](https://github.com/zwave-js/zwave-js-ui/issues/2800)


### Features

* bump zwave-js@10.3.1 ([#2801](https://github.com/zwave-js/zwave-js-ui/issues/2801)) ([4f40677](https://github.com/zwave-js/zwave-js-ui/commit/4f406772fdb3112bcc6b27007ed5e93bc1438db8))
* **mqtt:** restore on disk store support of offline packets ([6c44920](https://github.com/zwave-js/zwave-js-ui/commit/6c4492097e4912b0a7cae79d1f0c5501ad46721b))
* **ui:** show info tooltip when set value of sleeping node ([4a6d60f](https://github.com/zwave-js/zwave-js-ui/commit/4a6d60f4807e27431658f0fbf220f5c83c9fb4cf))

## [8.4.1](https://github.com/zwave-js/zwave-js-ui/compare/v8.4.0...v8.4.1) (2022-11-08)


### Bug Fixes

* **mqtt:** possible circular reference error in publish ([#2792](https://github.com/zwave-js/zwave-js-ui/issues/2792)) ([1424dd4](https://github.com/zwave-js/zwave-js-ui/commit/1424dd400ea99647cee1b4109a41e28f38542db6))

# [8.4.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.3.0...v8.4.0) (2022-11-08)


### Bug Fixes

* **mqtt:** always send zwaveNode to node `event` as first arg ([#2790](https://github.com/zwave-js/zwave-js-ui/issues/2790)) ([c254a86](https://github.com/zwave-js/zwave-js-ui/commit/c254a86acccef87efab3673ae38b92fe45f41c13)), closes [#2789](https://github.com/zwave-js/zwave-js-ui/issues/2789)
* **ui:** filter mains powered devices ([#2788](https://github.com/zwave-js/zwave-js-ui/issues/2788)) ([e16225c](https://github.com/zwave-js/zwave-js-ui/commit/e16225c1f0723a441519a57eea43f10ab66bdeed)), closes [#2761](https://github.com/zwave-js/zwave-js-ui/issues/2761)
* **ui:** valueId button text overlaps ([33d1cf5](https://github.com/zwave-js/zwave-js-ui/commit/33d1cf524096449799f9a557541b5cba177f2ebb)), closes [#2780](https://github.com/zwave-js/zwave-js-ui/issues/2780)


### Features

* **ui:** show loader when value is waiting an update ([#2791](https://github.com/zwave-js/zwave-js-ui/issues/2791)) ([ff2396b](https://github.com/zwave-js/zwave-js-ui/commit/ff2396b0d48b7a77de9ce503395db29bd12ddf52)), closes [/github.com/zwave-js/zwave-js-ui/issues/188#issuecomment-1295987999](https://github.com//github.com/zwave-js/zwave-js-ui/issues/188/issues/issuecomment-1295987999)

# [8.3.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.2.2...v8.3.0) (2022-11-02)


### Bug Fixes

* catch zwave js server errors ([#2754](https://github.com/zwave-js/zwave-js-ui/issues/2754)) ([af754ad](https://github.com/zwave-js/zwave-js-ui/commit/af754ad6b5c9b015f2179025fd222abb03499628)), closes [#782](https://github.com/zwave-js/zwave-js-ui/issues/782)
* **ui:** typo in fw update dialog title ([#2764](https://github.com/zwave-js/zwave-js-ui/issues/2764)) ([044d543](https://github.com/zwave-js/zwave-js-ui/commit/044d543ed963445d33cf5bbaa9d8bfa25816ecaf))
* **ui:** update favicons ([a16b670](https://github.com/zwave-js/zwave-js-ui/commit/a16b670419be4866dfa1b411a5822bdf33e07682))


### Features

* bump @zwave-js/server@1.24.1 ([#2765](https://github.com/zwave-js/zwave-js-ui/issues/2765)) ([2cc76b6](https://github.com/zwave-js/zwave-js-ui/commit/2cc76b6759aaad4ba466e1bc2466297292366cc8))
* **ui:** allow to fetch OTA pre-releases ([#2773](https://github.com/zwave-js/zwave-js-ui/issues/2773)) ([098432e](https://github.com/zwave-js/zwave-js-ui/commit/098432ea6e76270d80832496a903f29e69555fc5)), closes [#2768](https://github.com/zwave-js/zwave-js-ui/issues/2768)

## [8.2.2](https://github.com/zwave-js/zwave-js-ui/compare/v8.2.1...v8.2.2) (2022-10-25)


### Bug Fixes

* **ui:** better firmware update progress ([#2755](https://github.com/zwave-js/zwave-js-ui/issues/2755)) ([d6c7867](https://github.com/zwave-js/zwave-js-ui/commit/d6c78679d650b60e0234403d865f90fc433908d6))
* **ui:** nodes manager dialog improvements ([#2747](https://github.com/zwave-js/zwave-js-ui/issues/2747)) ([fe152d9](https://github.com/zwave-js/zwave-js-ui/commit/fe152d921fba4b960e4b55c8ee022733c345cbdd)), closes [#2079](https://github.com/zwave-js/zwave-js-ui/issues/2079) [#2746](https://github.com/zwave-js/zwave-js-ui/issues/2746) [#2735](https://github.com/zwave-js/zwave-js-ui/issues/2735)
* **ui:** show warning if `manualDiscovery` is enabled ([bbb16db](https://github.com/zwave-js/zwave-js-ui/commit/bbb16db4b23fe7264c4a3ac3bd0e96b0e819eb76)), closes [#2733](https://github.com/zwave-js/zwave-js-ui/issues/2733)


### Features

* **ui:** add notice on OTA updates not being complete ([#2753](https://github.com/zwave-js/zwave-js-ui/issues/2753)) ([39fc9d2](https://github.com/zwave-js/zwave-js-ui/commit/39fc9d27a99e83049f978574a39e401f78a910e3))

## [8.2.1](https://github.com/zwave-js/zwave-js-ui/compare/v8.2.0...v8.2.1) (2022-10-12)


### Bug Fixes

* **ui:** add back target selection to firmware update dialog ([#2726](https://github.com/zwave-js/zwave-js-ui/issues/2726)) ([c3c6c1c](https://github.com/zwave-js/zwave-js-ui/commit/c3c6c1c902971b35149948a211562e12d09dc5f0))

# [8.2.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.1.0...v8.2.0) (2022-10-11)


### Bug Fixes

* **mqtt:** possible write fails when publishing to `/set` ([#2720](https://github.com/zwave-js/zwave-js-ui/issues/2720)) ([03fa9ee](https://github.com/zwave-js/zwave-js-ui/commit/03fa9ee7a9b19887ed2d7974d953b0d73998448c))


### Features

* **ui:** better snackbars and import provisioning json ([#2716](https://github.com/zwave-js/zwave-js-ui/issues/2716)) ([1249312](https://github.com/zwave-js/zwave-js-ui/commit/12493125fcf76389b75f865fbfe943c6c3bb1628)), closes [#1942](https://github.com/zwave-js/zwave-js-ui/issues/1942)
* **ui:** switch from vuex to pinia ([#2719](https://github.com/zwave-js/zwave-js-ui/issues/2719)) ([e9630fd](https://github.com/zwave-js/zwave-js-ui/commit/e9630fd89ea43569ec3916c18ed04f78db16c8e4))

# [8.1.0](https://github.com/zwave-js/zwave-js-ui/compare/v8.0.3...v8.1.0) (2022-10-04)


### Features

* **pkg:** add windows build to release assets ([abb7ca9](https://github.com/zwave-js/zwave-js-ui/commit/abb7ca9e8471a25f5643f876b0bd0ebd0e90f87d))
* zwave-js@10.3.0 and new fw update apis ([#2702](https://github.com/zwave-js/zwave-js-ui/issues/2702)) ([5255d64](https://github.com/zwave-js/zwave-js-ui/commit/5255d642329f789880db171e98d7f16ccaac2fa3))

## [8.0.3](https://github.com/zwave-js/zwave-js-ui/compare/v8.0.2...v8.0.3) (2022-10-03)


### Features

* add `UID_DISCOVERY_PREFIX` env var ([#2698](https://github.com/zwave-js/zwave-js-ui/issues/2698)) ([93c16af](https://github.com/zwave-js/zwave-js-ui/commit/93c16af9f2ed6413d1ee11c6ed40f16cdbf31d0c))

## [8.0.2](https://github.com/zwave-js/zwave-js-ui/compare/v8.0.1...v8.0.2) (2022-09-29)


### Bug Fixes

* **docker:** use zwave-js's new pack utility, optimize layers, copy snippets ([#2688](https://github.com/zwave-js/zwave-js-ui/issues/2688)) ([281e9c0](https://github.com/zwave-js/zwave-js-ui/commit/281e9c072e890656365e0fe024a03817ef67df6e))
* reset node fw update progress on abort ([#2692](https://github.com/zwave-js/zwave-js-ui/issues/2692)) ([08ed7cb](https://github.com/zwave-js/zwave-js-ui/commit/08ed7cb3df69cc0192499e21cc7eb943bbf36dc5))
* revert mqtt discovery `unique_id` prefix change ([2fc3850](https://github.com/zwave-js/zwave-js-ui/commit/2fc3850ed9f4edd4ae64563ce18af16693303e85))
* startup ASCII logo not escaped ([dc1ce1d](https://github.com/zwave-js/zwave-js-ui/commit/dc1ce1d6daa8f6d9ff3cf36dcbe48f23025a5351))


### Features

* bump @zwave-js/server@1.23.1 ([#2689](https://github.com/zwave-js/zwave-js-ui/issues/2689)) ([ee339d3](https://github.com/zwave-js/zwave-js-ui/commit/ee339d388be073df19b4cc0655885db672e3a2ee))

## [8.0.1](https://github.com/zwave-js/zwave-js-ui/compare/v8.0.0...v8.0.1) (2022-09-26)


### Bug Fixes

* possible delays in slower systems ([3021f91](https://github.com/zwave-js/zwave-js-ui/commit/3021f914c071947fbd203b3a510abab902e839ac)), closes [#2676](https://github.com/zwave-js/zwave-js-ui/issues/2676)


### Features

* bump @zwave-js/server@1.23.0 ([#2680](https://github.com/zwave-js/zwave-js-ui/issues/2680)) ([a3dcbff](https://github.com/zwave-js/zwave-js-ui/commit/a3dcbff695707d502b3da868bff229891b9adad7))

# [8.0.0](https://github.com/zwave-js/zwave-js-ui/compare/v7.2.0...v8.0.0) (2022-09-21)


### Features

* bump zwave-js@10.2.0 ([#2666](https://github.com/zwave-js/zwave-js-ui/issues/2666)) ([fe51581](https://github.com/zwave-js/zwave-js-ui/commit/fe5158130c29742617f8240b92f22a5a0af8fbc4))

# [7.2.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v7.1.0...v7.2.0) (2022-09-19)


### Features

* add `BASE_PATH` env var ([4952481](https://github.com/zwave-js/zwavejs2mqtt/commit/4952481dcee9b4b7e7530a2ba1a439503bfa9d62)), closes [#2637](https://github.com/zwave-js/zwavejs2mqtt/issues/2637)
* add reinterview-nodes snippet ([e284ef9](https://github.com/zwave-js/zwavejs2mqtt/commit/e284ef9aadcc197d74748653abcd3eea4a4fcc87))
* bump zwave-js@10.1.0 ([#2643](https://github.com/zwave-js/zwavejs2mqtt/issues/2643)) ([11dca51](https://github.com/zwave-js/zwavejs2mqtt/commit/11dca51012f7c405e9a7066e534bee57965f07e1))
* **hass:** added Siegenia Aeropac device discovery for HA ([#2648](https://github.com/zwave-js/zwavejs2mqtt/issues/2648)) ([217d760](https://github.com/zwave-js/zwavejs2mqtt/commit/217d760e0e429321ad456a8495793c62b7d48ad6))
* set zwave-js `userAgent` option ([#2644](https://github.com/zwave-js/zwavejs2mqtt/issues/2644)) ([e3e7f67](https://github.com/zwave-js/zwavejs2mqtt/commit/e3e7f67babb5a8b841cf227c190d0d5ad6eeecbe)), closes [#2636](https://github.com/zwave-js/zwavejs2mqtt/issues/2636)

# [7.1.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v7.0.0...v7.1.0) (2022-09-06)


### Bug Fixes

* add logger to driver function context ([de180ba](https://github.com/zwave-js/zwavejs2mqtt/commit/de180bae6b6481efbd9c9a88722a9bff1ca96f6a))
* creating new file in store copies last opened content ([8a71998](https://github.com/zwave-js/zwavejs2mqtt/commit/8a71998b8e3b4e512d7ae59196e351eec2cff97b)), closes [#2619](https://github.com/zwave-js/zwavejs2mqtt/issues/2619)
* ensure `store` and `logs` dirs exists on startup ([25c13ea](https://github.com/zwave-js/zwavejs2mqtt/commit/25c13eab6e09f9e62ad20d2c7ccd9aead5f68ef4)), closes [#2625](https://github.com/zwave-js/zwavejs2mqtt/issues/2625)
* fw updates api key ([4f1d091](https://github.com/zwave-js/zwavejs2mqtt/commit/4f1d0914d0447cc172026084ac18544b9b89cb60))
* more generic snippet ([40fd4c5](https://github.com/zwave-js/zwavejs2mqtt/commit/40fd4c5b5d3f4c23b7ed1242b7c1fdf0f32af6ed))
* snippets not correctly loaded on production ([c201cdd](https://github.com/zwave-js/zwavejs2mqtt/commit/c201cddebd7a1a37575142463dfa9bc72c8e9e1f))
* **ui:** get/set configuration CC ([#2627](https://github.com/zwave-js/zwavejs2mqtt/issues/2627)) ([984e613](https://github.com/zwave-js/zwavejs2mqtt/commit/984e613fc79e3b927c066df20713e9cceb755fca))
* **ui:** healthcheck results not showing correctly ([bd09413](https://github.com/zwave-js/zwavejs2mqtt/commit/bd094138e2cacd24e3f1d13906427a35fde237ca))


### Features

* add '@kvaster/zwavejs-prom' plugin ([a55f847](https://github.com/zwave-js/zwavejs2mqtt/commit/a55f8476504d725bdf7e38f66b751c70d99f28b4)), closes [#2604](https://github.com/zwave-js/zwavejs2mqtt/issues/2604)
* bump zwave-js@10.0.4 ([#2629](https://github.com/zwave-js/zwavejs2mqtt/issues/2629)) ([5893916](https://github.com/zwave-js/zwavejs2mqtt/commit/58939160a41e87ae28d05b770a4ca8972d9ba696))
* ctrl+s combination to save store file ([f94f739](https://github.com/zwave-js/zwavejs2mqtt/commit/f94f739deb2d7555d3033e5a8e15619f5071ec83)), closes [#2616](https://github.com/zwave-js/zwavejs2mqtt/issues/2616)
* driver function snippets ([9148bbf](https://github.com/zwave-js/zwavejs2mqtt/commit/9148bbf07c61fd3909ec0cbc12569d5a4fce421a)), closes [#2176](https://github.com/zwave-js/zwavejs2mqtt/issues/2176)
* higher reports timeout setting ([#2628](https://github.com/zwave-js/zwavejs2mqtt/issues/2628)) ([7964f9e](https://github.com/zwave-js/zwavejs2mqtt/commit/7964f9e60fd088a297f42a652a922bc151d10922))
* sort store entries like in a computer ([3616a55](https://github.com/zwave-js/zwavejs2mqtt/commit/3616a55de10f1c3f46fe6c86b58d695fcd9c8a95)), closes [#2617](https://github.com/zwave-js/zwavejs2mqtt/issues/2617)

# [7.0.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.16.0...v7.0.0) (2022-09-01)


### Features

* bump zwave-js@10.0.3 ([a4b6027](https://github.com/zwave-js/zwavejs2mqtt/commit/a4b6027eb8dcc56a316e33e89b4e2640f0330fab))
* zwave-js v10 support ([#2542](https://github.com/zwave-js/zwavejs2mqtt/issues/2542)) ([f51d17e](https://github.com/zwave-js/zwavejs2mqtt/commit/f51d17e22329e6ad1892fc9ba447c942f9df1055))

# [6.16.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.15.2...v6.16.0) (2022-08-29)


### Bug Fixes

* prevent error when cron string is wrong ([61e4803](https://github.com/zwave-js/zwavejs2mqtt/commit/61e4803638344a8f6840d1e3b1aa64b2d84c2852)), closes [#2596](https://github.com/zwave-js/zwavejs2mqtt/issues/2596)
* symlinks not working in store ([#2611](https://github.com/zwave-js/zwavejs2mqtt/issues/2611)) ([955434f](https://github.com/zwave-js/zwavejs2mqtt/commit/955434f864df7a71fb6888ac850eb4ac8235ad21))
* **ui:** firmware update changelog overflow ([#2584](https://github.com/zwave-js/zwavejs2mqtt/issues/2584)) ([8776e5c](https://github.com/zwave-js/zwavejs2mqtt/commit/8776e5cea9f1795a921e9e04b2dd0bb7e8ef317a)), closes [#2583](https://github.com/zwave-js/zwavejs2mqtt/issues/2583)
* **ui:** hide ping action for controller node ([badf2c9](https://github.com/zwave-js/zwavejs2mqtt/commit/badf2c9af70b1faf57da1f58818d631d58ecea3f)), closes [#2586](https://github.com/zwave-js/zwavejs2mqtt/issues/2586)
* **ui:** hide useless actions from controller node ([#2589](https://github.com/zwave-js/zwavejs2mqtt/issues/2589)) ([7d0bf88](https://github.com/zwave-js/zwavejs2mqtt/commit/7d0bf88d8d1ccc3c69e0287ab504c6a415eb9228)), closes [#2587](https://github.com/zwave-js/zwavejs2mqtt/issues/2587)
* **ui:** hide values on controller node ([83c1b7a](https://github.com/zwave-js/zwavejs2mqtt/commit/83c1b7a83393115613b88486692eea092f9abb5b))
* **ui:** including a node shows security class twice ([1178e16](https://github.com/zwave-js/zwavejs2mqtt/commit/1178e16926e3d56930846c17d925b2b0aa18d597)), closes [#2321](https://github.com/zwave-js/zwavejs2mqtt/issues/2321)
* **ui:** refreshing RF region results in empty field ([#2588](https://github.com/zwave-js/zwavejs2mqtt/issues/2588)) ([84c878d](https://github.com/zwave-js/zwavejs2mqtt/commit/84c878db91ed4f832220ad0888e676fc6d3e91d6)), closes [#2585](https://github.com/zwave-js/zwavejs2mqtt/issues/2585)


### Features

* move logs to `logs` folder in store ([#2610](https://github.com/zwave-js/zwavejs2mqtt/issues/2610)) ([61bd39f](https://github.com/zwave-js/zwavejs2mqtt/commit/61bd39ff4538d2fa5fc1bd1382896193ad49b6de)), closes [#2600](https://github.com/zwave-js/zwavejs2mqtt/issues/2600)

## [6.15.2](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.15.1...v6.15.2) (2022-08-05)


### Bug Fixes

* lazy load not working behind a proxy ([#2571](https://github.com/zwave-js/zwavejs2mqtt/issues/2571)) ([5774dbf](https://github.com/zwave-js/zwavejs2mqtt/commit/5774dbf5be07d8e2a47a8a71dfd8f692728d7181))
* **ui:** typo in ota update tab ([#2566](https://github.com/zwave-js/zwavejs2mqtt/issues/2566)) ([ca44f02](https://github.com/zwave-js/zwavejs2mqtt/commit/ca44f02691b24bd7d5ce415dd851f28dac403d57))

## [6.15.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.15.0...v6.15.1) (2022-08-02)


### Bug Fixes

* icons not diaplaying correctly ([935a18d](https://github.com/zwave-js/zwavejs2mqtt/commit/935a18d977d63087f4dcc6c6fd5a9d4e815e1e41)), closes [#2564](https://github.com/zwave-js/zwavejs2mqtt/issues/2564)

# [6.15.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.14.1...v6.15.0) (2022-08-02)


### Features

* allow to force disable SSL ([#2562](https://github.com/zwave-js/zwavejs2mqtt/issues/2562)) ([44d86a1](https://github.com/zwave-js/zwavejs2mqtt/commit/44d86a127d3fbb9a5ea2903b2d41d807b08ff4fb))

## [6.14.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.14.0...v6.14.1) (2022-07-27)


### Bug Fixes

* typos in code ([#2544](https://github.com/zwave-js/zwavejs2mqtt/issues/2544)) ([e7e397b](https://github.com/zwave-js/zwavejs2mqtt/commit/e7e397b9f9feff25c31bdfe0cbb03b82af9b715f))


### Features

* bump @zwave-js/server@1.21.0 ([#2550](https://github.com/zwave-js/zwavejs2mqtt/issues/2550)) ([a33b85a](https://github.com/zwave-js/zwavejs2mqtt/commit/a33b85ac046dd03438bae92e134fbb61ede94773))

# [6.14.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.13.0...v6.14.0) (2022-07-22)


### Bug Fixes

* issues with controller powerlevel settings ([#2541](https://github.com/zwave-js/zwavejs2mqtt/issues/2541)) ([02e5f2b](https://github.com/zwave-js/zwavejs2mqtt/commit/02e5f2b6409a4c673340113e345e487cc22c7e83))
* **ui:** diaplay issue with healthckeck dialog on smartphones ([af954e9](https://github.com/zwave-js/zwavejs2mqtt/commit/af954e978873903a61c27b7a9d55d2f8ba524557)), closes [#2513](https://github.com/zwave-js/zwavejs2mqtt/issues/2513)
* **ui:** nvm backup alert ([d49dad8](https://github.com/zwave-js/zwavejs2mqtt/commit/d49dad8b1b44f2058e0d926deb92a34a63ba4db2))


### Features

* bump zwave-js@9.6.0 ([#2514](https://github.com/zwave-js/zwavejs2mqtt/issues/2514)) ([d0f25f3](https://github.com/zwave-js/zwavejs2mqtt/commit/d0f25f3ff29a4e210d969a87c6119c199c7dbab1))
* bump zwave-js@9.6.1 ([#2536](https://github.com/zwave-js/zwavejs2mqtt/issues/2536)) ([8a02b7a](https://github.com/zwave-js/zwavejs2mqtt/commit/8a02b7a6ccd83705d35b71c62f4d96574010fdfc))
* bump zwave-js@9.6.2 ([#2540](https://github.com/zwave-js/zwavejs2mqtt/issues/2540)) ([c225e6a](https://github.com/zwave-js/zwavejs2mqtt/commit/c225e6ab4b0d3ef6935922763e4dc89c724b02f0))
* ota device firmware updates ([#2504](https://github.com/zwave-js/zwavejs2mqtt/issues/2504)) ([4ab6264](https://github.com/zwave-js/zwavejs2mqtt/commit/4ab62642b41e97ad7b2ee047f56ca03f72258ed6))

# [6.13.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.12.1...v6.13.0) (2022-06-28)


### Features

* backup restore ([#2469](https://github.com/zwave-js/zwavejs2mqtt/issues/2469)) ([b34cde4](https://github.com/zwave-js/zwavejs2mqtt/commit/b34cde43be9a4b536be3cf1acd81e04f8966100d)), closes [#2068](https://github.com/zwave-js/zwavejs2mqtt/issues/2068)
* bump zwave-js@9.4.1 ([#2496](https://github.com/zwave-js/zwavejs2mqtt/issues/2496)) ([52612e3](https://github.com/zwave-js/zwavejs2mqtt/commit/52612e3ccc3af9d4ebfe23c34d3e7a9ae91bc145))
* bump zwave-js@9.5.0 ([#2500](https://github.com/zwave-js/zwavejs2mqtt/issues/2500)) ([6fc05f3](https://github.com/zwave-js/zwavejs2mqtt/commit/6fc05f3bcc387fee67ad76c6da036becf9a47ab9))
* zwave radio configurations ([#2485](https://github.com/zwave-js/zwavejs2mqtt/issues/2485)) ([01909ad](https://github.com/zwave-js/zwavejs2mqtt/commit/01909ade2904db30b1f12f10fc7dad2170b66346)), closes [#2319](https://github.com/zwave-js/zwavejs2mqtt/issues/2319)

## [6.12.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.12.0...v6.12.1) (2022-06-24)


### Bug Fixes

* log rotation ([#2476](https://github.com/zwave-js/zwavejs2mqtt/issues/2476)) ([a24f1b5](https://github.com/zwave-js/zwavejs2mqtt/commit/a24f1b5e7c1f46390d5a20fd1f810dcd740d3a8e))
* show commit sha whitout using git ([#2458](https://github.com/zwave-js/zwavejs2mqtt/issues/2458)) ([10fb994](https://github.com/zwave-js/zwavejs2mqtt/commit/10fb994aca8bad73e45f29922497388da8a35d1b))
* **ui:** disable mqtt hass discovery by default ([17faaad](https://github.com/zwave-js/zwavejs2mqtt/commit/17faaad03d26d42d1032dfc410d9900bbc08778e))


### Features

* bump @zwave-js/server@1.18.0 ([#2474](https://github.com/zwave-js/zwavejs2mqtt/issues/2474)) ([1e14238](https://github.com/zwave-js/zwavejs2mqtt/commit/1e14238437c00d83c76705a77b2d8629af06fef0))
* bump @zwave-js/server@1.19.0 ([#2479](https://github.com/zwave-js/zwavejs2mqtt/issues/2479)) ([2948abc](https://github.com/zwave-js/zwavejs2mqtt/commit/2948abccedda3a3d1de64d2df8228b5fb171e686))
* bump @zwave-js/server@1.20.0 ([#2481](https://github.com/zwave-js/zwavejs2mqtt/issues/2481)) ([1956772](https://github.com/zwave-js/zwavejs2mqtt/commit/19567722d94f46a0cf339798340abafd08dc1696))
* bump zwave-js@9.4.0 ([#2460](https://github.com/zwave-js/zwavejs2mqtt/issues/2460)) ([64e4212](https://github.com/zwave-js/zwavejs2mqtt/commit/64e4212e159b86fe65b347c39c0e0f483082f7a7))

# [6.12.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.11.0...v6.12.0) (2022-06-07)


### Bug Fixes

* smart start inclusion forgets node name and loc ([33167ec](https://github.com/zwave-js/zwavejs2mqtt/commit/33167ecad5a34a30da23eb8d4bd2ab4be97a5ef8)), closes [#2447](https://github.com/zwave-js/zwavejs2mqtt/issues/2447)
* typo in the storeLimiter error message ([#2448](https://github.com/zwave-js/zwavejs2mqtt/issues/2448)) ([943aee9](https://github.com/zwave-js/zwavejs2mqtt/commit/943aee95dc0ffaae3abd735df7f9deaa087c69e6))
* **ui:** advanced button overflow in  expanded node ([80fec3a](https://github.com/zwave-js/zwavejs2mqtt/commit/80fec3a9115020a8664ef364c59321751ac4b37c))


### Features

* allow to pass custom set value options in MQTT payload ([#2453](https://github.com/zwave-js/zwavejs2mqtt/issues/2453)) ([cbf57c4](https://github.com/zwave-js/zwavejs2mqtt/commit/cbf57c4ecfb341891bee65ce258013975d16b348)), closes [#2305](https://github.com/zwave-js/zwavejs2mqtt/issues/2305)
* allow to specify custom zwavejs server host ([#2452](https://github.com/zwave-js/zwavejs2mqtt/issues/2452)) ([51e6eb9](https://github.com/zwave-js/zwavejs2mqtt/commit/51e6eb91312cf86d50475ebcff5c9d6769d0dd38)), closes [#2265](https://github.com/zwave-js/zwavejs2mqtt/issues/2265)
* handle MQTT writes to valueIds that have an associated targetValue ([#2454](https://github.com/zwave-js/zwavejs2mqtt/issues/2454)) ([d437d5e](https://github.com/zwave-js/zwavejs2mqtt/commit/d437d5e359dda7a2a4f895f10ec8cac3917c78bd))

# [6.11.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.10.0...v6.11.0) (2022-05-27)


### Bug Fixes

* disable colors also in HTTP logging ([#2438](https://github.com/zwave-js/zwavejs2mqtt/issues/2438)) ([a7fea38](https://github.com/zwave-js/zwavejs2mqtt/commit/a7fea38427baa984b2afe87d8bdf5e39a13d8938))
* **ui:** show warning when zwave or general logs are disabled ([#2443](https://github.com/zwave-js/zwavejs2mqtt/issues/2443)) ([ef2740a](https://github.com/zwave-js/zwavejs2mqtt/commit/ef2740a0364d57fef045606527f3b2367f4bd472))


### Features

* **ui:** node events logs queue ([#2439](https://github.com/zwave-js/zwavejs2mqtt/issues/2439)) ([daea2eb](https://github.com/zwave-js/zwavejs2mqtt/commit/daea2eb625f6b3cd2bbbd569ac6422ecbb8c9ac7))

# [6.10.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.9.1...v6.10.0) (2022-05-24)


### Features

* allow to disable logs with `NO_LOG_COLORS` env var ([#2427](https://github.com/zwave-js/zwavejs2mqtt/issues/2427)) ([43650ac](https://github.com/zwave-js/zwavejs2mqtt/commit/43650ac50f8345d3fbd5a92080beb4523a73dfe8)), closes [#2425](https://github.com/zwave-js/zwavejs2mqtt/issues/2425)
* bump @zwave-js/server@1.17.0 ([#2436](https://github.com/zwave-js/zwavejs2mqtt/issues/2436)) ([e64c062](https://github.com/zwave-js/zwavejs2mqtt/commit/e64c0623de9913cb007af81ebaa53713219777f6))
* bump zwave-js@9.3.0 ([#2432](https://github.com/zwave-js/zwavejs2mqtt/issues/2432)) ([92bf06a](https://github.com/zwave-js/zwavejs2mqtt/commit/92bf06a204ce14f88c3b4649ed01bc4ebca20356))

## [6.9.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.9.0...v6.9.1) (2022-05-12)


### Bug Fixes

* avoid showing git error on startup ([#2418](https://github.com/zwave-js/zwavejs2mqtt/issues/2418)) ([0d44081](https://github.com/zwave-js/zwavejs2mqtt/commit/0d44081f8359ff447d452c2d6271919640b637f6))
* correctly parse buffers in MQTT payload ([#2412](https://github.com/zwave-js/zwavejs2mqtt/issues/2412)) ([36db245](https://github.com/zwave-js/zwavejs2mqtt/commit/36db245929b66581406ffcd876bacc0564375c45)), closes [#2303](https://github.com/zwave-js/zwavejs2mqtt/issues/2303)
* **ui:** table sorting/grouping with undefined values ([#2414](https://github.com/zwave-js/zwavejs2mqtt/issues/2414)) ([28021d7](https://github.com/zwave-js/zwavejs2mqtt/commit/28021d73759fb76737d628ea252a07f28d33cb97))


### Features

* bump zwave-js@9.2.2 ([#2421](https://github.com/zwave-js/zwavejs2mqtt/issues/2421)) ([aa1b3a1](https://github.com/zwave-js/zwavejs2mqtt/commit/aa1b3a18289b2c691f40e9cff3600e7e8e556623))

# [6.9.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.8.1...v6.9.0) (2022-05-05)


### Bug Fixes

* **ui:** current action null in nodes manager ([#2406](https://github.com/zwave-js/zwavejs2mqtt/issues/2406)) ([30c28e0](https://github.com/zwave-js/zwavejs2mqtt/commit/30c28e09a58975fb2a8ed7b568ca8dfa50fcfcf5))


### Features

* active status and disable non requested security classes in provisioning entities ([#2410](https://github.com/zwave-js/zwavejs2mqtt/issues/2410)) ([11dd784](https://github.com/zwave-js/zwavejs2mqtt/commit/11dd784c0ee519b732027e380e40c07f79629c4b))
* bump zwave-js@9.1.0 ([#2407](https://github.com/zwave-js/zwavejs2mqtt/issues/2407)) ([3390416](https://github.com/zwave-js/zwavejs2mqtt/commit/339041685bf08a4ddf1ba16767c74ce4df2279b4))
* bump zwave.js@9.2.0 ([6ee5154](https://github.com/zwave-js/zwavejs2mqtt/commit/6ee51544310a718b149c7e85c9043c0167ac7ba9))

## [6.8.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.8.0...v6.8.1) (2022-05-02)


### Bug Fixes

* **ui:** local settings not correctly updated after submit ([14d5b46](https://github.com/zwave-js/zwavejs2mqtt/commit/14d5b46f3a651ed00b7d20265be6f363c5036e8f)), closes [#2401](https://github.com/zwave-js/zwavejs2mqtt/issues/2401)


### Features

* bump @zwave-js/server@1.16.1 ([#2405](https://github.com/zwave-js/zwavejs2mqtt/issues/2405)) ([1ace504](https://github.com/zwave-js/zwavejs2mqtt/commit/1ace504f928078c17e47b5ed5bc9f2a05268a74e))
* bump zwave-js@9.0.7 ([#2400](https://github.com/zwave-js/zwavejs2mqtt/issues/2400)) ([63b0427](https://github.com/zwave-js/zwavejs2mqtt/commit/63b0427823646370a230d8caf4a8b9612af27c4b))

# [6.8.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.7.4...v6.8.0) (2022-04-28)


### Bug Fixes

* inclusion via QR forgets name/location ([#2391](https://github.com/zwave-js/zwavejs2mqtt/issues/2391)) ([c05863f](https://github.com/zwave-js/zwavejs2mqtt/commit/c05863fcff15ed5cdc3e6c778e848b1a4b2d3388)), closes [#2389](https://github.com/zwave-js/zwavejs2mqtt/issues/2389)
* **ui:** allow to display comments with line break ([2ea8193](https://github.com/zwave-js/zwavejs2mqtt/commit/2ea8193509b315dd0ceea90182ae87512bcb92b7))
* **ui:** use types and utils from zwave-js ([#2383](https://github.com/zwave-js/zwavejs2mqtt/issues/2383)) ([20bbfa3](https://github.com/zwave-js/zwavejs2mqtt/commit/20bbfa3bcd114ec4862eedbda78092aff0126a67))


### Features

* bump zwave-js@9.0.5 ([#2393](https://github.com/zwave-js/zwavejs2mqtt/issues/2393)) ([4ba01bd](https://github.com/zwave-js/zwavejs2mqtt/commit/4ba01bda9410a2888b01960ca7cc018f6283194d))
* bump zwave-js@9.0.6 ([de27a71](https://github.com/zwave-js/zwavejs2mqtt/commit/de27a71344d04a96a3c2e6b71bfa8dc16894b32e))
* **ui:** display node metadata comments ([119ab3b](https://github.com/zwave-js/zwavejs2mqtt/commit/119ab3b73d56ef337a24982c0f344c2ad976e864))
* **ui:** support url in node comments ([282cf54](https://github.com/zwave-js/zwavejs2mqtt/commit/282cf547856b05ca7978fe19f34c00289d38b843))

## [6.7.4](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.7.3...v6.7.4) (2022-04-22)


### Bug Fixes

* correctly parse MultilevelSwitchCC notifications ([#2386](https://github.com/zwave-js/zwavejs2mqtt/issues/2386)) ([9cc840f](https://github.com/zwave-js/zwavejs2mqtt/commit/9cc840f5d6c1693c1f34f67b0769cfd390cace60)), closes [#2382](https://github.com/zwave-js/zwavejs2mqtt/issues/2382)


### Features

* bump zwave-js@9.0.4 ([907955a](https://github.com/zwave-js/zwavejs2mqtt/commit/907955aece85c8939673291d41bb247745f12934))

## [6.7.3](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.7.2...v6.7.3) (2022-04-20)


### Bug Fixes

* **ui:** correct misspelling ([#2378](https://github.com/zwave-js/zwavejs2mqtt/issues/2378)) ([ec4431b](https://github.com/zwave-js/zwavejs2mqtt/commit/ec4431be1499212d82007bf73ef0efd9fccdca70))


### Features

* bump zwave-js@9.0.3 ([#2380](https://github.com/zwave-js/zwavejs2mqtt/issues/2380)) ([72deb18](https://github.com/zwave-js/zwavejs2mqtt/commit/72deb189f11341eee1aaeb0e07928e989f0401f8))

## [6.7.2](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.7.1...v6.7.2) (2022-04-19)


### Bug Fixes

* ensure device config priority dir exists ([f266328](https://github.com/zwave-js/zwavejs2mqtt/commit/f266328e2e813bc111f8bf0eda80694d3988a508)), closes [#2374](https://github.com/zwave-js/zwavejs2mqtt/issues/2374)

## [6.7.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.7.0...v6.7.1) (2022-04-14)


### Bug Fixes

* **ui:** dialog when decurity is undefined ([9d6c500](https://github.com/zwave-js/zwavejs2mqtt/commit/9d6c5002f876427e59192dfdd6634f05c50eb7de))
* **ui:** group association dialog check max nodes and disable add ([6d234ca](https://github.com/zwave-js/zwavejs2mqtt/commit/6d234caea8fa7b8a3815959a9b72575ee7b28c2d))
* **ui:** hide target node when group is full ([#2359](https://github.com/zwave-js/zwavejs2mqtt/issues/2359)) ([fd10576](https://github.com/zwave-js/zwavejs2mqtt/commit/fd105769be01de8439da4517da362981ef776c4b))


### Features

* bump zwave-js@9.0.2 ([#2373](https://github.com/zwave-js/zwavejs2mqtt/issues/2373)) ([2775ecb](https://github.com/zwave-js/zwavejs2mqtt/commit/2775ecbe6ac84f22761f4ee9894d06983e6ef717))

# [6.7.0](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.6.2...v6.7.0) (2022-04-05)


### Bug Fixes

* **docker:** serialport bindings issue ([#2351](https://github.com/zwave-js/zwavejs2mqtt/issues/2351)) ([0deb1c9](https://github.com/zwave-js/zwavejs2mqtt/commit/0deb1c9d6dd38248540f600ff70b2a379791ade9)), closes [#2349](https://github.com/zwave-js/zwavejs2mqtt/issues/2349)
* prevent to update node lastActive when fetched from cache ([8774f30](https://github.com/zwave-js/zwavejs2mqtt/commit/8774f3021bd69f5f6cbcd1acb1014daca5e104e0)), closes [#2341](https://github.com/zwave-js/zwavejs2mqtt/issues/2341)
* **ui:** create  `serverServiceDiscoveryDisabled` setting input ([4439b31](https://github.com/zwave-js/zwavejs2mqtt/commit/4439b31e1e8f041fd52cde0386f3d03a3d722188))
* **ui:** hint to on-screen keyboards that DSK pin is numeric ([#2343](https://github.com/zwave-js/zwavejs2mqtt/issues/2343)) ([15caab7](https://github.com/zwave-js/zwavejs2mqtt/commit/15caab771f723e3b137a932a87de6fd40959fdcb))
* **ui:** setting hint ([1e776cd](https://github.com/zwave-js/zwavejs2mqtt/commit/1e776cdec9c60974388bc6842e23305e3375382f))


### Features

* bump zwave-js@9 and @zwave-js/server@1.16.0 and fix breaking changes ([#2294](https://github.com/zwave-js/zwavejs2mqtt/issues/2294)) ([#2294](https://github.com/zwave-js/zwavejs2mqtt/issues/2294)) ([519dee8](https://github.com/zwave-js/zwavejs2mqtt/commit/519dee8fe4d531b2ae9ad453d2d448257c9a76aa)), closes [#2337](https://github.com/zwave-js/zwavejs2mqtt/issues/2337)

## [6.6.2](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.6.1...v6.6.2) (2022-03-25)


### Bug Fixes

* **ui:** remove messages from stats of non-controller nodes ([3d483ff](https://github.com/zwave-js/zwavejs2mqtt/commit/3d483ff84cf8023e6be7103f4d49fb41f314b869))


### Features

* **ui:** show totals in controller commands stats ([d871d36](https://github.com/zwave-js/zwavejs2mqtt/commit/d871d36e334b49379b51a45e28e3e365314dc144))

## [6.6.1](https://github.com/zwave-js/zwavejs2mqtt/compare/v6.6.0...v6.6.1) (2022-03-24)


### Bug Fixes

* **ui:** initialize darkMode at startup ([#2333](https://github.com/zwave-js/zwavejs2mqtt/issues/2333)) ([132a65e](https://github.com/zwave-js/zwavejs2mqtt/commit/132a65ef0866a435f8696ba6d1d64789ab72590f))

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
