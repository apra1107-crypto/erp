import React from 'react';
import { pdf } from '@react-pdf/renderer';
import FeeReceiptPDF from '../components/FeeReceiptPDF';
import { BASE_URL } from '../config';

/**
 * Fetches an image through the server proxy and converts to Base64.
 * This is the ultimate fix for CORS issues in @react-pdf/renderer.
 */
const fetchImageAsBase64 = async (imageUrl) => {
    try {
        const proxyUrl = `${BASE_URL}/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
        console.log("PDF_GEN: Fetching via proxy:", proxyUrl);
        
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Proxy fetch failed");
        
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error("PDF_GEN: Proxy conversion failed:", e);
        return null;
    }
};

/**
 * Generates and downloads a high-quality PDF receipt using @react-pdf/renderer.
 */
export const downloadReceiptPDF = async (data) => {
    const { student, payment, months, institute } = data;
    
    console.log("PDF_GEN: Starting generation process...", { type: data.type, student: student.name });
    
    try {
        if (!student || !payment || !institute) {
            console.error("PDF_GEN: Missing core data", { student: !!student, payment: !!payment, institute: !!institute });
            throw new Error("Missing required data for receipt generation");
        }
        
        let logoUrl = institute.logo_url;
        let base64Logo = null;

        if (logoUrl) {
            // Ensure absolute URL
            if (!logoUrl.startsWith('http')) {
                logoUrl = `${BASE_URL}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`;
            }
            
            console.log("PDF_GEN: Converting logo to base64 via proxy from:", logoUrl);
            base64Logo = await fetchImageAsBase64(logoUrl);
            
            if (base64Logo) {
                console.log("PDF_GEN: Proxy logo conversion successful");
            } else {
                console.warn("PDF_GEN: Proxy failed, using direct URL as fallback");
                base64Logo = logoUrl;
            }
        }

        const enrichedData = {
            ...data,
            institute: {
                ...institute,
                logo_url: base64Logo
            }
        };

        // 2. Minimum delay
        await new Promise(resolve => setTimeout(resolve, 800));

        // 3. Generate the PDF
        console.log("PDF_GEN: Rendering PDF components...");
        const doc = <FeeReceiptPDF data={enrichedData} />;
        
        // 4. Convert to blob
        const blob = await pdf(doc).toBlob();
        
        if (!blob || blob.size < 100) {
            throw new Error("The PDF document could not be generated correctly.");
        }

        console.log("PDF_GEN: Blob ready, size:", (blob.size / 1024).toFixed(2), "KB");

        // 5. Trigger download
        const monthLabel = (payment.month && months) ? months[payment.month - 1] : 'OneTime';
        const fileName = `Receipt_${(student.name || 'Student').replace(/\s+/g, '_')}_${monthLabel}.pdf`;
        const downloadUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);
        }, 100);
        
        console.log("PDF_GEN: Download complete");
        return true;
    } catch (error) {
        console.error('PDF_GEN_FATAL_ERROR:', error);
        throw error;
    }
};