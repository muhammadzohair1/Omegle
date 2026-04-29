import React from 'react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Settings, MessageSquare, User } from 'lucide-react';
import './Navbar.css';

const Navbar = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (!currentUser) return null;

  return (
    <nav className="navbar">
      <div className="navbar-glass">
        <div className="navbar-container">
          <Link to="/chat" className="navbar-logo">
            <MessageSquare className="logo-icon" />
            <span className="hidden sm:inline">SmartChat</span>
          </Link>
          
          <div className="navbar-links">
            <div className="user-profile-badge">
              {currentUser.photoURL ? (
                <img src={currentUser.photoURL} alt="Profile" className="profile-pic-mini" />
              ) : (
                <div className="profile-placeholder"><User size={16} /></div>
              )}
              <span className="badge-name">{currentUser.displayName || 'User'}</span>
            </div>

            <Link to="/interests" className="nav-action-btn btn-interests" title="Edit Interests">
              <Settings size={16} />
              <span className="nav-text">Interests</span>
            </Link>
            
            <button onClick={handleLogout} className="nav-action-btn btn-logout" title="Logout">
              <LogOut size={16} />
              <span className="nav-text">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
