# Mozilla reviewer: Torrent Control Mana 0.3.1

Source revision: f4221a94978007997ba4a8e24f698028a347ee91
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
Output: web-ext-artifacts/torrent_control_mana-0.3.1.zip

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
