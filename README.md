# MapStore privacy settings extension

Template of a [MapStore](https://github.com/geosolutions-it/MapStore2) extension that configures the privacy settings
panel of an installation, so that `localConfig.json` does not need to change:

- the Cookie Policy, Privacy Policy and Terms of Use pages, in one or more languages;
- the policy version, the validity of the choices and the optional categories;
- optional integrations, started only with the consent of the user;
- optionally, the texts of the panel.

It needs a MapStore version with the privacy settings panel (2026.03.00 or later).
See the [privacy settings guide](https://docs.mapstore.geosolutionsgroup.com/en/latest/developer-guide/privacy-settings/).

## Create the extension of an installation

1. Create a repository from this template (**Use this template** on GitHub).
2. Complete the pages in `assets/en-US`: replace every text marked as `placeholder` and remove the template notes.
   Replace `assets/logo.png` with the logo of the operator.
3. Edit `privacy.config.json` (see below).
4. Run `npm ci` and `npm run build`. The build checks the configuration and refuses pages that still contain
   placeholders; `npm run build:draft` builds them anyway, to preview the result.
5. Upload `dist/PrivacySettings-<version>.zip` from the extensions section of the MapStore context creator.

Pushing a tag `v<version>` builds the zip and publishes it as a GitHub release.

## Files

```text
├── privacy.config.json   privacy configuration
├── package.json          version of the extension
├── assets/
│   ├── logo.png          logo at the top of the pages
│   ├── privacy-docs.css  styles shared by all the pages
│   └── en-US/            one folder for each language: cookie.html, privacy.html, terms.html
├── translations/         optional texts of the panel, data.<locale>.json
├── src/
│   ├── index.js          code of the extension, completed by the build
│   └── integrations.js   optional integrations
└── build.js              builds the zip
```

## privacy.config.json

| Key | Meaning |
| --- | --- |
| `name` | Name of the extension. Keep `PrivacySettings`: the pages are served at `extensions/PrivacySettings/assets/` |
| `title`, `description` | Shown in the context creator |
| `policyVersion` | Version of the policies. Change it every time the content of the pages changes: users are asked for their choices again |
| `retentionDays` | Days a choice is kept before it is asked again |
| `enabled` | Enables the panel when `localConfig.json` has no `privacy` section |
| `categories` | Optional categories actually used, among `functional`, `statistics` and `marketing`, with a description by locale |
| `locales` | Languages of the pages, one folder each in `assets`. The first one is used when the language of MapStore has no pages |
| `pages` | Pages linked by the panel, among `cookie`, `privacy` and `terms` |

Change `version` in `package.json` for every release. The configuration is used by MapStore only when
`localConfig.json` does not configure `privacy.links`: an installation can always link its own pages there.

## Optional integrations

`src/integrations.js` lists the optional tools of the installation, for example a statistics service.
Each integration has a category among the configured ones and a `start` function that returns a teardown function.
The extension starts it only while the user consents to its category, and calls the teardown on refusal, withdrawal,
expiry of the choice or a new policy version. Withdrawal cannot undo data already sent: the teardown must stop everything
the integration started and remove what it stored.

## How it works

MapStore loads the `index.js` of every installed extension when the application starts, before the first render.
This extension:

- dispatches `setControlProperty('privacy', 'defaults', {...})` with the configuration and the links of the pages;
- listens to `SET_PRIVACY_CHOICE`, dispatched by MapStore with the validated choice of the user (or `null`), to start and stop the integrations.

The `index.js` has no dependencies and needs no webpack build, so the same zip works with every MapStore version
that supports these two actions.

## License

[BSD-2-Clause](LICENSE.txt)
