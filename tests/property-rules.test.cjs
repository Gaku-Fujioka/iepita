const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const context = vm.createContext();
for (const file of ['property-filters.js', 'quiz-scoring.js']) {
    const filename = path.join(__dirname, '../src', file);
    vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
}
const { filterProperties } = vm.runInContext('propertyFilters', context);
const { evaluate, scoreProperty } = vm.runInContext('quizScoring', context);

const properties = [
    { id: 1, address: '東京都調布市布田', price: 80000, age: 20, tags: ['静か', '庭'], matchScore: 45, coordinates: [35.65, 139.55] },
    { id: 2, address: '東京都府中市宮町', price: 70000, age: 25, tags: ['庭'], matchScore: 90, coordinates: [35.67, 139.48] },
    { id: 3, address: '北海道札幌市中央区', price: 65000, age: 10, tags: ['静か'], matchScore: 70, coordinates: [43.06, 141.35] }
];
const filters = { tags: [], tagMode: 'AND', maxPrice: 150000, maxAge: 100, prefecture: '', city: '', sort: 'match_desc' };
const ids = (overrides, location) => Array.from(
    filterProperties(properties, { ...filters, ...overrides }, location),
    property => property.id
);

test('filters combine inclusive price and age limits with region and tag criteria', () => {
    assert.deepEqual(ids({ maxPrice: 80000, maxAge: 20, prefecture: '東京都', city: '調布市' }), [1]);
    assert.deepEqual(ids({ maxPrice: 79999, maxAge: 20, prefecture: '東京都', city: '調布市' }), []);
    assert.deepEqual(ids({ tags: ['庭', '静か'] }), [1]);
    assert.deepEqual(ids({ tags: ['庭', '静か'], tagMode: 'OR' }), [2, 3, 1]);
});

test('sorts without reordering the input and falls back to match score without location', () => {
    assert.deepEqual(ids({ sort: 'price_asc' }), [3, 2, 1]);
    assert.deepEqual(ids({ sort: 'distance_asc' }, { lat: 35.65, lng: 139.55 }), [1, 2, 3]);
    assert.deepEqual(ids({ sort: 'distance_asc' }), [2, 3, 1]);
    assert.deepEqual(properties.map(property => property.id), [1, 2, 3]);
});

test('diagnosis uses weighted tags and keeps the first type on a tie', () => {
    const questions = [{ key: 'location', options: [{ value: 'suburb', tags: ['庭', '庭'] }] }];
    const types = { first: { tagWeights: { 庭: 2, 静か: 1 } }, tied: { tagWeights: { 庭: 2 } } };
    const result = evaluate({ location: 'suburb' }, questions, types);
    assert.equal(result.typeName, 'first');
    assert.equal(result.type, types.first);
    assert.deepEqual(Array.from(result.matchTags), ['庭', '静か']);
    assert.equal(evaluate({}, questions, types).typeName, null);
});

test('match score includes the existing rating weights, random factor and bounds', () => {
    const property = { id: 1, tags: ['庭'] };
    const tags = new Set(['庭', '静か']);
    const ratings = { favorites: [], stars: [], dislikes: [] };
    assert.equal(scoreProperty(property, tags, ratings, () => 0), 55);
    assert.equal(scoreProperty(property, tags, ratings, () => 0.999), 71);
    assert.equal(scoreProperty(property, tags, { ...ratings, favorites: [1] }, () => 0.5), 78);
    assert.equal(scoreProperty(property, tags, { ...ratings, stars: [1] }, () => 0.5), 88);
    assert.equal(scoreProperty(property, tags, { ...ratings, dislikes: [1] }, () => 0.5), 28);
    assert.equal(scoreProperty(property, new Set(['庭']), { ...ratings, stars: [1] }, () => 0.999), 100);
    assert.equal(scoreProperty(property, new Set(['静か']), { ...ratings, dislikes: [1] }, () => 0), 0);
    assert.equal(property.matchScore, undefined);
});
