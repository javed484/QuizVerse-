import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/admin/Dashboard';
import AdminCourses from './pages/admin/Courses';
import AdminStudents from './pages/admin/Students';
import AdminQuestions from './pages/admin/Questions';
import AdminQuizzes from './pages/admin/Quizzes';
import StudentDashboard from './pages/student/Dashboard';
import StudentQuiz from './pages/student/Quiz';
import StudentResults from './pages/student/Results';
import Layout from './components/Layout';
import { isFirebaseConfigured } from './lib/firebase';

const ProtectedRoute = ({ children, role }: { children: React.ReactNode; role?: 'admin' | 'student' }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen font-mono bg-background text-primary/20">LOADING_QUIZVERSE...</div>;
  
  if (!user) return <Navigate to="/login" />;
  
  // Handle case where user is logged in but Firestore profile is missing
  if (!profile) return <Navigate to="/login" state={{ error: 'Your profile was not found. Please try registering again.' }} />;
  
  if (role && profile.role !== role) return <Navigate to="/" />;

  return <>{children}</>;
};

const HomeRedirect = () => {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (profile?.role === 'admin') return <Navigate to="/admin" />;
  if (profile?.role === 'student') return <Navigate to="/student" />;
  return <Navigate to="/login" />;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route path="/" element={<HomeRedirect />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute role="admin"><Layout role="admin" /></ProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="courses" element={<AdminCourses />} />
            <Route path="students" element={<AdminStudents />} />
            <Route path="questions" element={<AdminQuestions />} />
            <Route path="quizzes" element={<AdminQuizzes />} />
          </Route>

          {/* Student Routes */}
          <Route path="/student" element={<ProtectedRoute role="student"><Layout role="student" /></ProtectedRoute>}>
            <Route index element={<StudentDashboard />} />
            <Route path="quiz/:quizId" element={<StudentQuiz />} />
            <Route path="results" element={<StudentResults />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
