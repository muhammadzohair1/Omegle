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
    <nav className="navbar glass-panel">
      <div className="navbar-container">
        <Link to="/chat" className="navbar-logo">
          <MessageSquare className="logo-icon" />
          <span>SmartChat</span>
        </Link>
        
        <div className="navbar-links">
          <div className="user-profile">
            {currentUser.photoURL ? (
              <img src={currentUser.photoURL} alt="Profile" className="profile-pic" />
            ) : (
              <div className="profile-placeholder"><User size={20} /></div>
            )}
            <span className="user-name">{currentUser.displayName || 'User'}</span>
          </div>

          <Link to="/interests" className="nav-btn btn-secondary" title="Edit Interests">
            <Settings size={18} />
            <span className="nav-text">Interests</span>
          </Link>
          
          <button onClick={handleLogout} className="nav-btn btn-danger" title="Logout">
            <LogOut size={18} />
            <span className="nav-text">Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
