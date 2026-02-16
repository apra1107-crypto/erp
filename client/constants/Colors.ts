import { StatusBarStyle } from 'react-native';

export const Colors = {
    light: {
        primary: '#4A90E2',
        secondary: '#5C6BC0',
        success: '#4CAF50',
        danger: '#F44336',
        warning: '#FF9800',
        background: '#ffffffff',
        card: '#FFFFFF',
        text: '#2C3E50',
        textLight: '#7F8C8D',
        border: '#E0E6ED',
        icon: '#555555',
        tabBar: '#FFFFFF',
        statusBarStyle: 'dark-content' as StatusBarStyle,
    },
    dark: {
        primary: '#4A90E2',
        secondary: '#7986CB',
        success: '#66BB6A',
        danger: '#EF5350',
        warning: '#FFA726',
        background: '#000000ff',
        card: '#1E1E1E',
        text: '#E1E1E1',
        textLight: '#B0B0B0',
        border: '#333333',
        icon: '#A0A0A0',
        tabBar: '#1E1E1E',
        statusBarStyle: 'light-content' as StatusBarStyle,
    }
};

export type ThemeType = typeof Colors.light;
