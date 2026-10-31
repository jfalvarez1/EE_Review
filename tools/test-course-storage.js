'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { create } = require('../assets/course-storage');

function backend(seed = {}) {
    const records = new Map(Object.entries(seed));
    return { records, get length() { return records.size; },
        key: i => Array.from(records.keys())[i], getItem: key => records.get(key) ?? null,
        setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) };
}

function framework(storage) {
    const context = vm.createContext({ window: { CourseStorage: storage }, console });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/ad-framework.js'), 'utf8'), context);
    return context.window.AD;
}

// Valid legacy records survive. Broken JSON and valid JSON of the wrong shape do not break navigation.
for (const raw of ['{', 'null', '[]', '7', '"text"', '{"lessons":null,"exercises":[]}',
    '{"lessons":{"m1l1":true},"exercises":{"x":{"attempts":-4,"solved":"yes"}}}']) {
    const saved = backend({ 'AD_course_v1.progress': raw });
    const AD = framework(create(() => saved));
    assert.doesNotThrow(() => AD.isLessonDone(1, 1));
    assert.doesNotThrow(() => AD.toggleLessonDone(1, 2));
    assert.equal(AD.isLessonDone(1, 2), true);
    assert.equal(AD.incrementExerciseAttempts('x'), 1);
}
const saved = backend({ 'AD_course_v1.progress': '{"lessons":{"m1l1":true},"exercises":{"x":{"attempts":3,"solved":true}},"checklists":{"a-b":true}}',
    'design:one': '{"passed":true}', unrelated: 'keep', 'AD_course_v2.future': 'keep' });
const storage = create(() => saved);
const AD = framework(storage);
assert.equal(AD.isLessonDone(1, 1), true);
assert.equal(AD.getExerciseState('x').attempts, 3);
assert.equal(AD.isChecklistItemDone('a', 'b'), true);
assert.equal(storage.exportData().records['design:one'], '{"passed":true}');
assert.throws(() => storage.write('unrelated', 'overwrite'));
assert.equal(storage.clear().complete, true);
assert.deepEqual(Array.from(saved.records.keys()), ['unrelated', 'AD_course_v2.future']);

// Quota/private mode: edits remain usable within this page, and failed deletion is reported.
const unavailable = create(() => { throw new Error('SecurityError'); });
let warned = 0;
unavailable.subscribe(() => { warned++; });
const volatileAD = framework(unavailable);
volatileAD.toggleLessonDone(2, 3);
assert.equal(volatileAD.isLessonDone(2, 3), true);
assert.equal(volatileAD.incrementExerciseAttempts('trial'), 1);
assert.equal(volatileAD.incrementExerciseAttempts('trial'), 2);
assert.equal(unavailable.exportData().storageAccessFailed, true);
assert(warned > 0);
assert.equal(unavailable.clear().complete, false);
assert.equal(volatileAD.isLessonDone(2, 3), false);

const full = backend();
full.setItem = () => { throw new Error('QuotaExceededError'); };
const quota = create(() => full);
assert.equal(quota.write('design:answer', '<img src=x onerror=alert(1)>'), false);
assert.equal(quota.exportData().records['design:answer'], '<img src=x onerror=alert(1)>');
assert.equal(quota.readObject('design:answer').constructor, Object);

const poisoned = create(() => backend({ 'AD_course_v1.progress': '{"lessons":{"__proto__":{"polluted":true}},"exercises":{"constructor":{"attempts":5}}}' }));
assert.equal(Object.keys(framework(poisoned).getProgress().lessons).length, 0);
assert.equal({}.polluted, undefined);
// Exercise actual widget rendering with saved strings that try to escape an input attribute.
const injection = '4" autofocus onfocus="window.injected=1';
const widgetStorage = create(() => backend({
    'design:test': JSON.stringify({ values: { R: injection }, attempts: '<img src=x>' }),
    'design:sim:test': JSON.stringify({ values: { v: injection } }),
    'design:fault:test': JSON.stringify({ solved: true, probesUsed: '<img src=x onerror=alert(1)>' })
}));
const widgets = vm.createContext({ window: { CourseStorage: widgetStorage }, console });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/design-brief.js'), 'utf8'), widgets);
function host() {
    return { innerHTML: '', classList: { toggle() {} },
        querySelector: () => ({ addEventListener() {} }), querySelectorAll: () => [] };
}
const designHost = host();
const design = new widgets.window.DesignBriefWidget(designHost, { id: 'test', inputs: [{ id: 'R' }] });
assert.equal(design.state.attempts, 0);
assert(designHost.innerHTML.includes('value="4&quot; autofocus onfocus=&quot;window.injected=1"'));
const simHost = host();
new widgets.window.SimCheckWidget(simHost, { id: 'test', probes: [{ id: 'v' }] });
assert(simHost.innerHTML.includes('value="4&quot; autofocus onfocus=&quot;window.injected=1"'));
const faultHost = host();
new widgets.window.FaultFindWidget(faultHost, { id: 'test' });
assert(!faultHost.innerHTML.includes('<img'));
assert(faultHost.innerHTML.includes('Diagnosed in 0 probes'));
console.log('PASS - legacy/malformed records, blocked storage, scoped deletion and stored-markup injection regressions.');
