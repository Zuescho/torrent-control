// Source archive for AMO source-code submission, plus the reviewer notes that
// go in it. Archives the committed tree, so commit the release first.
import {execFileSync} from 'node:child_process';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const {version} = JSON.parse(await readFile('package.json', 'utf8'));
const archive = resolve('web-ext-artifacts', `torrent_control_mana-${version}-source.zip`);

// The repository directory can be owned by a different account than the one
// running the release, which git refuses to read without this.
const git = (...args) => execFileSync('git', ['-c', `safe.directory=${process.cwd().replace(/\\/g, '/')}`, ...args], {encoding: 'utf8'}).trim();

const dirty = git('status', '--porcelain');
const revision = git('rev-parse', 'HEAD');

await writeFile('MOZILLA-SOURCE.md', `# Mozilla reviewer: Torrent Control Mana ${version}

Source revision: ${revision}
Repository: https://github.com/Zuescho/torrent-control

The extension contains readable JavaScript ES modules, HTML, CSS and static assets.
There is no compilation, transpilation, minification, bundling or generated code.
The installed extension is the contents of src/, copied unchanged into a ZIP.
This source archive includes the build tools' package.json and package-lock.json,
tests, license, and documentation. It excludes node_modules and credentials.

Build environment: Node.js 22.12 or later; npm is included with it.
The packaging command is platform-independent. From this source directory run:

    npm ci --ignore-scripts
    npm run build

On Windows PowerShell, use npm.cmd if execution policy blocks npm.ps1.
Output: web-ext-artifacts/torrent_control_mana-${version}.zip

Compare the extracted files with the submitted add-on ZIP. All files under src/
are included unchanged at the ZIP root. ZIP timestamps/compression metadata may
differ; file contents should not. No secrets, server access, Firefox installation,
or environment variables are required to build.

Optional validation:

    npm test
    npm run lint

The separate test:firefox command requires an installed Firefox and uses local
fake API endpoints by default. It is not necessary to reproduce the build.
All npm dependencies are development tools; they are not bundled into the add-on.
`, 'utf8');

git('archive', '--format=zip', `--output=${archive}`, 'HEAD');

console.log(`Source archive: ${archive}\nRevision: ${revision}`);

if (dirty) {
    console.warn(`\nWarning: the archive holds commit ${revision.slice(0, 10)}, not the working tree.\n`
        + 'Commit the release (including MOZILLA-SOURCE.md) and run this again:\n' + dirty);
    process.exitCode = 1;
}
