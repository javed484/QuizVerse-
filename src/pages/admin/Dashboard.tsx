import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { BookOpen, Users, HelpCircle, FileText } from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    courses: 0,
    students: 0,
    questions: 0,
    quizzes: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      const coursesSnap = await getDocs(collection(db, 'courses'));
      const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
      const questionsSnap = await getDocs(collection(db, 'questions'));
      const quizzesSnap = await getDocs(collection(db, 'quizzes'));

      setStats({
        courses: coursesSnap.size,
        students: studentsSnap.size,
        questions: questionsSnap.size,
        quizzes: quizzesSnap.size
      });
    };
    fetchStats();
  }, []);

  const cards = [
    { name: 'Total Courses', value: stats.courses, icon: BookOpen, color: 'bg-blue-500' },
    { name: 'Active Students', value: stats.students, icon: Users, color: 'bg-emerald-500' },
    { name: 'Question Bank', value: stats.questions, icon: HelpCircle, color: 'bg-amber-500' },
    { name: 'Quizzes Created', value: stats.quizzes, icon: FileText, color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display font-bold tracking-tight text-primary">System Overview</h2>
        <p className="text-primary/40 mt-1 font-medium">Real-time statistics of your QuizVerse ecosystem.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <div key={card.name} className="bg-white p-6 rounded-3xl border border-primary/5 shadow-xl shadow-primary/5 hover:shadow-primary/10 transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className={`${card.color} p-4 rounded-2xl text-white shadow-lg shadow-current/20 group-hover:scale-110 transition-transform`}>
                <card.icon size={24} />
              </div>
              <span className="text-3xl font-bold tracking-tighter text-primary">{card.value}</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/40">{card.name}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-primary/5 shadow-xl shadow-primary/5">
          <h3 className="text-lg font-bold mb-6 text-primary">Recent Activity</h3>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-background border border-primary/5">
                <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center">
                  <FileText size={20} className="text-primary/40" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">New quiz published in "Advanced Mathematics"</p>
                  <p className="text-[10px] text-primary/40 uppercase tracking-wider mt-1 font-bold">2 hours ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-primary/5 shadow-xl shadow-primary/5">
          <h3 className="text-lg font-bold mb-6 text-primary">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <button className="p-6 rounded-2xl border-2 border-dashed border-primary/10 hover:border-accent hover:bg-accent/5 transition-all text-left group">
              <p className="text-sm font-bold text-primary group-hover:text-accent">Create Course</p>
              <p className="text-[10px] text-primary/40 uppercase tracking-wider mt-1 font-semibold">Add new curriculum</p>
            </button>
            <button className="p-6 rounded-2xl border-2 border-dashed border-primary/10 hover:border-accent hover:bg-accent/5 transition-all text-left group">
              <p className="text-sm font-bold text-primary group-hover:text-accent">Add Question</p>
              <p className="text-[10px] text-primary/40 uppercase tracking-wider mt-1 font-semibold">Expand bank</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
