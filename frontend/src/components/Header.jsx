import React from 'react';
import './Header.css';

const Header = ({ onLoginClick }) => {
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
                    <a href="#contact" className="nav-link-item">Contact</a>
                    <button className="btn-login-minimal" onClick={onLoginClick}>
                        Login
                    </button>
                </nav>
            </div>
        </header>
    );
};

export default Header;