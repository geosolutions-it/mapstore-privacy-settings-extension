/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
// MapStore loads every installed extension when the application starts, before the first render,
// as a module federation container named after its plugin.
// This extension sets the privacy configuration of the privacy settings panel and starts the optional
// integrations of `integrations.js` according to the consent of the user.
(function() {
    var CONFIG = __PRIVACY_SETTINGS_CONFIG__;

    __PRIVACY_SETTINGS_INTEGRATIONS__

    // The pages are served next to this script, in the "assets" folder of the extension.
    var script = document.currentScript;
    var base = script ? script.src.split("?")[0].replace(/[^/]*$/, "") : "";
    var links = CONFIG.pages.reduce(function(result, page) {
        result[page] = CONFIG.locales.reduce(function(byLocale, locale) {
            byLocale[locale] = base + "assets/" + locale + "/" + page + ".html";
            return byLocale;
        }, {});
        return result;
    }, {});

    // Read by MapStore when localConfig.json does not configure `privacy.links`.
    var setPrivacyDefaults = {
        type: "SET_CONTROL_PROPERTY",
        control: "privacy",
        property: "defaults",
        value: {
            enabled: CONFIG.enabled,
            policyVersion: CONFIG.policyVersion,
            retentionDays: CONFIG.retentionDays,
            categories: CONFIG.categories,
            links: links
        }
    };

    // Teardown functions of the running integrations, by id.
    var running = {};
    var syncIntegrations = function(choice) {
        integrations.forEach(function(integration) {
            var allowed = !!(choice && choice.categories && choice.categories[integration.category] === true);
            if (allowed && !running[integration.id]) {
                try {
                    var teardown = integration.start();
                    running[integration.id] = typeof teardown === "function" ? teardown : function() {};
                } catch (e) {
                    console.error("Optional integration could not start", integration.id, e); // eslint-disable-line no-console
                }
            } else if (!allowed && running[integration.id]) {
                try {
                    running[integration.id]();
                } catch (e) {
                    console.error("Optional integration teardown failed", integration.id, e); // eslint-disable-line no-console
                }
                delete running[integration.id];
            }
        });
    };

    var plugin = {
        name: CONFIG.name,
        component: function() { return null; },
        reducers: {},
        epics: {
            // Emits the configuration as soon as the epic starts, before the privacy panel is rendered.
            privacySettingsSetDefaults: function(action$) {
                return action$.startWith(setPrivacyDefaults).take(1);
            },
            // MapStore dispatches SET_PRIVACY_CHOICE with the validated choice, or null, every time it changes.
            privacySettingsSyncIntegrations: function(action$) {
                return action$.ofType("SET_PRIVACY_CHOICE")
                    .do(function(action) { syncIntegrations(action.choice); })
                    .filter(function() { return false; });
            }
        }
    };
    window[CONFIG.name] = {
        init: function() { return Promise.resolve(); },
        get: function() {
            return Promise.resolve(function() { return plugin; });
        }
    };
})();
