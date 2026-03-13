import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import axios from 'axios';
import { BASE_URL } from '../constants/Config';

interface ReceiptData {
    institute: any;
    student: any;
    payment: any;
    breakage: any[];
    type: 'MONTHLY' | 'ONE-TIME';
    months?: string[];
}

interface Transaction {
    created_at: string;
    payment_method: string;
    collected_by?: string;
    amount: string | number;
}

export const generateReceiptPDF = async (data: ReceiptData) => {
    const { institute, student, payment, breakage, type, months } = data;

    const paidDate = payment?.paid_at ? new Date(payment.paid_at) : new Date();
    const dayName = paidDate.toLocaleDateString('en-IN', { weekday: 'long' });
    const formattedDate = paidDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const formattedTime = paidDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    const totalPayable = breakage.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const safeTransactions = Array.isArray(payment?.transactions) ? payment.transactions : [];

    const logoHtml = institute?.logo_url ? `<img src="${institute.logo_url}" style="width: 60px; height: 60px; object-fit: contain;" />` : '';

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
            body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #1a1a1a; position: relative; }
            .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg); font-size: 120px; font-weight: 900; color: rgba(16, 185, 129, 0.12); pointer-events: none; border: 10px solid rgba(16, 185, 129, 0.12); padding: 10px 40px; border-radius: 20px; z-index: 9999; text-align: center; }
            .header { display: flex; flex-direction: column; align-items: center; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
            .header-main { display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 5px; }
            .inst-name { font-size: 28px; font-weight: 900; text-transform: uppercase; margin: 0; }
            .inst-aff { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; }
            .inst-address { font-size: 10px; color: #475569; margin-top: 8px; max-width: 80%; line-height: 1.4; font-weight: 600; }
            .title-row { margin-bottom: 35px; }
            .title { font-size: 22px; font-weight: 800; letter-spacing: 2px; border-left: 5px solid #6366f1; padding-left: 15px; margin: 0; }
            .details-container { display: flex; flex-direction: column; gap: 20px; margin-bottom: 40px; }
            .detail-section { border-bottom: 1px solid #f1f5f9; padding-bottom: 15px; }
            .section-label { font-size: 10px; font-weight: 800; color: #64748b; margin-bottom: 12px; letter-spacing: 1px; text-transform: uppercase; }
            .details-grid { display: flex; flex-wrap: wrap; gap: 30px; }
            .detail-text { font-size: 13px; color: #475569; margin: 0; }
            .bold { color: #1a1a1a; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            thead th { background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; }
            tbody td { padding: 15px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; }
            .text-right { text-align: right; }
            .t-footer { background-color: #2563eb; color: #ffffff; }
            .t-footer td { padding: 15px; font-size: 14px; font-weight: 800; border: none; }
            .total-val { font-size: 18px; }
            .history-section { margin-top: 40px; background-color: #fafafa; padding: 25px; border-radius: 12px; border: 1px solid #eeeeee; }
            .history-label { font-size: 11px; font-weight: 900; color: #1e293b; margin-bottom: 15px; letter-spacing: 1px; border-bottom: 2px solid #6366f1; display: inline-block; padding-bottom: 4px; }
            .history-table { width: 100%; border-collapse: collapse; }
            .history-table th { text-align: left; font-size: 10px; color: #64748b; padding: 10px; border-bottom: 1px solid #e2e8f0; }
            .history-table td { padding: 12px 10px; font-size: 12px; border-bottom: 1px solid #f1f5f9; }
            .footer-area { margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end; }
            .payment-meta { font-size: 12px; color: #475569; }
            .payment-meta p { margin: 5px 0; }
            .tx-id { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-weight: 700; }
            .footer-note { text-align: right; }
            .comp-gen { font-size: 10px; font-weight: 600; color: #94a3b8; margin-bottom: 12px; }
            .thank-you { font-size: 16px; font-weight: 800; font-style: italic; color: #1a1a1a; }
        </style>
    </head>
    <body>
        <div class="watermark">PAID</div>
        
        <div class="header">
            <div class="header-main">
                ${logoHtml}
                <h1 class="inst-name">${institute?.institute_name || 'Institute'}</h1>
            </div>
            ${institute?.affiliation ? `<div class="inst-aff">${institute.affiliation}</div>` : ''}
            <div class="inst-address">
                ${institute?.address || ''}${institute?.landmark ? `, ${institute.landmark}` : ''}, ${institute?.district || ''}, ${institute?.state || ''} - ${institute?.pincode || ''}
            </div>
        </div>

        <div class="title-row">
            <div class="title">FEE RECEIPT</div>
        </div>

        <div class="details-container">
            ${type === 'MONTHLY' ? `
            <div class="detail-section">
                <div class="section-label">PAYMENT DETAILS</div>
                <div class="details-grid">
                    <div class="detail-text">Billing Month: <span class="bold">${months && months[(payment?.month || 1) - 1]} ${payment?.year}</span></div>
                    <div class="detail-text">Payment Date: <span class="bold">${formattedDate}</span></div>
                    <div class="detail-text">Day: <span class="bold">${dayName}</span></div>
                    <div class="detail-text">Time: <span class="bold">${formattedTime}</span></div>
                    <div class="detail-text">Collected By: <span class="bold">${payment?.collected_by || 'Staff'}</span></div>
                </div>
            </div>
            ` : ''}

            <div class="detail-section">
                <div class="section-label">STUDENT DETAILS</div>
                <div class="details-grid">
                    <div class="detail-text">Name: <span class="bold">${student?.name}</span></div>
                    <div class="detail-text">Class: <span class="bold">${student?.class}-${student?.section}</span></div>
                    <div class="detail-text">Roll No: <span class="bold">${student?.roll_no}</span></div>
                </div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Description</th>
                    <th class="text-right">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${breakage.map(item => `
                <tr>
                    <td>${item.reason || item.label}</td>
                    <td class="text-right">₹${parseFloat(item.amount || 0).toLocaleString()}</td>
                </tr>
                `).join('')}
                <tr class="t-footer">
                    <td>TOTAL PAYABLE</td>
                    <td class="text-right total-val">₹${totalPayable.toLocaleString()}</td>
                </tr>
            </tbody>
        </table>

        ${type === 'ONE-TIME' && safeTransactions.length > 0 ? `
        <div class="history-section">
            <div class="history-label">PAYMENT BREAKDOWN (TRANSACTIONS)</div>
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Date & Day</th>
                        <th>Method</th>
                        <th>Collected By</th>
                        <th class="text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${safeTransactions.map((t: Transaction) => {
                        const tDate = new Date(t.created_at);
                        return `
                        <tr>
                            <td>
                                <div class="bold">${tDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                <div style="font-size: 9px; color: #64748b;">${tDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                            </td>
                            <td>${t.payment_method}</td>
                            <td><span class="bold">${t.collected_by || 'Admin'}</span></td>
                            <td class="text-right bold">₹${parseFloat(t.amount || 0).toLocaleString()}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <th colspan="3" style="padding-top: 15px; font-size: 12px; color: #1a1a1a;">TOTAL COLLECTED</th>
                        <th class="text-right" style="padding-top: 15px; font-size: 14px; color: #1a1a1a;">₹${safeTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0).toLocaleString()}</th>
                    </tr>
                </tfoot>
            </table>
        </div>
        ` : ''}

        <div class="footer-area">
            <div class="payment-meta">
                ${type === 'MONTHLY' ? `
                    <p>Payment Method: <span class="bold">${payment?.payment_method === 'Cash' ? 'Cash' : `Online (${payment?.payment_method})`}</span></p>
                    ${payment?.transaction_id ? `<p>Transaction ID: <span class="tx-id">${payment.transaction_id}</span></p>` : ''}
                ` : ''}
            </div>
            <div class="footer-note">
                <div class="comp-gen">This is a computer-generated receipt.</div>
                <div class="thank-you">Thank you for your payment!</div>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        const { uri } = await Print.printToFileAsync({ html: htmlContent });
        
        if (Platform.OS === 'ios') {
            await Sharing.shareAsync(uri);
        } else {
            // On Android, Sharing works well too and allows saving to drive/local storage
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        }
    } catch (error) {
        console.error('Receipt Generation Error:', error);
        throw error;
    }
};
