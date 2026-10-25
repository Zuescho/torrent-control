// Clicking a magnet link only reaches the extension when Firefox's magnet
// protocol handler points at it. When the handler is set to the operating
// system, or to another application, the click never arrives and the user gets
// an OS "no app associated" error instead. Catch the click here so the
// configured client receives the magnet regardless of that preference.
const magnetScheme = /^magnet:/i;

let catchMagnetLinks = true;

function readMagnetSetting(globals) {
    if (globals && typeof globals === 'object' && 'catchMagnetLinks' in globals) {
        catchMagnetLinks = globals.catchMagnetLinks !== false;
    }
}

function findMagnetLink(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];

    for (const node of path) {
        if (!node || node.nodeType !== 1 || typeof node.getAttribute !== 'function') {
            continue;
        }

        const href = (node.getAttribute('href') || node.getAttribute('xlink:href') || '').trim();

        if (magnetScheme.test(href)) {
            return href;
        }
    }

    return null;
}

function magnetClickListener(event) {
    if (!catchMagnetLinks || event.defaultPrevented) {
        return;
    }

    // Plain activation only: leave modified clicks to the browser so page
    // behaviour such as opening a copy menu is not swallowed.
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
        return;
    }

    const magnetUri = findMagnetLink(event);

    if (!magnetUri) {
        return;
    }

    event.preventDefault();

    try {
        const sending = chrome.runtime.sendMessage({
            type: 'addMagnetLink',
            url: magnetUri,
        });

        // Firefox resolves a promise here; a missing background page must not
        // surface as an unhandled rejection in the page's console.
        if (sending && typeof sending.catch === 'function') {
            sending.catch(() => {});
        }
    } catch (e) {
        // The extension was reloaded or disabled; nothing to add.
    }
}

chrome.storage.local.get('globals', (stored) => readMagnetSetting(stored && stored.globals));

chrome.storage.onChanged.addListener((changes) => {
    if (changes.globals) {
        readMagnetSetting(changes.globals.newValue);
    }
});

document.addEventListener('click', magnetClickListener, true);
