import { EOS_BUCKET_URL } from '../constants/Config';

export const getFullImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    
    // Ensure no double slashes
    const cleanBucketUrl = EOS_BUCKET_URL.endsWith('/') 
        ? EOS_BUCKET_URL.slice(0, -1) 
        : EOS_BUCKET_URL;
        
    const cleanPath = url.startsWith('/') ? url.slice(1) : url;
    
    return `${cleanBucketUrl}/${cleanPath}`;
};
