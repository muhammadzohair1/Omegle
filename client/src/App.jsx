import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import InterestSelector from './pages/InterestSelector';
import Chat from './pages/Chat';
import Admin from './pages/Admin';
import './index.css';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" />;
  return children;
};

// Require Interests Route Wrapper
const RequireInterestsRoute = ({ children }) => {
  const { currentUser, userInterests } = useAuth();
  
  if (!currentUser) return <Navigate to="/login" />;
  if (!userInterests) return <Navigate to="/interests" />;
  
  return children;
};

function App() {
  return (
    <Router>
      <div className="page-wrapper">
        <Navbar />
        <div className="main-content">
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/interests" element={
              <ProtectedRoute>
                <InterestSelector />
              </ProtectedRoute>
            } />
            
            <Route path="/chat" element={
              <RequireInterestsRoute>
                <Chat />
              </RequireInterestsRoute>
            } />

            <Route path="/admin" element={<Admin />} />
            
            <Route path="/" element={<Navigate to="/chat" />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
