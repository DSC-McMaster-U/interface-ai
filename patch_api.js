const fs = require('fs');
let code = fs.readFileSync('frontend/src/content/ui-handlers.ts', 'utf8');

code = code.replace(/const BACKEND_API = "http:\/\/localhost:5000";/g, 'const BACKEND_API = "http://localhost:5050";');

fs.writeFileSync('frontend/src/content/ui-handlers.ts', code);
