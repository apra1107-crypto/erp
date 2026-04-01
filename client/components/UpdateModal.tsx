import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

// You will update this URL to your E2E storage URL or server URL
const VERSION_INFO_URL = 'https://klassin.co.in/downloads/version.json';

const UpdateModal = () => {
    const [visible, setVisible] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<any>(null);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        checkVersion();
    }, []);

    const checkVersion = async () => {
        try {
            const url = `${VERSION_INFO_URL}?t=${Date.now()}`;
            const response = await axios.get(url);
            const latestVersion = response.data?.version;
            const currentVersion = Constants.expoConfig?.version || '1.0.0';

            if (latestVersion && isVersionHigher(latestVersion, currentVersion)) {
                setUpdateInfo(response.data);
                setVisible(true);
            }
        } catch (error) {
            console.log('Version check failed:', error);
        }
    };

    const isVersionHigher = (latest: string, current: string) => {
        if (!latest || !current) return false;
        const v1 = latest.split('.').map(Number);
        const v2 = current.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
            if (v1[i] > v2[i]) return true;
            if (v1[i] < v2[i]) return false;
        }
        return false;
    };

    const handleUpdate = async () => {
        if (!updateInfo?.url) return;

        setIsDownloading(true);
        const fileUri = FileSystem.cacheDirectory + 'klassin-update.apk';
        const downloadUrl = `${updateInfo.url}${updateInfo.url.includes('?') ? '&' : '?'}t=${Date.now()}`;

        try {
            const downloadResumable = FileSystem.createDownloadResumable(
                downloadUrl,
                fileUri,
                {},
                (downloadProgress) => {
                    const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
                    setDownloadProgress(progress);
                }
            );

            const result = await downloadResumable.downloadAsync();
            if (result && result.uri) {
                installApk(result.uri);
            }
        } catch (error) {
            console.error('Download failed:', error);
            setIsDownloading(false);
        }
    };

    const installApk = async (uri: string) => {
        try {
            if (Platform.OS === 'android') {
                const contentUri = await FileSystem.getContentUriAsync(uri);
                await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
                    data: contentUri,
                    flags: 1,
                    type: 'application/vnd.android.package-archive',
                });
            } else {
                // For iOS or sharing fallback
                await Sharing.shareAsync(uri);
            }
        } catch (error) {
            console.error('Installation failed:', error);
        } finally {
            setIsDownloading(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="cloud-download-outline" size={40} color="#007AFF" />
                    </View>
                    
                    <Text style={styles.title}>Update Available!</Text>
                    <Text style={styles.versionText}>Version {updateInfo?.version}</Text>
                    
                    <Text style={styles.description}>
                        {updateInfo?.notes || 'A new version of Klassin is available with improved features and fixes.'}
                    </Text>

                    {isDownloading ? (
                        <View style={styles.progressContainer}>
                            <Text style={styles.progressLabel}>
                                Downloading... {Math.round(downloadProgress * 100)}%
                            </Text>
                            <View style={styles.progressBarBg}>
                                <View style={[styles.progressBarFill, { width: `${downloadProgress * 100}%` }]} />
                            </View>
                        </View>
                    ) : (
                        <View style={styles.buttonContainer}>
                            {!updateInfo?.isCritical && (
                                <TouchableOpacity style={styles.laterButton} onPress={() => setVisible(false)}>
                                    <Text style={styles.laterButtonText}>Later</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
                                <Text style={styles.updateButtonText}>Update Now</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    content: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F0F7FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1A1A1A',
        marginBottom: 4,
    },
    versionText: {
        fontSize: 14,
        color: '#007AFF',
        fontWeight: '700',
        marginBottom: 16,
    },
    description: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    buttonContainer: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    updateButton: {
        flex: 1,
        backgroundColor: '#007AFF',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    updateButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    laterButton: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    laterButtonText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '700',
    },
    progressContainer: {
        width: '100%',
        alignItems: 'center',
    },
    progressLabel: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
        marginBottom: 8,
    },
    progressBarBg: {
        width: '100%',
        height: 8,
        backgroundColor: '#E5E5E5',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#007AFF',
    },
});

export default UpdateModal;
