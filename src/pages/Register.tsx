import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { Link, useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { UserRole } from '../types';
import { cn } from '../lib/utils';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      console.log("Creating Firestore profile for UID:", user.uid);
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email,
        displayName: name,
        role,
        courseIds: [],
        createdAt: Date.now(),
      });
      console.log("Firestore profile created successfully");

      // Navigate based on the role we just assigned
      if (role === 'admin') navigate('/admin');
      else navigate('/student');
    } catch (err: any) {
      console.error("Registration error:", err);
      let errorMessage = err.message;
      
      if (err.code === 'auth/network-request-failed') {
        errorMessage = "Network error: Please check your internet connection or disable any ad-blockers/firewalls that might be blocking Firebase.";
      } else if (err.code === 'permission-denied') {
        errorMessage = "Database permission denied. Please ensure your Firestore Security Rules allow profile creation (see instructions).";
      }

      // If Firestore fails, delete the Auth user so they can try again
      if (auth.currentUser) {
        try {
          console.log("Cleaning up Auth user due to Firestore failure...");
          await auth.currentUser.delete();
        } catch (deleteErr) {
          console.error('Failed to cleanup auth user:', deleteErr);
        }
      }
      setError(`Registration failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-white p-12 rounded-3xl shadow-xl shadow-primary/5 border border-primary/5">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-display font-bold tracking-tighter mb-2 text-primary">QuizVerse</h1>
          <p className="text-sm text-primary/50 uppercase tracking-widest font-semibold">Create your account</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 text-xs font-mono rounded-xl border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-6">
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Full Name</label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
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
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Account Type</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={cn(
                  "py-3 rounded-xl text-xs font-bold border-2 transition-all",
                  role === 'student' ? "border-primary bg-primary text-white" : "border-primary/5 text-primary/40"
                )}
              >
                STUDENT
              </button>
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={cn(
                  "py-3 rounded-xl text-xs font-bold border-2 transition-all",
                  role === 'admin' ? "border-primary bg-primary text-white" : "border-primary/5 text-primary/40"
                )}
              >
                ADMIN
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50"
          >
            {loading ? 'CREATING ACCOUNT...' : 'REGISTER'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-primary/40">
            Already have an account?{' '}
            <Link to="/login" className="text-accent font-bold hover:underline">
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
