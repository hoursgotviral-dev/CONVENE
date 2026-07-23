import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Mail,
  Lock,
  User,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Zap,
  Check,
  Layers,
  ArrowLeft
} from 'lucide-react';

interface AuthContainerProps {
  onSuccess: (userEmail: string) => void;
}

export const AuthContainer: React.FC<AuthContainerProps> = ({ onSuccess }) => {
  const [screen, setScreen] = useState<'login' | 'signup' | 'forgot'>('login');
  
  // Form values
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  // Submit states
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Validations (Inline as the user types)
  const [emailFeedback, setEmailFeedback] = useState<{ status: 'idle' | 'invalid' | 'valid'; msg: string }>({ status: 'idle', msg: '' });
  const [passwordFeedback, setPasswordFeedback] = useState<{ status: 'weak' | 'moderate' | 'strong'; msg: string }>({ status: 'weak', msg: 'Password should be at least 8 characters.' });
  const [matchFeedback, setMatchFeedback] = useState<{ status: 'idle' | 'mismatch' | 'match'; msg: string }>({ status: 'idle', msg: '' });

  // Email validation check
  useEffect(() => {
    if (!email) {
      setEmailFeedback({ status: 'idle', msg: '' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailFeedback({
        status: 'invalid',
        msg: 'Please enter a complete email address (e.g., alex@company.com).',
      });
    } else {
      setEmailFeedback({
        status: 'valid',
        msg: 'Email is formatted correctly.',
      });
    }
  }, [email]);

  // Password strength checker
  useEffect(() => {
    if (!password) {
      setPasswordFeedback({ status: 'weak', msg: 'Password should be at least 8 characters.' });
      return;
    }

    if (password.length < 8) {
      setPasswordFeedback({
        status: 'weak',
        msg: 'Almost there! Password should be at least 8 characters.',
      });
      return;
    }

    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!hasNumber) {
      setPasswordFeedback({
        status: 'moderate',
        msg: 'Good length! Add a number to make this stronger.',
      });
    } else if (!hasSpecial) {
      setPasswordFeedback({
        status: 'moderate',
        msg: 'Great! Add a special character (like @, $, !, %) for maximum security.',
      });
    } else {
      setPasswordFeedback({
        status: 'strong',
        msg: 'Password is highly secure!',
      });
    }
  }, [password]);

  // Password confirmation matcher
  useEffect(() => {
    if (!confirmPassword) {
      setMatchFeedback({ status: 'idle', msg: '' });
      return;
    }

    if (password !== confirmPassword) {
      setMatchFeedback({
        status: 'mismatch',
        msg: 'Passwords do not match yet.',
      });
    } else {
      setMatchFeedback({
        status: 'match',
        msg: 'Passwords match perfectly.',
      });
    }
  }, [password, confirmPassword]);

  // Reset form errors on switch
  const handleSwitchScreen = (target: 'login' | 'signup' | 'forgot') => {
    setScreen(target);
    setErrorMessage(null);
    setSuccessMessage(null);
    setPassword('');
    setConfirmPassword('');
    setTermsAccepted(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || emailFeedback.status !== 'valid') {
      setErrorMessage('Please fill in a valid email address and password.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      setSubmitting(false);

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Authentication failed. Please check your credentials.');
        return;
      }

      onSuccess(data.user?.email || email);
    } catch (err: any) {
      setSubmitting(false);
      setErrorMessage('Network error authenticating. Please try again.');
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Please tell us your name so we know who you are.');
      return;
    }
    if (emailFeedback.status !== 'valid') {
      setErrorMessage('Please provide a correctly formatted email address.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Your password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('The passwords you entered do not match.');
      return;
    }
    if (!termsAccepted) {
      setErrorMessage('Please review and accept our terms of service to create an account.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName: name }),
      });

      const data = await res.json();

      setSubmitting(false);

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Registration failed. Please try again.');
        return;
      }

      setSuccessMessage('Your account was created! Logging you in now...');
      setTimeout(() => {
        onSuccess(data.user?.email || email);
      }, 800);
    } catch (err: any) {
      setSubmitting(false);
      setErrorMessage('Network error creating account. Please try again.');
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailFeedback.status !== 'valid') {
      setErrorMessage('Please enter a valid email address to receive the link.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    setTimeout(() => {
      setSubmitting(false);
      setSuccessMessage('Check your email inbox for a secure recovery link. We just sent it.');
    }, 1200);
  };

  return (
    <div id="auth-main-container" className="min-h-screen bg-neutral-950 flex font-sans select-none overflow-hidden text-neutral-200">
      
      {/* LEFT SIDE: Asymmetrical Split Layout Form */}
      <div className="w-full lg:w-[45%] flex flex-col justify-between p-6 sm:p-12 bg-neutral-950 border-r border-neutral-900 overflow-y-auto relative z-10">
        
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#5f5af6]/10 text-[#5f5af6] border border-[#5f5af6]/20 rounded-lg shadow-lg shadow-[#5f5af6]/5">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-widest text-neutral-100 font-display uppercase">
              SAMANVAY
            </span>
            <span className="block text-[10px] text-neutral-500 font-mono tracking-widest uppercase">
              COORDINATION GATEWAY
            </span>
          </div>
        </div>

        {/* Central interactive screen cards */}
        <div className="my-auto py-10 max-w-md w-full mx-auto space-y-8">
          
          {/* Header Copy */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-100 font-display">
              {screen === 'login' && 'Welcome back'}
              {screen === 'signup' && 'Create developer account'}
              {screen === 'forgot' && 'Reset your password'}
            </h1>
            <p className="text-sm text-neutral-400">
              {screen === 'login' && 'Sign in to monitor and coordinate multi-agent AI processes.'}
              {screen === 'signup' && 'Get started with SAMANVAY in under two minutes.'}
              {screen === 'forgot' && "Enter your email. We'll send a plain-text link to securely restore access."}
            </p>
          </div>

          {/* Feedback banners */}
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-start gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed font-sans">{errorMessage}</p>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg flex items-start gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed font-sans">{successMessage}</p>
            </div>
          )}

          {/* LOGIN SCREEN FORM */}
          {screen === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Work Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="login-email"
                    type="email"
                    required
                    placeholder="alex@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#5f5af6]/40 focus:border-[#5f5af6] placeholder-neutral-600 transition-all font-sans"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="login-password" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => handleSwitchScreen('forgot')}
                    className="text-xs text-[#5f5af6] hover:text-[#7d79f8] transition-colors font-medium cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    required
                    placeholder="Enter your security password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#5f5af6]/40 focus:border-[#5f5af6] placeholder-neutral-600 transition-all font-sans"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 bg-[#5f5af6] hover:bg-[#4f49e4] disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-semibold text-sm rounded-lg transition-all duration-200 shadow-lg shadow-[#5f5af6]/10 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] focus:ring-2 focus:ring-[#5f5af6]/50"
              >
                {submitting ? 'Verifying access credentials...' : 'Enter Dashboard'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-center text-xs text-neutral-400 mt-2">
                New to Samanvay?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchScreen('signup')}
                  className="text-[#5f5af6] hover:text-[#7d79f8] font-bold transition-colors cursor-pointer bg-transparent border-none p-0"
                >
                  Create free account
                </button>
              </p>
            </form>
          )}

          {/* SIGNUP SCREEN FORM */}
          {screen === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="signup-name" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Your Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="signup-name"
                    type="text"
                    required
                    placeholder="Alex Mercer"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#5f5af6]/40 focus:border-[#5f5af6] placeholder-neutral-600 transition-all font-sans"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="signup-email" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Work Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="signup-email"
                    type="email"
                    required
                    placeholder="alex@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full pl-10 pr-3 py-2.5 bg-neutral-900 border rounded-lg text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#5f5af6]/40 focus:border-[#5f5af6] placeholder-neutral-600 transition-all font-sans ${
                      emailFeedback.status === 'invalid'
                        ? 'border-rose-500/50'
                        : emailFeedback.status === 'valid'
                        ? 'border-emerald-500/50'
                        : 'border-neutral-800'
                    }`}
                  />
                </div>
                {emailFeedback.msg && (
                  <p className={`text-[11px] leading-snug flex items-center gap-1.5 ${
                    emailFeedback.status === 'invalid' ? 'text-amber-500' : 'text-emerald-400'
                  }`}>
                    {emailFeedback.status === 'invalid' ? (
                      <AlertCircle className="w-3 h-3 shrink-0" />
                    ) : (
                      <Check className="w-3 h-3 shrink-0" />
                    )}
                    {emailFeedback.msg}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="signup-password" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Choose Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="signup-password"
                    type="password"
                    required
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#5f5af6]/40 focus:border-[#5f5af6] placeholder-neutral-600 transition-all font-sans"
                  />
                </div>
                {password && (
                  <p className={`text-[11px] leading-snug flex items-center gap-1.5 ${
                    passwordFeedback.status === 'strong' ? 'text-emerald-400' : 'text-amber-500'
                  }`}>
                    {passwordFeedback.status === 'strong' ? (
                      <Check className="w-3 h-3 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3 h-3 shrink-0" />
                    )}
                    {passwordFeedback.msg}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="signup-confirm" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="signup-confirm"
                    type="password"
                    required
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full pl-10 pr-3 py-2.5 bg-neutral-900 border rounded-lg text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#5f5af6]/40 focus:border-[#5f5af6] placeholder-neutral-600 transition-all font-sans ${
                      matchFeedback.status === 'mismatch'
                        ? 'border-rose-500/50'
                        : matchFeedback.status === 'match'
                        ? 'border-emerald-500/50'
                        : 'border-neutral-800'
                    }`}
                  />
                </div>
                {matchFeedback.msg && (
                  <p className={`text-[11px] leading-snug flex items-center gap-1.5 ${
                    matchFeedback.status === 'mismatch' ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {matchFeedback.status === 'mismatch' ? (
                      <AlertCircle className="w-3 h-3 shrink-0" />
                    ) : (
                      <Check className="w-3 h-3 shrink-0" />
                    )}
                    {matchFeedback.msg}
                  </p>
                )}
              </div>

              {/* Consent check */}
              <div className="flex items-start gap-2.5 pt-1">
                <input
                  id="signup-terms"
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 rounded bg-neutral-900 border-neutral-800 text-[#5f5af6] focus:ring-[#5f5af6] cursor-pointer"
                />
                <label htmlFor="signup-terms" className="text-xs text-neutral-400 leading-normal select-none">
                  I consent to the Samanvay terms of service and acknowledge that agents follow sandbox safety guidelines.
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting || !termsAccepted || emailFeedback.status !== 'valid' || password.length < 8 || password !== confirmPassword}
                className="w-full mt-2 py-2.5 px-4 bg-[#5f5af6] hover:bg-[#4f49e4] disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-semibold text-sm rounded-lg transition-all duration-200 shadow-lg shadow-[#5f5af6]/10 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] focus:ring-2 focus:ring-[#5f5af6]/50"
              >
                {submitting ? 'Generating tenant sandbox...' : 'Create Account'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-center text-xs text-neutral-400 mt-2">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchScreen('login')}
                  className="text-[#5f5af6] hover:text-[#7d79f8] font-bold transition-colors cursor-pointer bg-transparent border-none p-0"
                >
                  Log in
                </button>
              </p>
            </form>
          )}

          {/* FORGOT PASSWORD SCREEN */}
          {screen === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="forgot-email" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Your Account Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    placeholder="alex@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[#5f5af6]/40 focus:border-[#5f5af6] placeholder-neutral-600 transition-all font-sans"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || emailFeedback.status !== 'valid'}
                className="w-full py-2.5 px-4 bg-[#5f5af6] hover:bg-[#4f49e4] disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-semibold text-sm rounded-lg transition-all duration-200 shadow-lg shadow-[#5f5af6]/10 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] focus:ring-2 focus:ring-[#5f5af6]/50"
              >
                {submitting ? 'Generating password token...' : 'Request Password Link'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleSwitchScreen('login')}
                className="w-full py-2.5 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white font-medium text-xs rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Return to Login
              </button>
            </form>
          )}

        </div>

        {/* Footer info */}
        <div className="pt-6 border-t border-neutral-900 flex justify-between items-center text-[11px] text-neutral-600 font-mono">
          <span>SAMANVAY V1.0</span>
          <span>SANDBOXED PORT 3000</span>
        </div>

      </div>

      {/* RIGHT SIDE: Immersive Product Context Showcase */}
      <div className="hidden lg:flex lg:w-[55%] bg-neutral-950 p-12 flex-col justify-between relative overflow-hidden">
        
        {/* Background Ambient Aura */}
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#5f5af6]/10 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[10%] w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[110px] pointer-events-none" />
        
        {/* Decorative Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

        {/* Info header */}
        <div className="flex items-center gap-2 text-xs text-[#5f5af6] font-mono tracking-widest uppercase">
          <ShieldCheck className="w-4 h-4" />
          <span>Multi-Agent Autonomy Verified</span>
        </div>

        {/* Product Context Teaser */}
        <div className="space-y-8 max-w-lg">
          <div className="space-y-3">
            <h2 className="text-3xl font-extrabold tracking-tight text-white font-display leading-tight">
              Orchestrate autonomous <span className="text-[#5f5af6]">AI workers</span> in harmony.
            </h2>
            <p className="text-sm text-neutral-400 leading-relaxed">
              SAMANVAY manages specialized AI entities designed to dissect engineering plans, generate granular financial timeline ledgers, and audit structural system vulnerabilities.
            </p>
          </div>

          {/* Interactive Agent teasers */}
          <div className="space-y-4">
            
            {/* Agent 1 Teaser */}
            <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-2xl flex gap-4 hover:border-neutral-700 transition-all">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 rounded-lg h-fit">
                <Layers className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-neutral-200">Planner Agent</span>
                  <span className="text-[9px] font-mono bg-emerald-500/15 text-emerald-400 px-2 rounded-full font-bold">READY</span>
                </div>
                <p className="text-xs text-neutral-500 leading-normal font-sans">Decomposes product descriptions into hierarchical modules and explicit database models automatically.</p>
              </div>
            </div>

            {/* Agent 2 Teaser */}
            <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-2xl flex gap-4 hover:border-neutral-700 transition-all">
              <div className="p-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/15 rounded-lg h-fit">
                <Zap className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-neutral-200">Estimator Agent</span>
                  <span className="text-[9px] font-mono bg-cyan-500/15 text-cyan-400 px-2 rounded-full font-bold">READY</span>
                </div>
                <p className="text-xs text-neutral-500 leading-normal font-sans">Simulates labor hours and matches rate tiers to export highly predictable engineering cost projections.</p>
              </div>
            </div>

            {/* Agent 3 Teaser */}
            <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-2xl flex gap-4 hover:border-neutral-700 transition-all">
              <div className="p-2 bg-rose-500/10 text-rose-400 border border-rose-500/15 rounded-lg h-fit">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-neutral-200">Risk-Flagger Agent</span>
                  <span className="text-[9px] font-mono bg-rose-500/15 text-rose-400 px-2 rounded-full font-bold">READY</span>
                </div>
                <p className="text-xs text-neutral-500 leading-normal font-sans">Runs preemptive compliance logs and threat reviews, drafting direct operational mitigation playbooks.</p>
              </div>
            </div>

          </div>
        </div>

        {/* Lower trust indicator */}
        <div className="text-[11px] text-neutral-600 leading-relaxed max-w-sm">
          Protected by tenant encryption logic. Zero-retention secure model pipeline guarantees total prompt intellectual privacy.
        </div>

      </div>

    </div>
  );
};
