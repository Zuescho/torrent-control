# Torrent Control Mana

A Firefox fork of [mika-si/torrent-control](https://github.com/mika-si/torrent-control),
focused on reliable qBittorrent file/magnet submission to your configured client. Current test build:
**0.3.1**, based on upstream 0.2.51. Original MIT licensing is retained.

The first changes address session isolation, private-tracker GET requests,
qBittorrent tags, error handling and malformed torrent filenames. See the
[changelog](CHANGELOG.md), [complete upstream issue/PR review](docs/upstream-review.md)
and [privacy explanation](PRIVACY.md).

## Try the build in Firefox

The built ZIP is **unsigned**. Normal Firefox cannot install it permanently until
Mozilla signs it. Temporary loading is supported:

1. Disable the original Torrent Control and competing magnet userscripts to avoid
   handling the same click twice.
2. Extract `web-ext-artifacts/torrent_control_mana-0.3.1.zip` into a folder.
3. Open `about:debugging#/runtime/this-firefox`, select **Load Temporary Add-on**,
   and choose the extracted `manifest.json`.
4. Open the extension's options. Set application to **qBittorrent**, address to
   `https://qbittorrent.example.invalid/`, and enter your existing Web UI login
   locally. Leave HTTP authentication blank unless you separately configured it.
5. Enable the advanced add dialog to choose a category, save path, tags and whether
   to add stopped. Start with a known legal torrent and add it stopped.

Temporary installation ends when Firefox restarts. The fork has its own extension
ID (`torrent-control-mana@users.noreply.github.com`), so it does not overwrite the upstream install
or automatically inherit its settings. It requires Firefox Desktop 140+.

Clicking a magnet link on a page is handled by the extension directly, so it no
longer depends on Firefox's `magnet:` handler preference; if Windows previously
answered those clicks with "This file does not have an app associated with it",
that stops. Turn it off with **Catch magnet links clicked on web pages** in the
options if you would rather a desktop client took them. Ctrl-, Shift-, Alt- and
middle-clicks are left to the browser, and the `magnet:` protocol handler still
works when Firefox is set to use it.

Use the link context menu for `.torrent` and magnet links. Authenticated GET
downloads use the source tab's session. JavaScript-only buttons, POST downloads,
and anti-bot challenges can still require downloading the file normally and
uploading it through qBittorrent's Web UI. Keep the source tracker tab open.
Server-side seeding rules and bandwidth/VPN settings continue to govern downloads;
extension tags do not replace tracker-based seeding rules.

For a permanent private build, submit the ZIP to Mozilla as an **unlisted** add-on
and install the signed XPI it returns. See
[Mozilla signing and distribution](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/).
No signing credentials or submission are included in this repository.

## Releasing a new version to Mozilla

The add-on ID `torrent-control-mana@users.noreply.github.com` ties an upload to
the existing AMO entry: keep it unchanged, and give each upload a version higher
than the published one.

1. Raise the version in `package.json` (`npm version <x.y.z> --no-git-tag-version`)
   and in `src/manifest.json`, and add the release notes to `CHANGELOG.md`.
2. `npm test && npm run lint && npm run test:firefox`
3. `npm run build` — writes `web-ext-artifacts/torrent_control_mana-<version>.zip`.
4. Commit the release, then `npm run build:source`. It regenerates
   `MOZILLA-SOURCE.md` and archives the committed tree as
   `torrent_control_mana-<version>-source.zip`. The script warns and exits
   non-zero while the working tree is dirty, because the archive would not match
   the release. AMO only requires this archive when submitted code is minified,
   bundled or otherwise generated, which this add-on's is not; supply it when a
   reviewer asks.
5. Sign the build with an API key and secret from **Manage API Keys** in the
   [Developer Hub](https://addons.mozilla.org/developers/addons):

   ```sh
   WEB_EXT_API_KEY=user:12345:67 WEB_EXT_API_SECRET=... npm run sign:unlisted
   ```

   Mozilla signs a self-distributed version within minutes and the signed
   `.xpi` lands in `web-ext-artifacts/`. Add
   `-- --upload-source-code web-ext-artifacts/torrent_control_mana-<version>-source.zip`
   when the source archive is required. Keep the key and secret out of the
   repository and out of shell history. Uploading by hand through the Developer
   Hub's **Upload New Version** works just as well.
6. Publish the signed `.xpi` as a GitHub release asset tagged `v<version>`.
7. `npm run build:updates`, then commit the regenerated `updates.json` to
   `master`. It records the version, the release asset's URL and its SHA-256,
   keeping earlier versions listed.

## How installed copies update themselves

`src/manifest.json` points `browser_specific_settings.gecko.update_url` at
`updates.json` on `master`. Firefox checks it about once a day, compares the
newest listed version against the installed one, verifies the download against
`update_hash`, and installs it. Users can force the check from `about:addons`
with the gear menu's **Check for Updates**. Steps 6 and 7 are what make this
work: a version that is signed but missing from `updates.json`, or listed with
an asset URL that 404s, simply never reaches anyone.

Self-distribution is why the add-on may declare `update_url` at all. Mozilla
rejects it on a publicly listed AMO version, where AMO distributes updates
instead, so `npm run lint` runs the linter in `--self-hosted` mode. If this
add-on is ever published as a listed version, remove `update_url` and drop that
flag again.

## Build and verify

Use Node 22.12+ (tested with 22.16.0) and an installed Firefox:

```sh
npm ci --ignore-scripts
npm test
npm run lint
npm run test:firefox
npm run build
```

The Firefox smoke test launches an isolated temporary profile and two local fake
API servers. It checks real webRequest behavior, authentication, file/magnet
submission, stopped flags, tags, port isolation and magnet-link clicks caught in
a page and in a subframe. It submits no real torrent.
Set `FIREFOX_BINARY` if Firefox is installed at a nonstandard location.

Optional read-only live authentication check: set `TC_QBT_URL` (including the
trailing slash), `TC_QBT_USERNAME` (defaults to admin), and `TC_QBT_PASSWORD_FILE`
pointing to a private text file with a `Password: ...` line. Run `npm run test:firefox`.
The harness checks login/version/logout; it never adds a torrent to the live server.
It copies credentials into its temporary test extension only, then removes that
directory. Keep the password file outside the repository.

136 tests and Firefox 155.0.1 smoke tests pass; live HTTPS authentication was verified
against a qBittorrent 5.2.3 test endpoint. The extension ZIP contains only `src/`, not npm
dependencies. See the review for remaining development-tool audit findings and
untested cases. This is a test candidate, not a claim that every upstream issue is fixed.

## Upstream capabilities

The [original Firefox listing](https://addons.mozilla.org/addon/torrent-control/)
installs upstream Torrent Control, not this fork. Its broader client support is
retained; this fork's integration testing focuses on qBittorrent.

Features:
- Supports magnet links
- Supports private trackers
- Supports multiple servers
- Auto login for interfaces using HTTP auth
- HTTP Digest authentication
- Private mode and Multi-Account Container support
- User defined URL matchers
- Bittorrent client specific options eg.
    - Fast resume on ruTorrent
    - Piece priority on qBittorrent

Supported clients:
- BiglyBT<sup>1</sup>
- Cloud Torrent
- Deluge<sup>1,2</sup>
- Flood<sup>1,2</sup>
- ruTorrent<sup>1,2,3,4</sup>
- Synology Download Station<sup>1</sup>
- Tixati
- Transmission<sup>1,2</sup>
- tTorrent
- µTorrent
- Vuze<sup>1</sup>
- qBittorrent<sup>1,2,3,4</sup>

<sup>1</sup> Supports download directories/paths
<sup>2</sup> Supports labels/categories
<sup>3</sup> Supports client specific extra options (sequential download, etc.)
<sup>4</sup> Supports adding of RSS feeds
