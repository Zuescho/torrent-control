// Real Firefox test against local fake qBittorrent endpoints. No tracker traffic or credentials.
import {createServer} from 'node:http';
import {mkdtemp, cp, writeFile, rm, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const directory = await mkdtemp(join(tmpdir(), 'torrent-control-smoke-'));
const liveUrl = process.env.TC_QBT_URL;
const passwordFile = process.env.TC_QBT_PASSWORD_FILE;
const livePassword = liveUrl && passwordFile
    ? (await readFile(passwordFile, 'utf8')).match(/^Password:\s*(.+)$/im)?.[1].trim() : null;
if (liveUrl && !livePassword) throw new Error('Live mode requires a password file containing a Password: line');
const live = liveUrl ? {application: 'qbittorrent', hostname: liveUrl, username: process.env.TC_QBT_USERNAME || 'admin', password: livePassword} : null;
const requests = [];
const smokeMagnet = 'magnet:?xt=urn:btih:0123456789012345678901234567890123456789&dn=Smoke+Test';
let finish;
const completion = new Promise(resolve => { finish = resolve; });
const handler = async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    requests.push({path: request.url, headers: request.headers, body});
    if (request.url === '/api/v2/auth/login') {
        response.writeHead(204, {'Set-Cookie': ['proxy=irrelevant; Path=/', 'QBT_SID_8080=isolated; HttpOnly; Path=/']});
    } else if (request.url === '/report') {
        finish(JSON.parse(body));
    } else if (request.url === '/magnet-page' || request.url === '/magnet-frame') {
        // A magnet link in the top frame and in a subframe, clicked by the page
        // itself. Without the content script the click leaves the browser.
        response.writeHead(200, {'Content-Type': 'text/html'});
        response.end(`<!doctype html><a id="magnet" href="${smokeMagnet}">magnet</a>`
            + (request.url === '/magnet-page' ? '<iframe src="/magnet-frame"></iframe>' : '')
            + '<script>addEventListener("load", () => document.getElementById("magnet").click())</script>');
        return;
    }
    response.end('Ok.');
};
const primary = createServer(handler);
const secondary = createServer(handler);
await new Promise(resolve => primary.listen(0, '127.0.0.1', resolve));
await new Promise(resolve => secondary.listen(0, '127.0.0.1', resolve));
const endpoint = `http://127.0.0.1:${primary.address().port}`;
const otherEndpoint = `http://127.0.0.1:${secondary.address().port}`;
let child;
let timer;
let output = '';
try {
    await cp('src', directory, {recursive: true});
    await writeFile(join(directory, 'smoke.html'), '<!doctype html><script type="module" src="smoke.js"></script>');
    await writeFile(join(directory, 'manifest.json'), JSON.stringify({
        manifest_version: 2, name: 'Torrent Control smoke test', version: '1.0',
        default_locale: 'en',
        browser_specific_settings: {gecko: {id: 'smoke-test@torrent-control.invalid'}},
        permissions: ['webRequest', 'webRequestBlocking', 'storage', 'http://127.0.0.1/*', ...(live ? [new URL(liveUrl).protocol + '//' + new URL(liveUrl).hostname + '/*'] : [])],
        content_scripts: [{matches: ['http://127.0.0.1/*'], js: ['magnet-links.js'], all_frames: true, run_at: 'document_start'}],
        background: {page: 'smoke.html'},
    }));
    await writeFile(join(directory, 'smoke.js'), `
import {getClient} from './util.js';
const endpoint = ${JSON.stringify(endpoint)};
const client = getClient({application: 'qbittorrent', hostname: endpoint + '/', username: 'fixture', password: 'fixture'});
const live = ${JSON.stringify(live)};
const smokeMagnet = ${JSON.stringify(smokeMagnet)};
const caughtMagnets = [];
chrome.runtime.onMessage.addListener((request) => {
    if (request.type === 'addMagnetLink') caughtMagnets.push(request.url);
});
try {
    await client.logIn();
    if (client.cookie !== 'QBT_SID_8080=isolated') throw new Error('Session cookie was not captured');
    await client.addTorrentUrl('magnet:?xt=urn:btih:0123456789012345678901234567890123456789', {paused: true, tags: 'one, two'});
    await client.addTorrent(new Blob(['fixture']), {paused: true, tags: 'one, two'});
    await fetch(${JSON.stringify(otherEndpoint + '/other-port')});
    await client.logOut();
    const tab = await new Promise(resolve => chrome.tabs.create({url: endpoint + '/magnet-page', active: false}, resolve));
    await new Promise((resolve, reject) => {
        const deadline = Date.now() + 15000;
        const poll = setInterval(() => {
            if (caughtMagnets.length >= 2) { clearInterval(poll); resolve(); }
            else if (Date.now() > deadline) { clearInterval(poll); reject(new Error('Magnet clicks caught: ' + caughtMagnets.length + ' of 2')); }
        }, 100);
    });
    chrome.tabs.remove(tab.id);
    if (caughtMagnets.some(url => url !== smokeMagnet)) throw new Error('Unexpected magnet URI: ' + caughtMagnets.join(' '));
    let version = null;
    if (live) {
        const liveClient = getClient(live);
        try {
            await liveClient.logIn();
            const response = await fetch(live.hostname + 'api/v2/app/version');
            if (!response.ok) throw new Error('Live version request failed: ' + response.status);
            version = await response.text();
            if (!/^v?\\d+\\.\\d+\\.\\d+$/.test(version)) throw new Error('Unexpected live version response');
        } finally { await liveClient.logOut(); }
    }
    await fetch(endpoint + '/report', {method: 'POST', body: JSON.stringify({ok: true, version})});
} catch (error) {
    await fetch(endpoint + '/report', {method: 'POST', body: JSON.stringify({ok: false, error: live ? 'Live integration failed; check endpoint/session settings' : error.message})});
}
`);
    const firefox = process.env.FIREFOX_BINARY || (process.platform === 'win32' ? 'C:/Program Files/Mozilla Firefox/firefox.exe' : 'firefox');
    child = spawn(process.execPath, [resolve('node_modules/web-ext/bin/web-ext.js'), 'run',
        '--source-dir', directory, '--firefox', firefox, '--no-reload', '--no-input', '--args=-headless'],
    {stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true});
    child.stdout.on('data', data => { output += data.toString(); });
    child.stderr.on('data', data => { output += data.toString(); });
    child.on('exit', code => { if (code) finish({ok: false, error: `web-ext exited ${code}: ${output.slice(-2000)}`}); });
    const result = await Promise.race([completion, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Firefox timed out: ${output.slice(-2000)}`)), 45000);
    })]);
    assert.equal(result.ok, true, result.error);
    const additions = requests.filter(request => request.path === '/api/v2/torrents/add');
    assert.equal(additions.length, 2);
    for (const request of additions) {
        assert.equal(request.headers.cookie, 'QBT_SID_8080=isolated');
        assert.equal(request.headers.origin, endpoint);
        assert.equal(request.headers.referer, endpoint + '/');
        assert.match(request.body, /name="stopped"\r\n\r\ntrue/);
        assert.match(request.body, /name="tags"\r\n\r\none,two/);
    }
    const other = requests.find(request => request.path === '/other-port');
    assert.equal(other.headers.cookie, undefined);
    assert.notEqual(other.headers.origin, endpoint);
    assert.equal(requests.filter(request => request.path === '/magnet-frame').length, 1);
    console.log('PASS: real Firefox login 204, multiple cookies, magnet/file submission, tags, stopped flag, port isolation and caught magnet clicks in both frames.');
    if (live) console.log('PASS: live HTTPS login, authenticated version request and logout: ' + result.version);
} finally {
    clearTimeout(timer);
    // web-ext handles SIGINT by closing its temporary Firefox profile.
    if (child && child.exitCode === null) {
        child.kill('SIGINT');
        await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 3000))]);
    }
    primary.closeAllConnections(); secondary.closeAllConnections();
    primary.close(); secondary.close();
    await rm(directory, {recursive: true, force: true, maxRetries: 3});
}
