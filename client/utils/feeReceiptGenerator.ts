import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export const getFeeReceiptHTML = (feeData: any, institute: any, student: any) => {
    if (!institute || !student) return '<html><body><h1>Error: Missing Info</h1></body></html>';

    const isMonthly = feeData.fee_type === 'monthly' || !!feeData.breakdown;
    
    // Safely parse breakdown if it comes as a string
    let breakdown = feeData.breakdown;
    if (typeof breakdown === 'string') {
        try { breakdown = JSON.parse(breakdown); } catch (e) { breakdown = {}; }
    }

    const items = isMonthly 
        ? (breakdown ? Object.entries(breakdown) : [])
        : (feeData.items || '').split(' + ').map((name: string, i: number) => [name, (feeData.amount_breakdown || '').split(' + ')[i] || '0']);

    const fullAddress = [
        institute.address,
        institute.landmark,
        institute.district,
        institute.state,
        institute.pincode
    ].filter(Boolean).join(', ');

    const paymentDate = feeData.paid_at ? new Date(feeData.paid_at).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');
    const totalAmount = parseFloat(feeData.total_amount || '0');

    return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
          
          .header-container { display: flex; flex-direction: row; align-items: center; justify-content: center; margin-bottom: 5px; }
          .logo { width: 60px; height: 60px; margin-right: 15px; border-radius: 8px; margin-top: -10px; }
          .institute-info { text-align: center; }
          
          .institute-name { font-size: 26px; font-weight: 900; color: #1A237E; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
          .affiliation-text { font-size: 11px; color: #555; margin: 2px 0; font-weight: 600; }
          .address-text { font-size: 11px; color: #666; margin: 2px 0; }
          
          .divider { height: 2px; background-color: #4A90E2; margin: 15px 0; }
          .receipt-title { font-size: 18px; font-weight: bold; text-align: center; margin: 15px 0; text-transform: uppercase; background: #f5f5f5; padding: 8px; border-radius: 4px; }
          
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; border-bottom: 1px dashed #eee; padding-bottom: 4px; }
          .label { font-weight: bold; color: #444; }
          
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 10px; text-align: left; font-size: 13px; text-transform: uppercase; }
          td { border: 1px solid #dee2e6; padding: 10px; font-size: 13px; }
          .total-row { font-weight: bold; font-size: 15px; background-color: #f8f9fa; color: #1A237E; }
          
          .amount-words { font-size: 13px; margin-top: 15px; padding: 10px; background: #FFFDE7; border-radius: 4px; font-style: italic; }
          .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 15px; }
          
          .signature-section { margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end; }
          .sig-box { text-align: center; width: 150px; }
          .sig-line { border-top: 1px solid #333; margin-bottom: 5px; }
          .sig-label { font-size: 12px; font-weight: bold; }
          
          .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 120px; color: rgba(0, 200, 83, 0.15); font-weight: 900; z-index: 9999; pointer-events: none; text-transform: uppercase; border: 15px solid rgba(0, 200, 83, 0.15); padding: 20px; border-radius: 20px; }
        </style>
      </head>
      <body>
        <div class="watermark">PAID</div>
        
        <div class="header-container">
          ${institute?.logo_url ? `<img src="${institute.logo_url}" class="logo" />` : ''}
          <div class="institute-info">
            <h1 class="institute-name">${institute?.institute_name || 'INSTITUTE'}</h1>
            ${institute?.affiliation ? `<p class="affiliation-text">${institute.affiliation}</p>` : ''}
            <p class="address-text">${fullAddress}</p>
          </div>
        </div>

        <div class="divider"></div>

        <div class="receipt-title">Fee Payment Receipt</div>

        <div class="info-grid">
          <div>
            <div class="info-row"><span class="label">Receipt No:</span> <span>${feeData.payment_id || 'N/A'}</span></div>
            <div class="info-row"><span class="label">Date:</span> <span>${paymentDate}</span></div>
            <div class="info-row"><span class="label">Month:</span> <span>${feeData.month_year || 'N/A'}</span></div>
          </div>
          <div>
            <div class="info-row"><span class="label">Student:</span> <span>${student.name}</span></div>
            <div class="info-row"><span class="label">Class:</span> <span>${student.class} - ${student.section}</span></div>
            <div class="info-row"><span class="label">Roll No:</span> <span>${student.roll_no}</span></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: right;">Amount (INR)</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(([name, amt]: [string, string]) => `
              <tr>
                <td>${name}</td>
                <td style="text-align: right;">${parseFloat(amt as string || '0').toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td>Grand Total</td>
              <td style="text-align: right;">₹${totalAmount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="amount-words">
          <span class="label">In Words:</span> Indian Rupees ${numberToWords(totalAmount)} Only
        </div>

        <div style="margin-top: 15px; font-size: 13px;">
          <p><span class="label">Payment Mode:</span> ${feeData.payment_id?.startsWith('COUNTER_') ? 'Counter Cash / Manual' : 'Online / Digital'}</p>
          <p><span class="label">Collected By:</span> ${feeData.payment_id?.startsWith('COUNTER_') ? (feeData.collected_by || 'Institute Office') : 'System / Online'}</p>
        </div>

        <div class="signature-section">
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Student/Parent</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-label">Authorized Office</div>
          </div>
        </div>

        <div class="footer">
          <p>This is a computer-generated document. No physical signature is required.</p>
          <p>Contact: ${institute.mobile || ''} | Email: ${institute.email || ''}</p>
        </div>
      </body>
    </html>
    `;
};

let isPrinting = false;

export const generateFeeReceipt = async (feeData: any, institute: any, student: any) => {
    if (isPrinting) return;
    isPrinting = true;
    const html = getFeeReceiptHTML(feeData, institute, student);

    try {
        const { uri } = await Print.printToFileAsync({ html });
        if (Platform.OS === 'ios') {
            await Sharing.shareAsync(uri);
        } else {
            await Sharing.shareAsync(uri, {
                mimeType: 'application/pdf',
                dialogTitle: 'Fee Receipt',
                UTI: 'com.adobe.pdf'
            });
        }
    } catch (error) {
        console.error('Error generating receipt:', error);
        throw error;
    } finally {
        isPrinting = false;
    }
};

export const previewFeeReceipt = async (feeData: any, institute: any, student: any) => {
    if (isPrinting) return;
    isPrinting = true;
    
    try {
        const html = getFeeReceiptHTML(feeData, institute, student);
        
        if (Platform.OS === 'android') {
            await new Promise(resolve => setTimeout(resolve, 150));
        }
        
        await Print.printAsync({ html });
    } catch (error) {
        console.error('Error previewing receipt:', error);
        throw error;
    } finally {
        isPrinting = false;
    }
};

function numberToWords(num: number): string {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if (!num || isNaN(num)) return 'Zero';
    
    const floorNum = Math.floor(num);
    if (floorNum.toString().length > 9) return 'Amount too large';
    
    let n = ('000000000' + floorNum).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return ''; 
    let str = '';
    str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';
    str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';
    str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';
    str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';
    str += (Number(n[5]) != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) : '';
    return str.trim() || 'Zero';
}