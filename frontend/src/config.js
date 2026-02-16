const IP_ADDRESS = 'localhost';
const PORT = '5000';
export const BASE_URL = `http://${IP_ADDRESS}:${PORT}`;

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
    FEES: `${BASE_URL}/api/fees`,
    ROUTINE: `${BASE_URL}/api/routine`,
    ADMIT_CARD: `${BASE_URL}/api/admit-cards`,
};
