# Changelog

## [3.0.2](https://github.com/CIT-U-Computer-Students-Society/IPES/compare/backend-v3.0.1...backend-v3.0.2) (2026-10-31)


### Bug Fixes

* **evaluations:** exclude closed forms from member pending queue ([94480de](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/94480de1cf8b7512502cdf83e0ee620a637044e6)), closes [#237](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/237)
* **evaluations:** make multi-rule assignment matrix generation atomic ([c472aba](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/c472aba17236749d341701fbeca4bcbbd4a1d1b3)), closes [#239](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/239)
* **evaluations:** record audit events on form updates and guard lifecycle mutations ([06a50fb](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/06a50fb3cbe6d2c9b84a6a032243fd89b6cde71d)), closes [#259](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/259)
* **evaluations:** reset completed assignments on question creation and guard released forms ([bc0b79b](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/bc0b79b959f4158b238ea22dc57edc27ee0c3aee)), closes [#236](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/236)
* **organizations:** exclude inactive user accounts from analytics total_users ([f5b9cc5](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/f5b9cc59b475b6781434d5f75ddffefce0e05e33))
* **organizations:** isolate analytics actions to active tenant ([ed96d35](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/ed96d35c350a207e7a75eeaf12668f9f61b1af74)), closes [#269](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/269)
* **organizations:** record audit events for structure and membership mutations ([4a206ee](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/4a206eee3db078294812c05f8bf09645291a24cd)), closes [#277](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/277)
* **portfolio:** apply status and type query filters to member accomplishment queries ([3f4771d](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/3f4771d2719a34a24bc947b98a22fdef62528569))
* **portfolio:** enforce active membership and organization checks on accomplishment submission ([6636dc7](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/6636dc7e6a5bb16cf29a5f8f48c2cf25ab9562f5))
* **portfolio:** persist and display verification comments on approved accomplishments ([47dbcba](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/47dbcba2375b227defe8d34145e010fab0a1e3b5)), closes [#251](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/251)
* **portfolio:** restrict accomplishment deletion to owners and pending/rejected status with audit logging ([ec741f3](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/ec741f304e5205673c34b8ee75b56fb956dbced1))
* **portfolio:** return 404 for malformed accomplishment id on deletion ([9071ebe](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/9071ebe56ebe756870190f1e7c15f1e89b9b4d9d))
* **portfolio:** serialize accomplishment deletion with database row locks ([f61f6a6](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/f61f6a6c8b2c5c4b3d9ed802765b394a8818141c))
* **portfolio:** serialize accomplishment edits and reviews with concurrency locks ([fbe9754](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/fbe975414468f86582c31072989df1b26505a150))
* **portfolio:** validate organization identifiers at request boundary ([a34afec](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/a34afec36de9028301bea058a97c850cd6993814))

## [3.0.1](https://github.com/CIT-U-Computer-Students-Society/IPES/compare/backend-v3.0.0...backend-v3.0.1) (2026-10-30)


### Bug Fixes

* **audit:** attribute audit events to authoritative organization ([0056420](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/00564202335016a9ec8cd7c5ad666b80548866e1)), closes [#248](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/248) [#261](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/261)
* **audit:** isolate failed audit inserts ([fa57666](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/fa57666f731a56f789b9a900ffcbcff8add57ea7)), closes [#256](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/256)
* **audit:** neutralize spreadsheet formula injection in CSV exports ([fc94803](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/fc94803dd4a7441bd7b7d8bd3f3314a5c7789f9c)), closes [#262](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/262)
* **audit:** preserve full event metadata ([587dc79](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/587dc796c08471c094057245a72decb8e0657d2b)), closes [#257](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/257)
* **audit:** reject invalid calendar bounds ([de34636](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/de346369be76086ab3abb2a698e49712e30e460f)), closes [#266](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/266)
* **audit:** restore actor name search ([e89cde6](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/e89cde643c11331d2ae6655b2696764d8c198c6a))
* **audit:** scope action catalog and search ([de8c76e](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/de8c76ec59f2f73b14e461efdf528c045290a26f)), closes [#268](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/268)
* **audit:** scope audit read endpoints and hooks by active organization ([ed078d6](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/ed078d6c8a19c5ddd81e7f9ce4da94f7ca48c58c)), closes [#268](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/268)
* **audit:** validate filter parameters and include full end date ([d009753](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/d00975392e3872924ce29353b27bf024ce59e8cf)), closes [#266](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/266) [#267](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/267)
* **evaluations:** enforce required question existence guard during membership auto assignment ([2327578](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/23275785ec5e5d969654439b5582131f6d3a99bb)), closes [#238](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/238)
* **evaluations:** exclude revoked and inactive members from assignment generation ([2cdade8](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/2cdade898d140f38a85db87f79763d5a3738b337)), closes [#235](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/235)
* **evaluations:** protect individual assignment results ([3601738](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/3601738bb93ecd2b03fcc48ef0822d2d0dc58b5c))
* **evaluations:** record distinct audit action on results release ([7dd9b2a](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/7dd9b2a2a18399f942f26564dccd18d57838881f)), closes [#263](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/263)
* **organizations:** allow re-adding and reactivating inactive position assignments ([552d372](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/552d37223f8225f615393955b514dad613cda041)), closes [#271](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/271)
* **organizations:** authorize organization updates ([afe4389](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/afe4389cb048d14292d617fdd67b8aaae733333c))
* **organizations:** isolate join requests by tenant ([9f9f8d0](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/9f9f8d01b48bf71106f4c9e8a045294de7a100e0)), closes [#252](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/252)
* **organizations:** make join request approval atomic and validate role choices ([7564c78](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/7564c78601b47c4cb2db488e075fb221c0aca6c7)), closes [#270](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/270)
* **organizations:** protect organization audit history ([f71f160](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/f71f16091d516c7178c1dbe4265d767ba51bc9b1))
* **organizations:** require active join request administrators ([43b944b](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/43b944bb4672ae740cf552bdf5015c731f73549c)), closes [#253](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/253)
* **organizations:** require active organization role for positional memberships ([d08bf31](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/d08bf31ede8919edabb7d2edde75ed8d000af99e)), closes [#272](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/272)
* **organizations:** validate membership reactivation ([7192441](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/71924411b794724ff0749a81050a3791461cdf64)), closes [#272](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/272)
* **users:** enforce configured password validators ([8baa023](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/8baa0236ef34e6ead3f7f7975399d489e701b664)), closes [#278](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/278)
* **users:** restrict global account management ([7061297](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/7061297da79054e1e17b883690472c2b02f23692)), closes [#254](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/254)
* **users:** scope membership details to the active organization ([86c54c2](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/86c54c298b8114dcce22d3fd68a478432695f8ae)), closes [#255](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/255)


### Build and Dependencies

* **deps:** update django requirement from &lt;6.2,&gt;=6.0 to &gt;=6.1.2,&lt;6.2 in /backend ([ad7d70b](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/ad7d70ba265b4892db2fc5837b705c567882f4d9))
* **deps:** update django requirement in /backend ([dd2f2c0](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/dd2f2c04dba2d633a71ab107e3192721c7ee60b3))


### Tests

* **backend:** add seeded E2E support and database evidence ([db141ee](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/db141ee2273f6c7e26008f55950e04cc286396dd))


### CI

* **testing:** provision isolated PostgreSQL test environments ([f00ac86](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/f00ac860b4a8a83c905a7272287cf984fcd0067d))

## [3.0.0](https://github.com/CIT-U-Computer-Students-Society/IPES/compare/backend-v2.0.0...backend-v3.0.0) (2026-10-29)


### ⚠ BREAKING CHANGES

* **auth:** browser clients must use session cookies and CSRF bootstrapping. Existing clients must sign in again; legacy token headers no longer authenticate.

### Features

* **users:** add private profile picture uploads ([f58366a](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/f58366ab110338e9f3acfb650699b3c8f4143b04))


### Bug Fixes

* **auth:** replace browser bearer tokens with protected sessions ([b700e1a](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/b700e1ad3e3c513c56dd3cb78be0a6748711c7aa))
* **security:** enforce browser policy and safe proof links ([1899454](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/1899454af08e1f6c3a9f86281b6c590b2ab7167e))


### Build and Dependencies

* **backend:** add S3 storage support ([b570947](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/b570947e479d5b34d31deabc4b5255462fe0dddc))
* **security:** declare CSP and local animation dependencies ([8b54f7b](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/8b54f7b60cd7da559b60265d7be5142403103a0d))


### Documentation

* **setup:** document private avatars and root environment template ([09baeeb](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/09baeeb03f6af215153e502cd057137689d9007c))

## [2.0.0](https://github.com/CIT-U-Computer-Students-Society/IPES/compare/backend-v1.0.0...backend-v2.0.0) (2026-10-28)


### ⚠ BREAKING CHANGES

* **database:** Evaluation and organization-resource endpoints require active organization context. Generic assignment writes are disabled, and raw analytics responses move to the administrator-only analytics_export action.

### Bug Fixes

* **database:** enforce evaluation integrity and optimize queries ([bc749a7](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/bc749a73d6e4b46662e6099ee601bf06c3de115e))

## 1.0.0 (2026-10-28)


### CI

* **release:** automate independent web backend and docs releases ([9ee5088](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/9ee5088d614944ef7b3f5cf6101270c943216449))

## Backend changelog

Release Please maintains this file for changes in `backend/`.
Versioned entries begin with the first automated release.
