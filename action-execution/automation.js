// ============================================
// InterfaceAI - Terminal Browser Automation
// ============================================

const puppeteer = require('puppeteer');

class InterfaceAI {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async init(headless = false) {
        this.browser = await puppeteer.launch({ 
            headless,
            defaultViewport: { width: 1280, height: 800 }
        });
        this.page = await this.browser.newPage();
        console.log('[InterfaceAI] Browser launched');
    }

    async goto(url) {
        await this.page.goto(url, { waitUntil: 'networkidle2' });
        console.log(`[InterfaceAI] Navigated to ${url}`);
    }

    async close() {
        await this.browser.close();
        console.log('[InterfaceAI] Browser closed');
    }

    // -------------------- ACTION FUNCTIONS --------------------

    async clickAtCoordinate(x, y) {
        await this.page.mouse.click(x, y);
        console.log(`[InterfaceAI] Clicked at (${x}, ${y})`);
        return { success: true, x, y };
    }

    async clickByName(name, exactMatch = false) {
        const result = await this.page.evaluate((name, exactMatch) => {
            const selectors = ['button', 'a', '[role="button"]', 'input[type="button"]', 'input[type="submit"]'];
            for (const selector of selectors) {
                for (const el of document.querySelectorAll(selector)) {
                    const text = el.textContent?.trim() || el.value || el.getAttribute('aria-label') || '';
                    const matches = exactMatch 
                        ? text.toLowerCase() === name.toLowerCase()
                        : text.toLowerCase().includes(name.toLowerCase());
                    if (matches) {
                        el.click();
                        return { success: true, element: el.tagName, text };
                    }
                }
            }
            return { success: false, error: `No element found: ${name}` };
        }, name, exactMatch);
        
        console.log(`[InterfaceAI] clickByName("${name}"):`, result);
        return result;
    }

    async scrollUp(pixels = 500) {
        await this.page.evaluate((px) => window.scrollBy(0, -px), pixels);
        console.log(`[InterfaceAI] Scrolled up ${pixels}px`);
        return { success: true, scrolledBy: -pixels };
    }

    async scrollDown(pixels = 500) {
        await this.page.evaluate((px) => window.scrollBy(0, px), pixels);
        console.log(`[InterfaceAI] Scrolled down ${pixels}px`);
        return { success: true, scrolledBy: pixels };
    }

    async scrollToTop() {
        await this.page.evaluate(() => window.scrollTo(0, 0));
        console.log(`[InterfaceAI] Scrolled to top`);
        return { success: true };
    }

    async scrollToBottom() {
        await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        console.log(`[InterfaceAI] Scrolled to bottom`);
        return { success: true };
    }

    async fillInput(identifier, value) {
        const result = await this.page.evaluate((identifier, value) => {
            const lower = identifier.toLowerCase();
            let input = document.querySelector(`input[name="${identifier}" i], textarea[name="${identifier}" i]`)
                || document.querySelector(`#${CSS.escape(identifier)}`)
                || document.querySelector(`input[placeholder*="${identifier}" i], textarea[placeholder*="${identifier}" i]`)
                || document.querySelector(`input[aria-label*="${identifier}" i], textarea[aria-label*="${identifier}" i]`);
            
            if (!input) {
                for (const label of document.querySelectorAll('label')) {
                    if (label.textContent.toLowerCase().includes(lower)) {
                        input = label.getAttribute('for') 
                            ? document.getElementById(label.getAttribute('for'))
                            : label.querySelector('input, textarea');
                        if (input) break;
                    }
                }
            }
            
            if (!input) {
                // Last resort: find by type for common fields
                const typeMap = { 'search': 'input[type="search"], input[name*="search" i]', 'email': 'input[type="email"]', 'password': 'input[type="password"]' };
                if (typeMap[lower]) input = document.querySelector(typeMap[lower]);
            }
            
            if (input) {
                input.focus();
                input.value = value;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                return { success: true, name: input.name || input.id || input.placeholder };
            }
            return { success: false, error: `No input found: ${identifier}` };
        }, identifier, value);
        
        console.log(`[InterfaceAI] fillInput("${identifier}"):`, result);
        return result;
    }

    async clickFirstSearchResult() {
        const result = await this.page.evaluate(() => {
            const selectors = [
                '#search a h3', '#rso a h3', 'div.g a h3',
                '#b_results .b_algo h2 a',
                '[data-testid="result-title-a"]', '.result__a',
                'main a h2', 'main a h3'
            ];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) {
                    const link = el.closest('a') || el;
                    link.click();
                    return { success: true, url: link.href, text: el.textContent?.trim() };
                }
            }
            return { success: false, error: 'No search results found' };
        });
        
        console.log(`[InterfaceAI] clickFirstSearchResult:`, result);
        return result;
    }

    async pressEnter() {
        await this.page.keyboard.press('Enter');
        console.log(`[InterfaceAI] Pressed Enter`);
        return { success: true };
    }

    async type(text) {
        await this.page.keyboard.type(text);
        console.log(`[InterfaceAI] Typed: "${text}"`);
        return { success: true };
    }

    // -------------------- STATUS CHECKER --------------------

    async getPageStatus() {
        const status = await this.page.evaluate(() => {
            return {
                title: document.title,
                url: window.location.href,
                scroll: {
                    position: window.scrollY,
                    maxScroll: document.body.scrollHeight,
                    percent: Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100) || 0
                },
                headings: [...document.querySelectorAll('h1,h2,h3')].slice(0, 20).map(h => ({
                    level: h.tagName,
                    text: h.textContent.trim().substring(0, 100)
                })),
                buttons: [...document.querySelectorAll('button, [role="button"], input[type="submit"]')].slice(0, 30).map(b => ({
                    text: (b.textContent?.trim() || b.value || b.getAttribute('aria-label') || '').substring(0, 50),
                    disabled: b.disabled
                })),
                textboxes: [...document.querySelectorAll('input:not([type="hidden"]), textarea')].slice(0, 20).map(i => ({
                    name: i.name || i.id || i.placeholder || 'unnamed',
                    type: i.type || 'text',
                    value: i.type === 'password' ? '***' : (i.value || '').substring(0, 50)
                })),
                links: [...document.querySelectorAll('a[href]')].slice(0, 30).map(a => ({
                    text: (a.textContent || '').trim().substring(0, 50),
                    href: a.href.substring(0, 100)
                })),
                images: [...document.querySelectorAll('img[src]')].slice(0, 20).map(i => ({
                    alt: (i.alt || '').substring(0, 50),
                    src: i.src.substring(0, 100)
                }))
            };
        });
        
        console.log(`[InterfaceAI] Page: "${status.title}"`);
        return status;
    }

    // -------------------- VISION AI (for later) --------------------

    async screenshot(path = 'screenshot.png') {
        await this.page.screenshot({ path, fullPage: false });
        console.log(`[InterfaceAI] Screenshot saved: ${path}`);
        return { success: true, path };
    }

    async screenshotBase64() {
        const base64 = await this.page.screenshot({ encoding: 'base64' });
        console.log(`[InterfaceAI] Screenshot captured (base64)`);
        return base64;
    }

    // Placeholder for vision AI integration
    async analyzeWithVision(prompt = "What do you see on this page?") {
        const base64 = await this.screenshotBase64();
        
        // TODO: Send to vision AI (Claude, GPT-4V, etc.)
        // Example structure for Claude:
        // const response = await anthropic.messages.create({
        //     model: "claude-sonnet-4-20250514",
        //     max_tokens: 1024,
        //     messages: [{
        //         role: "user",
        //         content: [
        //             { type: "image", source: { type: "base64", media_type: "image/png", data: base64 }},
        //             { type: "text", text: prompt }
        //         ]
        //     }]
        // });
        
        console.log(`[InterfaceAI] Vision AI placeholder`);
        return { 
            success: true, 
            screenshot: base64,
            message: "Implement vision AI call here" 
        };
    }
}

// -------------------- INTERACTIVE MODE --------------------

async function interactive() {
    const readline = require('readline');
    const ai = new InterfaceAI();
    
    await ai.init(false);
    await ai.goto('https://www.google.com');
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log('\n✅ Browser ready! Commands:');
    console.log('  goto <url>           - Navigate to URL');
    console.log('  click <name>         - Click button/link by text');
    console.log('  fill <name> <value>  - Fill input field');
    console.log('  type <text>          - Type text');
    console.log('  enter                - Press Enter');
    console.log('  scroll up/down       - Scroll page');
    console.log('  status               - Get page status');
    console.log('  screenshot           - Take screenshot');
    console.log('  exit                 - Close browser\n');

    const prompt = () => rl.question('> ', async (input) => {
        const [cmd, ...args] = input.trim().split(' ');
        
        try {
            switch (cmd) {
                case 'goto':
                    await ai.goto(args.join(' '));
                    break;
                case 'click':
                    await ai.clickByName(args.join(' '));
                    break;
                case 'fill':
                    const field = args[0];
                    const value = args.slice(1).join(' ');
                    await ai.fillInput(field, value);
                    break;
                case 'type':
                    await ai.type(args.join(' '));
                    break;
                case 'enter':
                    await ai.pressEnter();
                    break;
                case 'scroll':
                    if (args[0] === 'up') await ai.scrollUp();
                    else if (args[0] === 'down') await ai.scrollDown();
                    else if (args[0] === 'top') await ai.scrollToTop();
                    else if (args[0] === 'bottom') await ai.scrollToBottom();
                    break;
                case 'status':
                    const status = await ai.getPageStatus();
                    console.log('\n--- Page Status ---');
                    console.log('Title:', status.title);
                    console.log('URL:', status.url);
                    console.log('Headings:', status.headings.slice(0, 5));
                    console.log('Buttons:', status.buttons.slice(0, 5));
                    console.log('Textboxes:', status.textboxes);
                    console.log('Links:', status.links.slice(0, 5));
                    break;
                case 'screenshot':
                    await ai.screenshot('screenshot.png');
                    break;
                case 'exit':
                case 'quit':
                    await ai.close();
                    rl.close();
                    process.exit(0);
                default:
                    if (cmd) console.log('Unknown command:', cmd);
            }
        } catch (err) {
            console.error('Error:', err.message);
        }
        
        prompt();
    });

    prompt();
}

// Run interactive mode if executed directly
if (require.main === module) {
    interactive();
}

module.exports = InterfaceAI;