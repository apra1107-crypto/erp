import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import AsyncStorage from '@react-native-async-storage/async-storage';


export default function StudentLayout() {
    const { socket } = useSocket();

    useEffect(() => {
        if (!socket) return;

        // Also try to join room on mount if not already joined (double safety)
        const checkRoom = async () => {
            const data = await AsyncStorage.getItem('studentData');
            if (data) {
                const student = JSON.parse(data);
                if (student.institute_id && student.class && student.section) {
                    const room = `${student.institute_id}-${student.class}-${student.section}`;
                    socket.emit('join_room', room);
                }
            }
        };
        checkRoom();
    }, [socket]);

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right'
            }}
        >
            <Stack.Screen name="dashboard" />
            <Stack.Screen name="admit-card" />
            <Stack.Screen name="profile" />
        </Stack>
    );
}
