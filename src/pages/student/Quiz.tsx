import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Quiz, Question } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Clock, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

const StudentQuiz = () => {
  const { quizId } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!quiz || !profile || submitting) return;
    setSubmitting(true);

    let score = 0;
    let totalPoints = 0;

    questions.forEach((q, idx) => {
      const qPoints = quiz.questionPoints?.[q.id] ?? q.points;
      totalPoints += qPoints;
      if (answers[idx] === q.correctOptionIndex) {
        score += qPoints;
      }
    });

    try {
      await addDoc(collection(db, 'attempts'), {
        quizId: quiz.id,
        studentId: profile.uid,
        answers,
        score,
        totalPoints,
        startedAt: Date.now() - (quiz.durationMinutes * 60 - timeLeft) * 1000,
        completedAt: Date.now()
      });
      navigate('/student');
    } catch (err) {
      console.error(err);
      setSubmitting(false);
    }
  }, [quiz, profile, questions, answers, timeLeft, navigate, submitting]);

  useEffect(() => {
    const fetchQuiz = async () => {
      if (!quizId) return;
      const quizSnap = await getDoc(doc(db, 'quizzes', quizId));
      if (!quizSnap.exists()) return navigate('/student');
      
      const quizData = { id: quizSnap.id, ...quizSnap.data() } as Quiz;
      setQuiz(quizData);
      setTimeLeft(quizData.durationMinutes * 60);

      const qPromises = quizData.questionIds.map(id => getDoc(doc(db, 'questions', id)));
      const qSnaps = await Promise.all(qPromises);
      const qList = qSnaps.map(s => ({ id: s.id, ...s.data() } as Question));
      
      // Sort by questionNumber if available
      qList.sort((a, b) => (a.questionNumber || 0) - (b.questionNumber || 0));
      
      setQuestions(qList);
      setAnswers(new Array(qList.length).fill(-1));
      setLoading(false);
    };
    fetchQuiz();
  }, [quizId, navigate]);

  useEffect(() => {
    if (timeLeft <= 0 && !loading && quiz) {
      handleSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, loading, quiz, handleSubmit]);

  if (loading || !quiz) return <div className="font-mono text-xs p-8">INITIALIZING_ASSESSMENT...</div>;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentQ = questions[currentIdx];

  return (
    <div className="max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-12">
        <div>
          <h2 className="text-2xl font-display font-bold text-primary">{quiz.title}</h2>
          <p className="text-[10px] text-primary/40 uppercase tracking-widest mt-1 font-bold">Question {currentIdx + 1} of {questions.length}</p>
        </div>
        <div className={cn(
          "flex items-center gap-3 px-6 py-3 rounded-2xl font-mono text-lg font-bold border-2 transition-all shadow-lg",
          timeLeft < 60 ? "bg-red-50 border-red-200 text-red-600 animate-pulse shadow-red-100" : "bg-white border-primary/5 text-primary shadow-primary/5"
        )}>
          <Clock size={20} />
          {formatTime(timeLeft)}
        </div>
      </header>

      <div className="bg-[#f0f4f8] p-12 rounded-3xl border border-primary/5 shadow-xl shadow-primary/5 mb-8">
        <div className="mb-8">
          <h3 className="text-2xl font-bold leading-tight text-[#1a2b3c]">
            {currentQ.questionNumber} {currentQ.text}{currentQ.marathiText}
          </h3>
          <p className="text-xs text-[#1a2b3c]/60 mt-4">Select one:</p>
        </div>
        
        {currentQ.imageUrl && (
          <div className="mb-12 rounded-3xl overflow-hidden border border-primary/5 bg-white p-4">
            <img 
              src={currentQ.imageUrl} 
              alt="Question figure" 
              className="max-h-96 object-contain mx-auto"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        <div className="space-y-4">
          {currentQ.options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => {
                const newAnswers = [...answers];
                newAnswers[currentIdx] = idx;
                setAnswers(newAnswers);
              }}
              className="w-full flex items-start gap-4 text-left group"
            >
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 flex items-center justify-center transition-all",
                answers[currentIdx] === idx ? "border-primary bg-primary/10" : "border-primary/20 group-hover:border-primary/40"
              )}>
                {answers[currentIdx] === idx && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
              </div>
              <span className={cn(
                "font-bold text-lg transition-colors",
                answers[currentIdx] === idx ? "text-primary" : "text-[#1a2b3c]"
              )}>
                {opt}{currentQ.marathiOptions?.[idx]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          disabled={currentIdx === 0}
          onClick={() => setCurrentIdx(prev => prev - 1)}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-primary/40 hover:text-primary disabled:opacity-0 transition-all uppercase tracking-widest text-xs"
        >
          <ChevronLeft size={20} /> PREVIOUS
        </button>

        <div className="flex gap-2">
          {questions.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "h-2 rounded-full transition-all",
                idx === currentIdx ? "bg-accent w-8" : (answers[idx] !== -1 ? "bg-primary/40 w-2" : "bg-primary/10 w-2")
              )}
            />
          ))}
        </div>

        {currentIdx === questions.length - 1 ? (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-10 py-4 bg-accent text-white rounded-xl font-bold hover:bg-accent/90 transition-all shadow-xl shadow-accent/20 uppercase tracking-widest text-xs"
          >
            {submitting ? 'SUBMITTING...' : 'FINISH ASSESSMENT'}
          </button>
        ) : (
          <button
            onClick={() => setCurrentIdx(prev => prev + 1)}
            className="flex items-center gap-2 px-10 py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 uppercase tracking-widest text-xs"
          >
            NEXT QUESTION <ChevronRight size={20} />
          </button>
        )}
      </div>

      {timeLeft < 300 && timeLeft > 0 && (
        <div className="mt-12 p-6 bg-orange-50 border border-orange-100 rounded-2xl flex items-center gap-4 text-orange-700 shadow-lg shadow-orange-100/50">
          <AlertCircle size={24} />
          <p className="text-[10px] font-bold uppercase tracking-widest">Less than 5 minutes remaining. Please ensure all questions are answered.</p>
        </div>
      )}
    </div>
  );
};

export default StudentQuiz;
