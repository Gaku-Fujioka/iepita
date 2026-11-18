const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const repo = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(repo, 'sw.js'), 'utf8');
const origin = 'https://example.github.io';
const scope = origin + '/iepita/';

const makeWorker = ({ caches, fetch, scopeUrl = scope }) => {
    const events = new Map();
    let claimed = false;
    const self = {
        registration: { scope: scopeUrl },
        clients: { claim: async () => { claimed = true; } },
        addEventListener: (type, handler) => events.set(type, handler)
    };
    vm.runInNewContext(source, { self, caches, fetch, URL, Request, AbortSignal });

    const dispatch = (type, request) => {
        let result;
        const capture = promise => { result = promise; };
        events.get(type)({ request, waitUntil: capture, respondWith: capture });
        return result;
    };
    return { dispatch, isClaimed: () => claimed };
};

test('pre-caches the shipped local assets under the scope even when CDNs fail', async () => {
    const files = [];
    const worker = makeWorker({
        caches: { open: async () => ({ addAll: async requests => files.push(...requests) }) },
        fetch: async () => { throw new Error('CDN unavailable'); }
    });
    await worker.dispatch('install');
    for (const request of files) {
        assert.ok(request.url.startsWith(scope));
        assert.equal(request.cache, 'reload');
        assert.ok(fs.existsSync(path.join(repo, request.url.slice(scope.length))));
    }
    const html = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
    for (const [, relative] of html.matchAll(/(?:src|href)="\.\/((?:src|styles)\/[^\"]+)"/g)) {
        assert.ok(files.some(request => request.url === scope + relative), relative);
    }
    assert.ok(files.some(request => request.url === scope + 'index.html'));
    assert.ok(files.some(request => request.url === scope + 'quiz.json'));
});

test('installation fails when the required app files cannot be cached', async () => {
    const error = new Error('Required app asset unavailable');
    const worker = makeWorker({ caches: { open: async () => ({ addAll: async () => { throw error; } }) } });
    await assert.rejects(worker.dispatch('install'), error);
});

test('activation removes only obsolete caches belonging to the same scope', async () => {
    const deleted = [];
    const stale = `iepita:${scope}:v1`;
    const worker = makeWorker({ caches: {
        keys: async () => [stale, `iepita:${scope}:v2`, `iepita:${origin}/:v1`, 'unrelated-app-cache'],
        delete: async name => { deleted.push(name); }
    } });
    await worker.dispatch('activate');
    assert.deepEqual(deleted, [stale]);
    assert.ok(worker.isClaimed());
});

test('serves app files and shortcut navigations offline under root and project scopes', async () => {
    for (const scopeUrl of [scope, origin + '/']) {
        const worker = makeWorker({
            scopeUrl,
            caches: { open: async () => ({ match: async url => url }) },
            fetch: async () => { throw new Error('Offline'); }
        });
        const fetchPage = (target, mode = 'navigate', method = 'GET') =>
            worker.dispatch('fetch', { url: new URL(target, scopeUrl).href, mode, method });

        assert.equal(await fetchPage('./?action=quiz'), scopeUrl + 'index.html');
        assert.equal(await fetchPage('index.html?action=favorites'), scopeUrl + 'index.html');
        assert.equal(await fetchPage('./src/main.js', 'same-origin'), scopeUrl + 'src/main.js');
        assert.equal(fetchPage('./unknown.html'), undefined);
        assert.equal(fetchPage('./quiz.json', 'same-origin', 'POST'), undefined);
    }
});

test('manifest and its shortcuts resolve under the public project path', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(repo, 'manifest.json'), 'utf8'));
    const manifestUrl = scope + 'manifest.json';
    assert.equal(new URL(manifest.start_url, manifestUrl).href, scope);
    assert.equal(new URL(manifest.scope, manifestUrl).href, scope);
    assert.deepEqual(manifest.shortcuts.map(shortcut => new URL(shortcut.url, manifestUrl).href), [
        scope + '?action=quiz',
        scope + '?action=favorites'
    ]);
});
