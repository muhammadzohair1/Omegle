import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Shield, UserX, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';

const Admin = () => {
  const [reports, setReports] = useState([]);
  const [bannedUsers, setBannedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('reports');

  useEffect(() => {
    const qReports = query(collection(db, 'reports'), orderBy('reportedAt', 'desc'));
    const unsubscribeReports = onSnapshot(qReports, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qBanned = query(collection(db, 'banned'), orderBy('bannedAt', 'desc'));
    const unsubscribeBanned = onSnapshot(qBanned, (snapshot) => {
      setBannedUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubscribeReports();
      unsubscribeBanned();
    };
  }, []);

  const handleUnban = async (uid) => {
    try {
      await deleteDoc(doc(db, 'banned', uid));
      alert('User Unbanned.');
    } catch (err) {
      console.error(err);
    }
  };

  const getRemainingTime = (expiresAt) => {
    if (!expiresAt) return 'Permanent';
    const diff = expiresAt.toDate() - new Date();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const handleBan = async (uid) => {
    if (!window.confirm('Are you sure you want to BAN this user?')) return;
    try {
      await setDoc(doc(db, 'banned', uid), {
        bannedAt: new Date(),
        reason: 'Violation of safety terms detected via AI or User Report'
      });
      alert('User Banned successfully.');
    } catch (err) {
      console.error(err);
      alert('Error banning user.');
    }
  };

  const deleteReport = async (id) => {
    try {
      await deleteDoc(doc(db, 'reports', id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="admin-container p-6 max-w-6xl mx-auto min-h-screen">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Shield className="text-white" size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white">Moderation Hub</h1>
          <p className="text-gray-400 text-sm">Real-time reports and user management</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search UID, reason, or status..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-12 text-white outline-none focus:border-indigo-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Shield className="absolute left-4 top-3.5 text-gray-500" size={20} />
        </div>
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'reports' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            Reports ({reports.length})
          </button>
          <button
            onClick={() => setActiveTab('bans')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'bans' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            Banned ({bannedUsers.length})
          </button>
        </div>
      </div>

      <div className="glass-panel overflow-hidden border border-white/10 bg-slate-900/50 backdrop-blur-xl rounded-3xl">
        <div className="overflow-x-auto">
          {activeTab === 'reports' ? (
            <table className="w-full text-left border-collapse">
              <thead className="bg-white/5 text-gray-400 text-xs uppercase tracking-widest font-bold">
                <tr>
                  <th className="p-4 border-b border-white/10">Time</th>
                  <th className="p-4 border-b border-white/10">Target UID</th>
                  <th className="p-4 border-b border-white/10">Reason</th>
                  <th className="p-4 border-b border-white/10">Type</th>
                  <th className="p-4 border-b border-white/10 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {reports.filter(r => 
                  r.reportedUid?.includes(searchTerm) || 
                  r.reason?.includes(searchTerm)
                ).map((report) => (
                  <tr key={report.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-4 border-b border-white/5 text-gray-300">
                      {report.reportedAt?.toDate().toLocaleString()}
                    </td>
                    <td className="p-4 border-b border-white/5 font-mono text-[10px] text-gray-500">
                      {report.reportedUid}
                    </td>
                    <td className="p-4 border-b border-white/5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${report.reason === 'inappropriate' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
                        {report.reason}
                      </span>
                    </td>
                    <td className="p-4 border-b border-white/5">
                      {report.autoReport ? (
                        <span className="flex items-center gap-1 text-indigo-400 text-xs">
                          <Shield size={12} /> AI Detected
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-400 text-xs">
                          <UserX size={12} /> User Flagged
                        </span>
                      )}
                    </td>
                    <td className="p-4 border-b border-white/5 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleBan(report.reportedUid)} className="p-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-lg transition-all"><UserX size={16} /></button>
                        <button onClick={() => deleteReport(report.id)} className="p-2 bg-white/10 hover:bg-white/20 text-gray-400 rounded-lg transition-all"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-white/5 text-gray-400 text-xs uppercase tracking-widest font-bold">
                <tr>
                  <th className="p-4 border-b border-white/10">Banned At</th>
                  <th className="p-4 border-b border-white/10">UID</th>
                  <th className="p-4 border-b border-white/10">Time Left</th>
                  <th className="p-4 border-b border-white/10 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {bannedUsers.filter(b => b.id.includes(searchTerm)).map((ban) => (
                  <tr key={ban.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-4 border-b border-white/5 text-gray-300">{ban.bannedAt?.toDate().toLocaleString()}</td>
                    <td className="p-4 border-b border-white/5 font-mono text-[10px] text-gray-500">{ban.id}</td>
                    <td className="p-4 border-b border-white/5">
                      <span className="flex items-center gap-2 text-orange-400 font-bold">
                        <RefreshCw size={12} className="animate-spin-slow" />
                        {getRemainingTime(ban.expiresAt)}
                      </span>
                    </td>
                    <td className="p-4 border-b border-white/5 text-right">
                      <button onClick={() => handleUnban(ban.id)} className="px-4 py-2 bg-green-600/10 hover:bg-green-600 text-green-500 hover:text-white rounded-xl text-xs font-bold transition-all">Unban User</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
