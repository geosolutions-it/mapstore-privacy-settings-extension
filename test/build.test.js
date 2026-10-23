/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const JSZip = require('jszip');
const Rx = require('rxjs');
const { build } = require('../build');

const ROOT = path.join(__dirname, '..');
const SCRIPT_URL = 'http://localhost/mapstore/extensions/PrivacySettings/index.js?v=123';
const BASE = 'http://localhost/mapstore/extensions/PrivacySettings/';

// Test configuration and pages, independent of the ones of the repository.
const TEST_CONFIG = {
    name: 'PrivacySettings',
    title: 'Test title',
    description: 'Test description',
    policyVersion: 'test-1',
    retentionDays: 180,
    enabled: true,
    categories: [],
    locales: ['en-US'],
    pages: ['cookie', 'privacy', 'terms']
};
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

// Project in a temporary folder with the build sources of the repository, the test configuration
// and synthetic pages, with the given changes applied.
const project = (changes = {}) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'privacy-settings-'));
    fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(root, 'package.json'));
    fs.cpSync(path.join(ROOT, 'src'), path.join(root, 'src'), { recursive: true });
    const files = {
        'privacy.config.json': JSON.stringify({ ...TEST_CONFIG, ...changes.config }),
        'src/integrations.js': 'var integrations = [];',
        'assets/logo.png': 'logo',
        'assets/privacy-docs.css': 'body {}',
        'assets/en-US/cookie.html': '<p>cookie</p>',
        'assets/en-US/privacy.html': '<p>privacy</p>',
        'assets/en-US/terms.html': '<p>terms</p>',
        ...changes.files
    };
    Object.entries(files).forEach(([file, content]) => {
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        fs.writeFileSync(path.join(root, file), content);
    });
    return root;
};

// Runs the generated index.js as MapStore does and returns the plugin of the extension.
const loadPlugin = (code, context = {}) => {
    const window = {};
    vm.runInNewContext(code, { window, document: { currentScript: { src: SCRIPT_URL } }, Promise, console, ...context });
    return window.PrivacySettings.init().then(() => window.PrivacySettings.get('./plugin')).then(factory => factory());
};

const actionsOf = actions => {
    const action$ = Rx.Observable.from(actions);
    action$.ofType = type => action$.filter(action => action.type === type);
    return action$;
};

const buildAndRead = (root, options = {}) => build({ root, out: path.join(root, 'dist'), ...options })
    .then(file => JSZip.loadAsync(fs.readFileSync(file)).then(zip => ({ file, zip })));

test('builds a zip with index.js, index.json, the pages and the translations', () => {
    const root = project({ files: { 'translations/data.it-IT.json': '{"locale": "it-IT", "messages": {}}' } });
    return buildAndRead(root, { draft: true }).then(({ file, zip }) => {
        assert.strictEqual(path.basename(file), `PrivacySettings-${VERSION}-draft.zip`);
        assert.deepStrictEqual(Object.keys(zip.files).filter(name => !zip.files[name].dir).sort(), [
            'assets/en-US/cookie.html', 'assets/en-US/privacy.html', 'assets/en-US/terms.html',
            'assets/logo.png', 'assets/privacy-docs.css',
            'index.js', 'index.json', 'translations/data.it-IT.json'
        ]);
        return zip.file('index.json').async('string').then(json => {
            assert.deepStrictEqual(JSON.parse(json), {
                id: 'PrivacySettings',
                version: VERSION,
                title: 'Test title',
                description: 'Test description',
                plugins: [{
                    name: 'PrivacySettings',
                    title: 'Test title',
                    description: 'Test description',
                    version: VERSION,
                    glyph: 'lock',
                    defaultConfig: {}
                }]
            });
        });
    });
});

test('hides the plugin in the context creator when configured', () => {
    const root = project({ config: { hiddenInContextCreator: true } });
    return buildAndRead(root, { draft: true })
        .then(({ zip }) => zip.file('index.json').async('string'))
        .then(json => {
            const plugin = JSON.parse(json).plugins[0];
            assert.strictEqual(plugin.hidden, true);
            assert.strictEqual(plugin.version, VERSION);
        });
});

test('the extension sets the privacy configuration with links by locale next to its script', () => {
    const root = project({ config: { locales: ['en-US', 'it-IT'], pages: ['cookie', 'privacy'], policyVersion: 'test-2', retentionDays: 90 },
        files: { 'assets/it-IT/cookie.html': '<p>cookie</p>', 'assets/it-IT/privacy.html': '<p>privacy</p>' } });
    return buildAndRead(root, { draft: true })
        .then(({ zip }) => zip.file('index.js').async('string'))
        .then(code => loadPlugin(code))
        .then(plugin => {
            assert.strictEqual(plugin.name, 'PrivacySettings');
            assert.strictEqual(plugin.component(), null);
            return plugin.epics.privacySettingsSetDefaults(actionsOf([{ type: 'OTHER' }])).toArray().toPromise();
        })
        // objects created inside the vm context have a different prototype
        .then(actions => assert.deepStrictEqual(JSON.parse(JSON.stringify(actions)), [{
            type: 'SET_CONTROL_PROPERTY',
            control: 'privacy',
            property: 'defaults',
            value: {
                enabled: true,
                policyVersion: 'test-2',
                retentionDays: 90,
                categories: [],
                links: {
                    cookie: { 'en-US': BASE + 'assets/en-US/cookie.html', 'it-IT': BASE + 'assets/it-IT/cookie.html' },
                    privacy: { 'en-US': BASE + 'assets/en-US/privacy.html', 'it-IT': BASE + 'assets/it-IT/privacy.html' }
                }
            }
        }]));
});

test('integrations start with the consent to their category and stop when it is withdrawn', () => {
    const integrations = `var integrations = [{
        id: "stats",
        category: "statistics",
        start: function() { log.push("start"); return function() { log.push("stop"); }; }
    }];`;
    const root = project({
        config: { categories: [{ id: 'statistics', description: { 'en-US': 'Statistics' } }] },
        files: { 'src/integrations.js': integrations }
    });
    const log = [];
    const choice = statistics => ({ type: 'SET_PRIVACY_CHOICE', choice: { categories: { statistics } } });
    return buildAndRead(root, { draft: true })
        .then(({ zip }) => zip.file('index.js').async('string'))
        .then(code => loadPlugin(code, { log }))
        .then(plugin => plugin.epics.privacySettingsSyncIntegrations(actionsOf([
            { type: 'SET_PRIVACY_CHOICE', choice: null },
            choice(true),
            choice(true),
            choice(false),
            choice(true),
            { type: 'SET_PRIVACY_CHOICE', choice: null }
        ])).toArray().toPromise())
        .then(emitted => {
            assert.deepStrictEqual(emitted, []);
            assert.deepStrictEqual(log, ['start', 'stop', 'start', 'stop']);
        });
});

test('refuses to build pages with placeholders or template notes unless it is a draft', () => {
    const root = project({ files: {
        'assets/en-US/cookie.html': '<p><span class="placeholder">[DATE]</span></p>',
        'assets/en-US/terms.html': '<aside class="template-note">Template</aside>'
    } });
    assert.throws(() => build({ root, out: path.join(root, 'dist') }), error => {
        assert.deepStrictEqual(error.message.split('\n- ').slice(1), [
            'assets/en-US/cookie.html still contains placeholders or template notes',
            'assets/en-US/terms.html still contains placeholders or template notes'
        ]);
        return true;
    });
    return build({ root, out: path.join(root, 'dist'), draft: true })
        .then(file => assert.ok(fs.existsSync(file)));
});

test('reports invalid configuration and missing pages', () => {
    const root = project({ config: {
        name: 'Privacy-Settings',
        policyVersion: '',
        retentionDays: 0,
        enabled: 'yes',
        hiddenInContextCreator: 'no',
        categories: [{ id: 'ads', description: {} }, { id: 'statistics' }],
        locales: ['en-US', 'de-DE'],
        pages: ['cookie', 'faq']
    } });
    assert.throws(() => build({ root, out: path.join(root, 'dist'), draft: true }), error => {
        assert.deepStrictEqual(error.message.split('\n- ').slice(1), [
            'name must contain only letters and digits, starting with a letter',
            'policyVersion is required',
            'retentionDays must be a positive integer',
            'enabled must be true or false',
            'hiddenInContextCreator must be true or false',
            'category "ads" is not one of functional, statistics, marketing',
            'category "statistics" needs a description by locale',
            'page "faq" is not one of cookie, privacy, terms',
            'missing page assets/en-US/faq.html',
            'missing page assets/de-DE/cookie.html',
            'missing page assets/de-DE/faq.html'
        ]);
        return true;
    });
});
