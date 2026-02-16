import React, { useState } from 'react';
import './Header.css';
import DownloadDialog from './DownloadDialog';

const Header = ({ onLoginClick }) => {
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    return (
        <header className="main-header">
            <div className="header-inner">
                <div className="brand-section">
                    <a href="/" className="logo-text">
                        Klass<span className="logo-highlight">in</span>
                    </a>
                </div>

                <nav className={`nav-actions ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
                    <a href="#features" className="nav-link-item" onClick={() => setIsMobileMenuOpen(false)}>Features</a>
                    <a href="#about" className="nav-link-item" onClick={() => setIsMobileMenuOpen(false)}>About</a>
                    <button 
                        className="btn-download-nav" 
                        onClick={() => {
                            setIsDownloadOpen(true);
                            setIsMobileMenuOpen(false);
                        }}
                    >
                        Download App
                    </button>
                    <button className="btn-login-minimal" onClick={() => {
                        onLoginClick();
                        setIsMobileMenuOpen(false);
                    }}>
                        Login
                    </button>
                </nav>

                <button className="mobile-menu-toggle" onClick={toggleMobileMenu}>
                    <svg 
                        width="24" 
                        height="24" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                    >
                        {isMobileMenuOpen ? (
                            <>
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </>
                        ) : (
                            <>
                                <line x1="3" y1="12" x2="21" y2="12"></line>
                                <line x1="3" y1="6" x2="21" y2="6"></line>
                                <line x1="3" y1="18" x2="21" y2="18"></line>
                            </>
                        )}
                    </svg>
                </button>

                <DownloadDialog 
                    isOpen={isDownloadOpen} 
                    onClose={() => setIsDownloadOpen(false)} 
                />
            </div>
        </header>
    );
};

export default Header;