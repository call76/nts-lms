// ============================================
// pages/Feed.js - Complete Enhanced Feed
// ============================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { io } from 'socket.io-client';
import { FaHeart, FaRegHeart, FaComment, FaShare, FaNewspaper, FaUserPlus, FaEnvelope, FaTrash, FaEdit, FaPaperPlane, FaTimes, FaImage, FaTimesCircle, FaSmile, FaRegSmile, FaVideo, FaMusic, FaFile, FaEllipsisH, FaFlag, FaBookmark, FaRegBookmark, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';
import toast from 'react-hot-toast';
import api, { uploadFile } from '../services/api';
import { SOCKET_URL } from '../services/config';
import PromoBanner from '../components/PromoBanner';

const Feed = () => {
  const { user, token, followUser } = useAuthStore();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [newPostMedia, setNewPostMedia] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [posting, setPosting] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editPostContent, setEditPostContent] = useState('');
  const [showCommentsFor, setShowCommentsFor] = useState(null);
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState({});
  const [submittingComment, setSubmittingComment] = useState({});
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState(null);
  const [showOptionsFor, setShowOptionsFor] = useState(null);
  const [savedPosts, setSavedPosts] = useState(new Set());
  const [socket, setSocket] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);
  const videoRefs = useRef({});
  // Socket handlers are registered once; a ref avoids them seeing a stale 'showCommentsFor'
  const showCommentsRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  const reactions = ['❤️', '👍', '😂', '😮', '😢', '😡', '🎉', '🔥'];
  
  useEffect(() => { showCommentsRef.current = showCommentsFor; }, [showCommentsFor]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, { auth: { token } });
    setSocket(newSocket);
    fetchPosts();
    fetchSuggestedUsers();
    fetchSavedPosts();
    
    newSocket.on('post:created', (newPostData) => {
      setPosts(prev => (prev.some(p => p.id === newPostData.id) ? prev : [newPostData, ...prev]));
    });
    
    newSocket.on('post:deleted', (postId) => {
      setPosts(prev => prev.filter(post => post.id !== postId));
    });
    
    newSocket.on('post:edited', (updatedPost) => {
      setPosts(prev => prev.map(post => post.id === updatedPost.id ? updatedPost : post));
    });
    
    newSocket.on('comment:added', ({ postId, comment }) => {
      if (showCommentsRef.current === postId) {
        setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), comment] }));
      }
      setPosts(prev => prev.map(post => post.id === postId ? { ...post, commentsCount: (post.commentsCount || 0) + 1 } : post));
    });
    
    newSocket.on('comment:edited', ({ postId, comment }) => {
      if (showCommentsRef.current === postId) {
        setComments(prev => ({ ...prev, [postId]: (prev[postId] || []).map(c => c.id === comment.id ? comment : c) }));
      }
    });
    
    newSocket.on('comment:deleted', ({ postId, commentId }) => {
      if (showCommentsRef.current === postId) {
        setComments(prev => ({ ...prev, [postId]: (prev[postId] || []).filter(c => c.id !== commentId) }));
      }
      setPosts(prev => prev.map(post => post.id === postId ? { ...post, commentsCount: Math.max(0, (post.commentsCount || 0) - 1) } : post));
    });
    
    
    return () => newSocket.disconnect();
  }, [token]);
  
  const fetchPosts = async () => {
    try {
      const res = await api.get('/posts/feed');
      setPosts(res.data || []);
    } catch (error) {
      console.error('Failed to fetch posts', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchSuggestedUsers = async () => {
    try {
      const res = await api.get('/users/suggested');
      setSuggestedUsers(res.data || []);
    } catch (error) {
      console.error('Failed to fetch suggestions', error);
    }
  };
  
  const fetchSavedPosts = async () => {
    try {
      const res = await api.get('/posts/saved');
      setSavedPosts(new Set((res.data || []).map(p => p.id)));
    } catch (error) {}
  };
  
  const fetchComments = async (postId) => {
    try {
      const res = await api.get(`/posts/${postId}/comments`);
      setComments(prev => ({ ...prev, [postId]: res.data || [] }));
    } catch (error) {}
  };
  
  const handleMediaUpload = async (file) => {
    if (!file) return null;
    setUploading(true);
    try {
      const result = await uploadFile(file);
      const type = file.type.split('/')[0];
      setMediaType(type);
      return result.url;
    } catch (error) {
      toast.error('Failed to upload media');
      return null;
    } finally {
      setUploading(false);
    }
  };
  
  const handleCreatePost = async () => {
    if (!newPost.trim() && !newPostMedia) {
      toast.error('Please write something or add media');
      return;
    }
    setPosting(true);
    let mediaUrl = null;
    if (newPostMedia) {
      mediaUrl = await handleMediaUpload(newPostMedia);
      if (!mediaUrl) { setPosting(false); return; } // upload failed: don't publish a post that silently lost its media
    }
    try {
      const res = await api.post('/posts', { content: newPost, mediaUrl, mediaType: mediaUrl ? newPostMedia.type.split('/')[0] : null });
      setPosts(prev => [res.data, ...prev]);
      setNewPost('');
      setNewPostMedia(null);
      setMediaType(null);
      toast.success('Post created!');
    } catch (error) {
      toast.error('Failed to create post');
    } finally {
      setPosting(false);
    }
  };
  
  const handleEditPost = async (postId) => {
    if (!editPostContent.trim()) {
      toast.error('Content cannot be empty');
      return;
    }
    try {
      const res = await api.put(`/posts/${postId}`, { content: editPostContent });
      setPosts(prev => prev.map(post => post.id === postId ? res.data : post));
      setEditingPostId(null);
      setEditPostContent('');
      toast.success('Post updated!');
    } catch (error) {
      toast.error('Failed to edit post');
    }
  };
  
  const handleDeletePost = async (postId) => {
    try {
      await api.delete(`/posts/${postId}`);
      setPosts(prev => prev.filter(post => post.id !== postId));
      toast.success('Post deleted');
    } catch (error) {
      toast.error('Failed to delete post');
    }
    setShowDeleteModal(false);
    setItemToDelete(null);
  };
  
  const handleDeleteComment = async (postId, commentId) => {
    try {
      await api.delete(`/posts/${postId}/comments/${commentId}`);
      setComments(prev => ({ ...prev, [postId]: (prev[postId] || []).filter(c => c.id !== commentId) }));
      setPosts(prev => prev.map(post => post.id === postId ? { ...post, commentsCount: Math.max(0, (post.commentsCount || 0) - 1) } : post));
      toast.success('Comment deleted');
    } catch (error) {
      toast.error('Failed to delete comment');
    }
    setShowDeleteModal(false);
    setItemToDelete(null);
  };
  
  const handleLike = async (postId) => {
    try {
      const res = await api.post(`/posts/${postId}/like`);
      setPosts(prev => prev.map(post => post.id === postId
        ? { ...post, isLiked: res.data.liked, likesCount: res.data.likesCount ?? Math.max(0, (post.likesCount || 0) + (res.data.liked ? 1 : -1)) }
        : post));
    } catch (error) {
      toast.error('Failed to like post');
    }
  };
  
  const handleReaction = async (postId, reaction) => {
    try {
      const res = await api.post(`/posts/${postId}/react`, { reaction });
      setPosts(prev => prev.map(post => post.id === postId
        ? { ...post, userReaction: res.data.reaction, reactions: res.data.reactions }
        : post));
      setShowReactionPicker(null);
    } catch (error) {
      toast.error('Failed to react');
    }
  };
  
  const handleSharePost = async (postId) => {
    try {
      const res = await api.post(`/posts/${postId}/share`);
      setPosts(prev => [res.data, ...prev]);
      toast.success('Post shared!');
    } catch (error) {
      toast.error('Failed to share post');
    }
  };
  
  const handleSavePost = async (postId) => {
    try {
      const res = await api.post(`/posts/${postId}/save`);
      if (res.data.saved) {
        setSavedPosts(prev => new Set([...prev, postId]));
        toast.success('Saved to bookmarks');
      } else {
        setSavedPosts(prev => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });
        toast.success('Removed from bookmarks');
      }
    } catch (error) {
      toast.error('Failed to save post');
    }
  };
  
  const handleReportPost = async (postId) => {
    try {
      await api.post(`/posts/${postId}/report`);
      toast.success('Post reported. We will review it.');
    } catch (error) {
      toast.error('Failed to report');
    }
  };
  
  const handleAddComment = async (postId) => {
    const commentText = newComment[postId];
    if (!commentText?.trim()) {
      toast.error('Please write a comment');
      return;
    }
    setSubmittingComment(prev => ({ ...prev, [postId]: true }));
    try {
      const res = await api.post(`/posts/${postId}/comments`, { content: commentText });
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), res.data] }));
      setNewComment(prev => ({ ...prev, [postId]: '' }));
      setPosts(prev => prev.map(post => post.id === postId ? { ...post, commentsCount: (post.commentsCount || 0) + 1 } : post));
      toast.success('Comment added!');
    } catch (error) {
      toast.error('Failed to add comment');
    } finally {
      setSubmittingComment(prev => ({ ...prev, [postId]: false }));
    }
  };
  
  const handleEditComment = async (postId, commentId) => {
    if (!editCommentContent.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }
    try {
      const res = await api.put(`/posts/${postId}/comments/${commentId}`, { content: editCommentContent });
      setComments(prev => ({ ...prev, [postId]: (prev[postId] || []).map(comment => comment.id === commentId ? { ...comment, content: res.data.content, isEdited: true } : comment) }));
      setEditingCommentId(null);
      setEditCommentContent('');
      toast.success('Comment edited!');
    } catch (error) {
      toast.error('Failed to edit comment');
    }
  };
  
  const startConversation = async (userId) => {
    if (!userId) return;
    try {
      const res = await api.post(`/chat/private/${userId}`);
      navigate('/messages', { state: { selectedChat: res.data } });
    } catch (error) {
      toast.error('Could not start conversation');
    }
  };
  
  const toggleComments = (postId) => {
    if (showCommentsRef.current === postId) {
      setShowCommentsFor(null);
    } else {
      setShowCommentsFor(postId);
      if (!comments[postId]) fetchComments(postId);
    }
  };
  
  const handleFollow = async (userId) => {
    const result = await followUser(userId);
    if (result.success) {
      setSuggestedUsers(prev => result.isFollowing ? prev.filter(u => u.id !== userId) : prev.map(u => u.id === userId ? { ...u, isFollowing: false } : u));
      toast.success(result.isFollowing ? 'Followed!' : 'Unfollowed');
    } else {
      toast.error(result.error || 'Could not follow');
    }
  };
  
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };
  
  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };
  
  const getReactionEmoji = (reaction) => {
    const map = { like: '👍', love: '❤️', laugh: '😂', wow: '😮', sad: '😢', angry: '😡' };
    return map[reaction] || reaction || '👍';
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }
  
  return (
    <div className="max-w-2xl mx-auto py-4 px-4 pb-20">
      <div className="mb-4"><PromoBanner compact /></div>
      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaTrash className="text-red-500 text-2xl" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                Delete {deleteType === 'post' ? 'Post' : 'Comment'}?
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                This {deleteType} will be permanently deleted. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-2 border rounded-xl text-gray-700 dark:text-gray-300">
                  Cancel
                </button>
                <button onClick={() => {
                  if (deleteType === 'post') handleDeletePost(itemToDelete);
                  else if (deleteType === 'comment') handleDeleteComment(itemToDelete.postId, itemToDelete.commentId);
                }} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Suggested Users */}
      {suggestedUsers.filter(u => u.id !== user?.id).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4 mb-4">
          <h3 className="font-semibold mb-3 flex items-center text-gray-800 dark:text-white">
            <FaUserPlus className="mr-2 text-green-600" /> Connect with Others
          </h3>
          <div className="flex overflow-x-auto gap-3 pb-2 -mx-1 px-1">
            {suggestedUsers.filter(u => u.id !== user?.id).slice(0, 10).map(suggested => (
              <div key={suggested.id} className="flex-shrink-0 w-40 bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <Link to={`/profile/${suggested.id}`} className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-lg">
                    {getInitials(suggested.fullName)}
                  </div>
                  <p className="font-medium text-gray-800 dark:text-white text-sm mt-2 text-center truncate w-full">
                    {suggested.fullName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{suggested.role}</p>
                </Link>
                <div className="flex justify-center gap-2 mt-2">
                  <button onClick={() => startConversation(suggested.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-full">
                    <FaEnvelope size={12} />
                  </button>
                  <button onClick={() => handleFollow(suggested.id)} className="px-3 py-1 bg-green-600 text-white text-xs rounded-full">
                    Follow
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Create Post */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4 mb-4">
        <div className="flex space-x-3">
          <Link to="/profile" className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold">
              {getInitials(user?.fullName)}
            </div>
          </Link>
          <div className="flex-1">
            <textarea
              placeholder={`What's on your mind, ${user?.fullName?.split(' ')[0]}?`}
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              rows="2"
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-xl resize-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm dark:bg-gray-700 dark:text-white"
            />
            {newPostMedia && (
              <div className="relative mt-2 inline-block">
                {mediaType === 'image' ? (
                  <img src={URL.createObjectURL(newPostMedia)} alt="Preview" className="h-24 w-24 object-cover rounded-lg" />
                ) : mediaType === 'video' ? (
                  <video src={URL.createObjectURL(newPostMedia)} className="h-24 w-24 object-cover rounded-lg" />
                ) : (
                  <div className="h-24 w-24 bg-gray-100 rounded-lg flex items-center justify-center">
                    <FaFile size={32} className="text-gray-400" />
                  </div>
                )}
                <button onClick={() => { setNewPostMedia(null); setMediaType(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1">
                  <FaTimesCircle size={14} />
                </button>
              </div>
            )}
            <div className="flex justify-between items-center mt-2">
              <div className="flex gap-2">
                <label className="cursor-pointer text-gray-500 hover:text-green-600 transition p-2 rounded-full hover:bg-gray-100">
                  <FaImage size={18} />
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) { setNewPostMedia(e.target.files[0]); setMediaType('image'); } }} />
                </label>
                <label className="cursor-pointer text-gray-500 hover:text-green-600 transition p-2 rounded-full hover:bg-gray-100">
                  <FaVideo size={18} />
                  <input type="file" className="hidden" accept="video/*" onChange={(e) => { if (e.target.files?.[0]) { setNewPostMedia(e.target.files[0]); setMediaType('video'); } }} />
                </label>
              </div>
              <button
                onClick={handleCreatePost}
                disabled={(!newPost.trim() && !newPostMedia) || posting || uploading}
                className="px-5 py-2 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition text-sm"
              >
                {posting || uploading ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Posts Feed */}
      <div className="space-y-4">
        {posts.map((post) => (
          <div key={post.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4">
              {/* Post Header */}
              <div className="flex items-center justify-between mb-3">
                <Link to={`/profile/${post.author.id}`} className="flex items-center space-x-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-sm">
                    {getInitials(post.author.fullName)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-white hover:text-green-600">
                      {post.author.fullName}
                      {post.author.role === 'TRAINER' && <span className="ml-1 text-xs text-green-600">🎓</span>}
                      {post.author.isVerified && <span className="ml-1 text-xs text-blue-500">✓</span>}
                    </p>
                    <p className="text-xs text-gray-400">{formatTimeAgo(post.createdAt)}{post.isShared && ' · 🔁 Shared'}</p>
                  </div>
                </Link>
                
                <div className="relative">
                  <button onClick={() => setShowOptionsFor(showOptionsFor === post.id ? null : post.id)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
                    <FaEllipsisH size={16} />
                  </button>
                  {showOptionsFor === post.id && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border z-10">
                      <button onClick={() => handleSavePost(post.id)} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100">
                        {savedPosts.has(post.id) ? 'Unsave Post' : 'Save Post'}
                      </button>
                      <button onClick={() => handleReportPost(post.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">
                        Report Post
                      </button>
                      {(user?.id === post.author.id || user?.role === 'ADMIN') && (
                        <>
                          <hr className="my-1" />
                          <button onClick={() => { setEditingPostId(post.id); setEditPostContent(post.content); setShowOptionsFor(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                            Edit Post
                          </button>
                          <button onClick={() => { setItemToDelete(post.id); setDeleteType('post'); setShowDeleteModal(true); setShowOptionsFor(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">
                            Delete Post
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Post Content */}
              {editingPostId === post.id ? (
                <div className="mb-3">
                  <textarea value={editPostContent} onChange={(e) => setEditPostContent(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-700" rows="3" />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => handleEditPost(post.id)} className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm">Save</button>
                    <button onClick={() => { setEditingPostId(null); setEditPostContent(''); }} className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-gray-700 dark:text-gray-300 mb-3 text-sm whitespace-pre-wrap break-words">{post.content}</p>
                  {post.mediaUrl && (
                    <div className="mb-3 rounded-lg overflow-hidden bg-gray-100">
                      {post.mediaType === 'image' ? (
                        <img src={post.mediaUrl} alt="Post" className="w-full cursor-pointer" onClick={() => window.open(post.mediaUrl, '_blank')} />
                      ) : post.mediaType === 'video' ? (
                        <div className="relative">
                          <video ref={el => videoRefs.current[post.id] = el} src={post.mediaUrl} className="w-full" controls playsInline />
                        </div>
                      ) : null}
                    </div>
                  )}
                </>
              )}
              
              {/* Reactions Bar */}
              <div className="flex items-center justify-between pt-2 border-t dark:border-gray-700">
                <div className="flex items-center gap-1">
                  <div className="flex -space-x-1">
                    {post.reactions && Object.entries(post.reactions).slice(0, 3).map(([reaction, count]) => (
                      <span key={reaction} className="text-sm">{getReactionEmoji(reaction)}</span>
                    ))}
                  </div>
                  <span className="text-xs text-gray-500">{post.likesCount || 0}</span>
                </div>
                <div className="text-xs text-gray-500">{post.commentsCount || 0} comments • {post.sharesCount || 0} shares</div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center justify-around pt-2">
                <div className="relative">
                  <button onClick={() => handleLike(post.id)} className="flex items-center space-x-2 px-4 py-1 rounded-full transition text-gray-500 hover:text-red-500">
                    {post.isLiked ? <FaHeart className="text-red-500" /> : <FaRegHeart />}
                    <span className="text-sm">Like</span>
                  </button>
                  <button onClick={() => setShowReactionPicker(showReactionPicker === post.id ? null : post.id)} className="ml-1 text-gray-400 hover:text-green-600 text-sm" title="React">
                    {post.userReaction || <FaRegSmile />}
                  </button>
                  {showReactionPicker === post.id && (
                    <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-full shadow-lg p-2 flex gap-2 z-20">
                      {reactions.map(emoji => (
                        <button key={emoji} onClick={() => handleReaction(post.id, emoji)} className="text-2xl hover:scale-125 transition">
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => toggleComments(post.id)} className="flex items-center space-x-2 px-4 py-1 rounded-full text-gray-500 hover:text-green-600 transition">
                  <FaComment /> <span className="text-sm">Comment</span>
                </button>
                <button onClick={() => handleSharePost(post.id)} className="flex items-center space-x-2 px-4 py-1 rounded-full text-gray-500 hover:text-green-600 transition">
                  <FaShare /> <span className="text-sm">Share</span>
                </button>
                <button onClick={() => handleSavePost(post.id)} className="flex items-center space-x-2 px-4 py-1 rounded-full text-gray-500 hover:text-green-600 transition">
                  {savedPosts.has(post.id) ? <FaBookmark className="text-green-600" /> : <FaRegBookmark />}
                </button>
              </div>
              
              {/* Comments Section */}
              {showCommentsFor === post.id && (
                <div className="mt-4 pt-3 border-t dark:border-gray-700">
                  <div className="space-y-3 max-h-80 overflow-y-auto mb-3">
                    {(comments[post.id] || []).length === 0 ? (
                      <div className="text-center py-4 text-gray-400 text-sm">No comments yet. Be the first!</div>
                    ) : (
                      (comments[post.id] || []).map(comment => (
                        <div key={comment.id} className="flex space-x-2 text-sm group">
                          <Link to={`/profile/${comment.author.id}`}>
                            <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-xs">
                              {getInitials(comment.author.fullName)}
                            </div>
                          </Link>
                          <div className="flex-1 bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2">
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-xs dark:text-white">{comment.author.fullName}</p>
                              {(user?.id === comment.author.id || user?.role === 'ADMIN') && (
                                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition">
                                  <button onClick={() => { setEditingCommentId(comment.id); setEditCommentContent(comment.content); }} className="text-gray-400 hover:text-blue-500">
                                    <FaEdit size={10} />
                                  </button>
                                  <button onClick={() => { setItemToDelete({ postId: post.id, commentId: comment.id }); setDeleteType('comment'); setShowDeleteModal(true); }} className="text-gray-400 hover:text-red-500">
                                    <FaTrash size={10} />
                                  </button>
                                </div>
                              )}
                            </div>
                            {editingCommentId === comment.id ? (
                              <div className="mt-1">
                                <textarea value={editCommentContent} onChange={(e) => setEditCommentContent(e.target.value)} className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-600" rows="2" />
                                <div className="flex gap-2 mt-1">
                                  <button onClick={() => handleEditComment(post.id, comment.id)} className="px-2 py-0.5 bg-green-600 text-white rounded text-xs">Save</button>
                                  <button onClick={() => { setEditingCommentId(null); setEditCommentContent(''); }} className="px-2 py-0.5 bg-gray-200 rounded text-xs">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap break-words">{comment.content}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-xs text-gray-400">{formatTimeAgo(comment.createdAt)}</p>
                                  {comment.isEdited && <p className="text-xs text-gray-400">(edited)</p>}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex space-x-2 mt-2">
                    <input
                      type="text"
                      value={newComment[post.id] || ''}
                      onChange={(e) => setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                      placeholder="Write a comment..."
                      className="flex-1 px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <button
                      onClick={() => handleAddComment(post.id)}
                      disabled={submittingComment[post.id] || !newComment[post.id]?.trim()}
                      className="p-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 transition"
                    >
                      <FaPaperPlane size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {posts.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
            <FaNewspaper className="text-5xl text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No posts yet.</p>
            <p className="text-sm text-gray-400">Be the first to share something!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Feed;