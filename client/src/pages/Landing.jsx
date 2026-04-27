import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Shield, Zap, Users, Globe, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 30 }
  }
};

const Landing = () => {
  return (
    <div className="landing-container relative bg-obsidian text-slate-100 min-h-screen font-inter selection:bg-cyan-neon/30">
      <div className="landing-bg-glow absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-obsidian to-obsidian pointer-events-none"></div>
      
      {/* Hero Section */}
      <motion.section 
        className="landing-hero max-w-7xl mx-auto relative z-10 flex flex-col items-center justify-center pt-32 pb-20 text-center px-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} className="brand-badge mb-8 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black tracking-widest uppercase text-cyan-neon backdrop-blur-md shadow-glass-inset">
          SmartChat v2.0 • Digital Intimacy
        </motion.div>
        
        <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 leading-tight">
          Connect with the <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-neon to-purple-plasma">Digital World</span>
        </motion.h1>
        
        <motion.p variants={itemVariants} className="max-w-2xl text-slate-400 text-lg md:text-xl mb-12">
          Experience high-fidelity video chat powered by interest-based matching. 
          The next generation of human connection is here.
        </motion.p>
        
        <motion.div variants={itemVariants}>
          <Link to="/login" className="cta-button group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white bg-white/10 rounded-2xl backdrop-blur-md border border-white/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-neon-cyan overflow-hidden">
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-cyan-neon/20 to-purple-plasma/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <span className="relative z-10 uppercase tracking-widest text-sm">START CHATTING NOW</span>
          </Link>
        </motion.div>
      </motion.section>

      {/* Features Section - Bento Box Style */}
      <motion.section 
        className="landing-features relative z-10 max-w-6xl mx-auto px-4 py-20 grid grid-cols-1 md:grid-cols-3 gap-6"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
      >
        <motion.div variants={itemVariants} className="feature-card relative overflow-hidden bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8 hover:border-cyan-neon/50 transition-colors duration-300 group shadow-glass-inset">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
          <div className="feature-icon w-12 h-12 rounded-xl bg-cyan-neon/10 flex items-center justify-center mb-6 border border-cyan-neon/20 group-hover:scale-110 transition-transform duration-300">
            <Zap size={24} className="text-cyan-neon" />
          </div>
          <h3 className="text-xl font-semibold mb-3 text-white tracking-tight">Smart Matching</h3>
          <p className="text-slate-400 leading-relaxed text-sm">Our advanced algorithm connects you with people who share your specific passions and hobbies.</p>
        </motion.div>

        <motion.div variants={itemVariants} className="feature-card relative overflow-hidden bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8 hover:border-purple-plasma/50 transition-colors duration-300 group shadow-glass-inset">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
          <div className="feature-icon w-12 h-12 rounded-xl bg-purple-plasma/10 flex items-center justify-center mb-6 border border-purple-plasma/20 group-hover:scale-110 transition-transform duration-300">
            <Shield size={24} className="text-purple-plasma" />
          </div>
          <h3 className="text-xl font-semibold mb-3 text-white tracking-tight">AI Moderation</h3>
          <p className="text-slate-400 leading-relaxed text-sm">Real-time safety filters ensure a clean and respectful environment for everyone, automatically.</p>
        </motion.div>

        <motion.div variants={itemVariants} className="feature-card relative overflow-hidden bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8 hover:border-white/30 transition-colors duration-300 group shadow-glass-inset">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
          <div className="feature-icon w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6 border border-white/10 group-hover:scale-110 transition-transform duration-300">
            <Lock size={24} className="text-slate-300" />
          </div>
          <h3 className="text-xl font-semibold mb-3 text-white tracking-tight">Encrypted Privacy</h3>
          <p className="text-slate-400 leading-relaxed text-sm">Your connections are secure and private. We prioritize your digital safety above all else.</p>
        </motion.div>
      </motion.section>

      {/* Footer */}
      <footer className="relative z-10 py-12 text-center border-t border-white/5 bg-obsidian/80 backdrop-blur-md">
        <p className="text-[10px] font-black tracking-[0.3em] uppercase text-slate-600 mb-6">
          Built for the future of social interaction
        </p>
        <div className="flex justify-center gap-8 text-slate-500 text-xs font-bold uppercase tracking-widest">
          <a href="#" className="hover:text-cyan-neon transition-colors duration-300">Safety</a>
          <a href="#" className="hover:text-cyan-neon transition-colors duration-300">Privacy</a>
          <a href="#" className="hover:text-cyan-neon transition-colors duration-300">Terms</a>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
