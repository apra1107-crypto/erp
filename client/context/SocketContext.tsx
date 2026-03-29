
import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../constants/Config';

// Extract base URL correctly (remove /api/...)
const SOCKET_URL = BASE_URL;

export interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    lastConnectedAt: number; // For components to detect new connections/reconnects
    joinRoom: (room: string) => void;
    leaveRoom: (room: string) => void;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    lastConnectedAt: 0,
    joinRoom: () => { },
    leaveRoom: () => { },
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastConnectedAt, setLastConnectedAt] = useState(0);

    useEffect(() => {
        let newSocket: Socket | null = null;

        const connectSocket = async () => {
            try {
                newSocket = io(SOCKET_URL, {
                    transports: ['websocket'],
                    reconnection: true,
                    reconnectionAttempts: Infinity,
                    reconnectionDelay: 1000,
                });

                newSocket.on('connect', () => {
                    console.log('✅ Connected to socket server');
                    setIsConnected(true);
                    setLastConnectedAt(Date.now());

                    // Auto-join for students if data exists
                    AsyncStorage.getItem('studentData').then(data => {
                        if (data) {
                            const studentData = JSON.parse(data);
                            if (studentData.institute_id && studentData.class && studentData.section) {
                                const room = `${studentData.institute_id}-${studentData.class}-${studentData.section}`;
                                newSocket?.emit('join_room', room);
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
        }
    };

    const leaveRoom = (room: string) => {
        if (socket && isConnected) {
            socket.emit('leave_room', room);
        }
    };

    return (
        <SocketContext.Provider value={{ socket, isConnected, lastConnectedAt, joinRoom, leaveRoom }}>
            {children}
        </SocketContext.Provider>
    );
};
