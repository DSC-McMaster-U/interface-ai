const fs = require('fs');
let code = fs.readFileSync('frontend/src/content/ui-handlers.ts', 'utf8');

code = code.replace(/handlers\.showLoading\(false\);\r?\n\s*else if \(data\.echo\) \{/g, 'handlers.showLoading(false);\n          if (typeof data.message === "string" && data.message) {\n            handlers.addMessage(data.message, "assistant");\n          } else if (data.echo) {');

fs.writeFileSync('frontend/src/content/ui-handlers.ts', code);
