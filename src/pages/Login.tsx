import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.error) {
      setError(location.state.error);
    }
  }, [location]);

  const [repairMode, setRepairMode] = useState(false);
  const [repairName, setRepairName] = useState('');
  const [repairRole, setRepairRole] = useState<UserProfile['role']>('student');
  const [repairUid, setRepairUid] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      const profile = userDoc.data() as UserProfile | undefined;
      
      if (profile?.role === 'admin') {
        navigate('/admin');
      } else if (profile?.role === 'student') {
        navigate('/student');
      } else {
        setRepairUid(userCredential.user.uid);
        setRepairMode(true);
        setError('Account found, but profile is missing. Please complete your profile below.');
      }
    } catch (err: any) {
      console.error("Login error:", err);
      let errorMessage = err.message;
      if (err.code === 'auth/network-request-failed') {
        errorMessage = "Network error: Please check your internet connection or disable any ad-blockers/firewalls that might be blocking Firebase.";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setDoc(doc(db, 'users', repairUid), {
        uid: repairUid,
        email: email,
        displayName: repairName,
        role: repairRole,
        courseIds: [],
        createdAt: Date.now(),
      });
      navigate(repairRole === 'admin' ? '/admin' : '/student');
    } catch (err: any) {
      setError(`Repair failed: ${err.message}. Check Firestore Rules.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-white p-12 rounded-3xl shadow-xl shadow-primary/5 border border-primary/5">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-display font-bold tracking-tighter mb-2 text-primary">QuizVerse</h1>
          <p className="text-sm text-primary/50 uppercase tracking-widest font-semibold">
            {repairMode ? 'Complete Profile' : 'Access your portal'}
          </p>
        </div>

        {error && (
          <div className={cn(
            "mb-6 p-4 text-xs font-mono rounded-xl border",
            repairMode ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-red-50 text-red-600 border-red-100"
          )}>
            {error}
          </div>
        )}

        {!repairMode ? (
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Email Address</label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Password</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50"
            >
              {loading ? 'AUTHENTICATING...' : 'LOGIN'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRepair} className="space-y-6">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Full Name</label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
                placeholder="John Doe"
                value={repairName}
                onChange={(e) => setRepairName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Account Type</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setRepairRole('student')}
                  className={cn(
                    "py-3 rounded-xl text-xs font-bold border-2 transition-all",
                    repairRole === 'student' ? "border-primary bg-primary text-white" : "border-primary/5 text-primary/40"
                  )}
                >
                  STUDENT
                </button>
                <button
                  type="button"
                  onClick={() => setRepairRole('admin')}
                  className={cn(
                    "py-3 rounded-xl text-xs font-bold border-2 transition-all",
                    repairRole === 'admin' ? "border-primary bg-primary text-white" : "border-primary/5 text-primary/40"
                  )}
                >
                  ADMIN
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-accent text-white rounded-xl font-bold hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/20 transition-all disabled:opacity-50"
            >
              {loading ? 'CREATING PROFILE...' : 'COMPLETE SETUP'}
            </button>
            <button
              type="button"
              onClick={() => setRepairMode(false)}
              className="w-full text-xs font-bold text-primary/40 uppercase tracking-widest hover:text-primary transition-colors"
            >
              Cancel
            </button>
          </form>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-primary/40">
            Don't have an account?{' '}
            <Link to="/register" className="text-accent font-bold hover:underline">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
