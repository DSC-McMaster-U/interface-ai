const fs = require('fs');
let code = fs.readFileSync('frontend/src/content/ui-handlers.ts', 'utf8');

const target =             // data.message is sent via WebSocket agent_log to survive navigations.
      };

const repl =             // data.message is sent via WebSocket agent_log to survive navigations.
            if (data.done === true) {
              sawDone = true;
              break;
            }
          }
        };

code = code.replace(target, repl);
fs.writeFileSync('frontend/src/content/ui-handlers.ts', code);
