import { Platform } from 'react-native';

export const BASE_URL = 'http://10.69.149.252:5000';

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
    ROUTINE: `${BASE_URL}/api/routine`,
    ADMIT_CARD: `${BASE_URL}/api/manage-admit-cards`,
    ID_CARD: `${BASE_URL}/api/id-cards`,
    EXAM: `${BASE_URL}/api/exam`,
    ACADEMIC_SESSIONS: `${BASE_URL}/api/academic-sessions`,
    PROMOTION: `${BASE_URL}/api/promotion`,
    SALARY: `${BASE_URL}/api/salary`,
    TEACHER_ATTENDANCE: `${BASE_URL}/api/teacher-attendance`,
    HOMEWORK: `${BASE_URL}/api/homework`,
    NOTICE: `${BASE_URL}/api/notice`,
    CALENDAR: `${BASE_URL}/api/calendar`,
    ONE_TIME_FEES: `${BASE_URL}/api/one-time-fees`,
    TRANSPORT: `${BASE_URL}/api/transport`,
};
