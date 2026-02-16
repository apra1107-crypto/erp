import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

interface IDCardData {
    student: {
        name: string;
        class: string;
        section: string;
        roll_no: string;
        mobile: string;
        email: string;
        father_name: string;
        mother_name: string;
        address: string;
        photo_url?: string;
    };
    institute: {
        name: string;
        address: string;
        logo_url?: string;
    };
}

export const generateIDCardHTML = (data: IDCardData, template: 'classic' | 'modern' | 'elegant' | 'professional' | 'landscape' = 'classic') => {
    const { student, institute } = data;
    const photo = student.photo_url || 'https://via.placeholder.com/150';
    const logo = institute.logo_url || 'https://via.placeholder.com/150';

    // CSS VARIABLES FOR TEMPLATES
    let styles = `
        /* COMMON */
        body { font-family: 'Roboto', sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; display: flex; justify-content: center; align-items: flex-start; }
        .card { width: 350px; height: 550px; background: #fff; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); overflow: hidden; position: relative; border: 1px solid #e0e0e0; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: left; margin-bottom: 20px; width: 100%; }
        .info-item { font-size: 12px; }
        .label { color: #757575; font-size: 10px; text-transform: uppercase; font-weight: 500; margin-bottom: 2px; }
        .value { color: #333; font-weight: 600; }
        .full-width { grid-column: span 2; }
    `;

    // TEMPLATE SPECIFIC STYLES
    if (template === 'landscape') {
        styles += `
            .card { width: 550px; height: 350px; display: flex; flex-direction: row; }
            .land-left { width: 180px; background: #f0f4f8; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 15px; border-right: 1px solid #eee; }
            .land-right { flex: 1; padding: 20px; position: relative; }
            .photo { width: 100px; height: 100px; border-radius: 50%; border: 3px solid #fff; margin-bottom: 10px; object-fit: cover; }
            .student-name { font-size: 16px; font-weight: 700; color: #333; text-align: center; }
            .class-info { font-size: 12px; color: #666; font-weight: 600; margin-bottom: 5px; }
            .roll-no { font-size: 10px; color: #888; }
            
            .header { display: flex; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 15px; }
            .logo { width: 40px; height: 40px; object-fit: contain; margin-right: 10px; }
            .inst-name { font-size: 16px; font-weight: 700; color: #1e3c72; text-transform: uppercase; }
            .inst-addr { font-size: 10px; color: #666; }
            
            .land-grid { display: grid; grid-template-columns: 1fr; gap: 8px; font-size: 11px; }
            .land-row { display: flex; }
            .land-label { width: 60px; font-weight: 700; color: #888; }
            .land-value { flex: 1; color: #333; font-weight: 600; }
            
            .footer { position: absolute; bottom: 10px; right: 20px; font-size: 10px; color: #aaa; letter-spacing: 1px; text-transform: uppercase; }
        `;
    } else if (template === 'classic') {
        styles += `
            .header { background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); height: 120px; border-bottom-left-radius: 50% 20px; border-bottom-right-radius: 50% 20px; position: relative; display: flex; flex-direction: column; align-items: center; padding-top: 20px; color: white; }
            .logo-container { width: 60px; height: 60px; background: white; border-radius: 50%; display: flex; justify-content: center; align-items: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 10px; }
            .logo { width: 50px; height: 50px; object-fit: contain; }
            .inst-name { font-weight: 700; font-size: 16px; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; padding: 0 20px; }
            .inst-addr { font-size: 10px; opacity: 0.8; text-align: center; }
            .photo-wrapper { width: 120px; height: 120px; background: white; border-radius: 50%; position: absolute; top: 90px; left: 50%; transform: translateX(-50%); padding: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); }
            .photo { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 2px solid #2a5298; }
            .content { margin-top: 100px; padding: 0 30px; text-align: center; }
            .student-name { font-size: 22px; font-weight: 700; color: #333; margin-bottom: 5px; text-transform: uppercase; }
            .designation { font-size: 14px; color: #1e3c72; font-weight: 500; background: #e8eaf6; display: inline-block; padding: 4px 12px; border-radius: 12px; margin-bottom: 20px; }
            .footer { background: #f1f1f1; height: 40px; position: absolute; bottom: 0; width: 100%; display: flex; justify-content: center; align-items: center; border-top: 1px solid #ddd; }
            .footer-text { color: #555; font-size: 10px; font-weight: 600; }
        `;
    } else if (template === 'modern') {
        styles += `
            .card { display: flex; flex-direction: row; }
            .sidebar { width: 20px; height: 100%; background: #E91E63; }
            .main { flex: 1; padding: 20px; display: flex; flex-direction: column; }
            .header { display: flex; flex-direction: row; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 15px; margin-bottom: 20px; }
            .logo { width: 40px; height: 40px; object-fit: contain; margin-right: 15px; }
            .inst-info { flex: 1; }
            .inst-name { font-size: 14px; font-weight: 700; color: #333; text-transform: uppercase; }
            .inst-addr { font-size: 10px; color: #888; }
            .photo-row { display: flex; align-items: center; margin-bottom: 30px; }
            .photo { width: 90px; height: 90px; border-radius: 10px; object-fit: cover; border: 2px solid #ddd; margin-right: 20px; }
            .student-name { font-size: 20px; font-weight: 700; color: #E91E63; margin-bottom: 5px; }
            .class-info { font-size: 12px; font-weight: 600; color: #555; }
            .modern-info .info-item { border-left: 3px solid #E91E63; padding-left: 10px; margin-bottom: 10px; }
            .modern-label { font-size: 9px; color: #aaa; font-weight: 600; text-transform: uppercase; }
            .modern-value { font-size: 12px; font-weight: 600; color: #333; }
            .footer { position: absolute; bottom: 0; left: 20px; right: 0; height: 30px; background: #E91E63; display: flex; justify-content: center; align-items: center; color: white; font-size: 9px; }
        `;
    } else if (template === 'elegant') {
        styles += `
            .card { background: #fffcf5; padding: 15px; box-sizing: border-box; }
            .border-box { width: 100%; height: 100%; border: 2px solid #d4af37; border-radius: 15px; display: flex; flex-direction: column; align-items: center; padding: 20px; box-sizing: border-box; position: relative; }
            .logo { width: 50px; height: 50px; object-fit: contain; margin-bottom: 10px; }
            .inst-name { font-family: serif; font-size: 18px; font-weight: 700; color: #333; text-align: center; margin-bottom: 5px; }
            .inst-addr { font-size: 10px; text-align: center; color: #666; margin-bottom: 10px; }
            .divider { width: 60px; height: 2px; background: #d4af37; margin-bottom: 20px; }
            .photo { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid #d4af37; margin-bottom: 15px; }
            .student-name { font-family: serif; font-size: 22px; font-weight: 700; color: #333; margin-bottom: 5px; }
            .class-info { font-style: italic; color: #666; font-size: 14px; margin-bottom: 30px; }
            .elegant-info { text-align: center; line-height: 1.6; color: #444; font-family: serif; font-size: 12px; }
            .footer { position: absolute; bottom: 15px; width: 100%; text-align: center; color: #888; font-size: 10px; }
        `;
    } else if (template === 'professional') {
        // LIGHT THEME NOW
        styles += `
            .card { background: #F5F5F7; color: #333; }
            .header { background: #fff; padding: 20px; display: flex; align-items: center; border-bottom: 1px solid #e0e0e0; height: 40px; }
            .logo { width: 40px; height: 40px; border-radius: 5px; margin-right: 15px; object-fit: contain; }
            .inst-name { color: #333; font-size: 16px; font-weight: 700; text-transform: uppercase; }
            .inst-addr { color: #666; font-size: 10px; margin-top: 2px; }
            .body { padding: 30px 20px; position: relative; text-align: center; }
            .photo { width: 110px; height: 110px; border-radius: 10px; border: 1px solid #ccc; object-fit: cover; background: #fff; margin-top: 10px; margin-bottom: 20px; }
            .student-name { font-size: 24px; font-weight: 700; color: #333; text-transform: uppercase; margin-bottom: 5px; }
            .class-info { color: #555; font-size: 14px; font-weight: 600; margin-bottom: 40px; }
            .pro-row { display: flex; justify-content: space-between; border-bottom: 1px solid #e0e0e0; padding-bottom: 5px; margin-bottom: 10px; }
            .pro-label { color: #888; font-size: 10px; font-weight: 700; }
            .pro-value { color: #333; font-size: 12px; font-weight: 600; }
            .footer { background: #333; height: 15px; width: 100%; position: absolute; bottom: 0; }
        `;
    }

    // HTML STRUCTURE BUILDER
    let htmlContent = '';

    if (template === 'landscape') {
        htmlContent = `
            <div class="card">
                <div class="land-left">
                    <img src="${photo}" class="photo" />
                    <div class="student-name">${student.name}</div>
                    <div class="class-info">Class ${student.class} - ${student.section}</div>
                    <div class="roll-no">Roll: ${student.roll_no}</div>
                </div>
                <div class="land-right">
                    <div class="header">
                        <img src="${logo}" class="logo" />
                        <div>
                            <div class="inst-name">${institute.name}</div>
                            <div class="inst-addr">${institute.address}</div>
                        </div>
                    </div>
                    <div class="land-grid">
                        <div class="land-row"><div class="land-label">Father:</div><div class="land-value">${student.father_name}</div></div>
                        <div class="land-row"><div class="land-label">Contact:</div><div class="land-value">${student.mobile}</div></div>
                        <div class="land-row"><div class="land-label">Email:</div><div class="land-value">${student.email}</div></div>
                        <div class="land-row"><div class="land-label">Address:</div><div class="land-value">${student.address}</div></div>
                    </div>
                    <div class="footer">Identity Card</div>
                </div>
            </div>
        `;
    } else if (template === 'classic') {
        htmlContent = `
            <div class="card">
                <div class="header">
                    <div class="logo-container"><img src="${logo}" class="logo" /></div>
                    <div class="inst-name">${institute.name}</div>
                    <div class="inst-addr">${institute.address}</div>
                </div>
                <div class="photo-wrapper"><img src="${photo}" class="photo" /></div>
                <div class="content">
                    <div class="student-name">${student.name}</div>
                    <div class="designation">Class ${student.class} - ${student.section}</div>
                    <div class="info-grid">
                        <div class="info-item"><div class="label">Roll No</div><div class="value">${student.roll_no}</div></div>
                        <div class="info-item"><div class="label">Mobile</div><div class="value">${student.mobile}</div></div>
                        <div class="info-item"><div class="label">Father</div><div class="value">${student.father_name}</div></div>
                        <div class="info-item"><div class="label">Email</div><div class="value">${student.email}</div></div>
                        <div class="info-item full-width"><div class="label">Address</div><div class="value">${student.address}</div></div>
                    </div>
                </div>
                 <div class="footer"><div class="footer-text">${institute.address}</div></div>
            </div>
        `;
    } else if (template === 'modern') {
        htmlContent = `
            <div class="card">
                <div class="sidebar"></div>
                <div class="main">
                    <div class="header">
                        <img src="${logo}" class="logo" />
                        <div class="inst-info">
                            <div class="inst-name">${institute.name}</div>
                            <div class="inst-addr">${institute.address}</div>
                        </div>
                    </div>
                    <div class="photo-row">
                        <img src="${photo}" class="photo" />
                        <div>
                            <div class="student-name">${student.name}</div>
                            <div class="class-info">Class ${student.class} - ${student.section}</div>
                        </div>
                    </div>
                    <div class="info-grid modern-info">
                        <div class="info-item"><div class="modern-label">Roll No</div><div class="modern-value">${student.roll_no}</div></div>
                        <div class="info-item"><div class="modern-label">Mobile</div><div class="modern-value">${student.mobile}</div></div>
                        <div class="info-item full-width"><div class="modern-label">Email</div><div class="modern-value">${student.email}</div></div>
                        <div class="info-item"><div class="modern-label">Father</div><div class="modern-value">${student.father_name}</div></div>
                         <div class="info-item"><div class="modern-label">Mother</div><div class="modern-value">${student.mother_name}</div></div>
                         <div class="info-item full-width"><div class="modern-label">Address</div><div class="modern-value">${student.address}</div></div>
                    </div>
                    <div class="footer">${institute.address}</div>
                </div>
            </div>
        `;
    } else if (template === 'elegant') {
        htmlContent = `
            <div class="card">
                <div class="border-box">
                    <img src="${logo}" class="logo" />
                    <div class="inst-name">${institute.name}</div>
                    <div class="inst-addr">${institute.address}</div>
                    <div class="divider"></div>
                    <img src="${photo}" class="photo" />
                    <div class="student-name">${student.name}</div>
                    <div class="class-info">Student | Class ${student.class} - ${student.section}</div>
                    <div class="elegant-info">
                        <div>Roll No: ${student.roll_no}</div>
                        <div>Contact: ${student.mobile}</div>
                        <div>Email: ${student.email}</div>
                        <div style="margin-top:5px">Addr: ${student.address}</div>
                    </div>
                    <div class="footer">${institute.address}</div>
                </div>
            </div>
        `;
    } else if (template === 'professional') {
        htmlContent = `
            <div class="card">
                <div class="header">
                    <img src="${logo}" class="logo" />
                    <div>
                        <div class="inst-name">${institute.name}</div>
                        <div class="inst-addr">${institute.address}</div>
                    </div>
                </div>
                <div class="body">
                    <img src="${photo}" class="photo" />
                    <div class="student-name">${student.name}</div>
                    <div class="class-info">CLASS ${student.class} - ${student.section}</div>
                    <div style="width: 100%; margin-top: 20px;">
                        <div class="pro-row"><div class="pro-label">ID NO</div><div class="pro-value">${student.roll_no}</div></div>
                        <div class="pro-row"><div class="pro-label">PHONE</div><div class="pro-value">${student.mobile}</div></div>
                        <div class="pro-row"><div class="pro-label">EMAIL</div><div class="pro-value">${student.email}</div></div>
                        <div class="pro-row"><div class="pro-label">ADDRESS</div><div class="pro-value">${student.address}</div></div>
                    </div>
                </div>
                 <div class="footer"></div>
            </div>
        `;
    }

    return `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
        ${styles}
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>
    `;
};

export const generateAndShareIDCard = async (data: IDCardData, template: 'classic' | 'modern' | 'elegant' | 'professional' | 'landscape' = 'classic') => {
    try {
        const html = generateIDCardHTML(data, template);
        const { uri } = await Print.printToFileAsync({
            html,
            base64: false
        });

        await Sharing.shareAsync(uri, {
            UTI: '.pdf',
            mimeType: 'application/pdf',
            dialogTitle: `Share ID Card - ${data.student.name}`
        });
    } catch (error) {
        console.error('Error generating ID card:', error);
        throw error;
    }
};
