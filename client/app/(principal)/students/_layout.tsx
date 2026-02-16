import { Stack } from 'expo-router';

export default function StudentsLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="[class]/index" />
            <Stack.Screen name="[class]/[section]/index" />
            <Stack.Screen name="details/[id]" />
        </Stack>
    );
}
