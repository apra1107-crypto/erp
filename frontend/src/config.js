export const BASE_URL = `https://klassin.co.in`;

export const EOS_BUCKET_URL = 'https://klassinimg.objectstore.e2enetworks.net';

export const API_ENDPOINTS = {
    AUTH: {
        STUDENT: `${BASE_URL}/api/auth/student`,
        TEACHER: `${BASE_URL}/api/auth/teacher`,
        INSTITUTE: `${BASE_URL}/api/auth/institute`,
        PRINCIPAL: `${BASE_URL}/api/auth/principal`,
        ADMIN: `${BASE_URL}/api/auth/admin`,
    },
    STUDENT: `${BASE_URL}/api/student`,
    TEACHER: `${BASE_URL}/api/teacher`,
    PRINCIPAL: `${BASE_URL}/api/principal`,
    ADMIN_DASHBOARD: `${BASE_URL}/api/admin`,
    ATTENDANCE: `${BASE_URL}/api/attendance`,
    ABSENT_REQUEST: `${BASE_URL}/api/absent-request`,
    SUBSCRIPTION: `${BASE_URL}/api/subscription`,
    ROUTINE: `${BASE_URL}/api/routine`,
    ADMIT_CARD: `${BASE_URL}/api/manage-admit-cards`,
    STATS: `${BASE_URL}/api/stats`,
    TRANSPORT: `${BASE_URL}/api/transport`,
    ONE_TIME_FEES: `${BASE_URL}/api/one-time-fees`,
    ACADEMIC_SESSIONS: `${BASE_URL}/api/academic-sessions`,
    HOMEWORK: `${BASE_URL}/api/homework`,
};
