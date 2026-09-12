# Changelog

## 0.3.0 — Mana test build — 2026-09-12

Based on upstream 0.2.51 (`d71bdb2`).

* Isolate qBittorrent session/header handling to this extension's background
  requests and the configured origin, port and application path.
* Recognize session cookies after other cookies, including Firefox's combined
  Set-Cookie representation. Generate a valid Origin behind a proxy subpath.
* Fetch tracker files with explicit source-tab credentials and referrer;
  transport failures return serializable errors and missing tabs reject cleanly.
* Add qBittorrent tags to advanced file/magnet additions; restore the stopped
  checkbox when switching to a client that supports it.
* Bound filename parsing and handle Unicode code points, avoiding a hang on
  truncated torrent names. Handle missing API Content-Type without a TypeError.
* Use separate fork name/ID, Firefox 140+ data-transmission declarations,
  updated development dependencies and a reproducible Firefox smoke test.
* Document all 33 open upstream issues and both open PRs, including deferred work.

Validation: 126 passing tests, real Firefox 155.0.1 fake-server smoke test, and
read-only live HTTPS authentication against a qBittorrent 5.2.3 test endpoint.

The ZIP is unsigned. A permanent installation in normal Firefox requires Mozilla
signing; temporary developer loading is available now.
