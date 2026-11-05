// ============================================
// pages/Messages.js - Complete Enhanced Chat
// ============================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { io } from 'socket.io-client';
import { FaPaperPlane, FaSearch, FaUserPlus, FaComment, FaTrash, FaEdit, FaReply, FaTimes, FaPaperclip, FaArrowLeft, FaVideo, FaMicrophone, FaMicrophoneSlash, FaVideoSlash, FaPhoneSlash, FaArrowDown, FaPlay, FaPause, FaPhone, FaStop, FaSmile, FaCheck, FaCheckDouble, FaUserCheck, FaUsers, FaPlus, FaImage, FaFile, FaRegSmile } from 'react-icons/fa';
import toast from 'react-hot-toast';
import api, { uploadFile } from '../services/api';
import { SOCKET_URL } from '../services/config';

const Messages = () => {
  const { user, token, setUnreadCount } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showChatArea, setShowChatArea] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState([]);
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioRefs = useRef({});
  
  const reactions = ['❤️', '👍', '😂', '😮', '😢', '😡', '🎉', '🔥'];
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  useEffect(() => {
    if (!token || !user) return;
    
    const newSocket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'], reconnection: true });
    setSocket(newSocket);
    fetchChats();
    
    if (location.state?.selectedChat) {
      setSelectedChat(location.state.selectedChat);
      fetchMessages(location.state.selectedChat.id);
      if (isMobile) setShowChatArea(true);
    }
    
    return () => { if (newSocket) newSocket.disconnect(); };
  }, [token, user]);
  
  useEffect(() => {
    if (!socket) return;
    
    socket.on('message:received', (message) => {
      if (selectedChat?.id === message.chatId) {
        setMessages(prev => [...prev, message]);
        scrollToBottom();
        api.post(`/chat/messages/${message.id}/read`).catch(() => {});
      }
      fetchChats();
    });
    
    socket.on('message:read', ({ messageId }) => {
      setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, isRead: true } : msg));
    });
    
    socket.on('message:updated', (updatedMessage) => {
      setMessages(prev => prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg));
    });
    
    socket.on('message:deleted', ({ messageId }) => {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      fetchChats();
    });
    
    socket.on('message:reacted', ({ messageId, reaction }) => {
      setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, reaction } : msg));
    });
    
    socket.on('typing:start', ({ userId, chatId }) => {
      if (selectedChat?.id === chatId) {
        setTypingUsers(prev => ({ ...prev, [userId]: true }));
      }
    });
    
    socket.on('typing:stop', ({ userId, chatId }) => {
      if (selectedChat?.id === chatId) {
        setTypingUsers(prev => ({ ...prev, [userId]: false }));
      }
    });
    
    socket.on('user:online', ({ userId }) => {
      setOnlineUsers(prev => ({ ...prev, [userId]: true }));
    });
    
    socket.on('user:offline', ({ userId }) => {
      setOnlineUsers(prev => ({ ...prev, [userId]: false }));
    });
    
    return () => {
      socket.off('message:received');
      socket.off('message:read');
      socket.off('message:updated');
      socket.off('message:deleted');
      socket.off('message:reacted');
      socket.off('typing:start');
      socket.off('typing:stop');
      socket.off('user:online');
      socket.off('user:offline');
    };
  }, [socket, selectedChat]);
  
  const fetchChats = async () => {
    try {
      const res = await api.get('/chat');
      setChats(res.data || []);
      const unread = (res.data || []).reduce((total, chat) => total + (chat.unreadCount || 0), 0);
      setUnreadCount(unread);
    } catch (error) {
      console.error('Fetch chats error:', error);
    }
  };
  
  const fetchMessages = async (chatId) => {
    try {
      const res = await api.get(`/chat/${chatId}/messages`);
      setMessages(res.data.messages || []);
      scrollToBottom();
      
      const unreadMessages = (res.data.messages || []).filter(m => !m.isRead && m.senderId !== user.id);
      if (unreadMessages.length) {
        await Promise.all(unreadMessages.map(msg => api.post(`/chat/messages/${msg.id}/read`).catch(() => {})));
        fetchChats();
      }
    } catch (error) {
      console.error('Fetch messages error:', error);
    }
  };
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 200);
    }
  };
  
  const handleTyping = (e) => {
    setInput(e.target.value);
    const other = getOtherParticipant();
    if (socket && other && selectedChat) {
      socket.emit('typing:start', { receiverId: other.id, chatId: selectedChat.id });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing:stop', { receiverId: other.id, chatId: selectedChat.id });
      }, 1500);
    }
  };
  
  const handleReaction = async (messageId, reaction) => {
    try {
      const res = await api.post(`/chat/messages/${messageId}/react`, { reaction });
      setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, reaction: res.data.reaction } : msg));
    } catch (error) {
      console.error('Reaction error:', error);
    }
    setShowReactionPicker(null);
  };
  
  const sendMessage = async () => {
    if (!input.trim() || !selectedChat || sending) return;
    const other = getOtherParticipant();
    setSending(true);
    try {
      const payload = { chatId: selectedChat.id, content: input, receiverId: other?.id };
      if (replyingTo) payload.replyToId = replyingTo.id;
      
      const res = await api.post('/chat/messages', payload);
      setMessages(prev => [...prev, res.data]);
      setInput('');
      setReplyingTo(null);
      
      fetchChats();
      scrollToBottom();
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };
  
  const editMessage = async () => {
    if (!editingMessage || !input.trim()) return;
    try {
      const res = await api.put(`/chat/messages/${editingMessage.id}`, { content: input });
      setMessages(prev => prev.map(msg => msg.id === editingMessage.id ? res.data : msg));
      setInput('');
      setEditingMessage(null);
      toast.success('Message edited');
    } catch (error) {
      toast.error('Failed to edit message');
    }
  };
  
  const deleteMessage = async () => {
    if (!selectedMessage) return;
    try {
      await api.delete(`/chat/messages/${selectedMessage.id}`);
      setMessages(prev => prev.filter(msg => msg.id !== selectedMessage.id));
      setShowDeleteConfirm(false);
      setSelectedMessage(null);
      toast.success('Message deleted');
    } catch (error) {
      toast.error('Failed to delete message');
    }
  };
  
  const handleFileUpload = async (file) => {
    if (!selectedChat) return toast.error('No chat selected');
    setUploading(true);
    try {
      const result = await uploadFile(file);
      const other = getOtherParticipant();
      const res = await api.post('/chat/messages', {
        chatId: selectedChat.id,
        content: '',
        receiverId: other?.id,
        fileUrl: result.url,
        fileType: file.type,
        fileName: file.name
      });
      setMessages(prev => [...prev, res.data]);
      fetchChats();
      scrollToBottom();
      toast.success('Sent');
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };
  
  const searchUsers = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get('/chat/search', { params: { q: query } });
      setSearchResults(res.data || []);
    } catch (error) {
      console.error('Search error:', error);
    }
  };
  
  const searchGroupMembers = async (query) => {
    if (query.length < 2) {
      setGroupSearchResults([]);
      return;
    }
    try {
      const res = await api.get('/users/search', { params: { q: query } });
      setGroupSearchResults(res.data || []);
    } catch (error) {}
  };
  
  const startChat = async (userId) => {
    try {
      const res = await api.post(`/chat/private/${userId}`);
      setSelectedChat(res.data);
      setShowSearch(false);
      setSearchQuery('');
      fetchChats();
      await fetchMessages(res.data.id);
      toast.success('Chat started');
      if (isMobile) setShowChatArea(true);
    } catch (error) {
      toast.error('Failed to start chat');
    }
  };
  
  const createGroupChat = async () => {
    if (!groupName.trim() || groupMembers.length === 0) {
      toast.error('Group name and at least one member required');
      return;
    }
    try {
      const res = await api.post('/chat/group', { name: groupName, members: groupMembers.map(m => m.id) });
      setSelectedChat(res.data);
      setShowCreateGroup(false);
      setGroupName('');
      setGroupMembers([]);
      fetchChats();
      await fetchMessages(res.data.id);
      if (isMobile) setShowChatArea(true);
      toast.success('Group created!');
    } catch (error) {
      toast.error('Failed to create group');
    }
  };
  
  const addToGroup = (user) => {
    if (!groupMembers.find(m => m.id === user.id)) {
      setGroupMembers([...groupMembers, user]);
    }
    setGroupSearch('');
    setGroupSearchResults([]);
  };
  
  const removeFromGroup = (userId) => {
    setGroupMembers(groupMembers.filter(m => m.id !== userId));
  };
  
  const selectChat = (chat) => {
    setSelectedChat(chat);
    fetchMessages(chat.id);
    if (isMobile) setShowChatArea(true);
  };
  
  const goBackToChatList = () => {
    setShowChatArea(false);
    setSelectedChat(null);
    setReplyingTo(null);
    setEditingMessage(null);
  };
  
  const getOtherParticipant = useCallback(() => {
    if (!selectedChat || selectedChat.isGroup) return null;
    return selectedChat.participants?.find(p => p.userId !== user.id)?.user;
  }, [selectedChat, user.id]);
  
  const MessageStatus = ({ message, isOwn }) => {
    if (!isOwn) return null;
    if (message.isRead) return <FaCheckDouble size={10} className="text-blue-500" />;
    return <FaCheck size={10} className="text-gray-400" />;
  };
  
  const AudioPlayer = ({ audioUrl, messageId }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef(null);
    
    useEffect(() => {
      if (audioRef.current) {
        audioRef.current.addEventListener('loadedmetadata', () => setDuration(audioRef.current.duration));
        audioRef.current.addEventListener('timeupdate', () => {
          setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
        });
        audioRef.current.addEventListener('ended', () => {
          setIsPlaying(false);
          setProgress(0);
          setPlayingAudioId(null);
        });
      }
    }, []);
    
    const togglePlay = () => {
      if (playingAudioId && playingAudioId !== messageId) {
        if (audioRefs.current[playingAudioId]) {
          audioRefs.current[playingAudioId].pause();
          audioRefs.current[playingAudioId].currentTime = 0;
        }
      }
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        setPlayingAudioId(null);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
        setPlayingAudioId(messageId);
      }
    };
    
    return (
      <div className="flex items-center gap-2 min-w-[180px]">
        <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center">
          {isPlaying ? <FaPause size={12} className="text-white" /> : <FaPlay size={12} className="text-white ml-0.5" />}
        </button>
        <div className="flex-1">
          <div className="h-1 bg-gray-300 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <span className="text-xs text-gray-500 min-w-[40px]">{duration ? `${Math.floor(duration)}s` : '0:00'}</span>
        <audio ref={audioRef} src={audioUrl} />
      </div>
    );
  };
  
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };
  
  const otherUser = getOtherParticipant();
  const isTypingNow = otherUser && typingUsers[otherUser.id];
  
  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-100 dark:bg-gray-900">
      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Create Group</h2>
              <button onClick={() => setShowCreateGroup(false)} className="p-1 rounded-full hover:bg-gray-100">
                <FaTimes />
              </button>
            </div>
            <input
              type="text"
              placeholder="Group Name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg mb-4 dark:bg-gray-700 dark:border-gray-600"
            />
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search members..."
                  value={groupSearch}
                  onChange={(e) => { setGroupSearch(e.target.value); searchGroupMembers(e.target.value); }}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                />
                {groupSearchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border rounded-lg mt-1 max-h-48 overflow-y-auto z-10 shadow-lg">
                    {groupSearchResults.map(user => (
                      <button key={user.id} onClick={() => addToGroup(user)} className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm">
                          {getInitials(user.fullName)}
                        </div>
                        <span>{user.fullName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {groupMembers.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Members ({groupMembers.length})</p>
                <div className="flex flex-wrap gap-2">
                  {groupMembers.map(member => (
                    <div key={member.id} className="flex items-center gap-1 bg-green-100 dark:bg-green-900 rounded-full px-3 py-1">
                      <span className="text-sm">{member.fullName}</span>
                      <button onClick={() => removeFromGroup(member.id)} className="text-red-500">
                        <FaTimes size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={createGroupChat} className="w-full py-2 bg-green-600 text-white rounded-lg font-semibold">
              Create Group
            </button>
          </div>
        </div>
      )}
      
      {/* Chat List Sidebar */}
      <div className={`${isMobile && showChatArea ? 'hidden' : 'flex'} flex-col w-full md:w-96 bg-white dark:bg-gray-800 border-r dark:border-gray-700 h-full`}>
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Chats</h1>
            <div className="flex gap-2">
              <button onClick={() => setShowCreateGroup(true)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                <FaUsers className="text-green-500" size={20} />
              </button>
              <button onClick={() => setShowSearch(!showSearch)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                <FaUserPlus className="text-green-500" size={20} />
              </button>
            </div>
          </div>
          {showSearch && (
            <div className="mt-3">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); searchUsers(e.target.value); }}
                  className="w-full pl-10 pr-4 py-2 border rounded-full focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="absolute mt-1 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg border z-10 max-h-60 overflow-y-auto">
                  {searchResults.map(user => (
                    <button key={user.id} onClick={() => startChat(user.id)} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition">
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">
                        {getInitials(user.fullName)}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-gray-800 dark:text-white">{user.fullName}</p>
                        <p className="text-xs text-gray-500">{user.role}</p>
                      </div>
                      {onlineUsers[user.id] && <div className="w-2 h-2 bg-green-500 rounded-full" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4">
              <FaComment size={48} className="mb-3 opacity-50" />
              <p>No chats yet</p>
              <button onClick={() => setShowSearch(true)} className="mt-3 text-green-500 text-sm font-medium">
                Start a conversation
              </button>
            </div>
          ) : (
            chats.map(chat => {
              const other = chat.isGroup ? null : chat.participants?.find(p => p.userId !== user.id)?.user;
              const lastMsg = chat.messages?.[0];
              const unread = chat.unreadCount || 0;
              const isActive = selectedChat?.id === chat.id;
              const isOnline = other && onlineUsers[other.id];
              
              return (
                <button
                  key={chat.id}
                  onClick={() => selectChat(chat)}
                  className={`w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition border-b dark:border-gray-700 ${isActive && !isMobile ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center text-white font-bold shadow-sm">
                      {chat.isGroup ? <FaUsers size={20} /> : getInitials(other?.fullName)}
                    </div>
                    {!chat.isGroup && isOnline && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex justify-between items-baseline">
                      <p className="font-semibold text-gray-800 dark:text-white truncate">
                        {chat.isGroup ? chat.name || 'Group Chat' : other?.fullName}
                      </p>
                      {lastMsg && (
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                          {new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {isTypingNow && chat.id === selectedChat?.id ? (
                        <span className="text-green-500">Typing...</span>
                      ) : lastMsg?.content ? lastMsg.content : lastMsg?.fileUrl ? (lastMsg.fileType?.startsWith('audio/') ? '🎤 Voice message' : lastMsg.fileType?.startsWith('video/') ? '📹 Video' : lastMsg.fileType?.startsWith('image/') ? '📷 Photo' : '📎 File') : 'No messages yet'}
                    </p>
                  </div>
                  {unread > 0 && (
                    <span className="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
      
      {/* Chat Area */}
      <div className={`${isMobile && !showChatArea ? 'hidden' : 'flex'} flex-1 flex-col bg-gray-50 dark:bg-gray-900`}>
        {selectedChat && (otherUser || selectedChat.isGroup) ? (
          <>
            {/* Chat Header */}
            <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-4 py-3 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                {isMobile && (
                  <button onClick={goBackToChatList} className="p-2 hover:bg-gray-100 rounded-full">
                    <FaArrowLeft size={20} className="text-gray-600" />
                  </button>
                )}
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center text-white font-bold">
                    {selectedChat.isGroup ? <FaUsers size={18} /> : getInitials(otherUser?.fullName)}
                  </div>
                  {!selectedChat.isGroup && onlineUsers[otherUser?.id] && (
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div>
                  <h2 className="font-semibold text-gray-800 dark:text-white">
                    {selectedChat.isGroup ? selectedChat.name || 'Group Chat' : otherUser?.fullName}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {isTypingNow ? <span className="text-green-500">Typing...</span> : selectedChat.isGroup ? `${selectedChat.participants?.length || 0} members` : otherUser?.role}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {!selectedChat.isGroup && (
                  <button onClick={() => navigate(`/call/${otherUser?.id}`)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-green-500">
                    <FaVideo size={20} />
                  </button>
                )}
              </div>
            </div>
            
            {/* Reply/Edit Preview */}
            {(replyingTo || editingMessage) && (
              <div className={`px-4 py-2 border-l-4 flex justify-between items-center ${replyingTo ? 'bg-gray-100 dark:bg-gray-800 border-green-500' : 'bg-gray-100 dark:bg-gray-800 border-blue-500'}`}>
                <div className="flex-1">
                  <p className="text-xs font-semibold">{replyingTo ? 'Replying to' : 'Editing'}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{replyingTo?.content || editingMessage?.content || 'Media'}</p>
                </div>
                <button onClick={() => { setReplyingTo(null); setEditingMessage(null); setInput(''); }} className="p-1 hover:bg-gray-200 rounded-full">
                  <FaTimes size={12} className="text-gray-500" />
                </button>
              </div>
            )}
            
            {/* Messages Container */}
            <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <FaComment size={48} className="mb-3 opacity-30" />
                  <p>No messages yet</p>
                  <p className="text-sm">Send a message to start the conversation</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.senderId === user.id;
                  const isAudio = msg.fileType?.startsWith('audio/');
                  const isVideo = msg.fileType?.startsWith('video/');
                  const isImage = msg.fileType?.startsWith('image/');
                  const repliedTo = msg.replyToId ? messages.find(m => m.id === msg.replyToId) : null;
                  
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} message-item group relative`}>
                      <div className={`max-w-[75%] px-4 py-2 rounded-2xl relative ${isOwn ? 'bg-green-500 text-white rounded-br-sm' : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-white shadow-md rounded-bl-sm'}`}>
                        {repliedTo && (
                          <div className={`text-xs mb-1 p-1 rounded ${isOwn ? 'bg-green-600' : 'bg-gray-100 dark:bg-gray-700'} opacity-75`}>
                            <p className="font-semibold">↳ {repliedTo.senderId === user.id ? 'You' : repliedTo.sender?.fullName}</p>
                            <p className="truncate">{repliedTo.content || 'Media'}</p>
                          </div>
                        )}
                        {msg.content && <p className="text-sm break-words">{msg.content}</p>}
                        {msg.fileUrl && (
                          <>
                            {isImage && <img src={msg.fileUrl} alt="" className="max-w-full rounded mt-1 max-h-60 cursor-pointer" onClick={() => window.open(msg.fileUrl)} />}
                            {isVideo && <video controls className="max-w-full rounded mt-1 max-h-60"><source src={msg.fileUrl} /></video>}
                            {isAudio && <AudioPlayer audioUrl={msg.fileUrl} messageId={msg.id} />}
                          </>
                        )}
                        {msg.reaction && <div className="absolute -top-3 -right-2 text-lg">{msg.reaction}</div>}
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className={`text-[10px] ${isOwn ? 'text-green-200' : 'text-gray-400'}`}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <MessageStatus message={msg} isOwn={isOwn} />
                        </div>
                        
                        {/* Message Actions */}
                        {!isMobile && (
                          <div className="absolute -top-8 right-0 bg-white dark:bg-gray-800 rounded-full shadow-lg flex gap-1 p-1 opacity-0 group-hover:opacity-100 transition z-10">
                            <button onClick={() => { setReplyingTo(msg); setInput(''); }} className="p-1.5 hover:bg-gray-100 rounded-full" title="Reply">
                              <FaReply size={12} className="text-gray-600" />
                            </button>
                            {isOwn && (
                              <>
                                <button onClick={() => { setEditingMessage(msg); setInput(msg.content); }} className="p-1.5 hover:bg-gray-100 rounded-full" title="Edit">
                                  <FaEdit size={12} className="text-gray-600" />
                                </button>
                                <button onClick={() => { setSelectedMessage(msg); setShowDeleteConfirm(true); }} className="p-1.5 hover:bg-red-100 rounded-full" title="Delete">
                                  <FaTrash size={12} className="text-red-500" />
                                </button>
                              </>
                            )}
                            <button onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)} className="p-1.5 hover:bg-gray-100 rounded-full" title="React">
                              <FaSmile size={12} className="text-gray-600" />
                            </button>
                          </div>
                        )}
                        {showReactionPicker === msg.id && (
                          <div className="absolute -top-12 left-0 flex gap-2 bg-white dark:bg-gray-800 rounded-full p-2 shadow-lg z-20">
                            {reactions.map(emoji => (
                              <button key={emoji} onClick={() => handleReaction(msg.id, emoji)} className="text-2xl hover:scale-125 transition">
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {showScrollButton && (
              <button onClick={scrollToBottom} className="absolute bottom-20 right-4 bg-green-500 text-white rounded-full p-2 shadow-lg hover:bg-green-600 transition z-10">
                <FaArrowDown size={16} />
              </button>
            )}
            
            {/* Message Input */}
            <div className="bg-white dark:bg-gray-800 border-t dark:border-gray-700 px-4 py-3">
              <div className="flex items-center gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:text-green-500 rounded-full hover:bg-gray-100">
                  <FaPaperclip size={20} />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); e.target.value = ''; }} />
                <div className="flex-1">
                  <textarea
                    value={input}
                    onChange={handleTyping}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (editingMessage ? editMessage() : sendMessage())}
                    placeholder="Message..."
                    rows="1"
                    className="w-full px-4 py-2 border dark:border-gray-600 rounded-full resize-none focus:outline-none focus:ring-2 focus:ring-green-500 text-sm bg-gray-50 dark:bg-gray-700 dark:text-white"
                    style={{ maxHeight: '100px' }}
                  />
                </div>
                <button
                  onClick={editingMessage ? editMessage : sendMessage}
                  disabled={(!input.trim() && !editingMessage) || sending}
                  className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 disabled:opacity-50 transition shadow-md"
                >
                  <FaPaperPlane size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <FaComment size={64} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Select a chat</p>
              <p className="text-sm">Choose a conversation to start messaging</p>
              <button onClick={() => setShowSearch(true)} className="mt-4 px-4 py-2 bg-green-500 text-white rounded-full text-sm font-medium hover:bg-green-600">
                Find Users
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedMessage && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Delete Message</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Are you sure you want to delete this message?</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setSelectedMessage(null); }} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={deleteMessage} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;