import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_ENDPOINTS } from '../config';
import './DownloadDialog.css';

const DownloadDialog = ({ isOpen, onClose }) => {
    const [downloadCount, setDownloadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchDownloadCount();
        }
    }, [isOpen]);

    const fetchDownloadCount = async () => {
        try {
            const response = await axios.get(`${API_ENDPOINTS.STATS}/download-count`);
            setDownloadCount(response.data.count);
        } catch (error) {
            console.error('Error fetching download count:', error);
        }
    };

    const handleDownload = async () => {
        setLoading(true);
        try {
            // Trigger actual download from E2E Storage
            const link = document.createElement('a');
            link.href = `https://klassin.co.in/downloads/klassin.apk?v=${Date.now()}`; 
            link.download = 'Klassin-ERP.apk';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
         } catch (error) {
            console.error('Error during download process:', error);
           } finally {
             setLoading(false);
         }
      };
      
    if (!isOpen) return null;

    return (
        <div className="download-dialog-overlay" onClick={onClose}>
            <div className="download-dialog-content" onClick={(e) => e.stopPropagation()}>
                <button className="close-dialog-btn" onClick={onClose}>&times;</button>
                
                <div className="app-icon-container">
                    <div className="app-icon-preview">K</div>
                </div>
                
                <h2 className="dialog-title">Get the Klassin App</h2>
                <p className="dialog-subtitle">Manage your school on the go with our Android application.</p>
                
                <div className="app-details-grid">
                    <div className="detail-item">
                        <span className="detail-label">Version</span>
                        <span className="detail-value">v1.0.0</span>
                    </div>
                    <div className="detail-item">
                        <span className="detail-value-highlight">{downloadCount}+</span>
                        <span className="detail-label">Downloads</span>
                    </div>
                    <div className="detail-item">
                        <span className="detail-label">Size</span>
                        <span className="detail-value">~15 MB</span>
                    </div>
                </div>

                <div className="download-instructions">
                    <p><strong>Note:</strong> Since this is a direct APK download, you may need to enable "Install from Unknown Sources" in your phone's settings.</p>
                </div>

                <a
                  href="https://klassin.co.in/downloads/klassin.apk"
                    className="btn-download-primary"
                 style={{ textDecoration: 'none', display: 'flex', justifyContent:'center', alignItems: 'center' }} 
                 download
               >Download APK for Android</a>
            </div>
        </div>
    );
};

export default DownloadDialog;
