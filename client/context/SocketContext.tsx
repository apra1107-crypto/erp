
import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../constants/Config';

// Extract base URL correctly (remove /api/...)
const SOCKET_URL = BASE_URL;

export interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    joinRoom: (room: string) => void;
    leaveRoom: (room: string) => void;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    joinRoom: () => { },
    leaveRoom: () => { },
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        let newSocket: Socket | null = null;

        const connectSocket = async () => {
            try {
                // Determine user type (Student, Teacher, or Principal)
                // We check studentData first, but teachers/principals might store tokens differently
                // For simplicity, we just connect. Auth is needed for rooms mostly.

                newSocket = io(SOCKET_URL, {
                    transports: ['websocket'],
                });

                newSocket.on('connect', () => {
                    console.log('✅ Connected to socket server');
                    setIsConnected(true);

                    // Auto-join for students if data exists
                    AsyncStorage.getItem('studentData').then(data => {
                        if (data) {
                            const studentData = JSON.parse(data);
                            if (studentData.institute_id && studentData.class && studentData.section) {
                                const room = `${studentData.institute_id}-${studentData.class}-${studentData.section}`;
                                newSocket?.emit('join_room', room);
                                console.log(`👤 Student joined room: ${room}`);
                            }
                        }
                    });
                });

                newSocket.on('disconnect', () => {
                    console.log('❌ Disconnected from socket server');
                    setIsConnected(false);
                });

                setSocket(newSocket);
            } catch (error) {
                console.error('Socket connection error:', error);
            }
        };

        connectSocket();

        return () => {
            if (newSocket) {
                newSocket.disconnect();
            }
        };
    }, []);

    const joinRoom = (room: string) => {
        if (socket && isConnected) {
            socket.emit('join_room', room);
            console.log(`➡️ Manual join room: ${room}`);
        }
    };

    const leaveRoom = (room: string) => {
        if (socket && isConnected) {
            // Socket.io client doesn't have a standard 'leave' emission usually handled by server
            // But we can implement a custom event if needed, or just stop listening
            // Standard way is server-side leave, or just ignoring events.
            // For now, let's assume we just join new rooms.
            // Actually, best practice is to emit 'leave_room' and handle on server.
            // But our server only has 'join_room'.
            // Let's just allow joining for now. Multi-room presence is fine.
        }
    };

    return (
        <SocketContext.Provider value={{ socket, isConnected, joinRoom, leaveRoom }}>
            {children}
        </SocketContext.Provider>
    );
};
