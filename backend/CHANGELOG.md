# Changelog

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
