import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Sends a WhatsApp Message using a pre-approved Meta Template.
 * 
 * @param {string} to - Recipient's phone number with country code (e.g., '919876543210')
 * @param {string} templateName - The name of the template approved in Meta Dashboard
 * @param {Array} components - Array of variables for the template
 * @returns {Promise<Object>} - Response from Meta API
 */
export const sendWhatsAppMessage = async (to, templateName, components = []) => {
    try {
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';

        if (!accessToken || !phoneNumberId) {
            console.error('[WhatsApp] Missing API Configuration in .env');
            return { success: false, error: 'WhatsApp API not configured' };
        }

        // Remove any '+' or spaces from the phone number
        let formattedTo = to.replace(/\D/g, '');

        // If it is a 10-digit number (common in India), prepend the '91' country code
        if (formattedTo.length === 10) {
            formattedTo = '91' + formattedTo;
        }

        const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

        const payload = {
            messaging_product: "whatsapp",
            to: formattedTo,
            type: "template",
            template: {
                name: templateName,
                language: {
                    code: "en_US"
                },
                components: [
                    {
                        type: "body",
                        parameters: components.map(val => ({
                            type: "text",
                            text: String(val)
                        }))
                    }
                ]
            }
        };

        console.log(`[WhatsApp] Sending ${templateName} to ${formattedTo}...`);

        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`[WhatsApp] Success! Message ID: ${response.data.messages[0].id}`);
        return { success: true, data: response.data };

    } catch (error) {
        const errorData = error.response?.data || error.message;
        console.error('[WhatsApp] API Error:', JSON.stringify(errorData, null, 2));
        return { success: false, error: errorData };
    }
};
