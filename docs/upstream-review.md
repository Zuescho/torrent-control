# Upstream review — 12 September 2026

Reviewed all 33 open issue bodies and both open pull-request diffs at
[mika-si/torrent-control](https://github.com/mika-si/torrent-control/issues).
Baseline: `d71bdb2`, upstream version 0.2.51. Open counts are a snapshot, not a
measure of maintenance quality: many items are feature requests or client-specific reports.

## First Mana build

| Issues | Decision and coverage |
| --- | --- |
| [#213](https://github.com/mika-si/torrent-control/issues/213) | Improve authenticated GET downloads with explicit source-tab credentials and referrer. Tested request behavior; the reporter's private tracker/WAF is not available to reproduce, so this is mitigation, not a confirmed resolution. |
| [#188](https://github.com/mika-si/torrent-control/issues/188), [#171](https://github.com/mika-si/torrent-control/issues/171) | Implement comma-separated qBittorrent tags in the advanced add dialog, for files and magnets. Categories already existed upstream. |
| [#157](https://github.com/mika-si/torrent-control/issues/157) | Partial improvement: tags and re-enable the stopped checkbox when switching back to a supported server. Custom save paths already exist. The broader dialog request remains open. |
| [#161](https://github.com/mika-si/torrent-control/issues/161) | Improve error delivery and prevent malformed filename parsing from hanging. POST/form-token downloads remain unsupported; GET referrer handling does not solve that case. |

Additional findings fixed: qBittorrent header/cookie rewriting now checks the
request initiator, tab, exact origin including port, and application path. Firefox
can combine Set-Cookie fields with newlines; matching now handles those as well as
separate fields. Missing response Content-Type no longer causes a TypeError.
Upstream already accepts qBittorrent 5.2's empty HTTP 204 login response and its
QBT_SID cookie name; those are retained, not claimed as new fixes.

## Remaining issues

| Issues | Assessment / next step |
| --- | --- |
| [#197](https://github.com/mika-si/torrent-control/issues/197) | JavaScript/XHR buttons are not main-frame navigations. Defer network-body interception; download locally and upload through qBittorrent's Web UI for these sites. |
| [#147](https://github.com/mika-si/torrent-control/issues/147) | Custom matcher report needs a reproducible current-version example before changing matching or persistence. |
| [#96](https://github.com/mika-si/torrent-control/issues/96) | Connection-test UI is a useful next addition; this build supplies a developer Firefox integration check, not a settings-page button. |
| [#36](https://github.com/mika-si/torrent-control/issues/36), [#184](https://github.com/mika-si/torrent-control/issues/184), [#163](https://github.com/mika-si/torrent-control/issues/163), [#76](https://github.com/mika-si/torrent-control/issues/76) | Automatic server/category/path routing: defer until precedence and explicit user selections are covered together. See PR #208 below. |
| [#182](https://github.com/mika-si/torrent-control/issues/182), [#145](https://github.com/mika-si/torrent-control/issues/145) | LibreWolf authentication/network behavior needs testing in that browser; Firefox results do not establish a fix. |
| [#187](https://github.com/mika-si/torrent-control/issues/187) | Synology-specific magnet handling; requires a Download Station fixture or device. |
| [#181](https://github.com/mika-si/torrent-control/issues/181) | rqbit support: new client outside this qBittorrent build. |
| [#113](https://github.com/mika-si/torrent-control/issues/113) | HTTPS-only mode with an HTTP Deluge endpoint; use a valid HTTPS endpoint, investigate separately for Deluge. |
| [#154](https://github.com/mika-si/torrent-control/issues/154), [#83](https://github.com/mika-si/torrent-control/issues/83) | Chrome/Opera ports need separate permission and request-interception work. Firefox only here. |
| [#160](https://github.com/mika-si/torrent-control/issues/160) | Server sync includes credentials; defer until a deliberate storage/export and consent design exists. |
| [#85](https://github.com/mika-si/torrent-control/issues/85) | Automatic Web UI login is separate from the extension's session; do not couple the two in this build. |
| [#127](https://github.com/mika-si/torrent-control/issues/127) | Retry queue needs duplicate detection and session serialization; blindly retrying adds is unsuitable. |
| [#166](https://github.com/mika-si/torrent-control/issues/166), [#101](https://github.com/mika-si/torrent-control/issues/101), [#114](https://github.com/mika-si/torrent-control/issues/114) | Named paths, option groups and multiple client labels: defer. qBittorrent tags do not implement multiple labels for other clients. |
| [#202](https://github.com/mika-si/torrent-control/issues/202), [#144](https://github.com/mika-si/torrent-control/issues/144), [#137](https://github.com/mika-si/torrent-control/issues/137) | Window sizing, shortcuts and larger server menus: lower priority for one configured endpoint. |
| [#146](https://github.com/mika-si/torrent-control/issues/146) | OS notification regression needs current Windows/Firefox reproduction. |
| [#106](https://github.com/mika-si/torrent-control/issues/106), [#59](https://github.com/mika-si/torrent-control/issues/59), [#58](https://github.com/mika-si/torrent-control/issues/58), [#54](https://github.com/mika-si/torrent-control/issues/54) | Sounds, status popup, completion monitoring and bulk add: larger features, deferred. |

## Open pull requests

* [#208 — URL-based server routing](https://github.com/mika-si/torrent-control/pull/208):
  reviewed implementation and tests. Useful for several destination clients, but
  not required for one configured endpoint. Before integrating, test overlap order,
  advanced-dialog manual selection, unmatched URLs, and category/path precedence
  together. Not merged into this build.
* [#192 — custom Transmission auth token](https://github.com/mika-si/torrent-control/pull/192):
  reviewed implementation and tests. Transmission-specific; the proposed token
  field is plain text and its authentication/header behavior needs a dedicated
  review against current BaseClient. No Transmission service is under test here.
  Not merged into this build.

## Validation and limits

126 unit/regression tests pass. Real Firefox 155.0.1 smoke testing covers HTTP 204
login, newline-combined cookies, file/magnet uploads to a local fake server, tags,
stopped flags, and isolation from another port. A separate read-only check against
a qBittorrent 5.2.3 test endpoint verifies real HTTPS login, authenticated version retrieval,
and logout. It does not submit a live tracker torrent or certify every private
tracker's authentication/anti-bot workflow.

This remains a first test build. Concurrent additions to the same endpoint,
other torrent clients, multi-account containers and tracker-specific JavaScript
downloads require further testing. Credentials and private torrent URLs are not
included in this repository or build.

Development dependencies were updated, including Mocha 12. `npm audit --omit=dev`
reports zero findings. Full audit still reports three high-severity entries from
one dependency chain: web-ext → addons-linter → image-size (malformed image parser
denial of service; no fixed version offered at review time). These are build tools,
not included in the extension ZIP. Do not process untrusted image fixtures with
that toolchain; track an upstream fix rather than force-downgrading web-ext.
