import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import HumanCheck from '../components/HumanCheck';
import toast from 'react-hot-toast';
import { FaEnvelope, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';
import AuthShell from '../components/AuthShell';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill all fields');
      return;
    }
    
    setLoading(true);
    const result = await login(email, password);
    if (result.success) {
      toast.success('Welcome back!');
      if (useAuthStore.getState().user?.mustChangePassword) toast('You are using a temporary password. Please change it in your Profile.', { icon: '🔑', duration: 7000 });
      navigate('/');
    } else if (result.needsVerification) {
      toast.error('Please verify your email first');
      navigate('/verify-otp', { state: { email: email.trim().toLowerCase(), resend: true } });
    } else {
      toast.error(result.error || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <AuthShell start={0}>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Welcome to NTS</h1>
          <p className="text-gray-500 mt-2">Learn • Practice • Excel</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <div className="relative">
              <FaEnvelope className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                required
              />
            </div>
          </div>

          <div className="mb-6">
            <div className="relative">
              <FaLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                required
              />
              <HumanCheck />

          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Show or hide password">{show ? <FaEyeSlash /> : <FaEye />}</button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {process.env.NODE_ENV !== 'production' && (
          <div className="mt-5 rounded-xl border border-dashed border-gray-300 p-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">Demo accounts (password: Password123) — click to fill</p>
            <div className="flex flex-wrap gap-1.5">
              {[['Teacher', 'marie.uwase@nts-demo.rw'], ['Student', 'eric.mugisha@nts-demo.rw'], ['Parent', 'aline.giraneza@nts-demo.rw'], ['Employer', 'alain.ntwari@nts-demo.rw']].map(([label, mail]) => (
                <button key={mail} type="button" onClick={() => { setEmail(mail); setPassword('Password123'); }} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-nts-green-100">{label}</button>
              ))}
            </div>
          </div>
        )}

        <div className="text-center mt-6 space-y-2">
          <Link to="/forgot-password" className="text-sm text-nts-green-600 hover:underline block">
            Forgot Password?
          </Link>
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-nts-green-600 font-semibold hover:underline">
              Register
            </Link>
          </p>
        </div>
    </AuthShell>
  );
};

export default Login;