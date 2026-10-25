import sinon from 'sinon';
import {JSDOM} from 'jsdom';
import qBittorrentApi from '../src/lib/qbittorrent.js';
import BaseClient from '../src/lib/baseclient.js';
import {getTorrentName} from '../src/util.js';
import {loadContentScript} from './helpers.js';

describe('Mana regressions', () => {
    const own = {
        url: 'https://example.com:8443/qbt/api/v2/torrents/add',
        originUrl: 'moz-extension://torrent-control/background.html', tabId: -1,
        requestHeaders: [{name: 'Cookie', value: 'browser=session'}],
        responseHeaders: [{name: 'Set-Cookie', value: 'SID=browser-session; HttpOnly'}],
    };
    let client;
    beforeEach(() => {
        client = new qBittorrentApi({hostname: 'https://example.com:8443/qbt/'});
        client._attachListeners();
        client.cookie = 'SID=extension-session';
    });

    for (const [name, change] of Object.entries({
        'browser tabs': {tabId: 10},
        'another port': {url: 'https://example.com:443/qbt/api/v2/test'},
        'another protocol': {url: 'http://example.com:8443/qbt/api/v2/test'},
        'another application': {url: 'https://example.com:8443/qbtevil/api/v2/test'},
        'another extension': {originUrl: 'moz-extension://other/background.html'},
        'unknown initiators': {originUrl: undefined},
    })) {
        it(`does not rewrite or capture cookies from ${name}`, () => {
            const details = {...own, ...change};
            expect(client.listeners.onBeforeSendHeaders(details)).to.equal(undefined);
            expect(client.listeners.onHeadersReceived(details)).to.equal(undefined);
            expect(client.cookie).to.equal('SID=extension-session');
            expect(details.requestHeaders[0].value).to.equal('browser=session');
        });
    }

    it('uses an isolated cookie and an Origin without the proxy path', () => {
        const result = client.listeners.onBeforeSendHeaders(own).requestHeaders;
        expect(result.find(h => h.name === 'Origin').value).to.equal('https://example.com:8443');
        expect(result.find(h => h.name === 'Cookie').value).to.equal('SID=extension-session');
    });

    it('finds the qBittorrent cookie after an unrelated Set-Cookie header', () => {
        client.listeners.onHeadersReceived({...own, responseHeaders: [
            {name: 'Set-Cookie', value: 'proxy=abc; Path=/'},
            {name: 'Set-Cookie', value: 'QBT_SID_8080=correct; HttpOnly; Path=/'},
        ]});
        expect(client.cookie).to.equal('QBT_SID_8080=correct');
        expect(client.getCookie([{name: 'Set-Cookie', value: 'NOTSID=wrong'}], 'SID')).to.equal(null);
        expect(client.getCookie([{name: 'Set-Cookie', value: 'proxy=abc; Path=/\nSID=correct; HttpOnly'}], 'SID')).to.equal('SID=correct');
    });

    for (const apiVersion of [2, 3]) {
        for (const method of ['addTorrent', 'addTorrentUrl']) {
            it(`sends tags and the correct stopped flag: v${apiVersion} ${method}`, async () => {
                client.settings.apiVersion = apiVersion;
                const fetchStub = sinon.stub(global, 'fetch').resolves({ok: true});
                await client[method]('fixture', {tags: ' anime, , archive ', paused: true});
                const form = fetchStub.firstCall.args[1].body;
                expect(form.get('tags')).to.equal('anime,archive');
                expect(form.get(apiVersion === 3 ? 'stopped' : 'paused')).to.equal('true');
            });
        }
    }

    it('handles a response without Content-Type as an API error', async () => {
        const base = new BaseClient();
        let error;
        try {
            await base.parseJsonResponse({ok: true, headers: new Headers(), text: async () => 'invalid response'});
        } catch (caught) { error = caught; }
        expect(error).to.be.instanceOf(Error);
        expect(error).not.to.be.instanceOf(TypeError);
    });

    it('rejects truncated filename lengths without hanging', async () => {
        const {window} = new JSDOM();
        expect(await getTorrentName(new window.Blob(['d4:name999999999999:short']))).to.equal(false);
    });

    it('reads non-BMP Unicode torrent filenames by UTF-8 byte length', async () => {
        const {window} = new JSDOM();
        expect(await getTorrentName(new window.Blob(['d4:name8:📦.txte']))).to.equal('📦.txt');
    });

    it('fetches tracker files with the source session and referrer, and serializes failures', async () => {
        const fetchStub = sinon.stub().resolves({ok: true, status: 200, headers: new Headers(), blob: async () => 'fixture'});
        const {context, onMessage: listener} = await loadContentScript({fetch: fetchStub});
        await listener({type: 'fetchTorrent', url: '/download?id=1'});
        expect(fetchStub.firstCall.args[0]).to.equal('https://tracker.example/download?id=1');
        expect(fetchStub.firstCall.args[1].credentials).to.equal('include');
        expect(fetchStub.firstCall.args[1].referrer).to.equal(context.window.location.href);
        fetchStub.rejects(new Error('sensitive URL'));
        const result = await listener({type: 'fetchTorrent', url: '/download?id=1'});
        expect(JSON.parse(JSON.stringify(result)).error).to.include('source tab');
        expect(result.error).not.to.include('sensitive');
        fetchStub.resetHistory();
        expect((await listener({type: 'fetchTorrent', url: 'file:///secret'})).error).to.include('scheme');
        expect(fetchStub.called).to.equal(false);
    });
});
