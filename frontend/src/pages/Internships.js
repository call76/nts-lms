import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { FaMapMarkerAlt, FaClock, FaMoneyBillWave, FaCalendarAlt, FaCheckCircle, FaTimesCircle, FaHourglassHalf, FaEnvelope } from 'react-icons/fa';
import toast from 'react-hot-toast';
import api from '../services/api';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { SOCKET_URL } from '../services/config';
import PageHero from '../components/PageHero';
import InternshipEditor from '../components/InternshipEditor';

const Internships = () => {
  const { user, token } = useAuthStore();
  const navigate = useNavigate();
  const [internships, setInternships] = useState([]);
  const [applications, setApplications] = useState({});
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(null);
  const [withdrawing, setWithdrawing] = useState(null);
  const [socket, setSocket] = useState(null);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const canEdit = user?.role === 'ADMIN' || (user?.role === 'TRAINER' && user?.canEditInternships);
  
  useEffect(() => {
    const newSocket = io(SOCKET_URL, { auth: { token } });
    setSocket(newSocket);
    fetchInternships();
    fetchUserApplications();
    newSocket.on('application:status:updated', (data) => {
      toast.success(`Your application for ${data.internshipTitle} is now ${data.status}`);
      fetchUserApplications();
    });
    return () => newSocket.disconnect();
  }, [token]);
  
  const fetchInternships = async () => {
    try {
      const res = await api.get('/internships');
      setInternships(res.data || []);
    } catch (error) {
      console.error('Failed to fetch internships', error);
      toast.error('Failed to load internships');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchUserApplications = async () => {
    try {
      const res = await api.get('/my-applications');
      const userApps = {};
      if (res.data && Array.isArray(res.data)) {
        res.data.forEach(app => { userApps[app.internshipId] = app; });
      }
      setApplications(userApps);
    } catch (error) {
      console.error('Failed to fetch applications', error);
    }
  };
  
  const applyForInternship = async (internshipId) => {
    setApplying(internshipId);
    try {
      await api.post(`/internships/${internshipId}/apply`, {});
      toast.success('Application submitted!');
      await fetchUserApplications();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to apply');
    } finally {
      setApplying(null);
    }
  };
  
  const withdrawApplication = async (applicationId, internshipId) => {
    setWithdrawing(internshipId);
    try {
      await api.delete(`/applications/${applicationId}`);
      toast.success('Application withdrawn');
      await fetchUserApplications();
    } catch (error) {
      toast.error('Failed to withdraw application');
    } finally {
      setWithdrawing(null);
    }
  };
  
  const toggleActive = async (i) => {
    try { await api.patch(`/internships/${i.id}/active`, { isActive: !i.isActive }); toast.success(i.isActive ? 'Internship deactivated (students no longer see it)' : 'Internship activated'); fetchInternships(); }
    catch (error) { toast.error(error.response?.data?.error || 'Could not change status'); }
  };
  const removeInternship = async (i) => {
    if (!window.confirm(`Delete "${i.title}" and all its applications? Consider deactivating it instead.`)) return;
    try { await api.delete(`/internships/${i.id}`); toast.success('Internship deleted'); fetchInternships(); }
    catch (error) { toast.error(error.response?.data?.error || 'Could not delete'); }
  };

  const contactCompany = async () => {
    try {
      const adminRes = await api.get('/admin/contact');
      if (adminRes.data && adminRes.data.id) {
        const chatRes = await api.post(`/chat/private/${adminRes.data.id}`);
        navigate('/messages', { state: { selectedChat: chatRes.data } });
      } else {
        toast.error('Could not find admin contact');
      }
    } catch (error) {
      toast.error('Could not start conversation');
    }
  };
  
  const getStatusIcon = (status) => {
    switch(status) {
      case 'APPROVED': return <FaCheckCircle className="text-green-500" size={14} />;
      case 'REJECTED': return <FaTimesCircle className="text-red-500" size={14} />;
      default: return <FaHourglassHalf className="text-yellow-500" size={14} />;
    }
  };
  
  const getStatusColor = (status) => {
    switch(status) {
      case 'APPROVED': return 'bg-green-100 text-green-700 border-green-200';
      case 'REJECTED': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  };
  
  const getStatusText = (status) => {
    switch(status) {
      case 'APPROVED': return '✓ Approved';
      case 'REJECTED': return '✗ Rejected';
      default: return '⏳ Pending';
    }
  };
  
  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nts-green-600"></div></div>;
  }
  
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
      <PageHero slot="internshipsHero" title="Internship Opportunities" subtitle="Turn your skills into real-world experience" />
      {canEdit && <InternshipEditor onSaved={fetchInternships} />}
      {editing && <InternshipEditor editing={editing} onClose={() => setEditing(null)} onSaved={fetchInternships} />}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {internships.map(internship => {
          const application = applications[internship.id];
          const isExpired = new Date(internship.deadline) < new Date();
          const hasApplied = !!application;
          
          return (
            <div key={internship.id} className={`bg-white rounded-xl shadow-sm border p-5 md:p-6 hover:shadow-md transition relative ${internship.isActive === false ? 'opacity-70' : ''}`}>
              {internship.isActive === false && <span className="absolute left-4 -top-2 rounded-full bg-slate-700 px-3 py-0.5 text-[11px] font-bold text-white">Deactivated</span>}
              {hasApplied && (
                <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1 ${getStatusColor(application.status)}`}>
                  {getStatusIcon(application.status)} <span>{getStatusText(application.status)}</span>
                </div>
              )}
              
              <div className="pr-24">
                <h2 className="text-lg md:text-xl font-bold text-gray-800">{internship.title}</h2>
                <p className="text-nts-green-600 font-medium mt-1">{internship.company}</p>
              </div>
              
              <div className="flex flex-wrap gap-3 mt-3 text-sm text-gray-500">
                {internship.location && <span className="flex items-center"><FaMapMarkerAlt className="mr-1 flex-shrink-0" size={12} /> {internship.location}</span>}
                <span className="flex items-center"><FaClock className="mr-1 flex-shrink-0" size={12} /> {internship.duration} months</span>
                {internship.stipend > 0 && <span className="flex items-center"><FaMoneyBillWave className="mr-1 flex-shrink-0" size={12} /> {internship.stipend.toLocaleString()} RWF/month</span>}
              </div>
              
              <p className="text-gray-600 mt-3 text-sm line-clamp-3">{internship.description}</p>
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-4 pt-3 border-t">
                <span className="text-xs text-gray-400 flex items-center"><FaCalendarAlt className="mr-1" size={12} /> Deadline: {new Date(internship.deadline).toLocaleDateString()}{isExpired && <span className="ml-2 text-red-500">(Expired)</span>}</span>
                
                {user?.role === 'STUDENT' && (
                  hasApplied ? (
                    <div className="flex flex-wrap gap-2">
                      {application.status === 'PENDING' && (
                        <button onClick={() => withdrawApplication(application.id, internship.id)} disabled={withdrawing === internship.id} className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition disabled:opacity-50">
                          {withdrawing === internship.id ? 'Withdrawing...' : 'Withdraw Application'}
                        </button>
                      )}
                      {application.status === 'APPROVED' && (
                        <button onClick={() => { setSelectedApplication(application); setShowMessageModal(true); }} className="px-4 py-2 bg-nts-green-600 text-white text-sm rounded-lg hover:bg-nts-green-700 transition flex items-center space-x-2">
                          <FaEnvelope size={14} /> <span>Contact Company</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => applyForInternship(internship.id)} disabled={applying === internship.id || isExpired} className="px-4 py-2 bg-nts-green-600 text-white rounded-lg font-semibold hover:bg-nts-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
                      {applying === internship.id ? 'Applying...' : 'Apply Now'}
                    </button>
                  )
                )}
              </div>
              
              {canEdit && (
                <div className="mt-3 flex flex-wrap gap-3 border-t pt-3 text-xs font-bold">
                  <button onClick={() => setEditing(internship)} className="text-blue-700">Edit</button>
                  <button onClick={() => toggleActive(internship)} className={internship.isActive === false ? 'text-green-700' : 'text-amber-700'}>{internship.isActive === false ? 'Activate' : 'Deactivate'}</button>
                  <button onClick={() => removeInternship(internship)} className="text-red-600">Delete</button>
                </div>
              )}
              {application?.status === 'APPROVED' && (
                <div className="mt-3 p-2 bg-green-50 rounded-lg text-center text-sm text-green-700">🎉 Congratulations! Your application has been approved.</div>
              )}
              {application?.status === 'REJECTED' && (
                <div className="mt-3 p-2 bg-red-50 rounded-lg text-center text-sm text-red-700">Unfortunately, your application was not selected.</div>
              )}
            </div>
          );
        })}
      </div>
      
      {internships.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl"><p className="text-gray-500">No internships available at the moment.</p><p className="text-sm text-gray-400 mt-1">Check back later!</p></div>
      )}
      
      {showMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Contact Company</h3>
            <p className="text-gray-600 mb-4">Your application has been approved! You can now contact the company directly.</p>
            <div className="flex gap-3">
              <button onClick={contactCompany} className="flex-1 px-4 py-2 bg-nts-green-600 text-white rounded-lg hover:bg-nts-green-700 transition">Send Message</button>
              <button onClick={() => setShowMessageModal(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Internships;