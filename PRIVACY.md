# Privacy and permissions

This fork does not send telemetry, analytics or crash reports to its maintainers.
It sends configured login credentials to the torrent client you choose, fetches
torrent files from source websites using your browser session, and submits chosen
torrent/magnet URLs or torrent files to that client. These can contain private
tracker passkeys. Your client subsequently uses its own network and VPN setup.

Settings, including client credentials, use the upstream browser extension
storage mechanism. They are not a separate encrypted password vault. Do not commit
settings exports or credentials. This build adds no cloud synchronization.

Firefox's installation prompt declares authentication information, browsing
activity and website content because these are transmitted as part of that
functionality. There is no maintainer-operated collection endpoint.

Broad website access allows arbitrary user-configured trackers and client
endpoints. Blocking webRequest permission supports client authentication and URL
handling. Cookies support authenticated clients; context menus and notifications
provide the browser UI. qBittorrent session rewriting is constrained to extension
background requests for its configured endpoint.

The built-in consent declaration follows
[Mozilla's data consent documentation](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/).
This fork targets Firefox Desktop 140 or later, where that consent UI is supported.
