import React from 'react';
import { useAuth } from '../context/AuthContext';
import { auth, provider, browserPopupRedirectResolver } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import { useNavigate, Navigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import './Login.css';

const Login = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  if (currentUser) {
    return <Navigate to="/chat" />;
  }

  const handleGoogleSignIn = async () => {
    try {
      // Use the resolver to handle COOP/COEP isolation
      await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      navigate('/chat');
    } catch (error) {
      console.error('Error signing in with Google:', error);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card glass-panel animate-fade-in">
        <div className="brand">
          <MessageSquare size={48} className="brand-icon" />
          <h1>SmartChat</h1>
          <p>Real-time chat based on your interests</p>
        </div>
        
        <button className="google-btn" onClick={handleGoogleSignIn}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="google-icon" />
          <span>Continue with Google</span>
        </button>
        
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
      </div>
    </div>
  );
};

export default Login;
