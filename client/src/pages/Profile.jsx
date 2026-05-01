import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, auth } from '../firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { deleteUser, updateProfile as updateAuthProfile } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Calendar, Edit3, Trash2, Save, X, ArrowLeft, Shield } from 'lucide-react';
import './Profile.css';

const Profile = () => {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setBio(userProfile.bio || '');
    }
  }, [userProfile]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Update Firestore
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        displayName,
        bio
      });

      // Update Auth Profile
      await updateAuthProfile(currentUser, { displayName });

      await refreshProfile();
      setIsEditing(false);
    } catch (err) {
      setError('Failed to update profile: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirm = window.confirm(
      "Are you absolutely sure? This will permanently delete your profile and account data. This action cannot be undone."
    );

    if (confirm) {
      setLoading(true);
      try {
        // 1. Delete Firestore Data
        await deleteDoc(doc(db, 'users', currentUser.uid));
        
        // 2. Delete Auth Account
        await deleteUser(currentUser);
        
        navigate('/login');
      } catch (err) {
        setError('Error deleting account: ' + err.message + '. You might need to re-login to perform this sensitive action.');
      } finally {
        setLoading(false);
      }
    }
  };

  if (!userProfile) return <div className="loading-screen">Loading Profile...</div>;

  return (
    <div className="profile-page">
      <div className="profile-container">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="profile-card glass-panel"
        >
          <div className="profile-header">
            <button onClick={() => navigate(-1)} className="back-btn">
              <ArrowLeft size={20} />
            </button>
            <h2>User Profile</h2>
            <div className="header-actions">
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="edit-btn">
                  <Edit3 size={18} />
                  <span>Edit</span>
                </button>
              ) : (
                <button onClick={() => setIsEditing(false)} className="cancel-btn">
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          <div className="profile-avatar-section">
            <div className="avatar-wrapper">
              <img src={userProfile.photoURL} alt="Avatar" />
              <div className="online-indicator"></div>
            </div>
            <div className="profile-main-info">
              {!isEditing ? (
                <h3>{userProfile.displayName}</h3>
              ) : (
                <div className="edit-input-group">
                  <input 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Display Name"
                    className="edit-input"
                  />
                </div>
              )}
              <p className="user-email">
                <Mail size={14} />
                {currentUser.email}
              </p>
            </div>
          </div>

          <div className="profile-details">
            <div className="detail-section">
              <label>Bio</label>
              {!isEditing ? (
                <p className="bio-text">{userProfile.bio || 'No bio yet.'}</p>
              ) : (
                <textarea 
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  className="edit-textarea"
                />
              )}
            </div>

            <div className="info-grid">
              <div className="info-item">
                <Calendar size={18} />
                <div>
                  <span>Joined</span>
                  <p>{userProfile.createdAt?.toDate().toLocaleDateString() || 'N/A'}</p>
                </div>
              </div>
              <div className="info-item">
                <Shield size={18} />
                <div>
                  <span>Account Status</span>
                  <p className="status-verified">Verified</p>
                </div>
              </div>
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}

          <div className="profile-footer">
            {isEditing ? (
              <button 
                onClick={handleUpdate} 
                className="save-btn" 
                disabled={loading}
              >
                <Save size={18} />
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            ) : (
              <button 
                onClick={handleDeleteAccount} 
                className="delete-account-btn"
                disabled={loading}
              >
                <Trash2 size={18} />
                Delete Account
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
