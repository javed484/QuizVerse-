import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Course, Quiz, QuizAttempt } from '../../types';
import { BookOpen, FileText, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

const StudentDashboard = () => {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.courseIds || profile.courseIds.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch courses the student is enrolled in
      const coursesSnap = await getDocs(query(collection(db, 'courses'), where('__name__', 'in', profile.courseIds)));
      const coursesList = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      setCourses(coursesList);

      // Fetch quizzes for those courses
      const quizzesSnap = await getDocs(query(collection(db, 'quizzes'), where('courseId', 'in', profile.courseIds)));
      const quizzesList = quizzesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
      setQuizzes(quizzesList);

      // Fetch student's attempts
      const attemptsSnap = await getDocs(query(collection(db, 'attempts'), where('studentId', '==', profile.uid)));
      setAttempts(attemptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizAttempt)));

      setLoading(false);
    };

    if (profile) fetchData();
  }, [profile]);

  if (loading) return <div className="font-mono text-xs">SYNCING_DATA...</div>;

  return (
    <div className="space-y-12">
      <section>
        <div className="mb-8">
          <h2 className="text-3xl font-display font-bold tracking-tight text-primary">My Learning Path</h2>
          <p className="text-primary/40 mt-1 font-medium">Access your enrolled courses and active assessments.</p>
        </div>

        {courses.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-dashed border-primary/10 text-center shadow-xl shadow-primary/5">
            <BookOpen size={48} className="mx-auto text-primary/10 mb-4" />
            <p className="text-primary/40 font-bold uppercase tracking-widest text-xs">You are not enrolled in any courses yet.</p>
            <p className="text-[10px] text-primary/20 mt-2 font-semibold">Contact your administrator to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map(course => (
              <div key={course.id} className="bg-white p-8 rounded-3xl border border-primary/5 shadow-xl shadow-primary/5 hover:shadow-primary/10 transition-all group">
                <span className="text-[10px] font-bold uppercase tracking-widest text-accent mb-1 block">{course.shortCode}</span>
                <h3 className="text-xl font-bold mb-2 text-primary group-hover:text-accent transition-colors">{course.name}</h3>
                <p className="text-sm text-primary/50 mb-6 line-clamp-2 font-medium">{course.description}</p>
                <div className="flex items-center justify-between pt-6 border-t border-primary/5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary/30">
                    {quizzes.filter(q => q.courseId === course.id).length} Quizzes Available
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-8">
          <h2 className="text-2xl font-display font-bold tracking-tight text-primary">Active Quizzes</h2>
          <p className="text-primary/40 mt-1 font-medium">Complete these assessments to track your progress.</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {quizzes.map(quiz => {
            const course = courses.find(c => c.id === quiz.courseId);
            const attempt = attempts.find(a => a.quizId === quiz.id);
            return (
              <div key={quiz.id} className="bg-white p-8 rounded-3xl border border-primary/5 shadow-xl shadow-primary/5 flex items-center justify-between group hover:shadow-primary/10 transition-all">
                <div className="flex items-center gap-8">
                  <div className={cn(
                    "p-5 rounded-2xl border-2 transition-all",
                    attempt ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-primary/5 text-primary/40 border-transparent"
                  )}>
                    {attempt ? <CheckCircle2 size={28} /> : <FileText size={28} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary/30">{course?.shortCode || course?.name}</span>
                      {attempt && (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold border border-emerald-100">COMPLETED</span>
                      )}
                    </div>
                    <h4 className="font-bold text-xl text-primary">{quiz.title}</h4>
                    <div className="flex items-center gap-6 mt-3">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-primary/40 uppercase tracking-widest">
                        <Clock size={14} /> {quiz.durationMinutes}m
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-primary/40 uppercase tracking-widest">
                        <FileText size={14} /> {quiz.questionIds.length} Qs
                      </div>
                    </div>
                  </div>
                </div>
                
                {attempt ? (
                  <div className="text-right">
                    <p className="text-3xl font-bold tracking-tighter text-primary">{attempt.score}/{attempt.totalPoints}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary/30">Final Score</p>
                  </div>
                ) : (
                  <Link
                    to={`/student/quiz/${quiz.id}`}
                    className="px-8 py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-3"
                  >
                    START QUIZ <ChevronRight size={18} />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default StudentDashboard;
