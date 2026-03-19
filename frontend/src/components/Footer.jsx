import React from 'react';
import './Footer.css';

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="main-footer">
            <div className="container">
                <div className="footer-grid">
                    {/* Brand Section */}
                    <div className="footer-brand">
                        <a href="/" className="logo-text">
                            Klass<span className="logo-highlight">in</span>
                        </a>
                        <p className="footer-tagline">
                            The intelligent operating system for modern educational institutions. 
                            Streamlining administration, empowering educators.
                        </p>
                        <div className="social-links">
                            <a href="#" className="social-icon" aria-label="Facebook">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
                            </a>
                            <a href="#" className="social-icon" aria-label="Instagram">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                            </a>
                        </div>
                    </div>

                    {/* Links - Product */}
                    <div className="footer-links-group">
                        <h4 className="footer-title">Solutions</h4>
                        <ul className="footer-links">
                            <li><a href="#features">Smart Features</a></li>
                            <li><a href="#">Academic Core</a></li>
                            <li><a href="#">Financial Suite</a></li>
                            <li><a href="#">Attendance HQ</a></li>
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div className="footer-links-group">
                        <h4 className="footer-title">Connect</h4>
                        <ul className="footer-links contact-list">
                            <li>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                <span>support@klassin.co.in</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="footer-bottom">
                    <p className="copyright">
                        &copy; 2026 <span className="brand-accent">klassin.co.in</span>. All rights reserved.
                    </p>
                    <div className="footer-bottom-links">
                        <span className="status-indicator">
                            <span className="status-dot"></span>
                            All systems operational
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
