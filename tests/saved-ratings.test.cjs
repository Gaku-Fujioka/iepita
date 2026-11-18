const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/saved-ratings.js'), 'utf8');

const makeStorage = (entries = {}) => {
    const values = new Map(Object.entries(entries));
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
};

const makeRatings = (localStorage, sessionStorage) => {
    const context = vm.createContext({ localStorage, sessionStorage });
    return vm.runInContext(source + '\nsavedRatings;', context);
};

test('restores pre-existing keys and writes the same JSON arrays', () => {
    const local = makeStorage({ iepita_favorites: '[1,2]', iepita_stars: '[3]', iepita_dislikes: '[4]' });
    const ratings = makeRatings(local, makeStorage());
    assert.deepEqual(structuredClone(ratings.loadAll()), { favorites: [1, 2], stars: [3], dislikes: [4] });
    ratings.saveAll({ favorites: [2], stars: [1, 3], dislikes: [] });
    assert.equal(local.getItem('iepita_favorites'), '[2]');
    assert.equal(local.getItem('iepita_stars'), '[1,3]');
    assert.equal(local.getItem('iepita_dislikes'), '[]');
});

test('uses the existing session backup keys when primary storage fails', () => {
    const unavailable = () => { throw new Error('Storage unavailable'); };
    const session = makeStorage({ iepita_stars_backup: '[3]', iepita_dislikes_backup: '[4]' });
    const ratings = makeRatings({ getItem: unavailable, setItem: unavailable }, session);
    ratings.save('favorites', [1, 2]);
    assert.equal(session.getItem('iepita_favorites_backup'), '[1,2]');
    assert.deepEqual(structuredClone(ratings.loadAll()), { favorites: [1, 2], stars: [3], dislikes: [4] });
});

test('recovers corrupt JSON and clears saved ratings with their backups', () => {
    const local = makeStorage({ iepita_stars: '{', inquiries: '[{}]' });
    const session = makeStorage({ iepita_stars_backup: '[9]' });
    const ratings = makeRatings(local, session);
    assert.deepEqual(structuredClone(ratings.loadAll()), { favorites: [], stars: [9], dislikes: [] });
    ratings.clearAll();
    assert.deepEqual(structuredClone(ratings.loadAll()), { favorites: [], stars: [], dislikes: [] });
    assert.equal(session.getItem('iepita_stars_backup'), null);
    assert.equal(local.getItem('inquiries'), '[{}]');
});
