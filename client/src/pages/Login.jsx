import React from 'react';
import { useAuth } from '../context/AuthContext';
import { auth, provider } from '../firebase';
<<<<<<< HEAD
import { signInWithPopup } from 'firebase/auth';
=======
import { signInWithPopup } from 'firebase/auth'; // Redirect hata kar Popup import kiya
>>>>>>> d389c754e7f9d962ff348ba94932599abd49cb5e
import { useNavigate, Navigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import './Login.css';

const Login = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

<<<<<<< HEAD
=======
  // Redirect result check karne ki ab zaroorat nahi hai popup ke saath
  // Magar humne currentUser ka logic rakha hai redirection handle karne ke liye

>>>>>>> d389c754e7f9d962ff348ba94932599abd49cb5e
  if (currentUser) {
    return <Navigate to="/chat" />;
  }

  const handleGoogleSignIn = async () => {
    try {
<<<<<<< HEAD
      // Use signInWithPopup to avoid Vercel COOP/redirect issues
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        console.log('✅ Popup Login Successful');
        navigate('/chat');
      }
    } catch (error) {
      console.error('Error during popup sign in:', error);
      // Optional: Add user-facing error message here
=======
      // Vercel par stable chalne ke liye Popup method
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        console.log('✅ Login Successful');
        navigate('/chat');
      }
    } catch (error) {
      console.error('Error during Google Sign In:', error);
>>>>>>> d389c754e7f9d962ff348ba94932599abd49cb5e
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
