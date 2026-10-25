// Update manifest for the self-distributed add-on. Firefox reads the
// update_url in src/manifest.json roughly once a day and installs the newest
// version listed here, so this file and the release assets must agree.
import {createHash} from 'node:crypto';
import {readdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const manifest = JSON.parse(await readFile('src/manifest.json', 'utf8'));
const {repository} = JSON.parse(await readFile('package.json', 'utf8'));

const {id, strict_min_version: strictMinVersion} = manifest.browser_specific_settings.gecko;
const version = manifest.version;
const tag = `v${version}`;
const slug = repository.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');

const artifacts = 'web-ext-artifacts';
const signed = (await readdir(artifacts)).find((file) => file.endsWith('.xpi') && file.includes(version));

if (!signed) {
    throw new Error(`No signed ${version} XPI in ${artifacts}/. Run an unlisted signing first: npm run sign:unlisted`);
}

// Firefox verifies this before installing, so a release asset that was
// replaced or truncated is rejected instead of shipped.
const hash = createHash('sha256').update(await readFile(join(artifacts, signed))).digest('hex');

let updates = {addons: {[id]: {updates: []}}};

try {
    updates = JSON.parse(await readFile('updates.json', 'utf8'));
} catch (e) {
    // First release; start from the empty manifest above.
}

const entries = (updates.addons?.[id]?.updates || []).filter((entry) => entry.version !== version);

entries.push({
    version: version,
    update_link: `https://github.com/${slug}/releases/download/${tag}/${signed}`,
    update_hash: `sha256:${hash}`,
    applications: {
        gecko: {
            strict_min_version: strictMinVersion,
        },
    },
});

const order = (value) => value.split('.').map((part) => part.padStart(6, '0')).join('.');
entries.sort((a, b) => order(a.version).localeCompare(order(b.version)));

await writeFile('updates.json', JSON.stringify({addons: {[id]: {updates: entries}}}, null, 2) + '\n', 'utf8');

console.log(`updates.json now offers ${version} from ${entries.at(-1).update_link}`);
console.log(`Attach ${artifacts}/${signed} to the ${tag} release, then commit updates.json to the branch the update_url points at.`);
