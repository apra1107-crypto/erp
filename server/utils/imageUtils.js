import axios from 'axios';

export const getBase64Image = async (url) => {
    if (!url) return null;
    try {
        const response = await axios.get(url, { 
            responseType: 'arraybuffer',
            timeout: 3000 // 3 seconds max per image
        });
        const buffer = Buffer.from(response.data, 'binary');
        const mimeType = response.headers['content-type'] || 'image/png';
        return `data:${mimeType};base64,${buffer.toString('base64')}`;
    } catch (error) {
        console.error(`❌ Error fetching image for Base64 conversion (${url}):`, error.message);
        return null; // Silent fail, PDF will show placeholder
    }
};
