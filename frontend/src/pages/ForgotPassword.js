 import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaEnvelope, FaKey, FaArrowLeft } from 'react-icons/fa';
import toast from 'react-hot-toast';
import api from '../services/api';
import AuthShell from '../components/AuthShell';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const startCountdown = () => {
    setResendDisabled(true);
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setResendDisabled(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      toast.success('Reset code sent! Check your email');
      setStep(2);
      startCountdown();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendDisabled) return;

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      toast.success('New code sent!');
      startCountdown();
    } catch (error) {
      toast.error('Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (!otp || otp.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, otp, newPassword });
      toast.success('Password reset successfully! Please login.');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell start={3}>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Reset Password</h1>
          <p className="text-gray-500 mt-2">
            {step === 1 ? 'Enter your email to receive a reset code' : 'Enter the code and your new password'}
          </p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleSendCode}>
            <div className="mb-6">
              <div className="relative">
                <FaEnvelope className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nts-green-500 focus:border-transparent outline-none" placeholder="your@email.com" required />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-nts-green-600 text-white py-2 rounded-lg font-semibold hover:bg-nts-green-700 disabled:opacity-50 transition">
              {loading ? 'Sending...' : 'Send Reset Code'}
            </button>

            <p className="text-center text-sm text-gray-600 mt-6">
              <Link to="/login" className="text-nts-green-600 font-semibold hover:underline flex items-center justify-center">
                <FaArrowLeft className="mr-1" size={12} /> Back to Login
              </Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleResetPassword}>
            <div className="mb-4">
              <input type="email" value={email} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed" disabled />
            </div>

            <div className="mb-4">
              <input type="text" placeholder="Reset Code (OTP)" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength="6" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nts-green-500 focus:border-transparent outline-none text-center text-2xl tracking-widest" required />
              <button type="button" onClick={handleResendCode} disabled={resendDisabled || loading} className="text-sm text-nts-green-600 mt-2 hover:underline disabled:opacity-50">
                {resendDisabled ? `Resend in ${countdown}s` : 'Resend Code'}
              </button>
            </div>

            <div className="mb-4">
              <div className="relative">
                <FaKey className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nts-green-500 focus:border-transparent outline-none" required />
              </div>
            </div>

            <div className="mb-6">
              <div className="relative">
                <FaKey className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nts-green-500 focus:border-transparent outline-none" required />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-nts-green-600 text-white py-2 rounded-lg font-semibold hover:bg-nts-green-700 disabled:opacity-50 transition">
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
    </AuthShell>
  );
};

export default ForgotPassword;
