import axios from 'axios';

// In-memory cache to store Base64 strings of frequently used images (like logos)
const imageCache = new Map();

/**
 * Helper to sleep/delay execution
 * @param {number} ms - Milliseconds to wait
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetches an image from a URL and converts it to a Base64 string.
 * Implements an in-memory cache and retry logic for 503 SlowDown errors.
 * 
 * @param {string} url - The full URL of the image
 * @param {boolean} useCache - Whether to use the in-memory cache (default: true)
 * @returns {Promise<string|null>} - Base64 string or null if failed
 */
export const getBase64Image = async (url, useCache = true) => {
    if (!url) return null;

    // 1. Check Cache first
    if (useCache && imageCache.has(url)) {
        // console.log(`🚀 Serving from cache: ${url.split('/').pop()}`);
        return imageCache.get(url);
    }

    let attempts = 0;
    const maxAttempts = 3;
    const delayBetweenRetries = 800; // 800ms initial delay

    while (attempts < maxAttempts) {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 8000 // Increased timeout to 8 seconds
            });

            const buffer = Buffer.from(response.data, 'binary');
            const mimeType = response.headers['content-type'] || 'image/png';
            const base64String = `data:${mimeType};base64,${buffer.toString('base64')}`;

            // 2. Save to cache if successful
            if (useCache) {
                // If the cache is getting too large, clear it (simple cleanup)
                if (imageCache.size > 200) imageCache.clear(); 
                imageCache.set(url, base64String);
            }

            return base64String;

        } catch (error) {
            attempts++;
            const isSlowDown = error.response?.status === 503 || error.message.includes('SlowDown');
            
            if (isSlowDown && attempts < maxAttempts) {
                console.warn(`⚠️ E2E SlowDown detected for ${url.split('/').pop()}. Retry ${attempts}/${maxAttempts} in ${delayBetweenRetries * attempts}ms...`);
                await sleep(delayBetweenRetries * attempts); // Exponential backoff: 800ms, 1600ms...
                continue;
            }

            console.error(`❌ Error fetching image for Base64 conversion (${url}):`, error.message);
            return null; // Fail silently so PDF/Process continues
        }
    }

    return null;
};

/**
 * Clears the image cache. Use this when a logo or photo is updated.
 * @param {string|null} url - Specific URL to clear, or null to clear all
 */
export const clearImageCache = (url = null) => {
    if (url) {
        imageCache.delete(url);
    } else {
        imageCache.clear();
    }
};
