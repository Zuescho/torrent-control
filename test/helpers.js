import { promises } from 'node:fs';
import vm from 'node:vm';
import JSDOM from 'jsdom';
import sinon from 'sinon';

export const getTestTorrent = async () => {
    const jsdom = new JSDOM.JSDOM();

    return new jsdom.window.Blob([await promises.readFile('./test/test.torrent')], {
        type: 'application/x-bittorrent',
    });
}

export const getTestHtml = async () => {
    const jsdom = new JSDOM.JSDOM();

    return new jsdom.window.Blob(['<!doctype html>'], {
        type: 'text/html',
    });
}

/**
 * Run a content script in a context that mimics an injected page script.
 */
export const loadContentScript = async ({
    source = './src/content-script.js',
    globals = {},
    fetch = sinon.stub(),
    href = 'https://tracker.example/details?id=1',
} = {}) => {
    const jsdom = new JSDOM.JSDOM('<!doctype html><html><body></body></html>');
    const storageListeners = [];

    const context = {
        URL,
        Headers,
        fetch,
        document: jsdom.window.document,
        window: {location: {href: href}},
        chrome: {
            runtime: {
                onMessage: {addListener: (listener) => { context.onMessage = listener; }},
                sendMessage: sinon.stub(),
            },
            storage: {
                local: {get: (key, callback) => callback({globals: globals})},
                onChanged: {addListener: (listener) => storageListeners.push(listener)},
            },
        },
    };

    vm.runInNewContext(await promises.readFile(source, 'utf8'), context);

    return {
        context: context,
        document: jsdom.window.document,
        window: jsdom.window,
        fetch: fetch,
        sendMessage: context.chrome.runtime.sendMessage,
        onMessage: (request) => context.onMessage(request),
        changeGlobals: (newValue) => storageListeners.forEach((listener) => listener({globals: {newValue: newValue}})),
        click: (target, init = {}) => {
            const event = new jsdom.window.MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                composed: true,
                button: 0,
                ...init,
            });

            target.dispatchEvent(event);

            return event;
        },
    };
};
