import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Quiz, QuizAttempt, Course, Question } from '../../types';
import { format } from 'date-fns';
import { Trophy, Calendar, Target, BookOpen, X, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { doc, getDoc } from 'firebase/firestore';

const StudentResults = () => {
  const { profile } = useAuth();
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAttempt, setSelectedAttempt] = useState<QuizAttempt | null>(null);
  const [attemptQuestions, setAttemptQuestions] = useState<Question[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return;
      
      const attemptsSnap = await getDocs(query(collection(db, 'attempts'), where('studentId', '==', profile.uid)));
      const attemptsList = attemptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizAttempt));
      setAttempts(attemptsList);

      if (attemptsList.length > 0) {
        const quizIds = [...new Set(attemptsList.map(a => a.quizId))];
        const quizzesSnap = await getDocs(query(collection(db, 'quizzes'), where('__name__', 'in', quizIds)));
        const quizzesList = quizzesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
        setQuizzes(quizzesList);

        const courseIds = [...new Set(quizzesList.map(q => q.courseId))];
        const coursesSnap = await getDocs(query(collection(db, 'courses'), where('__name__', 'in', courseIds)));
        setCourses(coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
      }

      setLoading(false);
    };
    fetchData();
  }, [profile]);

  if (loading) return <div className="font-mono text-xs p-8">CALCULATING_PERFORMANCE...</div>;

  const handleViewDetails = async (attempt: QuizAttempt) => {
    setSelectedAttempt(attempt);
    setDetailsLoading(true);
    const quiz = quizzes.find(q => q.id === attempt.quizId);
    if (quiz) {
      const qPromises = quiz.questionIds.map(id => getDoc(doc(db, 'questions', id)));
      const qSnaps = await Promise.all(qPromises);
      const qList = qSnaps.map(s => ({ id: s.id, ...s.data() } as Question));
      qList.sort((a, b) => (a.questionNumber || 0) - (b.questionNumber || 0));
      setAttemptQuestions(qList);
    }
    setDetailsLoading(false);
  };

  const averageScore = attempts.length > 0 
    ? Math.round((attempts.reduce((acc, curr) => acc + (curr.score / curr.totalPoints), 0) / attempts.length) * 100)
    : 0;

  return (
    <div className="space-y-12">
      <header>
        <h2 className="text-3xl font-display font-bold tracking-tight text-primary">Performance Analytics</h2>
        <p className="text-primary/40 mt-1 font-medium">Review your assessment history and academic growth.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-primary/5 shadow-xl shadow-primary/5">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 border border-emerald-100">
            <Trophy size={24} />
          </div>
          <p className="text-4xl font-bold tracking-tighter mb-1 text-primary">{averageScore}%</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary/40">Average Proficiency</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-primary/5 shadow-xl shadow-primary/5">
          <div className="w-12 h-12 bg-primary/5 text-primary rounded-2xl flex items-center justify-center mb-6 border border-primary/10">
            <Target size={24} />
          </div>
          <p className="text-4xl font-bold tracking-tighter mb-1 text-primary">{attempts.length}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary/40">Quizzes Completed</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-primary/5 shadow-xl shadow-primary/5">
          <div className="w-12 h-12 bg-accent/5 text-accent rounded-2xl flex items-center justify-center mb-6 border border-accent/10">
            <BookOpen size={24} />
          </div>
          <p className="text-4xl font-bold tracking-tighter mb-1 text-primary">{courses.length}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary/40">Active Courses</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-primary/5 shadow-xl shadow-primary/5 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-background border-b border-primary/5">
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-primary/40">Assessment</th>
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-primary/40">Course</th>
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-primary/40">Date</th>
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-primary/40">Score</th>
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-primary/40">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary/5">
            {attempts.sort((a, b) => b.completedAt - a.completedAt).map((attempt) => {
              const quiz = quizzes.find(q => q.id === attempt.quizId);
              const course = courses.find(c => c.id === quiz?.courseId);
              const percentage = Math.round((attempt.score / attempt.totalPoints) * 100);
              
              return (
                <tr 
                  key={attempt.id} 
                  onClick={() => handleViewDetails(attempt)}
                  className="hover:bg-primary/[0.01] transition-colors group cursor-pointer"
                >
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-sm text-primary group-hover:text-accent transition-colors">{quiz?.title || 'Unknown Quiz'}</p>
                      <ChevronRight size={14} className="text-primary/10 group-hover:text-accent transition-all" />
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="px-3 py-1 bg-primary/5 text-primary rounded-lg text-[10px] font-bold uppercase tracking-widest border border-primary/10">
                      {course?.name || 'Unknown Course'}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-primary/40 uppercase tracking-widest">
                      <Calendar size={14} className="text-accent" />
                      {format(attempt.completedAt, 'MMM dd, yyyy')}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-primary">{attempt.score} / {attempt.totalPoints}</span>
                      <span className="text-[10px] text-primary/40 font-mono font-bold">{percentage}%</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all",
                      percentage >= 70 
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm shadow-emerald-100" 
                        : "bg-orange-50 text-orange-600 border-orange-100 shadow-sm shadow-orange-100"
                    )}>
                      {percentage >= 70 ? 'PASSED' : 'REVIEW'}
                    </span>
                  </td>
                </tr>
              );
            })}
            {attempts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-8 py-16 text-center">
                  <BookOpen size={48} className="mx-auto text-primary/5 mb-4" />
                  <p className="text-primary/30 font-bold uppercase tracking-widest text-xs">No assessment history found.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedAttempt && (
        <div className="fixed inset-0 bg-primary/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-display font-bold text-primary">
                  {quizzes.find(q => q.id === selectedAttempt.quizId)?.title}
                </h3>
                <p className="text-[10px] text-primary/40 mt-1 font-bold uppercase tracking-widest">
                  Attempt on {format(selectedAttempt.completedAt, 'MMMM dd, yyyy HH:mm')}
                </p>
              </div>
              <button onClick={() => setSelectedAttempt(null)} className="p-3 hover:bg-primary/5 rounded-full text-primary/40 transition-colors">
                <X size={24} />
              </button>
            </div>

            {detailsLoading ? (
              <div className="py-20 text-center font-mono text-xs text-primary/20">RETRIEVING_DATA...</div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10">
                    <p className="text-2xl font-bold text-primary">{selectedAttempt.score} / {selectedAttempt.totalPoints}</p>
                    <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Total Points</p>
                  </div>
                  <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                    <p className="text-2xl font-bold text-emerald-600">{Math.round((selectedAttempt.score / selectedAttempt.totalPoints) * 100)}%</p>
                    <p className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest">Percentage</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {attemptQuestions.map((q, idx) => {
                    const quiz = quizzes.find(qu => qu.id === selectedAttempt.quizId);
                    const options = quiz?.reviewOptions || { showMarks: true, showWhetherCorrect: true, showRightAnswer: true, showFeedback: true };
                    const qPoints = quiz?.questionPoints?.[q.id] ?? q.points;
                    const studentAnswer = selectedAttempt.answers[idx];
                    const isCorrect = studentAnswer === q.correctOptionIndex;

                    return (
                      <div key={q.id} className="p-8 bg-background rounded-3xl border border-primary/5 space-y-6">
                        <div className="flex justify-between items-start gap-4">
                          <h4 className="text-lg font-bold text-primary leading-tight">
                            {idx + 1}. {q.text}
                          </h4>
                          {options.showMarks && (
                            <span className={cn(
                              "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border",
                              isCorrect ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                            )}>
                              {isCorrect ? qPoints : 0} / {qPoints} PTS
                            </span>
                          )}
                        </div>

                        {q.imageUrl && (
                          <div className="rounded-2xl overflow-hidden border border-primary/5 bg-white p-2 w-fit">
                            <img src={q.imageUrl} alt="Question" className="max-h-48 object-contain" referrerPolicy="no-referrer" />
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {q.options.map((opt, optIdx) => {
                            const isStudentPick = studentAnswer === optIdx;
                            const isRight = optIdx === q.correctOptionIndex;
                            
                            let bgColor = "bg-white border-primary/5";
                            let textColor = "text-primary/60";
                            let icon = null;

                            if (options.showWhetherCorrect) {
                              if (isStudentPick) {
                                if (isRight) {
                                  bgColor = "bg-emerald-50 border-emerald-200";
                                  textColor = "text-emerald-700";
                                  icon = <CheckCircle2 size={16} className="text-emerald-500" />;
                                } else {
                                  bgColor = "bg-red-50 border-red-200";
                                  textColor = "text-red-700";
                                  icon = <XCircle size={16} className="text-red-500" />;
                                }
                              } else if (isRight && options.showRightAnswer) {
                                bgColor = "bg-emerald-50/50 border-emerald-100 border-dashed";
                                textColor = "text-emerald-600";
                              }
                            } else if (isStudentPick) {
                              bgColor = "bg-primary/5 border-primary/20";
                              textColor = "text-primary";
                            }

                            return (
                              <div key={optIdx} className={cn(
                                "flex items-center justify-between p-4 rounded-2xl border transition-all",
                                bgColor
                              )}>
                                <span className={cn("text-xs font-bold", textColor)}>{opt}</span>
                                {icon}
                              </div>
                            );
                          })}
                        </div>
                        
                        {options.showFeedback && !isCorrect && options.showRightAnswer && (
                          <div className="p-4 bg-emerald-50/30 rounded-2xl border border-emerald-100/50">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Correct Answer</p>
                            <p className="text-xs font-bold text-emerald-700">{q.options[q.correctOptionIndex]}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentResults;
