import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUsers, FaGlobeAfrica, FaBookOpen, FaCloudUploadAlt, FaComments, FaLayerGroup } from 'react-icons/fa';
import toast from 'react-hot-toast';
import api, { uploadFile } from '../services/api';
import { useAuthStore } from '../store/authStore';
import SiteImg from '../components/SiteImg';

export default function Community() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [myClass, setMyClass] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', file: null, classGroupId: '' });

  const load = async () => {
    try {
      const [c, mine, m] = await Promise.all([api.get('/community/classes'), api.get('/community/my-class'), api.get('/community/materials')]);
      setClasses(c.data); setMyClass(mine.data); setMaterials(m.data);
    } catch (e) { toast.error(e.response?.data?.error || 'Could not load community'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openChat = async (endpoint) => { try { const r = await api.post(endpoint); navigate('/messages', { state: { selectedChat: r.data } }); } catch (e) { toast.error(e.response?.data?.error || 'Could not open chat'); } };

  const joinClass = async (groupId) => {
    try { await api.post('/community/classes/join', { groupId }); toast.success('You joined this class community ✓'); setMyClass((old)=>old); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Could not join class'); }
  };

  const submitMaterial = async (e) => {
    e.preventDefault();
    if (!form.file) return toast.error('Choose a learning file first');
    setUploading(true);
    try {
      const uploaded = await uploadFile(form.file);
      await api.post('/community/materials', { title: form.title, description: form.description, fileUrl: uploaded.url, fileName: uploaded.filename, fileType: uploaded.mimetype, classGroupId: form.classGroupId || null });
      toast.success('Learning material published'); setForm({ title: '', description: '', file: null, classGroupId: '' }); load();
    } catch (e) { toast.error(e.response?.data?.error || 'Upload failed'); }
    finally { setUploading(false); }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading NTS communities…</div>;
  return <main className="min-h-screen bg-slate-50 dark:bg-gray-950 px-3 sm:px-6 py-6">
    <div className="max-w-7xl mx-auto">
      <section className="rounded-3xl bg-gradient-to-r from-emerald-950 via-emerald-800 to-teal-700 text-white p-7 sm:p-10 shadow-xl relative overflow-hidden">
        <SiteImg slot="communityHero" className="absolute inset-0 w-full h-full object-cover opacity-30" /><div className="absolute inset-0 bg-gradient-to-r from-emerald-950/90 via-emerald-900/60 to-transparent"/>
        <div className="absolute -right-12 -top-16 w-64 h-64 rounded-full bg-white/10"/><div className="absolute right-28 -bottom-24 w-48 h-48 rounded-full bg-emerald-300/10"/>
        <div className="relative"><span className="text-emerald-200 text-xs font-bold tracking-[.2em] uppercase">NTS • Learn together</span><h1 className="text-3xl sm:text-4xl font-black mt-3">Your class. Your people. Your future.</h1><p className="text-emerald-50/80 mt-3 max-w-2xl">Connect with classmates in your department, share knowledge, meet trainers and learn from one community.</p><div className="flex flex-wrap gap-3 mt-6"><a href="#my-class" className="bg-white text-emerald-900 px-5 py-3 rounded-xl font-bold text-sm">My class community</a><a href="#all-classes" className="bg-white/10 border border-white/20 px-5 py-3 rounded-xl font-bold text-sm">Explore classes</a></div></div>
      </section>
      <section className="grid sm:grid-cols-3 gap-4 mt-6">
        {[{icon:FaUsers,n:classes.reduce((a,c)=>a+(c._count?.members||0),0),l:'Community members'},{icon:FaLayerGroup,n:classes.length,l:'Class communities'},{icon:FaBookOpen,n:materials.length,l:'Learning resources'}].map((x,i)=><div key={i} className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-slate-100 dark:border-gray-800 shadow-sm flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><x.icon size={21}/></div><div><div className="text-2xl font-black text-slate-900 dark:text-white">{x.n}</div><div className="text-xs text-slate-500">{x.l}</div></div></div>)}
      </section>
      <section id="my-class" className="mt-8 grid lg:grid-cols-[1.4fr_.8fr] gap-5">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-800 p-6 shadow-sm"><div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center"><FaUsers/></div><div><h2 className="font-extrabold text-xl text-slate-900 dark:text-white">My class community</h2><p className="text-xs text-slate-500">Friends and learners in your own department</p></div></div>
          {myClass ? <><h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-300">{myClass.department} · {myClass.name}</h3><p className="text-sm text-slate-500 mt-1">{myClass.school || 'NTS community'} · {myClass.members?.length || 0} members</p><div className="grid sm:grid-cols-2 gap-3 mt-5">{(myClass.members||[]).map(member=><div key={member.id} className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-gray-800 p-3"><img src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.fullName)}`} alt="" className="w-10 h-10 rounded-full object-cover"/><div className="min-w-0"><div className="font-semibold text-sm text-slate-800 dark:text-white truncate">{member.fullName}</div><div className="text-xs text-slate-500">{member.className || 'Classmate'}</div></div></div>)}</div><div className="mt-5 flex flex-wrap gap-2"><button onClick={()=>openChat('/community/my-class/chat')} className="rounded-xl bg-emerald-700 text-white px-4 py-2 text-sm font-bold inline-flex items-center gap-2"><FaComments/> Open class chat</button><a href="/feed" className="rounded-xl bg-slate-100 dark:bg-gray-800 px-4 py-2 text-sm font-bold text-slate-700 dark:text-white">Community feed</a></div></> : <div className="rounded-xl bg-amber-50 text-amber-900 p-4 text-sm">You have not joined a class group yet. Choose your department and class below to find your classmates.</div>}
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-800 p-6 shadow-sm"><div className="flex items-center gap-3"><FaGlobeAfrica className="text-emerald-700"/><h2 className="font-extrabold text-lg text-slate-900 dark:text-white">NTS Global Lounge</h2></div><p className="text-sm text-slate-500 mt-2">A shared space for all verified students, university learners, high-school students and trainers to exchange ideas.</p><div className="mt-5 rounded-xl bg-gradient-to-br from-emerald-50 to-cyan-50 p-4"><div className="font-bold text-emerald-950">Everyone is welcome</div><p className="text-xs text-emerald-900/70 mt-1">Use the global feed and group conversations to ask questions, share projects and discover opportunities.</p><button onClick={()=>openChat('/community/global-chat')} className="inline-block mt-3 text-sm font-bold text-emerald-800">Enter global chat →</button></div></div>
      </section>
      <section id="all-classes" className="mt-8"><div className="flex items-end justify-between mb-4"><div><h2 className="text-2xl font-black text-slate-900 dark:text-white">Explore class communities</h2><p className="text-sm text-slate-500">Find your department, level and classmates.</p></div></div><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{classes.map(group=><article key={group.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-800 p-5 shadow-sm hover:shadow-lg transition"><div className="flex justify-between"><div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><FaLayerGroup/></div><span className="text-xs text-slate-500">{group._count?.members||0} learners</span></div><h3 className="font-extrabold text-lg mt-4 text-slate-900 dark:text-white">{group.department}</h3><p className="text-sm text-slate-500 mt-1">{group.name} {group.level ? `· ${group.level}` : ''}</p><p className="text-xs text-slate-400 mt-2">{group.school || 'NTS'} · {group.schoolType || 'All levels'}</p>{myClass?.id===group.id?<div className="mt-5 w-full rounded-xl bg-emerald-50 text-emerald-800 py-2.5 text-center text-sm font-bold dark:bg-emerald-900/30 dark:text-emerald-200">✓ Joined</div>:['TRAINER','ADMIN','PARENT'].includes(user?.role)?null:<button onClick={()=>joinClass(group.id)} className="mt-5 w-full rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 text-sm font-bold">{myClass?'Switch to this class':'Join this class'}</button>}</article>)}{!classes.length&&<div className="col-span-full rounded-xl bg-white p-8 text-center text-slate-500">Class communities will appear as students register or admins create them.</div>}</div></section>
      {['TRAINER','ADMIN'].includes(user?.role)&&<section className="mt-8 bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-800 p-6 shadow-sm"><div className="flex items-center gap-3 mb-5"><div className="w-11 h-11 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center"><FaCloudUploadAlt/></div><div><h2 className="font-extrabold text-xl text-slate-900 dark:text-white">Trainer Learning Studio</h2><p className="text-xs text-slate-500">Publish modules, notes, assignments and learning files.</p></div></div><form onSubmit={submitMaterial} className="grid md:grid-cols-2 gap-3"><input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Material title" className="border rounded-xl px-4 py-3 bg-white dark:bg-gray-800 dark:text-white"/><select value={form.classGroupId} onChange={e=>setForm({...form,classGroupId:e.target.value})} className="border rounded-xl px-4 py-3 bg-white dark:bg-gray-800 dark:text-white"><option value="">Share with all students</option>{classes.map(c=><option key={c.id} value={c.id}>{c.department} · {c.name}</option>)}</select><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Describe what students will learn…" className="md:col-span-2 border rounded-xl px-4 py-3 bg-white dark:bg-gray-800 dark:text-white"/><input required type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.mp4,.mp3,.jpg,.jpeg,.png" onChange={e=>setForm({...form,file:e.target.files?.[0]||null})} className="md:col-span-2 text-sm"/><button disabled={uploading} className="md:col-span-2 rounded-xl bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white py-3 font-bold">{uploading?'Uploading…':'Publish learning material'}</button></form></section>}
      <section className="mt-8"><h2 className="text-2xl font-black text-slate-900 dark:text-white mb-4">Latest learning materials</h2><div className="grid md:grid-cols-2 gap-3">{materials.map(m=><a key={m.id} href={m.fileUrl} target="_blank" rel="noreferrer" className="bg-white dark:bg-gray-900 rounded-xl border border-slate-100 dark:border-gray-800 p-4 flex items-center gap-3 hover:shadow-md"><div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center"><FaBookOpen/></div><div className="min-w-0 flex-1"><div className="font-bold text-sm text-slate-900 dark:text-white truncate">{m.title}</div><div className="text-xs text-slate-500">{m.trainer?.fullName} · {m.classGroup?.name || 'Global'}</div></div><span className="text-xs text-emerald-700 font-bold">Open ↗</span></a>)}{!materials.length&&<p className="text-sm text-slate-500">Trainers have not uploaded learning materials yet.</p>}</div></section>
    </div>
  </main>;
}
