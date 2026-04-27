import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Shield, Zap, Users, Globe, Lock } from 'lucide-react';
import './Landing.css';

const Landing = () => {
  return (
    <div className="landing-container">
      <div className="landing-bg-glow"></div>
      
      {/* Hero Section */}
      <section className="landing-hero">
        <div className="brand-badge mb-8 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black tracking-widest uppercase text-cyan-400">
          SmartChat v2.0 • Digital Intimacy
        </div>
        <h1>Connect with the <br/> <span className="text-cyan-400">Digital World</span></h1>
        <p>
          Experience high-fidelity video chat powered by interest-based matching. 
          The next generation of human connection is here.
        </p>
        <Link to="/login" className="cta-button">
          START CHATTING NOW
        </Link>
      </section>

      {/* Demo Preview */}
      <section className="demo-preview">
        <div className="preview-window">
          <div className="preview-content">
            <div className="preview-overlay"></div>
            <div className="absolute bottom-8 left-8 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-cyan-400/20 border border-cyan-400/30 flex items-center justify-center">
                <Users size={20} className="text-cyan-400" />
              </div>
              <div>
                <p className="text-xs font-black uppercase text-white">Live Match</p>
                <p className="text-[10px] text-gray-400">9.4k Users Online</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="landing-features">
        <div className="feature-card glass-panel">
          <div className="feature-icon">
            <Zap size={24} />
          </div>
          <h3>Smart Matching</h3>
          <p>Our advanced algorithm connects you with people who share your specific passions and hobbies.</p>
        </div>

        <div className="feature-card glass-panel">
          <div className="feature-icon">
            <Shield size={24} />
          </div>
          <h3>AI Moderation</h3>
          <p>Real-time safety filters ensure a clean and respectful environment for everyone, automatically.</p>
        </div>

        <div className="feature-card glass-panel">
          <div className="feature-icon">
            <Lock size={24} />
          </div>
          <h3>Encrypted Privacy</h3>
          <p>Your connections are secure and private. We prioritize your digital safety above all else.</p>
        </div>
      </section>

      {/* Footer / Final CTA */}
      <footer className="py-20 text-center border-t border-white/5">
        <p className="text-[10px] font-black tracking-[0.3em] uppercase text-gray-600 mb-4">
          Built for the future of social interaction
        </p>
        <div className="flex justify-center gap-8 text-gray-500 text-xs font-bold uppercase tracking-widest">
          <a href="#" className="hover:text-cyan-400 transition-colors">Safety</a>
          <a href="#" className="hover:text-cyan-400 transition-colors">Privacy</a>
          <a href="#" className="hover:text-cyan-400 transition-colors">Terms</a>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
