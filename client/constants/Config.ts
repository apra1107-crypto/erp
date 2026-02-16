import { Platform } from 'react-native';

// 1. IF USING PHYSICAL DEVICE: Put your Computer's IP here (e.g. 192.168.1.5)
// 2. IF USING EMULATOR: You can keep this IP OR use '10.0.2.2' directly.
const MACHINE_IP = '10.34.247.252'; 
const PORT = '5000';

// In React Native, 'localhost' doesn't work on Android. 
// It must be the machine IP or 10.0.2.2 for emulators.
export const BASE_URL = `http://${MACHINE_IP}:${PORT}`;

export const API_ENDPOINTS = {
    AUTH: {
        STUDENT: `${BASE_URL}/api/auth/student`,
        TEACHER: `${BASE_URL}/api/auth/teacher`,
        INSTITUTE: `${BASE_URL}/api/auth/institute`,
        PRINCIPAL: `${BASE_URL}/api/auth/principal`,
    },
    STUDENT: `${BASE_URL}/api/student`,
    TEACHER: `${BASE_URL}/api/teacher`,
    TEACHER_DASHBOARD: `${BASE_URL}/api/teacher/dashboard`,
    PRINCIPAL: `${BASE_URL}/api/principal`,
    STATS: `${BASE_URL}/api/principal/stats`,
    TEACHER_STATS: `${BASE_URL}/api/teacher/stats`,
    ATTENDANCE_DETAIL: `${BASE_URL}/api/principal/attendance-list-detail`,
    TEACHER_ATTENDANCE_DETAIL: `${BASE_URL}/api/teacher/attendance-list-detail`,
    ABSENT_REQUEST: `${BASE_URL}/api/absent-request`,
    ATTENDANCE: `${BASE_URL}/api/attendance`,
    SUBSCRIPTION: `${BASE_URL}/api/subscription`,
    FEES: `${BASE_URL}/api/fees`,
    ROUTINE: `${BASE_URL}/api/routine`,
    ADMIT_CARD: `${BASE_URL}/api/admit-cards`,
    EXAM: `${BASE_URL}/api/exam`,
    ACADEMIC_SESSIONS: `${BASE_URL}/api/academic-sessions`,
    PROMOTION: `${BASE_URL}/api/promotion`,
    SALARY: `${BASE_URL}/api/salary`,
    TEACHER_ATTENDANCE: `${BASE_URL}/api/teacher-attendance`,
    HOMEWORK: `${BASE_URL}/api/homework`,
    NOTICE: `${BASE_URL}/api/notice`,
    CALENDAR: `${BASE_URL}/api/calendar`,
};
