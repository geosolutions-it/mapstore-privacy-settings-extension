/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
// Builds the zip of the extension, ready to upload from the MapStore context creator.
//
//   node build.js [--draft] [--root <folder>] [--out <folder>]
//
// --draft accepts pages that still contain placeholders, to preview a template.
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const CATEGORY_IDS = ['functional', 'statistics', 'marketing'];
const PAGES = ['cookie', 'privacy', 'terms'];
// Marks left in the pages of the template until the operator completes them.
const PLACEHOLDER_MARKS = ['class="placeholder"', 'class="template-note"'];

const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));

const listFiles = (folder, base = folder) => fs.readdirSync(folder, { withFileTypes: true })
    .flatMap(entry => {
        const file = path.join(folder, entry.name);
        return entry.isDirectory() ? listFiles(file, base) : [path.relative(base, file).split(path.sep).join('/')];
    });

/**
 * Checks the configuration and the pages.
 * @returns {string[]} the errors found, empty when the extension can be built
 */
const validate = (root, config, { draft }) => {
    const errors = [];
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(config.name || '')) {
        errors.push('name must contain only letters and digits, starting with a letter');
    }
    if (typeof config.policyVersion !== 'string' || !config.policyVersion.trim()) {
        errors.push('policyVersion is required');
    }
    if (!Number.isInteger(config.retentionDays) || config.retentionDays <= 0) {
        errors.push('retentionDays must be a positive integer');
    }
    if (typeof config.enabled !== 'boolean') {
        errors.push('enabled must be true or false');
    }
    const ids = (config.categories || []).map(category => category.id);
    ids.filter(id => !CATEGORY_IDS.includes(id)).forEach(id => errors.push(`category "${id}" is not one of ${CATEGORY_IDS.join(', ')}`));
    ids.filter((id, index) => ids.indexOf(id) !== index).forEach(id => errors.push(`category "${id}" is repeated`));
    (config.categories || []).filter(category => !category.description || typeof category.description !== 'object')
        .forEach(category => errors.push(`category "${category.id}" needs a description by locale`));
    if (!Array.isArray(config.locales) || !config.locales.length) {
        errors.push('locales must list at least one locale');
    }
    (config.pages || []).filter(page => !PAGES.includes(page)).forEach(page => errors.push(`page "${page}" is not one of ${PAGES.join(', ')}`));
    (config.locales || []).forEach(locale => (config.pages || []).forEach(page => {
        const file = path.join(root, 'assets', locale, `${page}.html`);
        if (!fs.existsSync(file)) {
            errors.push(`missing page assets/${locale}/${page}.html`);
        } else if (!draft && PLACEHOLDER_MARKS.some(mark => fs.readFileSync(file, 'utf8').includes(mark))) {
            errors.push(`assets/${locale}/${page}.html still contains placeholders or template notes`);
        }
    }));
    return errors;
};

const build = ({ root = __dirname, out = path.join(root, 'dist'), draft = false } = {}) => {
    const pkg = readJSON(path.join(root, 'package.json'));
    const config = { pages: PAGES, ...readJSON(path.join(root, 'privacy.config.json')) };
    const errors = validate(root, config, { draft });
    if (errors.length) {
        throw new Error('The extension cannot be built:\n- ' + errors.join('\n- '));
    }
    const runtimeConfig = {
        name: config.name,
        policyVersion: config.policyVersion,
        retentionDays: config.retentionDays,
        enabled: config.enabled,
        categories: config.categories || [],
        locales: config.locales,
        pages: config.pages
    };
    const integrations = fs.readFileSync(path.join(root, 'src', 'integrations.js'), 'utf8');
    const indexJs = fs.readFileSync(path.join(root, 'src', 'index.js'), 'utf8')
        .replace('__PRIVACY_SETTINGS_CONFIG__', JSON.stringify(runtimeConfig, null, 4).replace(/\n/g, '\n    '))
        .replace('__PRIVACY_SETTINGS_INTEGRATIONS__', integrations.trim().replace(/\n/g, '\n    '));
    const indexJson = {
        id: config.name,
        version: pkg.version,
        title: config.title || config.name,
        description: config.description || '',
        plugins: [{
            name: config.name,
            title: config.title || config.name,
            description: config.description || '',
            glyph: 'lock',
            defaultConfig: {}
        }]
    };
    const zip = new JSZip();
    zip.file('index.js', indexJs);
    zip.file('index.json', JSON.stringify(indexJson, null, 2) + '\n');
    listFiles(path.join(root, 'assets')).forEach(file => zip.file(`assets/${file}`, fs.readFileSync(path.join(root, 'assets', file))));
    const translations = path.join(root, 'translations');
    if (fs.existsSync(translations)) {
        listFiles(translations).filter(file => /^data\.[^/]+\.json$/.test(file)).forEach(file => {
            readJSON(path.join(translations, file));
            zip.file(`translations/${file}`, fs.readFileSync(path.join(translations, file)));
        });
    }
    fs.mkdirSync(out, { recursive: true });
    const zipFile = path.join(out, `${config.name}-${pkg.version}${draft ? '-draft' : ''}.zip`);
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }).then(buffer => {
        fs.writeFileSync(zipFile, buffer);
        return zipFile;
    });
};

module.exports = { build, validate };

if (require.main === module) {
    const args = process.argv.slice(2);
    const option = name => {
        const index = args.indexOf(name);
        return index >= 0 ? args[index + 1] : undefined;
    };
    try {
        build({ draft: args.includes('--draft'), root: option('--root'), out: option('--out') })
            .then(file => console.log(`Built ${file}`))
            .catch(e => { console.error(e.message); process.exit(1); });
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
}
