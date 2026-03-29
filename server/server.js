import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import pool from './config/db.js';
import { initSocket } from './utils/socket.js';
import { startScheduler, triggerDailyEvents } from './utils/scheduler.js';

// Route Imports
import authRoutes from './routes/authRoutes.js';
import principalRoutes from './routes/principalRoutes.js';
import studentAuthRoutes from './routes/studentAuthRoutes.js';
import teacherAuthRoutes from './routes/teacherAuthRoutes.js';
import adminAuthRoutes from './routes/adminAuthRoutes.js';
import teacherRoutes from './routes/teacherRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import absentRequestRoutes from './routes/absentRequestRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import subscriptionRoutes from './routes/subscription.js';
import routineRoutes from './routes/routineRoutes.js';
import admitCardRoutes from './routes/admitCardRoutes.js';
import idCardRoutes from './routes/idCardRoutes.js';
import examRoutes from './routes/examRoutes.js';
import academicSessionRoutes from './routes/academicSessionRoutes.js';
import promotionRoutes from './routes/promotionRoutes.js';
import salaryRoutes from './routes/salaryRoutes.js';
import teacherAttendanceRoutes from './routes/teacherAttendanceRoutes.js';
import homeworkRoutes from './routes/homeworkRoutes.js';
import noticeRoutes from './routes/noticeRoutes.js';
import calendarRoutes from './routes/calendarRoutes.js';
import appStatsRoutes from './routes/appStatsRoutes.js';
import razorpayRoutes from './routes/razorpayRoutes.js';
import transportRoutes from './routes/transportRoutes.js';
import oneTimeFeeRoutes from './routes/oneTimeFeeRoutes.js';

// Controller/Middleware Imports
import { createNotice, getNotices, updateNotice, deleteNotice } from './controllers/noticeController.js';
import { protect } from './middlewares/auth.js';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Global Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

// Test database connection
pool.query('SELECT NOW()', async (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
  } else {
    console.log('✅ Database connected at:', res.rows[0].now);
    
    // Auto-Migration: Ensure admit_cards has is_published column
    try {
        await pool.query(`
            ALTER TABLE admit_cards 
            ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
        `);
        console.log('✅ Schema Sync: is_published column verified in admit_cards');
    } catch (migErr) {
        console.error('❌ Schema Sync Failed:', migErr.message);
    }
  }
});

// Routes
app.use('/api/auth/student', studentAuthRoutes);
app.use('/api/auth/teacher', teacherAuthRoutes);
app.use('/api/auth/admin', adminAuthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/principal/attendance', attendanceRoutes);
app.use('/api/teacher/attendance', attendanceRoutes);
app.use('/api/principal', principalRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/absent-request', absentRequestRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/routine', routineRoutes);
app.use('/api/manage-admit-cards', admitCardRoutes);
app.use('/api/id-cards', idCardRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/academic-sessions', academicSessionRoutes);
app.use('/api/promotion', promotionRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/teacher-attendance', teacherAttendanceRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/stats', appStatsRoutes);
app.use('/api/razorpay', razorpayRoutes);
app.use('/api/transport', transportRoutes);
app.use('/api/one-time-fees', oneTimeFeeRoutes);

// Notice Routes (Manual definition to keep specific controllers)
const noticeRouter = express.Router();
noticeRouter.post('/', protect, createNotice);
noticeRouter.get('/', protect, getNotices);
noticeRouter.put('/:id', protect, updateNotice);
noticeRouter.delete('/:id', protect, deleteNotice);
app.use('/api/notice', noticeRouter);

// Debug endpoint for password reset
app.get('/api/debug/password-reset-status', async (req, res) => {
  try {
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'password_reset_tokens'
      );
    `);
    const instituteCount = await pool.query('SELECT COUNT(*) FROM institutes;');
    res.status(200).json({
      status: 'OK',
      passwordResetTableExists: tableCheck.rows[0].exists,
      totalInstitutes: instituteCount.rows[0].count,
      awsConfigured: {
        AWS_REGION: !!process.env.AWS_REGION,
        AWS_ACCESS_KEY_ID: !!process.env.AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: !!process.env.AWS_SECRET_ACCESS_KEY,
        SES_FROM_EMAIL: !!process.env.SES_FROM_EMAIL,
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: error.message });
  }
});

// Test endpoint to send OTP
app.post('/api/debug/test-send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const { generateOTP, sendPasswordResetOTP } = await import('./utils/aws.js');
    const otp = generateOTP();
    const emailResult = await sendPasswordResetOTP(email, otp);
    res.status(200).json({ message: 'OTP send attempted', result: emailResult, otp: otp });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: error.message });
  }
});


// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'School ERP Server is running',
    timestamp: new Date().toISOString()
  });
});

// Image Proxy route for PDF generation
app.get('/api/proxy-image', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).send('URL is required');
    const response = await axios({ url, method: 'GET', responseType: 'arraybuffer' });
    res.set('Content-Type', response.headers['content-type']);
    res.set('Access-Control-Allow-Origin', '*');
    res.send(response.data);
  } catch (error) {
    res.status(500).send('Failed to proxy image');
  }
});

// 404 & Error handlers
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use((err, req, res, next) => {
  const errorLog = `!!! GLOBAL ERROR !!!\nMethod: ${req.method} URL: ${req.url}\n${err.stack}\n`;
  console.error(errorLog);
  try {
    fs.appendFileSync(path.join(process.cwd(), 'all_requests.log'), errorLog);
  } catch (fsErr) {
    // Ignore
  }
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);

// Initialize Socket.io
initSocket(httpServer);

// Start Scheduler
startScheduler();

httpServer.timeout = 300000; // 5 minutes
httpServer.keepAliveTimeout = 301000;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
