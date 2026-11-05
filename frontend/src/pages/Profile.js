 import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { 
  FaUserEdit, FaEnvelope, FaUsers, FaPhone, FaGraduationCap, 
  FaCalendarAlt, FaLock, FaSave, FaTimes, FaArrowLeft, FaImage
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import api, { uploadFile } from '../services/api';
import SiteImg from '../components/SiteImg';

const Profile = () => {
  const { userId } = useParams();
  const { user, updateProfile, followUser } = useAuthStore();
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    bio: '',
    phone: '',
    school: ''
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  const isOwnProfile = !userId || userId === user?.id;
  const targetUserId = isOwnProfile ? user?.id : userId;
  
  const fetchUserProfile = useCallback(async () => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/users/profile/${targetUserId}`);
      if (res.data) {
        setProfileUser(res.data);
        if (isOwnProfile) {
          setFormData({
            fullName: res.data.fullName || '',
            bio: res.data.bio || '',
            phone: res.data.phone || '',
            school: res.data.school || ''
          });
        }
      } else {
        toast.error('User data not found');
      }
    } catch (error) {
      console.error('Failed to fetch profile', error);
      if (error.response?.status === 401) {
        toast.error('Please login again');
        navigate('/login');
      } else if (error.response?.status === 404) {
        toast.error('User not found');
      } else {
        toast.error(error.response?.data?.error || 'Could not load profile');
      }
    } finally {
      setLoading(false);
    }
  }, [targetUserId, isOwnProfile, navigate]);
  
  useEffect(() => {
    if (targetUserId) {
      fetchUserProfile();
    } else {
      setLoading(false);
    }
  }, [fetchUserProfile, targetUserId]);
  
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  
  const handleAvatarUpload = async (file) => {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const result = await uploadFile(file);
      await api.put('/users/profile', { avatar: result.url });
      setProfileUser(prev => ({ ...prev, avatar: result.url }));
      toast.success('Profile picture updated!');
    } catch (error) {
      toast.error('Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      toast.error('Full name is required');
      return;
    }
    const result = await updateProfile(formData);
    if (result.success) {
      toast.success('Profile updated successfully!');
      setIsEditing(false);
      await fetchUserProfile();
    } else {
      toast.error(result.error || 'Update failed');
    }
  };
  
  
  const toggleFollow = async () => {
    const result = await followUser(profileUser.id);
    if (result.success) {
      setProfileUser(prev => ({
        ...prev,
        isFollowing: result.isFollowing,
        followersCount: Math.max(0, (prev.followersCount || 0) + (result.isFollowing ? 1 : -1))
      }));
      toast.success(result.isFollowing ? 'Following' : 'Unfollowed');
    } else {
      toast.error(result.error || 'Could not update follow');
    }
  };
  
  const startConversation = async () => {
    if (!profileUser || !profileUser.id) {
      toast.error('Cannot start conversation: User not found');
      return;
    }
    if (profileUser.id === user?.id) {
      toast.error('You cannot start a conversation with yourself');
      return;
    }
    try {
      const res = await api.post(`/chat/private/${profileUser.id}`);
      navigate('/messages', { state: { selectedChat: res.data } });
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error('Please login again');
        navigate('/login');
      } else if (error.response?.status === 404) {
        toast.error('User not found');
      } else {
        toast.error(error.response?.data?.error || 'Could not start conversation');
      }
    }
  };
  
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };
  
  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nts-green-600"></div></div>;
  }
  
  if (!profileUser) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">User not found</p>
        <Link to="/feed" className="text-nts-green-600 hover:underline inline-block">Go back to Feed</Link>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center space-x-2 text-gray-600 hover:text-nts-green-600 transition"><FaArrowLeft /> <span>Back</span></button>
      
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="h-40 bg-nts-green-800 relative">
          <SiteImg slot="profileCover" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-nts-green-950/75 to-nts-green-700/30" />
          {!isOwnProfile && profileUser && profileUser.id !== user?.id && (
            <div className="absolute bottom-4 right-4 flex items-center gap-2 z-10">
              <button onClick={toggleFollow} className={`px-5 py-2 rounded-full font-semibold shadow-md transition ${profileUser.isFollowing ? 'bg-white/20 text-white border border-white hover:bg-white/30' : 'bg-nts-green-800 text-white hover:bg-nts-green-900'}`}>{profileUser.isFollowing ? 'Following' : 'Follow'}</button>
              <button onClick={startConversation} className="bg-white text-nts-green-600 px-5 py-2 rounded-full font-semibold flex items-center space-x-2 shadow-md hover:bg-gray-50 transition"><FaEnvelope size={16} /> <span>Send Message</span></button>
            </div>
          )}
          {isOwnProfile && (
            <button onClick={() => setShowPasswordModal(true)} className="absolute bottom-4 right-4 bg-white text-gray-700 px-4 py-2 rounded-full font-semibold flex items-center space-x-2 shadow-md hover:bg-gray-50 transition z-10 text-sm"><FaLock size={14} /> <span>Change Password</span></button>
          )}
        </div>
        
        <div className="relative px-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end -mt-12">
            <div className="flex items-end space-x-4">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-white shadow-md bg-nts-green-600 flex items-center justify-center text-white text-3xl font-bold">
                  {profileUser.avatar ? (<img src={profileUser.avatar} alt={profileUser.fullName} className="w-full h-full rounded-full object-cover" />) : (getInitials(profileUser.fullName))}
                </div>
                {isOwnProfile && (
                  <label className="absolute bottom-0 right-0 bg-white rounded-full p-1 shadow-md cursor-pointer hover:bg-gray-100"><FaImage className="text-nts-green-600" size={14} /><input type="file" className="hidden" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) handleAvatarUpload(e.target.files[0]); }} disabled={uploadingAvatar} /></label>
                )}
              </div>
              <div className="pb-2">
                <h1 className="text-2xl font-bold text-gray-800">{profileUser.fullName}</h1>
                <div className="flex items-center space-x-2 mt-1 flex-wrap gap-y-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${profileUser.role === 'STUDENT' ? 'bg-blue-100 text-blue-700' : profileUser.role === 'TRAINER' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                    {profileUser.role === 'STUDENT' ? '🎓 Student' : profileUser.role === 'TRAINER' ? '👨‍🏫 Trainer' : '👑 Admin'}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center"><FaCalendarAlt className="mr-1" size={10} /> Joined {profileUser.createdAt ? new Date(profileUser.createdAt).toLocaleDateString() : 'Recently'}</span>
                </div>
              </div>
            </div>
            
            {isOwnProfile && !isEditing && (
              <button onClick={() => setIsEditing(true)} className="mt-3 sm:mt-0 px-4 py-2 border border-nts-green-600 text-nts-green-600 rounded-xl font-semibold hover:bg-nts-green-50 transition flex items-center space-x-2"><FaUserEdit size={14} /> <span>Edit Profile</span></button>
            )}
          </div>
        </div>
        
        <div className="p-6">
          {isOwnProfile && isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label><input type="text" name="fullName" value={formData.fullName} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-nts-green-500 focus:border-transparent outline-none" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Bio</label><textarea name="bio" placeholder="Tell us about yourself..." value={formData.bio} onChange={handleChange} rows="3" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-nts-green-500 focus:border-transparent outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label><input type="tel" name="phone" placeholder="Your phone number" value={formData.phone} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-nts-green-500 focus:border-transparent outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">School/University</label><input type="text" name="school" placeholder="Your school" value={formData.school} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-nts-green-500 focus:border-transparent outline-none" /></div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 px-4 py-2 bg-nts-green-600 text-white rounded-xl font-semibold hover:bg-nts-green-700 transition flex items-center justify-center space-x-2"><FaSave size={14} /> <span>Save Changes</span></button>
                <button type="button" onClick={() => setIsEditing(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition flex items-center justify-center space-x-2"><FaTimes size={14} /> <span>Cancel</span></button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {profileUser.bio && (<div className="bg-gray-50 rounded-xl p-4"><p className="text-gray-700">{profileUser.bio}</p></div>)}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {profileUser.school && (<div className="flex items-center space-x-3 text-gray-600 bg-gray-50 p-3 rounded-xl"><FaGraduationCap className="text-nts-green-600 flex-shrink-0" /><span className="text-sm">{profileUser.school}</span></div>)}
                {profileUser.phone && (<div className="flex items-center space-x-3 text-gray-600 bg-gray-50 p-3 rounded-xl"><FaPhone className="text-nts-green-600 flex-shrink-0" /><span className="text-sm">{profileUser.phone}</span></div>)}
                <div className="flex items-center space-x-3 text-gray-600 bg-gray-50 p-3 rounded-xl"><FaEnvelope className="text-nts-green-600 flex-shrink-0" /><span className="text-sm truncate">{profileUser.email}</span></div>
                <div className="flex items-center space-x-3 text-gray-600 bg-gray-50 p-3 rounded-xl"><FaCalendarAlt className="text-nts-green-600 flex-shrink-0" /><span className="text-sm">Joined {profileUser.createdAt ? new Date(profileUser.createdAt).toLocaleDateString() : 'Recently'}</span></div>
              </div>
              
              <div className="pt-4 border-t flex justify-around">
                <div className="text-center"><p className="text-2xl font-bold text-nts-green-600">{profileUser.postsCount || 0}</p><p className="text-xs text-gray-500">Posts</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-nts-green-600">{profileUser.followersCount || 0}</p><p className="text-xs text-gray-500">Followers</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-nts-green-600">{profileUser.followingCount || 0}</p><p className="text-xs text-gray-500">Following</p></div>
              </div>
              
              {!isOwnProfile && profileUser.id !== user?.id && (
                <button onClick={startConversation} className="w-full mt-4 py-3 bg-nts-green-600 text-white rounded-xl font-semibold hover:bg-nts-green-700 transition flex items-center justify-center space-x-2"><FaEnvelope /> <span>Send Message</span></button>
              )}
            </div>
          )}
        </div>
      </div>
      
      {isOwnProfile && (
        <div className="mt-6 bg-gradient-to-r from-nts-green-50 to-nts-green-100 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center"><FaUsers className="mr-2 text-nts-green-600" /> Connect with Others</h2>
          <p className="text-gray-600 text-sm">Go to the <Link to="/feed" className="text-nts-green-600 font-medium hover:underline">Feed</Link> to see posts from other students, or click on their profiles to start a conversation!</p>
        </div>
      )}
      
      {showPasswordModal && <PasswordPanel onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
};

export default Profile;
