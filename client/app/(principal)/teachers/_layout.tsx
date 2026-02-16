import { Stack } from 'expo-router';

export default function TeachersLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="details/[id]" />
        </Stack>
    );
}
