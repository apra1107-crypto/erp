import React, { useState } from 'react';
import './Header.css';
import DownloadDialog from './DownloadDialog';

const Header = ({ onLoginClick }) => {
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);

    return (
        <header className="main-header">
            <div className="header-inner">
                <div className="brand-section">
                    <a href="/" className="logo-text">
                        Klass<span className="logo-highlight">in</span>
                    </a>
                </div>

                <nav className="nav-actions">
                    <a href="#features" className="nav-link-item">Features</a>
                    <a href="#about" className="nav-link-item">About</a>
                    <button 
                        className="btn-download-nav" 
                        onClick={() => setIsDownloadOpen(true)}
                    >
                        Download App
                    </button>
                    <button className="btn-login-minimal" onClick={onLoginClick}>
                        Login
                    </button>
                </nav>

                <DownloadDialog 
                    isOpen={isDownloadOpen} 
                    onClose={() => setIsDownloadOpen(false)} 
                />
            </div>
        </header>
    );
};

export default Header;