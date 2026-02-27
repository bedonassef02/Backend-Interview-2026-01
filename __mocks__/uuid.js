// __mocks__/uuid.js
// Manual CJS mock for uuid v13 (pure ESM) to enable Jest CJS test runs.
// Provides a simple counter-based v4 that returns proper UUID-format strings.
'use strict';

let counter = 0;

function v4() {
    counter++;
    const hex = counter.toString(16).padStart(12, '0');
    return `00000000-0000-4000-8000-${hex}`;
}

function reset() {
    counter = 0;
}

module.exports = { v4, reset };
