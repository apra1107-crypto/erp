import * as Minio from 'minio';
import { SendMailClient } from 'zeptomail';
import nodemailer from 'nodemailer';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer, Font } from '@react-pdf/renderer';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { getBrowser } from './puppeteerManager.js';
import { getBase64Image } from './imageUtils.js';

dotenv.config();

const zeptoClient = new SendMailClient({
  url: process.env.ZEPTOMAIL_API_URL,
  token: process.env.ZEPTOMAIL_API_TOKEN,
});

// Helper to parse EOS_ENDPOINT for MinIO
const parseEndpoint = (url) => {
  if (!url) return { endPoint: 'objectstore.e2enetworks.net', port: 443, useSSL: true };
  
  try {
    // Ensure the URL has a protocol for the URL parser
    const validUrl = url.startsWith('http') ? url : `https://${url}`;
    const parsed = new URL(validUrl);
    
    return {
      endPoint: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80),
      useSSL: parsed.protocol === 'https:',
    };
  } catch (e) {
    // Fallback if URL is totally malformed
    return { endPoint: url, port: 443, useSSL: true };
  }
};

const endpointConfig = parseEndpoint(process.env.EOS_ENDPOINT);

const minioClient = new Minio.Client({
  endPoint: endpointConfig.endPoint,
  port: endpointConfig.port,
  useSSL: endpointConfig.useSSL,
  accessKey: process.env.EOS_ACCESS_KEY,
  secretKey: process.env.EOS_SECRET_KEY,
  region: process.env.EOS_REGION,
});

// Generate base62 unique code (Clean set: No 0, o, O, i, I, l, L)
const generateUniqueCode = () => {
  const chars = '123456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  let code = '';
  const randomBytes = crypto.randomBytes(6);

  for (let i = 0; i < 6; i++) {
    code += chars[randomBytes[i] % chars.length];
  }

  return code;
};

// Upload image to cloud storage using MinIO
const uploadToS3 = async (fileBuffer, fileName, mimetype, folder = 'others') => {
  const key = `${folder}/${Date.now()}-${fileName}`;

  try {
    await minioClient.putObject(
      process.env.EOS_BUCKET,
      key,
      fileBuffer,
      fileBuffer.length,
      { 'Content-Type': mimetype }
    );
    console.log('✅ Image uploaded to EOS (MinIO):', key);
    return key;
  } catch (error) {
    console.error('❌ Error uploading to EOS (MinIO):', error);
    throw error;
  }
};

// Delete image from cloud storage using MinIO
const deleteFromS3 = async (fileKey) => {
  if (!fileKey) return;

  try {
    let key = fileKey;
    if (fileKey.startsWith('http')) {
      const bucketUrl = process.env.EOS_BUCKET_URL;
      if (bucketUrl) {
        key = fileKey.replace(`${bucketUrl}/`, '');
      } else {
        const urlParts = fileKey.split('/');
        key = urlParts.slice(3).join('/');
      }
    }

    await minioClient.removeObject(process.env.EOS_BUCKET, key);
    console.log('✅ Image deleted from EOS (MinIO):', key);
  } catch (error) {
    console.error('❌ Error deleting from EOS (MinIO):', error);
  }
};

const sendWelcomeEmail = async (email, instituteName, principalName) => {
  try {
    const response = await zeptoClient.sendMail({
      from: {
        address: process.env.ZEPTOMAIL_FROM_EMAIL,
        name: instituteName,
      },
      to: [
        {
          email_address: {
            address: email,
            name: principalName,
          },
        },
      ],
      subject: `Welcome to School ERP - ${instituteName}`,
      htmlbody: `
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
    });
    console.log('✅ Welcome email sent successfully:', response.data?.[0]?.message_id);
    return { success: true, messageId: response.data?.[0]?.message_id };
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
};

// Send student credentials email
const sendStudentCredentials = async (email, studentName, uniqueCode, instituteName, studentDetails) => {
  try {
    const response = await zeptoClient.sendMail({
      from: {
        address: process.env.ZEPTOMAIL_FROM_EMAIL,
        name: instituteName,
      },
      to: [
        {
          email_address: {
            address: email,
            name: studentName,
          },
        },
      ],
      subject: `Student Registration Successful - ${instituteName}`,
      htmlbody: `
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
    });
    console.log('✅ Student credentials email sent:', response.data?.[0]?.message_id);
    return { success: true, messageId: response.data?.[0]?.message_id };
  } catch (error) {
    console.error('❌ Error sending student email:', error);
    return { success: false, error: error.message };
  }
};

// Send teacher credentials email
const sendTeacherCredentials = async (email, teacherName, uniqueCode, instituteName, teacherDetails) => {
  try {
    const response = await zeptoClient.sendMail({
      from: {
        address: process.env.ZEPTOMAIL_FROM_EMAIL,
        name: instituteName,
      },
      to: [
        {
          email_address: {
            address: email,
            name: teacherName,
          },
        },
      ],
      subject: `Teacher Registration Successful - ${instituteName}`,
      htmlbody: `
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
    });
    console.log('✅ Teacher credentials email sent:', response.data?.[0]?.message_id);
    return { success: true, messageId: response.data?.[0]?.message_id };
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
  try {
    const response = await zeptoClient.sendMail({
      from: {
        address: process.env.ZEPTOMAIL_FROM_EMAIL,
        name: 'School ERP Support',
      },
      to: [
        {
          email_address: {
            address: email,
          },
        },
      ],
      subject: 'Password Reset OTP - School ERP',
      htmlbody: `
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
    });
    console.log('✅ Password reset OTP sent successfully:', response.data?.[0]?.message_id);
    return { success: true, messageId: response.data?.[0]?.message_id };
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

    const response = await zeptoClient.sendMail({
      from: {
        address: process.env.ZEPTOMAIL_FROM_EMAIL,
        name: institute_name,
      },
      to: [
        {
          email_address: {
            address: studentEmail,
            name: studentName,
          },
        },
      ],
      subject: `Fee Payment Successful - ${institute_name}`,
      htmlbody: `
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
          content: pdfBuffer.toString('base64'),
          mime_type: 'application/pdf',
          name: `Fee_Receipt_${feeRecord.payment_id}.pdf`,
        },
      ],
    });

    console.log(`✨ SUCCESS: Fee receipt email sent to ${studentEmail}. ID: ${response.data?.[0]?.message_id}`);
    return { success: true, messageId: response.data?.[0]?.message_id };
  } catch (error) {
    console.error('🛑 ERROR in sendFeeReceiptEmail:', error);
    return { success: false, error: error.message };
  }
};

// Send promotion success email
const sendPromotionEmail = async (email, studentName, instituteName, details, promotedBy) => {
  try {
    const response = await zeptoClient.sendMail({
      from: {
        address: process.env.ZEPTOMAIL_FROM_EMAIL,
        name: instituteName,
      },
      to: [
        {
          email_address: {
            address: email,
            name: studentName,
          },
        },
      ],
      subject: `Promotion Successful! - ${instituteName}`,
      htmlbody: `
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
    });
    console.log('✅ Promotion email sent to:', email);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending promotion email:', error);
    return { success: false, error: error.message };
  }
};

// Send subscription payment success email
const sendSubscriptionSuccessEmail = async (email, principalName, instituteId, details) => {
  const { amount, durationDays, expiryDate, transactionId, months } = details;
  console.log(`📩 Preparing subscription email for ${email} (Inst: ${instituteId})`);

  const formattedExpiry = new Date(expiryDate).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const formattedAmount = parseFloat(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  try {
    // 1. Fetch Institute Details
    const instRes = await (await import('../config/db.js')).default.query(
      'SELECT institute_name, logo_url, address, district, state, pincode FROM institutes WHERE id = $1',
      [instituteId]
    );

    let logoBase64 = null;
    let fullAddress = 'N/A';
    let instituteName = 'Our Institute';

    if (instRes.rows.length > 0) {
      const inst = instRes.rows[0];
      instituteName = inst.institute_name;
      const logoUrl = inst.logo_url?.startsWith('http') ? inst.logo_url : (inst.logo_url ? `${process.env.EOS_BUCKET_URL}/${inst.logo_url}` : null);
      if (logoUrl) {
        try {
          logoBase64 = await getBase64Image(logoUrl);
        } catch (e) {
          console.error('⚠️ Could not load logo for receipt:', e.message);
        }
      }
      fullAddress = [inst.address, inst.district, inst.state, inst.pincode].filter(Boolean).join(', ');
    } else {
      console.warn(`⚠️ No institute found for ID ${instituteId} while generating receipt.`);
    }

    // 2. Generate PDF Receipt using Puppeteer
    console.log('📄 Generating PDF Receipt with Puppeteer...');
    const browser = await getBrowser();
    const page = await browser.newPage();

    const receiptHtml = `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica', sans-serif; margin: 0; padding: 40px; color: #333; }
            .receipt-container { border: 1px solid #eee; padding: 40px; border-radius: 10px; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f4f4f4; padding-bottom: 20px; }
            .logo { height: 60px; }
            .title { font-size: 24px; font-weight: bold; color: #1e1b4b; }
            .success-msg { color: #059669; font-weight: bold; margin: 20px 0; font-size: 18px; }
            .details-table { width: 100%; border-collapse: collapse; margin-top: 30px; }
            .details-table th { text-align: left; padding: 12px; border-bottom: 1px solid #eee; color: #64748b; font-size: 12px; text-transform: uppercase; }
            .details-table td { padding: 15px 12px; border-bottom: 1px solid #f8fafc; font-size: 14px; }
            .total-row { background: #f8fafc; font-weight: bold; }
            .footer { margin-top: 50px; text-align: center; color: #94a3b8; font-size: 12px; }
            .brand { color: #1e1b4b; font-weight: bold; font-size: 20px; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              <div>
                <div class="brand">KLASSIN ERP</div>
                <div style="font-size: 12px; color: #64748b;">School Management System</div>
              </div>
              <div class="title">PAYMENT RECEIPT</div>
            </div>

            <div class="success-msg">Congratulations! Your Payment was Successful</div>

            <p>Dear ${principalName},</p>
            <p>This is a formal receipt for your subscription payment for <strong>${instituteName}</strong>.</p>

            <table class="details-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Quantity</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>ERP Subscription Renewal (${months} Month/s)</td>
                  <td>${durationDays} Days</td>
                  <td>₹${formattedAmount}</td>
                </tr>
                <tr class="total-row">
                  <td colspan="2" style="text-align: right;">Grand Total</td>
                  <td>₹${formattedAmount}</td>
                </tr>
              </tbody>
            </table>

            <div style="margin-top: 30px; background: #ecfeff; padding: 20px; border-radius: 8px;">
              <div style="font-size: 12px; color: #164e63; font-weight: bold; text-transform: uppercase;">Subscription Details</div>
              <div style="display: flex; gap: 40px; margin-top: 10px;">
                <div>
                  <div style="font-size: 11px; color: #64748b;">TRANSACTION ID</div>
                  <div style="font-size: 13px; font-weight: bold;">${transactionId}</div>
                </div>
                <div>
                  <div style="font-size: 11px; color: #64748b;">EXPIRY DATE</div>
                  <div style="font-size: 13px; font-weight: bold;">${formattedExpiry}</div>
                </div>
              </div>
            </div>

            <div class="footer">
              <p>Thank you for choosing Klassin. This is a computer-generated document.</p>
              <p>&copy; 2026 Klassin ERP. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await page.setContent(receiptHtml);
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await page.close();
    console.log('✅ PDF Buffer generated successfully.');

    // 3. Send the Email
    console.log('📧 Sending email via ZeptoMail...');
    const response = await zeptoClient.sendMail({
      from: {
        address: process.env.ZEPTOMAIL_FROM_EMAIL,
        name: 'KLASSIN ERP Support',
      },
      to: [
        {
          email_address: {
            address: email,
            name: principalName,
          },
        },
      ],
      subject: `Congratulations! Payment Successful - ${instituteName}`,
      htmlbody: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
                .header { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: white; padding: 40px 20px; text-align: center; }
                .content { background-color: #ffffff; padding: 35px; }
                .details-grid { background-color: #f8fafc; border-radius: 10px; padding: 20px; margin: 25px 0; border: 1px solid #f1f5f9; }
                .detail-row { display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid #edf2f7; padding-bottom: 8px; }
                .detail-row:last-child { border-bottom: none; }
                .label { color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; }
                .value { color: #0f172a; font-size: 14px; font-weight: 700; }
                .expiry-box { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin-top: 20px; color: #166534; }
                .footer { text-align: center; padding: 20px; color: #94a3b8; font-size: 12px; background: #f8fafc; }
                .button { background-color: #4f46e5; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin: 0; font-size: 28px;">Congratulations!</h1>
                  <p style="margin: 10px 0 0; opacity: 0.9;">Your payment of ₹${formattedAmount} was successful</p>
                </div>
                <div class="content">
                  <h2 style="margin-top: 0; color: #0f172a;">Hello ${principalName},</h2>
                  <p>We are delighted to confirm that your subscription for <strong>${instituteName}</strong> has been successfully renewed.</p>
                  
                  <div class="expiry-box">
                    <strong style="font-size: 12px; text-transform: uppercase; display: block; margin-bottom: 4px;">Subscription Valid Until</strong>
                    <span style="font-size: 18px; font-weight: 800;">${formattedExpiry}</span>
                  </div>

                  <div class="details-grid">
                    <div class="detail-row">
                      <span class="label">Amount Paid</span>
                      <span class="value">₹${formattedAmount}</span>
                    </div>
                    <div class="detail-row">
                      <span class="label">Plan Duration</span>
                      <span class="value">${months} Month/s (${durationDays} Days)</span>
                    </div>
                    <div class="detail-row">
                      <span class="label">Transaction ID</span>
                      <span class="value" style="font-family: monospace;">${transactionId}</span>
                    </div>
                    <div class="detail-row">
                      <span class="label">Payment Status</span>
                      <span class="value" style="color: #059669;">Success</span>
                    </div>
                  </div>
                  
                  <p>Your official payment receipt is attached to this email. You can also view your transaction history in your dashboard.</p>
                  
                  <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL}/login" class="button">Go to Dashboard</a>
                  </div>
                </div>
                <div class="footer">
                  <p>&copy; 2026 Klassin ERP. All rights reserved.</p>
                  <p>Thank you for partnering with us to simplify school management.</p>
                </div>
              </div>
            </body>
            </html>
          `,
      attachments: [
        {
          content: pdfBuffer.toString('base64'),
          mime_type: 'application/pdf',
          name: `Klassin_Subscription_Receipt_${transactionId}.pdf`,
        },
      ],
    });
    console.log('✅ Professional subscription success email sent:', response.data?.[0]?.message_id);
    return { success: true, messageId: response.data?.[0]?.message_id };
  } catch (error) {
    console.error('❌ Error sending subscription success email:', error);
    return { success: false, error: error.message };
  }
};

// Send subscription expired email
const sendSubscriptionExpiredEmail = async (email, principalName, instituteName, details) => {
  const { expiryDate, monthlyPrice } = details;
  
  try {
    const response = await zeptoClient.sendMail({
      from: {
        address: process.env.ZEPTOMAIL_FROM_EMAIL,
        name: instituteName,
      },
      to: [
        {
          email_address: {
            address: email,
            name: principalName,
          },
        },
      ],
      subject: `URGENT: Subscription Expired - ${instituteName}`,
      htmlbody: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 20px auto; border: 1px solid #fee2e2; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
                .header { background: linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%); color: white; padding: 40px 20px; text-align: center; }
                .status-badge { display: inline-block; background: rgba(248, 113, 113, 0.2); color: #f87171; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; margin-bottom: 15px; border: 1px solid rgba(248, 113, 113, 0.3); }
                .content { background-color: #ffffff; padding: 35px; }
                .alert-box { background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 10px; padding: 20px; margin: 25px 0; color: #991b1b; }
                .expiry-info { font-size: 18px; font-weight: 800; color: #b91c1c; display: block; margin-top: 10px; }
                .footer { text-align: center; padding: 20px; color: #94a3b8; font-size: 12px; background: #f8fafc; }
                .button { background-color: #ef4444; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-top: 10px; box-shadow: 0 4px 14px 0 rgba(239, 68, 68, 0.39); }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <div class="status-badge">Access Suspended</div>
                  <h1 style="margin: 0; font-size: 24px;">Your Subscription Has Expired</h1>
                </div>
                <div class="content">
                  <h2 style="margin-top: 0; color: #0f172a;">Hello ${principalName},</h2>
                  <p>Your subscription for <strong>${instituteName}</strong> has expired. As a result, access to the administrative dashboard, teacher tools, and student portals has been temporarily restricted.</p>
                  
                  <div class="alert-box">
                    <strong>Subscription Expired On:</strong>
                    <span class="expiry-info">${new Date(expiryDate).toLocaleString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                    <p style="margin-top: 15px; font-size: 14px;">Please renew your subscription to restore full access for all staff and students. Your current plan is <strong>₹${parseFloat(monthlyPrice).toLocaleString('en-IN')}/month</strong>.</p>
                  </div>
                  
                  <p>To avoid any further disruption in school management and classes, please click the button below to renew your plan immediately.</p>
                  
                  <div style="text-align: center; margin-top: 30px;">
                    <a href="${process.env.FRONTEND_URL}/login?redirectTo=/dashboard/subscription" class="button">RENEW NOW & UNLOCK ACCESS</a>
                  </div>
                  
                  <p style="margin-top: 30px; font-size: 14px; color: #64748b;">If you have already made the payment and still see this message, please wait a few minutes or contact support.</p>
                </div>
                <div class="footer">
                  <p>&copy; 2026 School ERP. All rights reserved.</p>
                  <p>School Management Made Easy & Secure.</p>
                </div>
              </div>
            </body>
            </html>
          `,
    });
    console.log('✅ Subscription expired email sent:', response.data?.[0]?.message_id);
    return { success: true, messageId: response.data?.[0]?.message_id };
  } catch (error) {
    console.error('❌ Error sending subscription expired email:', error);
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
  sendPromotionEmail,
  sendSubscriptionSuccessEmail,
  sendSubscriptionExpiredEmail
};

