import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Shield, UserX, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';

const Admin = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('reportedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReports(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

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

      <div className="glass-panel overflow-hidden border border-white/10 bg-slate-900/50 backdrop-blur-xl rounded-3xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white/5 text-gray-400 text-xs uppercase tracking-widest font-bold">
              <tr>
                <th className="p-4 border-b border-white/10">Time</th>
                <th className="p-4 border-b border-white/10">Reporter UID</th>
                <th className="p-4 border-b border-white/10">Reason</th>
                <th className="p-4 border-b border-white/10">Type</th>
                <th className="p-4 border-b border-white/10 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {reports.length === 0 && !loading && (
                <tr>
                  <td colSpan="5" className="p-10 text-center text-gray-500 italic">No reports found. The community is safe!</td>
                </tr>
              )}
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-white/5 transition-colors group">
                  <td className="p-4 border-b border-white/5 text-gray-300">
                    {report.reportedAt?.toDate().toLocaleString()}
                  </td>
                  <td className="p-4 border-b border-white/5 font-mono text-[10px] text-gray-500">
                    {report.reporterUid}
                  </td>
                  <td className="p-4 border-b border-white/5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                      report.reason === 'inappropriate' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                    }`}>
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
                      <button 
                        onClick={() => handleBan(report.reportedUid)}
                        className="p-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-lg transition-all"
                        title="Ban Reported User"
                      >
                        <UserX size={16} />
                      </button>
                      <button 
                        onClick={() => deleteReport(report.id)}
                        className="p-2 bg-white/10 hover:bg-white/20 text-gray-400 rounded-lg transition-all"
                        title="Dismiss Report"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Admin;
