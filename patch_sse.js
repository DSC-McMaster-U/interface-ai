const fs = require('fs');
let code = fs.readFileSync('frontend/src/content/ui-handlers.ts', 'utf8');

// We matches the exact block inside the while loop
code = code.replace(/if \(typeof data\.message === "string" && data\.message\) \{\s+handlers\.addMessage\(data\.message, "assistant"\);\s+\}/g, '');

fs.writeFileSync('frontend/src/content/ui-handlers.ts', code);
