import React, { useState } from 'react';
import './DownloadDialog.css';

const DownloadDialog = ({ isOpen, onClose }) => {
    const [loading, setLoading] = useState(false);

    const handleDownload = async () => {
        setLoading(true);
        try {
            // Trigger actual download from E2E Storage
            const link = document.createElement('a');
            link.href = `https://klassin.co.in/downloads/klassinv120.apk?v=${Date.now()}`; 
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
                
                <h2 className="dialog-title">Get the NEW Klassin App</h2>
                <p className="dialog-subtitle">Manage your school on the go with our Android application.</p>
                
                <div className="download-instructions">
                    <p><strong>Note:</strong> Since this is a direct APK download, you may need to enable "Install from Unknown Sources" in your phone's settings.</p>
                </div>

                <a
                  href="https://klassin.co.in/downloads/klassinv120.apk"
                    className="btn-download-primary"
                 style={{ textDecoration: 'none', display: 'flex', justifyContent:'center', alignItems: 'center' }} 
                 download
               >Download APK for Android</a>
            </div>
        </div>
    );
};

export default DownloadDialog;