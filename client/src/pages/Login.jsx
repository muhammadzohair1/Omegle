import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth, provider, db } from '../firebase';
import { 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile 
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate, Navigate } from 'react-router-dom';
import { MessageSquare, Mail, Lock, User, LogIn, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './Login.css';

const Login = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (currentUser) {
    return <Navigate to="/interests" />;
  }

  const createUserProfile = async (user, additionalData = {}) => {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      const { email, displayName, photoURL, uid } = user;
      const createdAt = serverTimestamp();

      try {
        await setDoc(userRef, {
          uid,
          displayName: additionalData.displayName || displayName || 'Anonymous Stranger',
          email,
          photoURL: photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
          bio: 'Hey there! I am using SmartChat.',
          createdAt,
          interests: { category: 'Casual', subOptions: [] },
          ...additionalData
        });
      } catch (err) {
        console.error('Error creating user profile', err);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        await createUserProfile(result.user);
        navigate('/interests');
      }
    } catch (err) {
      setError(err.message);
      console.error('Error during Google Sign In:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName });
        await createUserProfile(result.user, { displayName });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/interests');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="login-card glass-panel"
      >
        <div className="brand">
          <MessageSquare size={48} className="brand-icon" />
          <h1>SmartChat</h1>
          <p>Real-time chat based on your interests</p>
        </div>

        <AnimatePresence mode="wait">
          <motion.form
            key={isSignUp ? 'signup' : 'login'}
            initial={{ opacity: 0, x: isSignUp ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isSignUp ? -20 : 20 }}
            onSubmit={handleEmailAuth}
            className="auth-form"
          >
            {isSignUp && (
              <div className="input-group">
                <User size={20} />
                <input
                  type="text"
                  placeholder="Display Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="input-group">
              <Mail size={20} />
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <Lock size={20} />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="error-text">{error}</p>}

            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
              {isSignUp ? <UserPlus size={20} /> : <LogIn size={20} />}
            </button>
          </motion.form>
        </AnimatePresence>

        <div className="divider">
          <span>OR</span>
        </div>

        <button className="google-btn" onClick={handleGoogleSignIn} disabled={loading}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="google-icon" />
          <span>Continue with Google</span>
        </button>

        <p className="toggle-auth">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => setIsSignUp(!isSignUp)} className="toggle-btn">
            {isSignUp ? 'Sign In' : 'Create Account'}
          </button>
        </p>

        <div className="features-grid">
          <div className="feature-item">
            <span className="feature-dot"></span>
            Smart Matching
          </div>
          <div className="feature-item">
            <span className="feature-dot"></span>
            Interest Based
          </div>
          <div className="feature-item">
            <span className="feature-dot"></span>
            Secure & Safe
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
