import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth, provider } from '../firebase';
import { signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { useNavigate, Navigate } from 'react-router-dom';
import { MessageSquare, Loader } from 'lucide-react';
import './Login.css';

const Login = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Capture the result when the user is redirected back to the app
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log('✅ Redirect Login Successful');
          navigate('/chat');
        }
      })
      .catch((error) => {
        console.error('Error with redirect result:', error);
      });
  }, [navigate]);

  if (currentUser) {
    return <Navigate to="/chat" />;
  }

  const handleGoogleSignIn = async () => {
    try {
      // Switch to Redirect to bypass COOP/COEP popup blocks
      await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error('Error initiating redirect sign in:', error);
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
