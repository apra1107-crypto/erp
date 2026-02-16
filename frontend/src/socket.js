import { io } from 'socket.io-client';
import { BASE_URL } from './config';

const socket = io(BASE_URL);

export const joinInstituteRoom = (instituteId) => {
    if (instituteId) {
        socket.emit('join_room', `principal-${instituteId}`);
    }
};

export const joinAdminRoom = () => {
    socket.emit('join_room', 'admin_room');
};

export default socket;
