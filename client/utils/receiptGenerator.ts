import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_ENDPOINTS } from '../constants/Config';

interface ReceiptData {
    student: any;
    payment: any;
    breakage: any[];
    type: 'MONTHLY' | 'ONE-TIME';
    months?: string[];
    institute?: any;
}

export const generateReceiptPDF = async (data: ReceiptData) => {
    try {
        const teacherToken = await AsyncStorage.getItem('teacherToken');
        const principalToken = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
        const studentToken = await AsyncStorage.getItem('studentToken');
        
        // Determine endpoint and token based on active session
        let token = teacherToken || principalToken || studentToken;
        let baseEndpoint = '';
        
        if (teacherToken) {
            baseEndpoint = API_ENDPOINTS.TEACHER;
        } else if (principalToken) {
            baseEndpoint = API_ENDPOINTS.PRINCIPAL;
        } else if (studentToken) {
            baseEndpoint = API_ENDPOINTS.AUTH.STUDENT;
        }

        const targetUrl = `${baseEndpoint}/generate-fee-receipt`;

        // Prepare data for backend
        const payload = {
            studentId: data.student.id,
            type: data.type,
            paymentData: data.payment,
            breakage: data.breakage
        };

        const response = await axios.post(
            targetUrl,
            payload,
            {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Accept': 'application/pdf',
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer',
                timeout: 120000 // Increase to 2 minutes for slow PDF generation
            }
        );

        // Efficient ArrayBuffer to Base64 conversion
        const arrayBuffer = response.data;
        const bytes = new Uint8Array(arrayBuffer);
        const len = bytes.byteLength;
        const chunkSize = 16 * 1024;
        let base64 = '';

        for (let i = 0; i < len; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
            base64 += String.fromCharCode.apply(null, Array.from(chunk));
        }
        
        const base64data = btoa(base64);
        const fileName = `receipt_${data.type}_${data.student.id}_${Date.now()}.pdf`;
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

        await FileSystem.writeAsStringAsync(fileUri, base64data, {
            encoding: 'base64',
        });

        await Sharing.shareAsync(fileUri, {
            UTI: '.pdf',
            mimeType: 'application/pdf',
            dialogTitle: 'Fee Receipt'
        });

    } catch (error: any) {
        console.error('❌ Receipt Download Error:', error.message);
        if (error.response) {
            // If the server returned an error, the data is still an ArrayBuffer
            try {
                const text = new TextDecoder().decode(error.response.data);
                console.error('Server Error Data:', text);
            } catch (e) {
                console.error('Could not decode error data');
            }
            console.error('Status:', error.response.status);
        } else if (error.request) {
            console.error('No response received. Target was:', targetUrl);
        }
        throw error;
    }
};
