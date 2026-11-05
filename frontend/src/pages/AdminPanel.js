import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  FaUsers, FaChalkboardTeacher, FaBook, FaBriefcase, FaTrash, 
  FaEdit, FaEye, FaSearch, FaCrown, FaPlus, 
  FaEnvelope, FaComment, FaChartLine, FaCheckCircle,
  FaTimesCircle, FaClock, FaUserGraduate, FaDatabase,
  FaCode, FaNetworkWired, FaMicrochip, FaBroadcastTower, FaVideo,
  FaPaperPlane, FaPlusCircle, FaKey, FaUserPlus, FaUndo, FaCopy, FaDownload, FaHistory, FaChild, FaLink
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Link } from 'react-router-dom';
import PageHero from '../components/PageHero';
import ModuleWizard from '../components/ModuleWizard';
import { asset } from '../services/assets';


const AdminPanel = () => {
  const { user, token } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ students: 0, trainers: 0, posts: 0, internships: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ fullName: '', email: '', phone: '', school: '', role: '', bio: '', status: 'ACTIVE' });
  // --- user management (add / reset password / filters) ---
  const USER_ROLES = [['STUDENT', 'Student'], ['TRAINER', 'Trainer'], ['ADMIN', 'Admin'], ['EMPLOYER', 'Employer'], ['PARENT', 'Parent'], ['GUEST', 'Guest']];
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const statusRef = useRef('');
  statusRef.current = statusFilter;
  const [userCounts, setUserCounts] = useState({ deleted: 0, inactive: 0, byRole: {} });
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: '', email: '', phone: '', role: 'STUDENT', password: '', status: 'ACTIVE' });
  const [showResetModal, setShowResetModal] = useState(false);
  const [userToReset, setUserToReset] = useState(null);
  const [resetMode, setResetMode] = useState('generate');
  const [resetPassword, setResetPassword] = useState('');
  const [credentials, setCredentials] = useState(null); // { name, email, password } shown once after create / reset
  const [savingUser, setSavingUser] = useState(false);
  const [auditLog, setAuditLog] = useState([]);
  const [parentLinks, setParentLinks] = useState([]);
  const [linkForm, setLinkForm] = useState({ parentId: '', studentId: '', relationship: 'Parent' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [applications, setApplications] = useState([]);
  const [internships, setInternships] = useState([]);
  const [showInternshipModal, setShowInternshipModal] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [newTrade, setNewTrade] = useState({ name: '', description: '', icon: 'FaCode', color: 'bg-green-500' });
  const [editModule, setEditModule] = useState(null);
  const [newInternship, setNewInternship] = useState({ title: '', company: '', description: '', location: '', duration: 3, stipend: 0, deadline: '' });
  const [allMessages, setAllMessages] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyInput, setReplyInput] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Complete trades data with all modules
  // Trades & modules now live in the database (they used to be lost on every page refresh)
  const [tradesData, setTradesData] = useState([]);
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const statsRes = await api.get('/dashboard/stats');
      setStats(statsRes.data);
      const appsRes = await api.get('/admin/applications');
      setApplications(appsRes.data || []);
      const internshipsRes = await api.get('/internships');
      setInternships(internshipsRes.data || []);
      const chatsRes = await api.get('/chat');
      setAllMessages(chatsRes.data || []);
      const tradesRes = await api.get('/trades');
      setTradesData(tradesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);
  
  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get('/admin/users', { params: { limit: 500, status: statusRef.current || undefined } });
      setUsers(res.data?.users || []);
      if (res.data?.counts) setUserCounts(res.data.counts);
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to load users'); }
  }, []);
  const refreshUsers = async () => { await loadUsers(); try { setStats((await api.get('/dashboard/stats')).data); } catch (e) { /* stats are optional */ } };

  const filterUsers = (list) => list.filter(u => {
    const q = searchTerm.trim().toLowerCase();
    const hit = !q || [u.fullName, u.email, u.phone].some(v => v?.toLowerCase().includes(q));
    return hit && (!roleFilter || u.role === roleFilter);
  });

  // Download the users that match the current search / filters as a CSV file (opens in Excel)
  const exportUsersCsv = () => {
    const rows = filterUsers(users);
    if (!rows.length) { toast.error('No users to export'); return; }
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Name', 'Email', 'Phone', 'Role', 'Status', 'Verified', 'Registered', 'Last login'];
    const body = rows.map(u => [u.fullName, u.email, u.phone, u.role, u.status, u.isVerified ? 'yes' : 'no', u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '', u.lastLoginAt ? new Date(u.lastLoginAt).toISOString().slice(0, 16).replace('T', ' ') : '']);
    const csv = '\uFEFF' + [head, ...body].map(r => r.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `nts-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} users`);
  };

  const loadParentLinks = useCallback(async () => {
    try { setParentLinks((await api.get('/admin/parent-links')).data || []); } catch (e) { toast.error('Failed to load parent links'); }
  }, []);
  const addParentLink = async () => {
    if (!linkForm.parentId || !linkForm.studentId) { toast.error('Choose a parent and a student'); return; }
    try { await api.post('/admin/parent-links', linkForm); toast.success('Parent linked to student'); setLinkForm({ parentId: '', studentId: '', relationship: 'Parent' }); loadParentLinks(); }
    catch (error) { toast.error(error.response?.data?.error || 'Failed to link'); }
  };
  const removeParentLink = async (id) => {
    try { await api.delete(`/admin/parent-links/${id}`); toast.success('Link removed'); loadParentLinks(); } catch (e) { toast.error('Failed to remove link'); }
  };
  useEffect(() => {
    if (activeTab === 'activity') api.get('/admin/audit-log', { params: { limit: 100 } }).then(r => setAuditLog(r.data || [])).catch(() => toast.error('Failed to load activity'));
    if (activeTab === 'parents') loadParentLinks();
  }, [activeTab, loadParentLinks]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { loadUsers(); }, [loadUsers, statusFilter]);
  useEffect(() => { if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  
  const updateUserRole = async (userId, newRole) => {
    try { await api.put(`/admin/users/${userId}/role`, { role: newRole }); toast.success('Role updated'); refreshUsers(); } 
    catch (error) { toast.error(error.response?.data?.error || 'Failed to update role'); }
  };
  
  const handleEditUser = async () => {
    try { await api.put(`/admin/users/${editingUser.id}`, editForm); toast.success('User updated successfully'); setShowEditModal(false); refreshUsers(); } 
    catch (error) { toast.error(error.response?.data?.error || 'Failed to update user'); }
  };
  
  const handleDeleteUser = async () => {
    try { await api.delete(`/admin/users/${userToDelete.id}`); toast.success('User deleted (kept in the database, can be restored)'); setShowDeleteModal(false); refreshUsers(); } 
    catch (error) { toast.error(error.response?.data?.error || 'Failed to delete user'); }
  };

  const handleAddUser = async () => {
    if (!addForm.fullName.trim() || !addForm.email.trim()) { toast.error('Name and email are required'); return; }
    setSavingUser(true);
    try {
      const res = await api.post('/admin/users', addForm);
      toast.success('User created');
      setShowAddModal(false);
      if (res.data.tempPassword) setCredentials({ name: addForm.fullName, email: addForm.email, password: res.data.tempPassword });
      setAddForm({ fullName: '', email: '', phone: '', role: 'STUDENT', password: '', status: 'ACTIVE' });
      refreshUsers();
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to create user'); }
    finally { setSavingUser(false); }
  };

  const toggleUserActive = async (u) => {
    const status = u.isActive ? 'INACTIVE' : 'ACTIVE';
    try { await api.put(`/admin/users/${u.id}/status`, { status }); toast.success(status === 'ACTIVE' ? `${u.fullName} activated` : `${u.fullName} deactivated`); loadUsers(); }
    catch (error) { toast.error(error.response?.data?.error || 'Failed to change status'); }
  };

  const restoreUser = async (u) => {
    try { await api.post(`/admin/users/${u.id}/restore`); toast.success(`${u.fullName} restored`); refreshUsers(); }
    catch (error) { toast.error(error.response?.data?.error || 'Failed to restore user'); }
  };

  const handleResetPassword = async () => {
    if (resetMode === 'set' && resetPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSavingUser(true);
    try {
      const res = await api.post(`/admin/users/${userToReset.id}/reset-password`, { mode: resetMode, newPassword: resetMode === 'set' ? resetPassword : undefined });
      setShowResetModal(false); setResetPassword('');
      if (res.data.tempPassword) setCredentials({ name: userToReset.fullName, email: userToReset.email, password: res.data.tempPassword });
      else toast.success(res.data.message || 'Password reset');
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to reset password'); }
    finally { setSavingUser(false); }
  };
  
  const createInternship = async () => {
    if (!newInternship.title || !newInternship.company || !newInternship.description || !newInternship.deadline) { toast.error('Please fill all required fields'); return; }
    try { await api.post('/internships', newInternship); toast.success('Internship created'); setShowInternshipModal(false); setNewInternship({ title: '', company: '', description: '', location: '', duration: 3, stipend: 0, deadline: '' }); fetchData(); } 
    catch (error) { toast.error('Failed to create internship'); }
  };
  
  const deleteInternship = async (id) => {
    if (!window.confirm('Delete this internship?')) return;
    try { await api.delete(`/internships/${id}`); toast.success('Internship deleted'); fetchData(); } 
    catch (error) { toast.error('Failed to delete internship'); }
  };
  
  const updateApplicationStatus = async (applicationId, status, studentName) => {
    try {
      await api.put(`/admin/applications/${applicationId}/status`, { status }); // server notifies the student live
      if (status === 'APPROVED') toast.success(`Application for ${studentName || 'student'} approved!`);
      else if (status === 'REJECTED') toast.error(`Application for ${studentName || 'student'} rejected`); else toast.success(`Internship status set to ${status}`);
      fetchData();
    } catch (error) { toast.error('Failed to update status'); }
  };
  
  const viewChatMessages = async (chatId) => {
    try { const res = await api.get(`/chat/${chatId}/messages`); setMessages(res.data.messages || []); setSelectedChat(allMessages.find(c => c.id === chatId)); } 
    catch (error) { toast.error('Failed to load messages'); }
  };
  
  const sendReply = async () => {
    if (!replyInput.trim() || !selectedChat || sendingReply) return;
    const otherParticipant = selectedChat.participants?.find(p => p.userId !== user.id);
    if (!otherParticipant) return;
    setSendingReply(true);
    try {
      const res = await api.post('/chat/messages', { chatId: selectedChat.id, content: replyInput, receiverId: otherParticipant.userId, replyToId: null });
      setMessages(prev => [...prev, res.data]);
      setReplyInput('');
      fetchData();
      toast.success('Reply sent');
    } catch (error) { toast.error('Failed to send reply'); } 
    finally { setSendingReply(false); }
  };
  
  const createTrade = async () => {
    if (!newTrade.name.trim()) { toast.error('Trade name is required'); return; }
    try {
      await api.post('/trades', newTrade);
      toast.success(`Trade "${newTrade.name}" created successfully!`);
      setShowTradeModal(false);
      setNewTrade({ name: '', description: '', icon: 'FaCode', color: 'bg-green-500' });
      fetchData();
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to create trade'); }
  };
  
  const deleteTrade = async (tradeId) => {
    if (!window.confirm('Delete this trade? All associated modules will be removed.')) return;
    try {
      await api.delete(`/trades/${tradeId}`);
      toast.success('Trade deleted');
      fetchData();
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to delete trade'); }
  };
  
  const deleteModule = async (tradeId, level, moduleId) => {
    if (!window.confirm('Delete this module?')) return;
    try {
      await api.delete(`/trades/modules/${moduleId}`);
      toast.success('Module deleted');
      fetchData();
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to delete module'); }
  };
  
  const getIconComponent = (iconName) => {
    const icons = {
      FaCode: <FaCode />,
      FaNetworkWired: <FaNetworkWired />,
      FaMicrochip: <FaMicrochip />,
      FaBroadcastTower: <FaBroadcastTower />,
      FaVideo: <FaVideo />
    };
    return icons[iconName] || <FaCode />;
  };
  
  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nts-green-600"></div></div>;
  if (user?.role !== 'ADMIN') return <div className="text-center py-12"><FaCrown className="text-6xl text-gray-300 mx-auto mb-4" /><p className="text-gray-500">Access denied. Admin only.</p></div>;
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <PageHero slot="adminHero" title="Admin Dashboard" subtitle="Full control over users, internships, messages, courses, and platform content" className="h-36 sm:h-44" />
        
        <div className="flex flex-wrap gap-2 mb-8 border-b">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center space-x-2 px-6 py-3 rounded-t-lg transition ${activeTab === 'dashboard' ? 'bg-white text-nts-green-600 border-b-2 border-nts-green-600 font-semibold' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}><FaChartLine /><span>Dashboard</span></button>
          <button onClick={() => setActiveTab('users')} className={`flex items-center space-x-2 px-6 py-3 rounded-t-lg transition ${activeTab === 'users' ? 'bg-white text-nts-green-600 border-b-2 border-nts-green-600 font-semibold' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}><FaUsers /><span>Users</span></button>
          <button onClick={() => setActiveTab('internships')} className={`flex items-center space-x-2 px-6 py-3 rounded-t-lg transition ${activeTab === 'internships' ? 'bg-white text-nts-green-600 border-b-2 border-nts-green-600 font-semibold' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}><FaBriefcase /><span>Internships</span></button>
          <button onClick={() => setActiveTab('applications')} className={`flex items-center space-x-2 px-6 py-3 rounded-t-lg transition ${activeTab === 'applications' ? 'bg-white text-nts-green-600 border-b-2 border-nts-green-600 font-semibold' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}><FaUserGraduate /><span>Applications</span></button>
          <button onClick={() => setActiveTab('messages')} className={`flex items-center space-x-2 px-6 py-3 rounded-t-lg transition ${activeTab === 'messages' ? 'bg-white text-nts-green-600 border-b-2 border-nts-green-600 font-semibold' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}><FaEnvelope /><span>Messages</span></button>
          <button onClick={() => setActiveTab('courses')} className={`flex items-center space-x-2 px-6 py-3 rounded-t-lg transition ${activeTab === 'courses' ? 'bg-white text-nts-green-600 border-b-2 border-nts-green-600 font-semibold' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}><FaDatabase /><span>Courses</span></button>
          <button onClick={() => setActiveTab('parents')} className={`flex items-center space-x-2 px-6 py-3 rounded-t-lg transition ${activeTab === 'parents' ? 'bg-white text-nts-green-600 border-b-2 border-nts-green-600 font-semibold' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}><FaChild /><span>Parents</span></button>
          <button onClick={() => setActiveTab('activity')} className={`flex items-center space-x-2 px-6 py-3 rounded-t-lg transition ${activeTab === 'activity' ? 'bg-white text-nts-green-600 border-b-2 border-nts-green-600 font-semibold' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}><FaHistory /><span>Activity</span></button>
          <Link to="/admin/site" className="flex items-center space-x-2 px-6 py-3 rounded-t-lg bg-nts-gold-500 text-nts-green-950 hover:bg-nts-gold-400 font-bold"><span>🎨 Site Settings</span></Link>
          <button onClick={() => { window.location.href = '/admin/verifications'; }} className="flex items-center space-x-2 px-6 py-3 rounded-t-lg text-emerald-700 hover:bg-emerald-50 font-semibold"><FaUserGraduate /><span>Student Verification</span></button>
        </div>
        
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div><p className="text-gray-500 text-sm">Students</p><p className="text-3xl font-bold">{stats.students}</p></div>
                  <div className="bg-blue-100 p-3 rounded-full"><FaUsers className="text-blue-600" /></div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div><p className="text-gray-500 text-sm">Trainers</p><p className="text-3xl font-bold">{stats.trainers}</p></div>
                  <div className="bg-green-100 p-3 rounded-full"><FaChalkboardTeacher className="text-green-600" /></div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div><p className="text-gray-500 text-sm">Posts</p><p className="text-3xl font-bold">{stats.posts}</p></div>
                  <div className="bg-purple-100 p-3 rounded-full"><FaBook className="text-purple-600" /></div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div><p className="text-gray-500 text-sm">Internships</p><p className="text-3xl font-bold">{stats.internships}</p></div>
                  <div className="bg-orange-100 p-3 rounded-full"><FaBriefcase className="text-orange-600" /></div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-r from-nts-green-600 to-nts-green-700 rounded-xl p-8 text-white">
              <h2 className="text-2xl font-bold mb-2">Welcome, {user?.fullName}</h2>
              <p>You have full administrative access. Monitor platform activity, manage users, review applications, and oversee all content.</p>
            </div>
          </div>
        )}
        
        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search name, email or phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border rounded-lg w-full" />
              </div>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                <option value="">All roles</option>
                {USER_ROLES.map(([value, label]) => <option key={value} value={value}>{label}{userCounts.byRole?.[value] ? ` (${userCounts.byRole[value]})` : ''}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                <option value="">All (not deleted)</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive{userCounts.inactive ? ` (${userCounts.inactive})` : ''}</option>
                <option value="PENDING">Not verified</option>
                <option value="DELETED">Deleted{userCounts.deleted ? ` (${userCounts.deleted})` : ''}</option>
              </select>
              <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-nts-green-600 text-white rounded-lg font-semibold hover:bg-nts-green-700 flex items-center space-x-2"><FaUserPlus /><span>Add User</span></button>
              <button onClick={exportUsersCsv} title="Download the listed users as CSV" className="px-4 py-2 border rounded-lg font-semibold text-gray-700 hover:bg-gray-50 flex items-center space-x-2"><FaDownload /><span>Export CSV</span></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.filter(u => {
                    const q = searchTerm.trim().toLowerCase();
                    const hit = !q || [u.fullName, u.email, u.phone].some(v => v?.toLowerCase().includes(q));
                    return hit && (!roleFilter || u.role === roleFilter);
                  }).map(userItem => {
                    const deleted = userItem.status === 'DELETED';
                    return (
                    <tr key={userItem.id} className={`hover:bg-gray-50 ${deleted ? 'opacity-60' : ''}`}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">{userItem.fullName}{userItem.phone && <div className="text-xs text-gray-400 font-normal">{userItem.phone}</div>}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{userItem.email}</td>
                      <td className="px-6 py-4">
                        <select value={userItem.role} disabled={deleted} onChange={(e) => updateUserRole(userItem.id, e.target.value)} className="text-sm border rounded-lg px-2 py-1">
                          {USER_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${deleted ? 'bg-red-100 text-red-700' : !userItem.isActive ? 'bg-gray-200 text-gray-700' : userItem.isVerified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {deleted ? 'Deleted' : !userItem.isActive ? 'Inactive' : userItem.isVerified ? 'Active' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {!deleted && (
                          <button type="button" role="switch" aria-checked={!!userItem.isActive} title={userItem.isActive ? 'Click to deactivate' : 'Click to activate'} onClick={() => toggleUserActive(userItem)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${userItem.isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${userItem.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          {deleted ? (
                            <button onClick={() => restoreUser(userItem)} title="Restore user" className="p-1 text-green-600 hover:bg-green-50 rounded flex items-center gap-1 text-xs"><FaUndo size={13} /> Restore</button>
                          ) : (<>
                            <button title="Edit" onClick={() => { setEditingUser(userItem); setEditForm({ fullName: userItem.fullName, email: userItem.email || '', phone: userItem.phone || '', school: userItem.school || '', role: userItem.role, bio: userItem.bio || '', status: userItem.isActive ? 'ACTIVE' : 'INACTIVE' }); setShowEditModal(true); }} className="p-1 text-green-500 hover:bg-green-50 rounded"><FaEdit size={14} /></button>
                            <button title="Reset password" onClick={() => { setUserToReset(userItem); setResetMode('generate'); setResetPassword(''); setShowResetModal(true); }} className="p-1 text-amber-500 hover:bg-amber-50 rounded"><FaKey size={14} /></button>
                            <button title="Delete (soft)" onClick={() => { setUserToDelete(userItem); setShowDeleteModal(true); }} className="p-1 text-red-500 hover:bg-red-50 rounded"><FaTrash size={14} /></button>
                            <Link title="View profile" to={`/profile/${userItem.id}`} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><FaEye size={14} /></Link>
                          </>)}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                  {users.length === 0 && <tr><td colSpan="6" className="px-6 py-10 text-center text-sm text-gray-400">No users match this filter.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Parents Tab */}
        {activeTab === 'parents' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><FaLink /> Link a parent to a student</h3>
              <p className="text-sm text-gray-500 mb-4">Linked parents see the student's progress, grades and certificates in the Parent Portal.</p>
              <div className="grid gap-3 md:grid-cols-4">
                <select value={linkForm.parentId} onChange={(e) => setLinkForm({ ...linkForm, parentId: e.target.value })} className="border rounded-lg px-3 py-2 text-sm">
                  <option value="">Select parent…</option>
                  {users.filter(u => u.role === 'PARENT').map(u => <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>)}
                </select>
                <select value={linkForm.studentId} onChange={(e) => setLinkForm({ ...linkForm, studentId: e.target.value })} className="border rounded-lg px-3 py-2 text-sm">
                  <option value="">Select student…</option>
                  {users.filter(u => u.role === 'STUDENT').map(u => <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>)}
                </select>
                <input type="text" placeholder="Relationship (Mother, Father…)" value={linkForm.relationship} onChange={(e) => setLinkForm({ ...linkForm, relationship: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
                <button onClick={addParentLink} className="px-4 py-2 bg-nts-green-600 text-white rounded-lg font-semibold hover:bg-nts-green-700">Link</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50"><tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Relationship</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                </tr></thead>
                <tbody className="divide-y divide-gray-200">
                  {parentLinks.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm"><b className="text-gray-800">{l.parent?.fullName}</b><div className="text-xs text-gray-400">{l.parent?.email}</div></td>
                      <td className="px-6 py-3 text-sm"><b className="text-gray-800">{l.student?.fullName}</b><div className="text-xs text-gray-400">{l.student?.email}</div></td>
                      <td className="px-6 py-3 text-sm text-gray-600">{l.relationship}</td>
                      <td className="px-6 py-3 text-right"><button onClick={() => removeParentLink(l.id)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Remove link"><FaTrash size={13} /></button></td>
                    </tr>
                  ))}
                  {parentLinks.length === 0 && <tr><td colSpan="4" className="px-6 py-10 text-center text-sm text-gray-400">No parent links yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b"><h3 className="font-bold text-gray-800 flex items-center gap-2"><FaHistory /> Admin activity log</h3><p className="text-sm text-gray-500">Who changed which account, newest first.</p></div>
            <ul className="divide-y divide-gray-100">
              {auditLog.map(a => (
                <li key={a.id} className="px-5 py-3 flex items-center justify-between gap-4 text-sm hover:bg-gray-50">
                  <span className="text-gray-700"><b>{a.actor?.fullName || 'Admin'}</b> · <span className="font-mono text-xs bg-gray-100 rounded px-1.5 py-0.5">{a.action}</span>{a.target ? <> · {a.target.fullName}</> : null}{a.details && a.details !== 'demo data' ? <span className="text-gray-400"> · {a.details}</span> : null}</span>
                  <span className="text-xs text-gray-400 shrink-0">{new Date(a.createdAt).toLocaleString()}</span>
                </li>
              ))}
              {auditLog.length === 0 && <li className="px-5 py-10 text-center text-sm text-gray-400">No activity recorded yet.</li>}
            </ul>
          </div>
        )}

        {/* Internships Tab */}
        {activeTab === 'internships' && (
          <div>
            <button onClick={() => setShowInternshipModal(true)} className="mb-4 px-4 py-2 bg-nts-green-600 text-white rounded-lg font-semibold hover:bg-nts-green-700 flex items-center space-x-2"><FaPlus /><span>Add Internship</span></button>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {internships.map(internship => (
                <div key={internship.id} className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="font-bold text-lg">{internship.title}</h3>
                  <p className="text-nts-green-600 text-sm">{internship.company}</p>
                  <p className="text-gray-600 text-sm mt-2 line-clamp-2">{internship.description}</p>
                  <div className="flex justify-between items-center mt-4 pt-3 border-t">
                    <span className="text-xs text-gray-400">Deadline: {new Date(internship.deadline).toLocaleDateString()}</span>
                    <button onClick={() => deleteInternship(internship.id)} className="text-red-500 hover:text-red-700"><FaTrash /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Applications Tab */}
        {activeTab === 'applications' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Internship</th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applied Date</th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {applications.map(app => (
                    <tr key={app.id} className="hover:bg-gray-50">
                      <td className="px-4 md:px-6 py-4 text-sm">{app.student?.fullName}</td>
                      <td className="px-4 md:px-6 py-4 text-sm">{app.internship?.title}</td>
                      <td className="px-4 md:px-6 py-4 text-sm">{new Date(app.appliedAt).toLocaleDateString()}</td>
                      <td className="px-4 md:px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full inline-flex items-center space-x-1 ${app.status === 'APPROVED' ? 'bg-green-100 text-green-700' : app.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {app.status === 'APPROVED' && <FaCheckCircle size={10} />}
                          {app.status === 'REJECTED' && <FaTimesCircle size={10} />}
                          {app.status === 'PENDING' && <FaClock size={10} />}
                          <span>{app.status}</span>
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => updateApplicationStatus(app.id, 'APPROVED', app.student?.fullName)} className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition">Approve</button>
                          <button onClick={() => updateApplicationStatus(app.id, 'REJECTED', app.student?.fullName)} className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition">Reject</button>
                          <button onClick={() => updateApplicationStatus(app.id, 'IN_PROGRESS', app.student?.fullName)} className="px-3 py-1 bg-blue-600 text-white text-xs rounded">In progress</button>
                          <button onClick={() => updateApplicationStatus(app.id, 'COMPLETED', app.student?.fullName)} className="px-3 py-1 bg-emerald-700 text-white text-xs rounded">Mark completed</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <div className="flex flex-col lg:flex-row h-[600px] bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="w-full lg:w-80 border-r bg-gray-50 overflow-y-auto">
              <div className="p-4 border-b bg-white sticky top-0">
                <h3 className="font-semibold text-gray-800">All Conversations</h3>
                <p className="text-xs text-gray-500 mt-1">{allMessages.length} total chats</p>
              </div>
              <div className="divide-y">
                {allMessages.map(chat => {
                  const otherParticipant = chat.participants?.find(p => p.userId !== user.id)?.user;
                  const lastMessage = chat.messages?.[0];
                  const unreadCount = chat.unreadCount || 0;
                  const isActive = selectedChat?.id === chat.id;
                  return (
                    <button key={chat.id} onClick={() => viewChatMessages(chat.id)} className={`w-full text-left p-4 hover:bg-gray-100 transition ${isActive ? 'bg-nts-green-50 border-l-4 border-l-nts-green-600' : ''}`}>
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-nts-green-500 to-nts-green-700 flex items-center justify-center text-white font-bold text-sm">
                          {otherParticipant?.fullName?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline">
                            <p className="font-semibold text-sm truncate">{otherParticipant?.fullName || 'Unknown User'}</p>
                            {lastMessage && (<span className="text-xs text-gray-400 flex-shrink-0 ml-2">{new Date(lastMessage.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>)}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{lastMessage?.content || lastMessage?.fileName || 'No messages yet'}</p>
                        </div>
                        {unreadCount > 0 && (<span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{unreadCount}</span>)}
                      </div>
                    </button>
                  );
                })}
                {allMessages.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <FaComment className="text-4xl mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No conversations yet</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 flex flex-col bg-gray-100">
              {selectedChat ? (
                <>
                  <div className="bg-white border-b px-4 py-3 shadow-sm">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-nts-green-500 to-nts-green-700 flex items-center justify-center text-white font-bold text-sm">
                        {selectedChat.participants?.find(p => p.userId !== user.id)?.user?.fullName?.charAt(0) || '?'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{selectedChat.participants?.find(p => p.userId !== user.id)?.user?.fullName}</h3>
                        <p className="text-xs text-gray-500">{selectedChat.participants?.find(p => p.userId !== user.id)?.user?.role || ''}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <FaComment className="text-5xl mb-2 opacity-30" />
                        <p className="text-sm">No messages yet</p>
                        <p className="text-xs">Start a conversation with this student</p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isOwn = msg.senderId === user.id;
                        return (
                          <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] px-4 py-2 rounded-2xl ${isOwn ? 'bg-nts-green-600 text-white rounded-br-sm' : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'}`}>
                              {msg.content && <p className="text-sm break-words">{msg.content}</p>}
                              {msg.fileUrl && (msg.fileType?.startsWith('image/') ? (<img src={msg.fileUrl} alt="Upload" className="max-w-full rounded mt-1 max-h-40 cursor-pointer" onClick={() => window.open(msg.fileUrl)} />) : msg.fileType?.startsWith('video/') ? (<video src={msg.fileUrl} controls className="max-w-full rounded mt-1 max-h-40" />) : (<a href={msg.fileUrl} download className="text-blue-500 underline text-sm">{msg.fileName || 'Download'}</a>))}
                              <p className={`text-xs mt-1 ${isOwn ? 'text-nts-green-200' : 'text-gray-400'}`}>{new Date(msg.createdAt).toLocaleTimeString()}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="bg-white border-t px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <input type="text" value={replyInput} onChange={(e) => setReplyInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendReply()} placeholder="Type your reply here..." className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-nts-green-500 focus:border-transparent" />
                      <button onClick={sendReply} disabled={!replyInput.trim() || sendingReply} className="p-2 bg-nts-green-600 text-white rounded-full hover:bg-nts-green-700 transition disabled:opacity-50"><FaPaperPlane size={18} /></button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <FaComment className="text-5xl mb-2 opacity-30 mx-auto" />
                    <p>Select a conversation to view messages</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Courses Tab */}
        {activeTab === 'courses' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Course & Trade Management</h2>
                  <p className="text-gray-500 mt-1">Manage trades, courses, and modules across all levels (Based on Rwanda TVET Curriculum)</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowTradeModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 flex items-center space-x-2"><FaPlusCircle /><span>New Trade</span></button>
                  <button onClick={() => setShowModuleModal(true)} className="px-4 py-2 bg-nts-green-600 text-white rounded-lg font-semibold hover:bg-nts-green-700 flex items-center space-x-2"><FaPlus /><span>Add Module</span></button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tradesData.map(trade => (
                  <div key={trade.id} className="border rounded-lg p-4 hover:shadow-md transition">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`${trade.color} p-2 rounded-lg text-white`}>{getIconComponent(trade.icon)}</div>
                        <h3 className="font-semibold text-gray-800">{trade.name}</h3>
                      </div>
                      <button onClick={() => deleteTrade(trade.id)} className="text-red-500 hover:text-red-700"><FaTrash size={14} /></button>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">Level 3: {trade.levels[1]?.length || 0} modules</p>
                      <p className="text-sm text-gray-500">Level 4: {trade.levels[2]?.length || 0} modules</p>
                      <p className="text-sm text-gray-500">Level 5: {trade.levels[3]?.length || 0} modules</p>
                    </div>
                    <button onClick={() => { setSelectedTrade(trade); }} className="mt-3 text-sm text-nts-green-600 hover:underline">View Modules →</button>
                    
                    {selectedTrade?.id === trade.id && (
                      <div className="mt-3 pt-3 border-t">
                        <h4 className="font-medium text-sm mb-2">Modules:</h4>
                        {[1, 2, 3].map(level => (
                          trade.levels[level]?.length > 0 && (
                            <div key={level} className="mb-2">
                              <p className="text-xs font-semibold text-gray-600">Level {level + 2}:</p>
                              {trade.levels[level].map(module => (
                                <div key={module.id} className="flex justify-between items-center bg-gray-50 p-2 rounded mt-1">
                                  {module.coverUrl && <img src={asset(module.coverUrl)} alt="" className="mr-2 h-9 w-14 rounded object-cover" />}
                                  <div className="flex-1">
                                    <p className="text-xs font-medium">{module.code} - {module.name}{module.hours ? ` · ${module.hours}h` : ''}</p>
                                    <p className="text-xs text-gray-500">{module.description}</p>
                                  </div>
                                  <button onClick={() => setEditModule(module)} className="text-blue-700 text-xs ml-2 p-1 hover:bg-blue-50 rounded">Edit / Files</button>
                                  <button onClick={() => deleteModule(trade.id, level, module.id)} className="text-red-500 text-xs ml-1 p-1 hover:bg-red-50 rounded">Delete</button>
                                </div>
                              ))}
                            </div>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">📚 Total: {tradesData.reduce((total, trade) => total + (trade.levels[1]?.length || 0) + (trade.levels[2]?.length || 0) + (trade.levels[3]?.length || 0), 0)} modules across all trades.</p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Modals */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Edit User</h3>
            <div className="space-y-4">
              <input type="text" placeholder="Full Name" value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              <input type="email" placeholder="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="School" value={editForm.school} onChange={(e) => setEditForm({ ...editForm, school: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              <textarea placeholder="Bio" value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows="3" />
              <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                {USER_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive (cannot log in)</option>
              </select>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleEditUser} className="flex-1 px-4 py-2 bg-nts-green-600 text-white rounded-lg">Save</button>
              <button onClick={() => setShowEditModal(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}
      
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><FaTrash className="text-red-500 text-2xl" /></div>
              <h3 className="text-xl font-bold mb-2">Delete User</h3>
              <p className="text-gray-500 text-sm mb-6">Are you sure you want to delete {userToDelete?.fullName}? The account is hidden and can no longer log in, but their courses, grades and certificates are kept. You can restore it later from the "Deleted" filter.</p>
              <div className="flex gap-3">
                <button onClick={handleDeleteUser} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg">Delete</button>
                <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Add User</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Full name *" value={addForm.fullName} onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              <input type="email" placeholder="Email *" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Phone (+250...)" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              <select value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                {USER_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <input type="text" placeholder="Password (leave empty to generate one)" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              <select value={addForm.status} onChange={(e) => setAddForm({ ...addForm, status: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleAddUser} disabled={savingUser} className="flex-1 px-4 py-2 bg-nts-green-600 text-white rounded-lg disabled:opacity-50">{savingUser ? 'Saving...' : 'Create user'}</button>
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowResetModal(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-1">Reset password</h3>
            <p className="text-gray-500 text-sm mb-4">{userToReset?.fullName} ({userToReset?.email})</p>
            <div className="space-y-2 text-sm">
              <label className="flex items-start gap-2 p-3 border rounded-lg cursor-pointer"><input type="radio" checked={resetMode === 'generate'} onChange={() => setResetMode('generate')} className="mt-1" /><span><b>Generate a temporary password</b><br /><span className="text-gray-500">Shown to you once. The user is asked to change it after login.</span></span></label>
              <label className="flex items-start gap-2 p-3 border rounded-lg cursor-pointer"><input type="radio" checked={resetMode === 'set'} onChange={() => setResetMode('set')} className="mt-1" /><span><b>Set a new password</b></span></label>
              {resetMode === 'set' && <input type="text" placeholder="New password (min 6 characters)" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />}
              <label className="flex items-start gap-2 p-3 border rounded-lg cursor-pointer"><input type="radio" checked={resetMode === 'email'} onChange={() => setResetMode('email')} className="mt-1" /><span><b>Email a reset code</b><br /><span className="text-gray-500">The user continues from "Forgot password".</span></span></label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleResetPassword} disabled={savingUser} className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg disabled:opacity-50">{savingUser ? 'Working...' : 'Reset password'}</button>
              <button onClick={() => setShowResetModal(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {credentials && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setCredentials(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-1">Temporary password</h3>
            <p className="text-gray-500 text-sm mb-4">Copy it now and give it to {credentials.name}. It will not be shown again.</p>
            <div className="bg-gray-50 border rounded-lg p-3 text-sm">
              <div><span className="text-gray-500">Email:</span> {credentials.email}</div>
              <div className="flex items-center justify-between mt-1"><span><span className="text-gray-500">Password:</span> <b className="font-mono">{credentials.password}</b></span>
                <button onClick={() => { navigator.clipboard?.writeText(credentials.password); toast.success('Copied'); }} className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="Copy"><FaCopy /></button></div>
            </div>
            <button onClick={() => setCredentials(null)} className="w-full mt-5 px-4 py-2 bg-nts-green-600 text-white rounded-lg">Done</button>
          </div>
        </div>
      )}

      {showInternshipModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowInternshipModal(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Add Internship</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Title" value={newInternship.title} onChange={(e) => setNewInternship({...newInternship, title: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Company" value={newInternship.company} onChange={(e) => setNewInternship({...newInternship, company: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              <textarea placeholder="Description" value={newInternship.description} onChange={(e) => setNewInternship({...newInternship, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg" rows="3" />
              <input type="text" placeholder="Location" value={newInternship.location} onChange={(e) => setNewInternship({...newInternship, location: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              <input type="number" placeholder="Duration (months)" value={newInternship.duration} onChange={(e) => setNewInternship({...newInternship, duration: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" />
              <input type="number" placeholder="Stipend (RWF)" value={newInternship.stipend} onChange={(e) => setNewInternship({...newInternship, stipend: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" />
              <input type="date" placeholder="Deadline" value={newInternship.deadline} onChange={(e) => setNewInternship({...newInternship, deadline: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={createInternship} className="flex-1 px-4 py-2 bg-nts-green-600 text-white rounded-lg">Create</button>
              <button onClick={() => setShowInternshipModal(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}
      
      {showTradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowTradeModal(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Create New Trade</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Trade Name (e.g., Cybersecurity)" value={newTrade.name} onChange={(e) => setNewTrade({...newTrade, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              <textarea placeholder="Description" value={newTrade.description} onChange={(e) => setNewTrade({...newTrade, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg" rows="2" />
              <select value={newTrade.icon} onChange={(e) => setNewTrade({...newTrade, icon: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                <option value="FaCode">💻 Code</option>
                <option value="FaNetworkWired">🌐 Network</option>
                <option value="FaMicrochip">🔬 Microchip</option>
                <option value="FaBroadcastTower">📡 Broadcast</option>
                <option value="FaVideo">🎥 Video</option>
              </select>
              <select value={newTrade.color} onChange={(e) => setNewTrade({...newTrade, color: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                <option value="bg-green-500">Green</option>
                <option value="bg-blue-500">Blue</option>
                <option value="bg-purple-500">Purple</option>
                <option value="bg-yellow-500">Yellow</option>
                <option value="bg-red-500">Red</option>
                <option value="bg-pink-500">Pink</option>
                <option value="bg-indigo-500">Indigo</option>
              </select>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={createTrade} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg">Create Trade</button>
              <button onClick={() => setShowTradeModal(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}
      
      {(showModuleModal || editModule) && (
        <ModuleWizard
          trades={tradesData}
          module={editModule}
          tradeId={selectedTrade?.id || ''}
          onClose={() => { setShowModuleModal(false); setEditModule(null); }}
          onDone={() => fetchData()}
        />
      )}
    </div>
  );
};

export default AdminPanel;