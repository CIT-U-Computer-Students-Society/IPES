# Changelog

## [3.1.0](https://github.com/CIT-U-Computer-Students-Society/IPES/compare/web-v3.0.1...web-v3.1.0) (2026-10-31)


### Features

* **frontend:** integrate user guide navigation links and add capture script ([26bee1b](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/26bee1bff0c0e162a3a8e4b420c8ad6311c32ccc))


### Bug Fixes

* **audit:** preserve entity identities and metadata details in formatted event text ([b66d420](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/b66d420190419aa9b9dcd2d7e338013ac9575535)), closes [#264](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/264)
* **audit:** preserve metadata commas and retain target identities in event text ([e75f138](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/e75f1385c077d5aaf44482cf67947b1ab84e6592))
* **audit:** render request failure and retry action on audit query error ([fe233e3](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/fe233e30acc98ced21be3a44104f850112681a9c)), closes [#265](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/265)
* **audit:** traverse all pagination pages for audit logs and filtering ([c4a17b3](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/c4a17b358a13ebb668e7451f042708e58842b68b)), closes [#258](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/258)
* **evaluations:** exclude closed forms from member pending queue ([94480de](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/94480de1cf8b7512502cdf83e0ee620a637044e6)), closes [#237](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/237)
* **evaluations:** traverse paginated assignment, form, and rule records across all pages ([7d4a1f3](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/7d4a1f310ab4696494ef0ab6334f34d15bd8a050))
* **organizations:** scope dashboard analytics cache keys to effective organization ([f3e1505](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/f3e1505323bdc1dcc2119013384ca49a2aa8fbb3)), closes [#274](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/274)
* **organizations:** traverse all API pagination pages for members and structure ([ac92ef7](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/ac92ef797ecdfe90439fedcf2c171eb6a6162272)), closes [#273](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/273)
* **portfolio:** persist and display verification comments on approved accomplishments ([47dbcba](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/47dbcba2375b227defe8d34145e010fab0a1e3b5)), closes [#251](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/251)
* **portfolio:** render actionable error state on request failure with retry recovery ([12dd659](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/12dd659128a9f1d82a07250e5cb1f2dd4e89f9f1))
* **portfolio:** reset unsaved draft notes on accomplishment review dialog cancel ([42b5a1f](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/42b5a1f3a3f4caf893c37407e8d4b9acc729f351)), closes [#247](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/247)
* **portfolio:** restrict accomplishment deletion to owners and pending/rejected status with audit logging ([ec741f3](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/ec741f304e5205673c34b8ee75b56fb956dbced1))
* **portfolio:** traverse paginated accomplishment records across all pages ([1597076](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/1597076f2ca31b76a4dfece62c8a90e3f1e46e23))
* **settings:** prefer authoritative cleared organization email over stale membership ([cdd7cc0](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/cdd7cc0a06834353f6952c1e9bc19e6f11aff2c0))
* **users:** derive current membership synchronously from current user ([52060bd](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/52060bdbf58bd8a7ccd8512567eb8ab3825dcb64)), closes [#275](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/275)
* **users:** invalidate unit and directory caches and derive role dialog state ([edbf982](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/edbf9820f671fdc8fcc97b80634bdffc9bc4d305)), closes [#276](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/276)

## [3.0.1](https://github.com/CIT-U-Computer-Students-Society/IPES/compare/web-v3.0.0...web-v3.0.1) (2026-10-30)


### Bug Fixes

* **audit:** scope audit read endpoints and hooks by active organization ([ed078d6](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/ed078d6c8a19c5ddd81e7f9ce4da94f7ca48c58c)), closes [#268](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/268)
* **dashboard:** count completed evaluation assignments using backend status ([6436bb2](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/6436bb2f79f164d917afb90b58139129a0c4a448)), closes [#240](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/240)
* **evaluations:** record distinct audit action on results release ([7dd9b2a](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/7dd9b2a2a18399f942f26564dccd18d57838881f)), closes [#263](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/263)


### Build and Dependencies

* **deps-dev:** bump postcss from 8.5.31 to 8.5.32 in /frontend ([1930f62](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/1930f62dfd7180ac0c0aa60f03456feb77098140))
* **deps-dev:** bump postcss from 8.5.31 to 8.5.32 in /frontend ([392f38d](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/392f38d80d172da25a65a49d74b92160633f81e9))
* **deps-dev:** bump typescript from 6.0.3 to 7.0.2 in /frontend ([91fb385](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/91fb38557fed3f5449a850a23a4ffc994c0ba29e))
* **deps-dev:** bump typescript from 6.0.3 to 7.0.2 in /frontend ([c82240e](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/c82240e5539edebd061ed24e21bc73a6abdfc729))
* **deps:** bump @lottiefiles/dotlottie-react from 0.17.14 to 0.20.0 in /frontend ([a12aa4e](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/a12aa4e7efa009970060a31af3bbcd591b26f0ba))
* **deps:** bump @lottiefiles/dotlottie-react in /frontend ([8fa7542](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/8fa75428ed4451aebf72d3324aa87dcddd211408))
* **deps:** bump react from 19.3.0 to 19.3.1 in /frontend ([ed46fbf](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/ed46fbf97266e5bc2b819c77946304995e606b7e))
* **deps:** bump react from 19.3.0 to 19.3.1 in /frontend ([c46d222](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/c46d222f3b588406dbabe93d9119b2ab277c8ba7))
* **deps:** bump react-hook-form from 7.86.0 to 7.91.0 in /frontend ([3c2fc09](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/3c2fc093f8b3340de8df348ae2f57564ae3abb9c))
* **deps:** bump react-hook-form from 7.86.0 to 7.91.0 in /frontend ([deaa302](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/deaa302ab3e42876c62bcb2d25c5952a19938398))
* **frontend:** restore compatible dependency versions ([85c31ec](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/85c31ec519ec69cb7bf0093209abb54d4e03e7e1))


### Tests

* **frontend:** add Playwright requirements and evidence pipeline ([9b5e6ec](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/9b5e6ecc1f6fd9acf666adecbca83bd85fc10261))


### CI

* **testing:** provision isolated PostgreSQL test environments ([f00ac86](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/f00ac860b4a8a83c905a7272287cf984fcd0067d))

## [3.0.0](https://github.com/CIT-U-Computer-Students-Society/IPES/compare/web-v2.0.0...web-v3.0.0) (2026-10-29)


### ⚠ BREAKING CHANGES

* **auth:** browser clients must use session cookies and CSRF bootstrapping. Existing clients must sign in again; legacy token headers no longer authenticate.

### Features

* **users:** add private profile picture uploads ([f58366a](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/f58366ab110338e9f3acfb650699b3c8f4143b04))


### Bug Fixes

* **auth:** replace browser bearer tokens with protected sessions ([b700e1a](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/b700e1ad3e3c513c56dd3cb78be0a6748711c7aa))
* **security:** enforce browser policy and safe proof links ([1899454](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/1899454af08e1f6c3a9f86281b6c590b2ab7167e))


### Build and Dependencies

* **security:** declare CSP and local animation dependencies ([8b54f7b](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/8b54f7b60cd7da559b60265d7be5142403103a0d))

## [2.0.0](https://github.com/CIT-U-Computer-Students-Society/IPES/compare/web-v1.0.2...web-v2.0.0) (2026-10-28)


### ⚠ BREAKING CHANGES

* **database:** Evaluation and organization-resource endpoints require active organization context. Generic assignment writes are disabled, and raw analytics responses move to the administrator-only analytics_export action.

### Bug Fixes

* **database:** enforce evaluation integrity and optimize queries ([bc749a7](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/bc749a73d6e4b46662e6099ee601bf06c3de115e))

## [1.0.2](https://github.com/CIT-U-Computer-Students-Society/IPES/compare/web-v1.0.1...web-v1.0.2) (2026-10-28)


### Performance

* **frontend:** load routes and desktop animation on demand ([a8099a8](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/a8099a8c759f005b81c0999677a0bdd4b7defd37))


### Maintenance

* **release:** promote Mantine UI and dependency cleanup ([417238b](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/417238ba324a737b8da17cb939bf734cd8ff2554))

## [1.0.1](https://github.com/CIT-U-Computer-Students-Society/IPES/compare/web-v1.0.0...web-v1.0.1) (2026-10-28)


### Bug Fixes

* **organizations:** preserve selection through dashboard navigation ([c936cb6](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/c936cb6a9865d400a8100041af3e77907f7d809c))
* **web:** resolve frontend lint diagnostics without disabling rules ([da3be6b](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/da3be6b5d637469ce53f4a1b967b4b24bd45c607))


### Refactoring

* **web:** migrate shared UI and notifications to Mantine ([a8faa03](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/a8faa03625f1ca9d662bc54432025ffc02ab85d4))


### Build and Dependencies

* **web:** align compiler and Tailwind validation dependencies ([9fdbaf0](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/9fdbaf0b6ff96a7c95e0a7ae8f0093a8b73d9f3d))
* **web:** prune unused UI dependencies and Lovable tooling ([880557c](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/880557c3118215b58baedafbd8d0c776a8b35da0))
* **web:** replace legacy UI packages with Mantine ([87706ee](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/87706eee1ce16713f83a55bb847d81f8751b77e7))

## 1.0.0 (2026-10-28)


### CI

* **release:** automate independent web backend and docs releases ([9ee5088](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/9ee5088d614944ef7b3f5cf6101270c943216449))

## Web changelog

Release Please maintains this file for changes in `frontend/`.
Versioned entries begin with the first automated release.
