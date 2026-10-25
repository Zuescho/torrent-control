import {
    isMagnetUrl,
    parseMagnetUriFromHandlerUrl,
} from '../src/util.js';

import {
    loadContentScript,
} from './helpers.js';

const magnetUri = 'magnet:?xt=urn:btih:c12fe1c06bba254a9dc9f519b335aa7c1367a88a&dn=%5BExample%5D%20Test';

describe('Magnet links', () => {
    describe('protocol handler requests', () => {
        it('decodes a magnet encoded into the handler path', () => {
            const url = 'https://torrent-control.invalid/' + encodeURIComponent(magnetUri);

            expect(parseMagnetUriFromHandlerUrl(url)).to.equal(magnetUri);
        });

        it('keeps a query and fragment that arrived unencoded', () => {
            const url = 'https://torrent-control.invalid/magnet:?xt=urn:btih:c12fe1c06bba254a9dc9f519b335aa7c1367a88a&dn=Test#1';

            expect(parseMagnetUriFromHandlerUrl(url)).to.equal('magnet:?xt=urn:btih:c12fe1c06bba254a9dc9f519b335aa7c1367a88a&dn=Test#1');
        });

        it('keeps a malformed percent escape instead of throwing', () => {
            expect(parseMagnetUriFromHandlerUrl('https://torrent-control.invalid/magnet:?xt=urn:btih:abc%zz'))
                .to.equal('magnet:?xt=urn:btih:abc%zz');
        });

        it('rejects requests that do not carry a magnet', () => {
            expect(parseMagnetUriFromHandlerUrl('https://torrent-control.invalid/')).to.equal(false);
            expect(parseMagnetUriFromHandlerUrl('https://torrent-control.invalid/https://example.com/x.torrent')).to.equal(false);
            expect(parseMagnetUriFromHandlerUrl('not a url')).to.equal(false);
        });

        it('accepts an uppercase scheme', () => {
            expect(isMagnetUrl('MAGNET:?xt=urn:btih:abc')).to.equal(true);
            expect(parseMagnetUriFromHandlerUrl('https://torrent-control.invalid/MAGNET:?xt=urn:btih:abc'))
                .to.equal('MAGNET:?xt=urn:btih:abc');
        });
    });

    describe('in-page clicks', () => {
        const loadMagnetScript = (settings = {}) => loadContentScript({source: './src/magnet-links.js', ...settings});

        const appendLink = (document, href, inner = 'Magnet') => {
            const link = document.createElement('a');
            link.setAttribute('href', href);
            link.innerHTML = inner;
            document.body.appendChild(link);

            return link;
        };

        it('catches a click before the browser hands the magnet to another application', async () => {
            const {document, click, sendMessage} = await loadMagnetScript();
            const link = appendLink(document, magnetUri);

            const event = click(link);

            expect(event.defaultPrevented).to.equal(true);
            expect(sendMessage.calledOnce).to.equal(true);
            expect(sendMessage.firstCall.args[0]).to.deep.equal({
                type: 'addMagnetLink',
                url: magnetUri,
            });
        });

        it('catches a click on an element inside the link', async () => {
            const {document, click, sendMessage} = await loadMagnetScript();
            const link = appendLink(document, '  ' + magnetUri + '  ', '<span><b>Download</b></span>');

            const event = click(link.querySelector('b'));

            expect(event.defaultPrevented).to.equal(true);
            expect(sendMessage.firstCall.args[0].url).to.equal(magnetUri);
        });

        it('leaves other links, modified clicks and non-primary buttons to the browser', async () => {
            const {document, click, sendMessage} = await loadMagnetScript();
            const magnetLink = appendLink(document, magnetUri);
            const torrentLink = appendLink(document, 'https://example.com/test.torrent');

            expect(click(torrentLink).defaultPrevented).to.equal(false);

            for (const modifier of [{ctrlKey: true}, {metaKey: true}, {shiftKey: true}, {altKey: true}, {button: 1}]) {
                expect(click(magnetLink, modifier).defaultPrevented).to.equal(false);
            }

            expect(sendMessage.called).to.equal(false);
        });

        it('stays out of the way when the option is disabled', async () => {
            const harness = await loadMagnetScript({globals: {catchMagnetLinks: false}});
            const link = appendLink(harness.document, magnetUri);

            expect(harness.click(link).defaultPrevented).to.equal(false);
            expect(harness.sendMessage.called).to.equal(false);

            harness.changeGlobals({catchMagnetLinks: true});

            expect(harness.click(link).defaultPrevented).to.equal(true);
            expect(harness.sendMessage.calledOnce).to.equal(true);
        });

        it('survives a reloaded extension without breaking the page', async () => {
            const {document, click, sendMessage} = await loadMagnetScript();
            sendMessage.throws(new Error('Extension context invalidated.'));

            expect(() => click(appendLink(document, magnetUri))).to.not.throw();

            sendMessage.returns(Promise.reject(new Error('Could not establish connection.')));

            expect(() => click(appendLink(document, magnetUri))).to.not.throw();
        });
    });
});
