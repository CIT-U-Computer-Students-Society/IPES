# Changelog

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
