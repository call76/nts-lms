import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useSiteStore } from '../store/siteStore';
import { useAuthStore } from '../store/authStore';
import AuthShell from '../components/AuthShell';
import HumanCheck from '../components/HumanCheck';

const ROLES = [
  { value: 'STUDENT', label: 'Student', hint: 'Learn, practise, earn certificates' },
  { value: 'PARENT', label: 'Parent / Guardian', hint: 'Follow your child and talk to teachers' },
  { value: 'EMPLOYER', label: 'Employer', hint: 'Find certified talent and post internships' },
  { value: 'GUEST', label: 'Guest', hint: 'Explore NTS with the AI assistant' },
];
const field = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nts-green-500 focus:border-transparent outline-none';

const SIGNUP = { STUDENT: 'allowStudentSignup', PARENT: 'allowParentSignup', EMPLOYER: 'allowEmployerSignup', GUEST: 'allowGuestSignup' };

const Register = () => {
  const siteSystem = useSiteStore((st) => st.site.system) || {};
  const OPEN_ROLES = ROLES.filter((r) => siteSystem[SIGNUP[r.value]] !== false);
  const [f, setF] = useState({
    fullName: '', email: '', password: '', confirmPassword: '', role: 'STUDENT', phone: '', school: '',
    schoolType: 'TVET', department: '', className: '', verificationDocument: null, childEmails: '', relationship: 'Parent',
  });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuthStore();
  const navigate = useNavigate();
  const set = (e) => setF({ ...f, [e.target.name]: e.target.value });
  const role = ROLES.find((r) => r.value === f.role);

  const submit = async (e) => {
    e.preventDefault();
    if (f.password !== f.confirmPassword) return toast.error('Passwords do not match');
    if (f.password.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    const body = new FormData();
    Object.entries({
      fullName: f.fullName, email: f.email, password: f.password, role: f.role, phone: f.phone, school: f.school,
      schoolType: f.role === 'STUDENT' ? f.schoolType : '', department: f.role === 'STUDENT' ? f.department : '', className: f.role === 'STUDENT' ? f.className : '',
      childEmails: f.role === 'PARENT' ? f.childEmails : '', relationship: f.role === 'PARENT' ? f.relationship : '',
      verificationDocument: f.role === 'STUDENT' ? f.verificationDocument : null,
    }).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') body.append(k, v); });
    const r = await register(body);
    setLoading(false);
    if (!r.success) return toast.error(r.error);
    if (r.unlinkedEmails?.length) toast(`No student account found for: ${r.unlinkedEmails.join(', ')}. Ask the school admin to link you.`, { icon: 'ℹ️', duration: 8000 });
    if (f.role === 'PARENT') toast('Your child must approve the link before you can see their progress.', { icon: '🔗', duration: 7000 });
    if (r.autoVerified) { toast.success('Account created. Welcome to NTS!'); navigate('/'); return; }
    toast.success('Verification code sent to your email');
    navigate('/verify-otp', { state: { email: r.email } });
  };

  return (
    <AuthShell start={1}>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Create Account</h1>
        <p className="text-gray-500 mt-1">Join the NTS community</p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <select name="role" value={f.role} onChange={set} className={field}>
            {OPEN_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <p className="text-xs text-gray-500 mt-1">{role?.hint}. Trainer accounts are created by NTS administrators.</p>
        </div>
        <input type="text" name="fullName" placeholder="Full name" value={f.fullName} onChange={set} className={field} required />
        <input type="email" name="email" placeholder="Email" value={f.email} onChange={set} className={field} required />
        <input type="tel" name="phone" placeholder="Phone number (optional)" value={f.phone} onChange={set} className={field} />

        {f.role === 'STUDENT' && (
          <>
            <input type="text" name="school" placeholder="School / University" value={f.school} onChange={set} className={field} />
            <select name="schoolType" value={f.schoolType} onChange={set} className={field}>
              <option value="TVET">TVET student</option>
              <option value="UNIVERSITY">University student</option>
              <option value="HIGH_SCHOOL">High school student</option>
            </select>
            <input type="text" name="department" placeholder="Department / Trade (e.g. Software Development)" value={f.department} onChange={set} className={field} required />
            <input type="text" name="className" placeholder="Class / Level (e.g. Year 1 A)" value={f.className} onChange={set} className={field} required />
            <div className="p-3 rounded-xl border border-green-200 bg-green-50">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Student ID or school letter <span className="font-normal text-gray-500">(optional, speeds up approval)</span></label>
              <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setF({ ...f, verificationDocument: e.target.files?.[0] || null })} className="w-full text-sm" />
              <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG or WEBP · max 8MB · private.</p>
            </div>
          </>
        )}

        {f.role === 'PARENT' && (
          <div className="p-3 rounded-xl border border-green-200 bg-green-50 space-y-2">
            <input type="text" name="childEmails" placeholder="Your child's student email (several: separate with commas)" value={f.childEmails} onChange={set} className={field} required />
            <select name="relationship" value={f.relationship} onChange={set} className={field}>
              {['Parent', 'Mother', 'Father', 'Guardian', 'Sibling', 'Other'].map((r) => <option key={r}>{r}</option>)}
            </select>
            <p className="text-xs text-gray-500">Your child gets a request and must approve it before you can see their progress and talk to their teachers.</p>
          </div>
        )}

        <div className="relative">
          <input type={show ? 'text' : 'password'} name="password" placeholder="Password (min 6 characters)" value={f.password} onChange={set} className={`${field} pr-10`} required />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Show or hide password">{show ? <FaEyeSlash /> : <FaEye />}</button>
        </div>
        <input type={show ? 'text' : 'password'} name="confirmPassword" placeholder="Confirm password" value={f.confirmPassword} onChange={set} className={field} required />

        <HumanCheck />
        <button type="submit" disabled={loading} className="w-full bg-nts-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-nts-green-700 disabled:opacity-50 transition">
          {loading ? 'Creating account…' : 'Register'}
        </button>
      </form>
      <p className="text-center text-sm text-gray-600 mt-5">
        Already have an account? <Link to="/login" className="text-nts-green-600 font-semibold hover:underline">Login</Link>
      </p>
    </AuthShell>
  );
};

export default Register;
