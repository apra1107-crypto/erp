import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import nodemailer from 'nodemailer';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer, Font } from '@react-pdf/renderer';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Generate base62 unique code
const generateUniqueCode = () => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let code = '';
  const randomBytes = crypto.randomBytes(6);

  for (let i = 0; i < 6; i++) {
    code += chars[randomBytes[i] % chars.length];
  }

  return code;
};

// Upload image to S3
const uploadToS3 = async (fileBuffer, fileName, mimetype, folder = 'others') => {
  // folder can be: 'students', 'teachers', 'logos', or 'others'
  const key = `${folder}/${Date.now()}-${fileName}`;

  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: mimetype,
  };

  try {
    const command = new PutObjectCommand(params);
    await s3Client.send(command);
    const photoUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    console.log('✅ Image uploaded to S3:', photoUrl);
    return photoUrl;
  } catch (error) {
    console.error('❌ Error uploading to S3:', error);
    throw error;
  }
};

// Delete image from S3
const deleteFromS3 = async (fileUrl) => {
  if (!fileUrl) return;

  try {
    // Extract key from URL
    // URL format: https://BUCKET.s3.REGION.amazonaws.com/KEY
    const bucketUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
    const key = fileUrl.replace(bucketUrl, '');

    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
    };

    const command = new DeleteObjectCommand(params);
    await s3Client.send(command);
    console.log('✅ Image deleted from S3:', key);
  } catch (error) {
    console.error('❌ Error deleting from S3:', error);
    // Don't throw error to prevent blocking main flow (logging is enough)
  }
};

const sendWelcomeEmail = async (email, instituteName, principalName) => {
  const params = {
    Source: process.env.SES_FROM_EMAIL,
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Subject: {
        Data: `Welcome to School ERP - ${instituteName}`,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #4A90E2; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                .button { background-color: #4A90E2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Welcome to School ERP!</h1>
                </div>
                <div class="content">
                  <h2>Hello ${principalName},</h2>
                  <p>Congratulations! Your institute <strong>${instituteName}</strong> has been successfully registered with our School ERP Management System.</p>
                  
                  <p>You can now:</p>
                  <ul>
                    <li>Manage your institute dashboard</li>
                    <li>Add teachers and students</li>
                    <li>Track attendance and performance</li>
                    <li>Generate reports and analytics</li>
                  </ul>
                  
                  <p>Login to your dashboard using the email address: <strong>${email}</strong></p>
                  
                  <p>If you have any questions or need assistance, feel free to reach out to our support team.</p>
                  
                  <p>Best regards,<br>School ERP Team</p>
                </div>
                <div class="footer">
                  <p>&copy; 2026 School ERP. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `,
          Charset: 'UTF-8',
        },
      },
    },
  };

  try {
    const command = new SendEmailCommand(params);
    const response = await sesClient.send(command);
    console.log('✅ Welcome email sent successfully:', response.MessageId);
    return { success: true, messageId: response.MessageId };
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
};

// Send student credentials email
const sendStudentCredentials = async (email, studentName, uniqueCode, instituteName, studentDetails) => {
  const params = {
    Source: process.env.SES_FROM_EMAIL,
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Subject: {
        Data: `Student Registration Successful - ${instituteName}`,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #27AE60; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
                .code-box { background-color: #fff; border: 2px solid #27AE60; padding: 20px; margin: 20px 0; text-align: center; border-radius: 5px; }
                .code { font-size: 32px; font-weight: bold; color: #27AE60; letter-spacing: 3px; }
                .details { background-color: #fff; padding: 15px; margin: 15px 0; border-left: 4px solid #27AE60; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Student Registration Successful!</h1>
                </div>
                <div class="content">
                  <h2>Dear Parent/Guardian,</h2>
                  <p>We are pleased to inform you that <strong>${studentName}</strong> has been successfully registered at <strong>${instituteName}</strong>.</p>
                  
                  <div class="code-box">
                    <p style="margin: 0; font-size: 14px; color: #666;">Student Unique Code</p>
                    <div class="code">${uniqueCode}</div>
                    <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">Please keep this code safe for future reference</p>
                  </div>
                  
                  <h3>Student Details:</h3>
                  <div class="details">
                    <p><strong>Name:</strong> ${studentDetails.name}</p>
                    <p><strong>Class:</strong> ${studentDetails.class} - ${studentDetails.section}</p>
                    <p><strong>Roll No:</strong> ${studentDetails.roll_no}</p>
                    <p><strong>Date of Birth:</strong> ${studentDetails.dob}</p>
                    <p><strong>Father's Name:</strong> ${studentDetails.father_name}</p>
                    <p><strong>Mother's Name:</strong> ${studentDetails.mother_name}</p>
                    <p><strong>Mobile:</strong> ${studentDetails.mobile}</p>
                    <p><strong>Transport Facility:</strong> ${studentDetails.transport_facility ? 'Yes' : 'No'}</p>
                  </div>
                  
                  <p>For any queries, please contact the school administration.</p>
                  
                  <p>Best regards,<br>${instituteName}</p>
                </div>
                <div class="footer">
                  <p>&copy; 2026 School ERP. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `,
          Charset: 'UTF-8',
        },
      },
    },
  };

  try {
    const command = new SendEmailCommand(params);
    const response = await sesClient.send(command);
    console.log('✅ Student credentials email sent:', response.MessageId);
    return { success: true, messageId: response.MessageId };
  } catch (error) {
    console.error('❌ Error sending student email:', error);
    return { success: false, error: error.message };
  }
};

// Send teacher credentials email
const sendTeacherCredentials = async (email, teacherName, uniqueCode, instituteName, teacherDetails) => {
  const params = {
    Source: process.env.SES_FROM_EMAIL,
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Subject: {
        Data: `Teacher Registration Successful - ${instituteName}`,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #8E44AD; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
                .code-box { background-color: #fff; border: 2px solid #8E44AD; padding: 20px; margin: 20px 0; text-align: center; border-radius: 5px; }
                .code { font-size: 32px; font-weight: bold; color: #8E44AD; letter-spacing: 3px; }
                .details { background-color: #fff; padding: 15px; margin: 15px 0; border-left: 4px solid #8E44AD; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Welcome to Our Team!</h1>
                </div>
                <div class="content">
                  <h2>Dear ${teacherName},</h2>
                  <p>Congratulations! You have been successfully registered as a teacher at <strong>${instituteName}</strong>.</p>
                  
                  <div class="code-box">
                    <p style="margin: 0; font-size: 14px; color: #666;">Your Unique Teacher Code</p>
                    <div class="code">${uniqueCode}</div>
                    <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">Please keep this code safe for future reference</p>
                  </div>
                  
                  <h3>Your Details:</h3>
                  <div class="details">
                    <p><strong>Name:</strong> ${teacherDetails.name}</p>
                    <p><strong>Subject:</strong> ${teacherDetails.subject}</p>
                    <p><strong>Qualification:</strong> ${teacherDetails.qualification}</p>
                    <p><strong>Date of Birth:</strong> ${teacherDetails.dob}</p>
                    <p><strong>Mobile:</strong> ${teacherDetails.mobile}</p>
                    <p><strong>Email:</strong> ${teacherDetails.email}</p>
                    ${teacherDetails.special_permission ? '<p><strong>Special Permission:</strong> Granted</p>' : ''}
                  </div>
                  
                  <p>You can now access the school portal using your credentials. If you have any questions, please contact the administration.</p>
                  
                  <p>Best regards,<br>${instituteName}</p>
                </div>
                <div class="footer">
                  <p>&copy; 2026 School ERP. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `,
          Charset: 'UTF-8',
        },
      },
    },
  };

  try {
    const command = new SendEmailCommand(params);
    const response = await sesClient.send(command);
    console.log('✅ Teacher credentials email sent:', response.MessageId);
    return { success: true, messageId: response.MessageId };
  } catch (error) {
    console.error('❌ Error sending teacher email:', error);
    return { success: false, error: error.message };
  }
};

// Generate 6 digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP for password reset
const sendPasswordResetOTP = async (email, otp) => {
  const params = {
    Source: process.env.SES_FROM_EMAIL,
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Subject: {
        Data: 'Password Reset OTP - School ERP',
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #E74C3C; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
                .otp-box { background-color: #fff; border: 2px solid #E74C3C; padding: 20px; margin: 20px 0; text-align: center; border-radius: 5px; }
                .otp { font-size: 40px; font-weight: bold; color: #E74C3C; letter-spacing: 5px; }
                .warning { background-color: #FFF3CD; border-left: 4px solid #FFC107; padding: 15px; margin: 20px 0; border-radius: 3px; color: #856404; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Password Reset Request</h1>
                </div>
                <div class="content">
                  <p>Hello,</p>
                  <p>We received a request to reset your password for your School ERP account. Use the OTP below to proceed with resetting your password:</p>
                  
                  <div class="otp-box">
                    <p style="margin: 0; font-size: 14px; color: #666;">Your OTP is valid for 10 minutes</p>
                    <div class="otp">${otp}</div>
                  </div>
                  
                  <div class="warning">
                    <strong>Important:</strong> Never share this OTP with anyone. School ERP staff will never ask for your OTP.
                  </div>
                  
                  <p>If you did not request this password reset, please ignore this email and your password will remain unchanged.</p>
                  
                  <p>Best regards,<br>School ERP Team</p>
                </div>
                <div class="footer">
                  <p>&copy; 2026 School ERP. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `,
          Charset: 'UTF-8',
        },
      },
    },
  };

  try {
    const command = new SendEmailCommand(params);
    const response = await sesClient.send(command);
    console.log('✅ Password reset OTP sent successfully:', response.MessageId);
    return { success: true, messageId: response.MessageId };
  } catch (error) {
    console.error('❌ Error sending password reset OTP:', error);
    return { success: false, error: error.message };
  }
};

// --- Fee Receipt Email Logic ---

Font.register({
  family: 'Noto Sans',
  src: 'https://fonts.gstatic.com/s/notosans/v42/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyD9A99d.ttf',
});

const pdfStyles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Noto Sans', backgroundColor: '#ffffff' },
  container: { flexDirection: 'column', backgroundColor: '#ffffff', border: '1pt solid #e2e8f0', borderRadius: 16, padding: 0, position: 'relative', overflow: 'hidden' },
  watermark: { position: 'absolute', top: '45%', left: '25%', fontSize: 80, fontWeight: 'bold', color: '#10b981', opacity: 0.08, transform: 'rotate(-30deg)' },
  header: { padding: '20px 20px 12px', textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#e2e8f0', borderBottomStyle: 'dashed', alignItems: 'center' },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4, width: '100%' },
  logo: { width: 42, height: 42, marginRight: 8, borderRadius: 6 },
  nameAffGroup: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' },
  instName: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase', textAlign: 'left' },
  instAff: { fontSize: 7.5, color: '#475569', fontWeight: 'bold', textTransform: 'uppercase', marginTop: 2, textAlign: 'left' },
  instAddress: { fontSize: 8.5, color: '#64748b', textAlign: 'center', width: '100%', marginTop: -3, lineHeight: 1.3 },
  receiptBody: { padding: '20px 30px' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, backgroundColor: '#f0fdf4', border: '1pt solid #bbf7d0', marginBottom: 20 },
  statusText: { color: '#059669', fontSize: 11, fontWeight: 'bold' },
  sectionTitle: { fontSize: 10.5, fontWeight: 'bold', color: '#080808', textTransform: 'uppercase', marginBottom: 10, marginTop: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#ffffff', borderRadius: 10, padding: 15, marginBottom: 20, border: '1pt solid #070707' },
  gridItem: { width: '50%', marginBottom: 10 },
  label: { fontSize: 8.5, color: '#000000', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 3 },
  value: { fontSize: 11, color: '#000000', fontWeight: 'bold' },
  table: { width: '100%', marginBottom: 20 },
  tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#f1f5f9', paddingVertical: 8 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f8fafc', paddingVertical: 10 },
  colLabel: { flex: 3, fontSize: 9.5, color: '#000000', fontWeight: 'bold', textTransform: 'uppercase', paddingLeft: 8 },
  colAmt: { flex: 1, textAlign: 'right', fontSize: 9.5, color: '#000000', fontWeight: 'bold', textTransform: 'uppercase', paddingRight: 8 },
  rowLabel: { flex: 3, fontSize: 10.5, color: '#000000', paddingLeft: 8 },
  rowAmt: { flex: 1, textAlign: 'right', fontSize: 10.5, color: '#000000', fontWeight: 'bold', paddingRight: 8 },
  totalSection: { backgroundColor: '#fdfdfd', borderRadius: 12, padding: 15, marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 13, color: '#020202', fontWeight: 'bold', textTransform: 'uppercase' },
  totalAmount: { fontSize: 20, color: '#0a0a0a', fontWeight: 'bold' },
  footerContainer: { padding: '20px 30px 40px', textAlign: 'center' },
  txnId: { fontSize: 9, color: '#000000', marginBottom: 10, fontWeight: 'bold' },
  disclaimer: { fontSize: 8, color: '#000000', fontWeight: 'bold' },
});

const ReceiptPDF = ({ feeRecord, instName, instLogo, instAff, fullAddress, stName, stRoll, stClass, stSection, formattedDate }) => {
  const addressParts = (fullAddress || '').split(', ');
  const line1 = addressParts.slice(0, 2).join(', ');
  const line2 = addressParts.slice(2).join(', ');

  return React.createElement(Document, {},
    React.createElement(Page, { size: "A4", style: pdfStyles.page },
      React.createElement(View, { style: pdfStyles.container },
        React.createElement(View, { style: pdfStyles.header },
          React.createElement(View, { style: pdfStyles.headerTop },
            instLogo ? React.createElement(Image, { src: instLogo, style: pdfStyles.logo }) : null,
            React.createElement(View, { style: pdfStyles.nameAffGroup },
              React.createElement(Text, { style: pdfStyles.instName }, instName),
              React.createElement(Text, { style: pdfStyles.instAff }, instAff)
            )
          ),
          React.createElement(View, { style: pdfStyles.instAddress },
            React.createElement(Text, {}, line1),
            line2 ? React.createElement(Text, {}, line2) : null
          )
        ),

        React.createElement(View, { style: pdfStyles.receiptBody },
          React.createElement(View, { style: pdfStyles.statusBadge },
            React.createElement(Text, { style: pdfStyles.statusText },
              feeRecord.payment_id?.startsWith('COUNTER_') ? 'FEE PAID AT COUNTER' : 'ONLINE FEE PAYMENT SUCCESSFUL'
            )
          ),

          React.createElement(Text, { style: pdfStyles.sectionTitle }, 'Student Particulars'),
          React.createElement(View, { style: pdfStyles.grid },
            React.createElement(View, { style: pdfStyles.gridItem },
              React.createElement(Text, { style: pdfStyles.label }, 'Student Name'),
              React.createElement(Text, { style: pdfStyles.value }, stName)
            ),
            React.createElement(View, { style: pdfStyles.gridItem },
              React.createElement(Text, { style: pdfStyles.label }, 'Roll Number'),
              React.createElement(Text, { style: pdfStyles.value }, stRoll)
            ),
            React.createElement(View, { style: pdfStyles.gridItem },
              React.createElement(Text, { style: pdfStyles.label }, 'Class - Section'),
              React.createElement(Text, { style: pdfStyles.value }, `${stClass} - ${stSection}`)
            ),
            React.createElement(View, { style: pdfStyles.gridItem },
              React.createElement(Text, { style: pdfStyles.label }, 'Payment Date'),
              React.createElement(Text, { style: pdfStyles.value }, formattedDate)
            ),
            React.createElement(View, { style: pdfStyles.gridItem },
              React.createElement(Text, { style: pdfStyles.label }, 'Collected By'),
              React.createElement(Text, { style: pdfStyles.value }, feeRecord.collected_by || (feeRecord.payment_id?.startsWith('COUNTER_') ? 'Staff' : 'Online System'))
            )
          ),

          React.createElement(Text, { style: pdfStyles.sectionTitle }, `Fee Breakdown (${feeRecord.month_year})`),
          React.createElement(View, { style: pdfStyles.table },
            React.createElement(View, { style: pdfStyles.tableHeaderRow },
              React.createElement(Text, { style: pdfStyles.colLabel }, 'Description'),
              React.createElement(Text, { style: pdfStyles.colAmt }, 'Amount (₹)')
            ),
            feeRecord.breakdown && Object.entries(feeRecord.breakdown).map(([label, amount]) => (
              React.createElement(View, { style: pdfStyles.tableRow, key: label },
                React.createElement(Text, { style: pdfStyles.rowLabel }, label),
                React.createElement(Text, { style: pdfStyles.rowAmt }, parseFloat(amount).toLocaleString('en-IN'))
              )
            ))
          ),

          React.createElement(View, { style: pdfStyles.totalSection },
            React.createElement(Text, { style: pdfStyles.totalLabel }, 'Grand Total'),
            React.createElement(Text, { style: pdfStyles.totalAmount }, `₹${parseFloat(feeRecord.total_amount || 0).toLocaleString('en-IN')}`)
          )
        ),

        React.createElement(View, { style: pdfStyles.footerContainer },
          React.createElement(Text, { style: pdfStyles.txnId }, `TRANSACTION ID: ${feeRecord.payment_id || 'RCV_123_TXN_PRM'}`),
          React.createElement(Text, { style: pdfStyles.disclaimer }, 'This is a computer generated receipt and does not require a physical signature.')
        ),
        React.createElement(Text, { style: pdfStyles.watermark }, 'PAID')
      )
    )
  )
};

const transporter = nodemailer.createTransport({
  SES: { ses: sesClient, aws: { SendRawEmailCommand, SESClient } },
});

const sendFeeReceiptEmail = async (studentEmail, studentName, amount, feeRecord, instituteDetails) => {
  try {
    const { institute_name, logo_url, address, state, district, pincode, affiliation } = instituteDetails;
    const fullAddress = [address, district, state, pincode].filter(Boolean).join(', ');
    const formattedDate = new Date(feeRecord.paid_at || Date.now()).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const pdfBuffer = await renderToBuffer(
      React.createElement(ReceiptPDF, {
        feeRecord,
        instName: institute_name,
        instLogo: logo_url,
        instAff: affiliation || 'Approved',
        fullAddress,
        stName: studentName,
        stRoll: feeRecord.roll_no || 'N/A',
        stClass: feeRecord.class || 'N/A',
        stSection: feeRecord.section || 'A',
        formattedDate
      })
    );

    const mailOptions = {
      from: process.env.SES_FROM_EMAIL,
      to: studentEmail,
      subject: `Fee Payment Successful - ${institute_name}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
          <div style="background: #10b981; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Payment Successful!</h1>
          </div>
          <div style="padding: 30px;">
            <p>Dear <strong>${studentName}</strong>,</p>
            <p>We are happy to inform you that your fee payment has been successfully processed.</p>
            
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Amount Paid:</strong> ₹${parseFloat(amount).toLocaleString('en-IN')}</p>
              <p style="margin: 5px 0;"><strong>Transaction ID:</strong> ${feeRecord.payment_id}</p>
              <p style="margin: 5px 0;"><strong>Date:</strong> ${formattedDate}</p>
              <p style="margin: 5px 0;"><strong>Month/Year:</strong> ${feeRecord.month_year}</p>
            </div>
            
            <p>Your official fee receipt is attached to this email for your records.</p>
            
            <p>Best regards,<br><strong>${institute_name} Team</strong></p>
          </div>
          <div style="background: #f3f4f6; color: #6b7280; padding: 15px; text-align: center; font-size: 12px;">
            This is an automated email. Please do not reply.
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `Fee_Receipt_${feeRecord.payment_id}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✨ SUCCESS: Fee receipt email sent to ${studentEmail}. ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('🛑 ERROR in sendFeeReceiptEmail:', error);
    if (error.message && error.message.includes('address is not verified')) {
      console.warn('💡 HINT: Your AWS SES is in SANDBOX mode. You can ONLY send to verified email addresses. Go to AWS Console > SES > Identities to verify the student email or request production access.');
    }
    return { success: false, error: error.message };
  }
};

// Send promotion success email
const sendPromotionEmail = async (email, studentName, instituteName, details, promotedBy) => {
  const params = {
    Source: process.env.SES_FROM_EMAIL,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: {
        Data: `Promotion Successful! - ${instituteName}`,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: `
            <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
              <div style="background: #27AE60; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">Congratulations!</h1>
              </div>
              <div style="padding: 30px;">
                <p>Dear <strong>${studentName}</strong>,</p>
                <p>We are delighted to inform you that you have been successfully promoted to the next academic session at <strong>${instituteName}</strong>.</p>
                
                <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #27AE60;">
                  <p style="margin: 5px 0;"><strong>New Class:</strong> ${details.newClass}</p>
                  <p style="margin: 5px 0;"><strong>Section:</strong> ${details.newSection}</p>
                  <p style="margin: 5px 0;"><strong>New Roll No:</strong> ${details.newRollNo}</p>
                  <p style="margin: 5px 0;"><strong>Academic Session:</strong> ${details.sessionName}</p>
                </div>
                
                <p>This promotion was authorized by <strong>${promotedBy}</strong>.</p>
                <p>We wish you all the best for the upcoming academic year. You can now login to your portal to see your fresh dashboard.</p>
                
                <p>Best regards,<br><strong>${instituteName} Administration</strong></p>
              </div>
              <div style="background: #f3f4f6; color: #6b7280; padding: 15px; text-align: center; font-size: 12px;">
                &copy; 2026 School ERP. All rights reserved.
              </div>
            </div>
          `,
          Charset: 'UTF-8',
        },
      },
    },
  };

  try {
    const command = new SendEmailCommand(params);
    await sesClient.send(command);
    console.log('✅ Promotion email sent to:', email);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending promotion email:', error);
    return { success: false, error: error.message };
  }
};

export {
  sendWelcomeEmail,
  uploadToS3,
  deleteFromS3,
  generateUniqueCode,
  sendStudentCredentials,
  sendTeacherCredentials,
  generateOTP,
  sendPasswordResetOTP,
  sendFeeReceiptEmail,
  sendPromotionEmail
};

