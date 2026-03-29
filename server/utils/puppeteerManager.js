import puppeteer from 'puppeteer';

let browser = null;

export const getBrowser = async () => {
    if (browser && browser.connected) {
        return browser;
    }

    console.log('🚀 Launching Persistent Puppeteer Browser...');
    browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--font-render-hinting=none'
        ]
    });

    browser.on('disconnected', () => {
        console.log('⚠️ Puppeteer Browser disconnected. Re-launching...');
        browser = null;
    });

    return browser;
};

export const closeBrowser = async () => {
    if (browser) {
        await browser.close();
        browser = null;
    }
};
