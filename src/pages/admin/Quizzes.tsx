import React, { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Quiz, Course, Question, QuizAttempt, UserProfile } from '../../types';
import { Plus, Trash2, FileText, X, CheckCircle2, Filter, Settings2, ChevronDown, GripVertical, HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSearchParams } from 'react-router-dom';

const AdminQuizzes = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const courseIdFromUrl = searchParams.get('courseId') || '';
  
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [courseFilter, setCourseFilter] = useState(courseIdFromUrl);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(courseIdFromUrl);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [duration, setDuration] = useState(30);
  const [questionFilterCourse, setQuestionFilterCourse] = useState('');
  const [reviewOptions, setReviewOptions] = useState({
    showMarks: true,
    showWhetherCorrect: true,
    showRightAnswer: true,
    showFeedback: true
  });

  useEffect(() => {
    setCourseFilter(courseIdFromUrl);
    setSelectedCourse(courseIdFromUrl);
  }, [courseIdFromUrl]);

  const [isEditQuestionsModalOpen, setIsEditQuestionsModalOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [maxGrade, setMaxGrade] = useState(10);
  const [isQuestionBankOpen, setIsQuestionBankOpen] = useState(false);
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
  const [isRandomModalOpen, setIsRandomModalOpen] = useState(false);
  const [randomCount, setRandomCount] = useState(1);
  const [randomCourse, setRandomCourse] = useState('');
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [quizQuestionPoints, setQuizQuestionPoints] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'quiz' | 'settings' | 'questions' | 'results' | 'bank'>('questions');
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [quizSections, setQuizSections] = useState<Quiz['sections']>([]);
  const [addDropdownAnchorId, setAddDropdownAnchorId] = useState<string | 'top' | 'bottom' | null>(null);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [bankSelectedIds, setBankSelectedIds] = useState<string[]>([]);

  // Quick Add Form State
  const [qaText, setQaText] = useState('');
  const [qaMarathiText, setQaMarathiText] = useState('');
  const [qaOptions, setQaOptions] = useState(['', '', '', '']);
  const [qaMarathiOptions, setQaMarathiOptions] = useState(['', '', '', '']);
  const [qaCorrectIndex, setQaCorrectIndex] = useState(0);
  const [qaPoints, setQaPoints] = useState(1);
  const [qaQuestionNum, setQaQuestionNum] = useState<number | ''>('');

  const fetchData = async () => {
    const coursesSnap = await getDocs(collection(db, 'courses'));
    setCourses(coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));

    const quizzesSnap = await getDocs(collection(db, 'quizzes'));
    setQuizzes(quizzesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz)));

    const questionsSnap = await getDocs(collection(db, 'questions'));
    setQuestions(questionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));

    const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
    setStudents(usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return alert('Select a course');

    await addDoc(collection(db, 'quizzes'), {
      courseId: selectedCourse,
      title,
      description,
      questionIds: [],
      durationMinutes: duration,
      maxGrade: 10,
      reviewOptions,
      createdAt: Date.now()
    });

    setTitle('');
    setDescription('');
    setSelectedCourse('');
    setSelectedQuestionIds([]);
    setDuration(30);
    setIsModalOpen(false);
    fetchData();
  };

  const handleUpdateQuestions = async () => {
    if (!editingQuiz) return;
    await updateDoc(doc(db, 'quizzes', editingQuiz.id), {
      title,
      description,
      durationMinutes: duration,
      reviewOptions,
      questionIds: selectedQuestionIds,
      questionPoints: quizQuestionPoints,
      sections: quizSections,
      maxGrade: maxGrade
    });
    setIsEditQuestionsModalOpen(false);
    setEditingQuiz(null);
    fetchData();
  };

  const addQuestionsToQuiz = (newIds: string[]) => {
    if (!editingQuiz) return;
    
    // Filter out already added questions to avoid duplicates
    const uniqueNewIds = newIds.filter(id => !selectedQuestionIds.includes(id));
    if (uniqueNewIds.length === 0) return;

    setSelectedQuestionIds(prev => {
      let next = [...prev];
      
      if (!addDropdownAnchorId || addDropdownAnchorId === 'bottom') {
        next = [...next, ...uniqueNewIds];
      } else if (addDropdownAnchorId === 'top') {
        next = [...uniqueNewIds, ...next];
      } else {
        // Check if it's a question ID
        const qIndex = next.indexOf(addDropdownAnchorId);
        if (qIndex !== -1) {
          next.splice(qIndex + 1, 0, ...uniqueNewIds);
        } else {
          // Check if it's a section ID
          const section = quizSections?.find(s => s.id === addDropdownAnchorId);
          if (section) {
            if (section.startQuestionId === null) {
              next = [...next, ...uniqueNewIds];
            } else {
              const sIndex = next.indexOf(section.startQuestionId);
              if (sIndex !== -1) {
                next.splice(sIndex, 0, ...uniqueNewIds);
              } else {
                next = [...next, ...uniqueNewIds];
              }
            }
          } else {
            next = [...next, ...uniqueNewIds];
          }
        }
      }
      return next;
    });

    // Update section startQuestionId if it was anchored to a section
    if (addDropdownAnchorId && addDropdownAnchorId !== 'top' && addDropdownAnchorId !== 'bottom') {
      const section = quizSections?.find(s => s.id === addDropdownAnchorId);
      if (section && section.startQuestionId !== null) {
        setQuizSections(prev => prev?.map(s => s.id === section.id ? { ...s, startQuestionId: uniqueNewIds[0] } : s));
      }
    }

    setAddDropdownAnchorId(null);
  };

  const handleAddRandomQuestions = () => {
    if (!editingQuiz) return;
    
    const pool = questions.filter(q => {
      const courseMatch = randomCourse === 'all' || (randomCourse ? q.courseId === randomCourse : q.courseId === editingQuiz.courseId);
      const notInQuiz = !selectedQuestionIds.includes(q.id);
      return courseMatch && notInQuiz;
    });

    if (pool.length === 0) return alert('No available questions found in this course.');

    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(randomCount, pool.length));
    
    addQuestionsToQuiz(selected.map(q => q.id));
    setIsRandomModalOpen(false);
    setRandomCount(1);
  };

  const handleQuickAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuiz) return;

    const questionData = {
      courseId: editingQuiz.courseId,
      text: qaText,
      marathiText: qaMarathiText || null,
      options: qaOptions,
      marathiOptions: qaMarathiOptions.some(o => o.trim()) ? qaMarathiOptions : null,
      correctOptionIndex: qaCorrectIndex,
      points: qaPoints,
      questionNumber: qaQuestionNum !== '' ? Number(qaQuestionNum) : null,
      createdAt: Date.now()
    };

    const docRef = await addDoc(collection(db, 'questions'), questionData);
    addQuestionsToQuiz([docRef.id]);
    
    // Reset form
    setQaText('');
    setQaMarathiText('');
    setQaOptions(['', '', '', '']);
    setQaMarathiOptions(['', '', '', '']);
    setQaCorrectIndex(0);
    setQaPoints(1);
    setQaQuestionNum('');
    setIsQuickAddModalOpen(false);
    fetchData();
  };

  const toggleQuestion = (id: string) => {
    setSelectedQuestionIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const fetchQuizAttempts = async (quizId: string) => {
    setAttemptsLoading(true);
    const attemptsSnap = await getDocs(query(collection(db, 'attempts'), where('quizId', '==', quizId)));
    setQuizAttempts(attemptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizAttempt)));
    setAttemptsLoading(false);
  };

  const handleOpenQuestionBank = () => {
    setBankSelectedIds([]);
    setIsQuestionBankOpen(true);
    setIsAddDropdownOpen(false);
  };

  const handleOpenSectionModal = () => {
    setNewSectionTitle('');
    setIsSectionModalOpen(true);
    setIsAddDropdownOpen(false);
  };

  const confirmAddSection = () => {
    if (!newSectionTitle) return;
    
    let startQuestionId: string | null = null;
    if (addDropdownAnchorId === 'top') {
      startQuestionId = selectedQuestionIds[0] || null;
    } else if (addDropdownAnchorId === 'bottom') {
      startQuestionId = null;
    } else {
      const currentIndex = selectedQuestionIds.indexOf(addDropdownAnchorId as string);
      startQuestionId = selectedQuestionIds[currentIndex + 1] || null;
    }
    
    const newSection = {
      id: Math.random().toString(36).substr(2, 9),
      title: newSectionTitle,
      startQuestionId,
      shuffle: false
    };
    
    setQuizSections(prev => [...(prev || []), newSection]);
    setIsSectionModalOpen(false);
    setAddDropdownAnchorId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this quiz?')) {
      await deleteDoc(doc(db, 'quizzes', id));
      fetchData();
    }
  };

  const filteredQuizzes = quizzes.filter(q => 
    courseFilter ? q.courseId === courseFilter : true
  );

  const filteredQuestions = questions
    .filter(q => {
      if (questionFilterCourse === 'all') return true;
      if (questionFilterCourse) return q.courseId === questionFilterCourse;
      return q.courseId === selectedCourse;
    })
    .sort((a, b) => (a.questionNumber || 0) - (b.questionNumber || 0));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold tracking-tight text-primary">Quiz Management</h2>
          <p className="text-primary/40 mt-1 font-medium">Design and publish assessments for your students.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/20" size={16} />
            <select
              className="pl-10 pr-4 py-3 bg-white border border-primary/10 rounded-xl outline-none focus:ring-2 focus:ring-primary/5 min-w-[200px] font-semibold text-primary/60 transition-all"
              value={courseFilter}
              onChange={(e) => {
                setCourseFilter(e.target.value);
                setSearchParams(e.target.value ? { courseId: e.target.value } : {});
              }}
            >
              <option value="">All Courses</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button
            onClick={() => {
              setSelectedCourse(courseFilter);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-xl font-bold hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/20 transition-all"
          >
            <Plus size={18} />
            <span>CREATE QUIZ</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredQuizzes.length > 0 ? (
          filteredQuizzes.map((quiz) => {
            const course = courses.find(c => c.id === quiz.courseId);
            return (
              <div key={quiz.id} className="bg-white p-8 rounded-3xl border border-primary/5 shadow-xl shadow-primary/5 group hover:shadow-primary/10 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="px-2 py-1 bg-primary/5 text-primary rounded text-[10px] font-bold uppercase tracking-wider mb-2 inline-block border border-primary/10">
                      {course?.name || 'Unknown Course'}
                    </span>
                    <h3 className="text-xl font-bold tracking-tight text-primary">{quiz.title}</h3>
                  </div>
                  <button onClick={() => handleDelete(quiz.id)} className="p-2 hover:bg-red-50 rounded-lg text-primary/40 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={18} />
                  </button>
                </div>
                <p className="text-sm text-primary/60 mb-6 font-medium">{quiz.description}</p>
                <div className="flex items-center gap-6 pt-6 border-t border-primary/5">
                  <div className="flex items-center gap-2 text-primary/40">
                    <FileText size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{quiz.questionIds.length} Questions</span>
                  </div>
                  <div className="flex items-center gap-2 text-primary/40">
                    <CheckCircle2 size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{quiz.durationMinutes} Minutes</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingQuiz(quiz);
                    setSelectedCourse(quiz.courseId);
                    setSelectedQuestionIds(quiz.questionIds);
                    setQuizQuestionPoints(quiz.questionPoints || {});
                    setQuizSections(quiz.sections || []);
                    setMaxGrade(quiz.maxGrade || 10);
                    setTitle(quiz.title);
                    setDescription(quiz.description);
                    setDuration(quiz.durationMinutes);
                    setReviewOptions(quiz.reviewOptions || {
                      showMarks: true,
                      showWhetherCorrect: true,
                      showRightAnswer: true,
                      showFeedback: true
                    });
                    setActiveTab('questions');
                    setIsEditQuestionsModalOpen(true);
                  }}
                  className="w-full mt-6 py-3 bg-primary/5 text-primary rounded-xl font-bold text-xs hover:bg-primary/10 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={14} />
                  MANAGE QUESTIONS
                </button>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-primary/5 border-dashed">
            <p className="text-primary/40 font-medium">No quizzes found for this selection.</p>
            <button 
              onClick={() => {
                setSelectedCourse(courseFilter);
                setIsModalOpen(true);
              }}
              className="mt-4 text-accent font-bold hover:underline text-sm"
            >
              Create the first quiz
            </button>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-primary/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-display font-bold text-primary">New Quiz</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-primary/5 rounded-full text-primary/40">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Quiz Title</label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Description</label>
                    <textarea
                      required
                      rows={3}
                      className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none resize-none transition-all"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Select Course</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
                      value={selectedCourse}
                      onChange={(e) => {
                        setSelectedCourse(e.target.value);
                      }}
                    >
                      <option value="">Choose a course...</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Duration (Minutes)</label>
                    <input
                      type="number"
                      required
                      className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-primary/5">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40">Review Options (Post-Attempt)</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <label className="flex items-center gap-3 p-3 bg-background rounded-xl cursor-pointer hover:bg-primary/5 transition-colors">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-primary/20 text-primary focus:ring-primary"
                      checked={reviewOptions.showMarks}
                      onChange={(e) => setReviewOptions(prev => ({ ...prev, showMarks: e.target.checked }))}
                    />
                    <span className="text-xs font-bold text-primary/60">Show Marks</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-background rounded-xl cursor-pointer hover:bg-primary/5 transition-colors">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-primary/20 text-primary focus:ring-primary"
                      checked={reviewOptions.showWhetherCorrect}
                      onChange={(e) => setReviewOptions(prev => ({ ...prev, showWhetherCorrect: e.target.checked }))}
                    />
                    <span className="text-xs font-bold text-primary/60">Whether Correct</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-background rounded-xl cursor-pointer hover:bg-primary/5 transition-colors">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-primary/20 text-primary focus:ring-primary"
                      checked={reviewOptions.showRightAnswer}
                      onChange={(e) => setReviewOptions(prev => ({ ...prev, showRightAnswer: e.target.checked }))}
                    />
                    <span className="text-xs font-bold text-primary/60">Right Answer</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-background rounded-xl cursor-pointer hover:bg-primary/5 transition-colors">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-primary/20 text-primary focus:ring-primary"
                      checked={reviewOptions.showFeedback}
                      onChange={(e) => setReviewOptions(prev => ({ ...prev, showFeedback: e.target.checked }))}
                    />
                    <span className="text-xs font-bold text-primary/60">Feedback</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all"
              >
                CREATE QUIZ
              </button>
            </form>
          </div>
        </div>
      )}

      {isEditQuestionsModalOpen && editingQuiz && (
        <div className="fixed inset-0 bg-primary/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            {/* Moodle-style Header Tabs */}
            <div className="bg-background border-b border-primary/5 px-8 pt-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-display font-bold text-primary">{editingQuiz.title}</h3>
                <button onClick={() => setIsEditQuestionsModalOpen(false)} className="p-2 hover:bg-primary/5 rounded-full text-primary/40">
                  <X size={20} />
                </button>
              </div>
              <div className="flex gap-8">
                {[
                  { id: 'quiz', label: 'Quiz' },
                  { id: 'settings', label: 'Settings' },
                  { id: 'questions', label: 'Questions' },
                  { id: 'results', label: 'Results' },
                  { id: 'bank', label: 'Question bank' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      if (tab.id === 'results' && editingQuiz) {
                        fetchQuizAttempts(editingQuiz.id);
                      }
                    }}
                    className={cn(
                      "px-4 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-all",
                      activeTab === tab.id ? "text-primary border-accent" : "text-primary/40 border-transparent hover:text-primary/60"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-8 overflow-y-auto flex-1">
              {activeTab === 'quiz' && (
                <div className="max-w-3xl mx-auto space-y-8">
                  <div className="bg-primary/5 p-8 rounded-3xl border border-primary/10">
                    <h4 className="text-xl font-bold text-primary mb-4">{editingQuiz.title}</h4>
                    <p className="text-sm text-primary/60 leading-relaxed mb-6">{editingQuiz.description}</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      <div className="bg-white p-4 rounded-2xl border border-primary/5">
                        <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-1">Time limit</p>
                        <p className="text-sm font-bold text-primary">{editingQuiz.durationMinutes} minutes</p>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-primary/5">
                        <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-1">Grading method</p>
                        <p className="text-sm font-bold text-primary">Highest grade</p>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-primary/5">
                        <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-1">Questions</p>
                        <p className="text-sm font-bold text-primary">{editingQuiz.questionIds.length}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <button className="px-8 py-4 bg-accent text-white rounded-2xl font-bold hover:bg-accent/90 transition-all shadow-xl shadow-accent/20">
                      PREVIEW QUIZ NOW
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="max-w-3xl mx-auto">
                  <form onSubmit={(e) => { e.preventDefault(); handleUpdateQuestions(); }} className="space-y-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Quiz Title</label>
                        <input
                          type="text"
                          required
                          className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Description</label>
                        <textarea
                          required
                          rows={3}
                          className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none resize-none transition-all"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Duration (Minutes)</label>
                          <input
                            type="number"
                            required
                            className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
                            value={duration}
                            onChange={(e) => setDuration(parseInt(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Maximum Grade</label>
                          <input
                            type="number"
                            className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
                            value={maxGrade}
                            onChange={(e) => setMaxGrade(parseFloat(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-6 border-t border-primary/5">
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40">Review Options</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { id: 'showMarks', label: 'Show Marks' },
                          { id: 'showWhetherCorrect', label: 'Whether Correct' },
                          { id: 'showRightAnswer', label: 'Right Answer' },
                          { id: 'showFeedback', label: 'Feedback' }
                        ].map(opt => (
                          <label key={opt.id} className="flex items-center gap-3 p-3 bg-background rounded-xl cursor-pointer hover:bg-primary/5 transition-colors">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-primary/20 text-primary focus:ring-primary"
                              checked={(reviewOptions as any)[opt.id]}
                              onChange={(e) => setReviewOptions(prev => ({ ...prev, [opt.id]: e.target.checked }))}
                            />
                            <span className="text-xs font-bold text-primary/60">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-4 pt-6">
                      <button
                        type="button"
                        onClick={() => setActiveTab('quiz')}
                        className="px-6 py-3 bg-primary/5 text-primary rounded-xl font-bold hover:bg-primary/10 transition-all"
                      >
                        CANCEL
                      </button>
                      <button
                        type="submit"
                        className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                      >
                        SAVE CHANGES
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === 'questions' && (
                <div className="space-y-8">
                  {/* Grade Management Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-6 bg-primary/[0.02] p-6 rounded-2xl border border-primary/5">
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-primary">Questions: {selectedQuestionIds.length}</p>
                      <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">This quiz is open</p>
                    </div>
                    
                    <div className="flex items-center gap-8">
                      <div className="flex items-center gap-3">
                        <label className="text-xs font-bold text-primary/60 uppercase tracking-widest">Maximum grade</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            className="w-20 px-3 py-2 bg-white border border-primary/10 rounded-lg text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/5"
                            value={maxGrade}
                            onChange={(e) => setMaxGrade(parseFloat(e.target.value))}
                          />
                          <button 
                            onClick={handleUpdateQuestions}
                            className="px-4 py-2 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary/20 transition-all"
                          >
                            SAVE
                          </button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-primary/40 uppercase tracking-widest">Total of marks</p>
                        <p className="text-lg font-bold text-primary">
                          {selectedQuestionIds.reduce((acc, id) => {
                            const q = questions.find(question => question.id === id);
                            const points = quizQuestionPoints[id] ?? q?.points ?? 0;
                            return acc + points;
                          }, 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3">
                    <button className="px-4 py-2 bg-primary/5 text-primary rounded-lg text-xs font-bold hover:bg-primary/10 transition-all uppercase tracking-widest">Repaginate</button>
                    <button className="px-4 py-2 bg-primary/5 text-primary rounded-lg text-xs font-bold hover:bg-primary/10 transition-all uppercase tracking-widest">Select multiple items</button>
                  </div>

                  {/* Questions List */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-4">
                      <div className="flex items-center gap-4">
                        <Settings2 size={16} className="text-primary/20" />
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input type="checkbox" className="w-4 h-4 rounded border-primary/20 text-primary focus:ring-primary" />
                          <span className="text-xs font-bold text-primary/60 group-hover:text-primary transition-colors">Shuffle</span>
                        </label>
                      </div>
                      
                      <div className="relative">
                        <button 
                          onClick={() => {
                            setIsAddDropdownOpen(!isAddDropdownOpen);
                            setAddDropdownAnchorId('top');
                          }}
                          className="flex items-center gap-2 text-xs font-bold text-accent hover:underline uppercase tracking-widest"
                        >
                          Add <ChevronDown size={14} />
                        </button>
                        
                        {isAddDropdownOpen && addDropdownAnchorId === 'top' && (
                          <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-primary/5 py-2 z-10">
                            <button 
                              onClick={() => {
                                setIsQuickAddModalOpen(true);
                                setIsAddDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-2 text-xs font-bold text-primary/60 hover:bg-primary/5 hover:text-primary flex items-center gap-2"
                            >
                              <Plus size={14} /> a new question
                            </button>
                            <button 
                              onClick={() => {
                                setIsQuestionBankOpen(true);
                                setIsAddDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-2 text-xs font-bold text-primary/60 hover:bg-primary/5 hover:text-primary flex items-center gap-2"
                            >
                              <Plus size={14} /> from question bank
                            </button>
                            <button 
                              onClick={() => {
                                setIsRandomModalOpen(true);
                                setIsAddDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-2 text-xs font-bold text-primary/60 hover:bg-primary/5 hover:text-primary flex items-center gap-2"
                            >
                              <Plus size={14} /> a random question
                            </button>
                            <button 
                              onClick={handleOpenSectionModal}
                              className="w-full text-left px-4 py-2 text-xs font-bold text-primary/60 hover:bg-primary/5 hover:text-primary flex items-center gap-2 border-t border-primary/5 mt-1 pt-3"
                            >
                              <Plus size={14} /> a new section heading
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {selectedQuestionIds.length > 0 ? (
                        selectedQuestionIds.map((id, index) => {
                          const q = questions.find(question => question.id === id);
                          if (!q) return null;
                          const section = quizSections?.find(s => s.startQuestionId === id);
                          return (
                            <React.Fragment key={id}>
                              {section && (
                                <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex items-center justify-between mb-2 mt-4">
                                  <div className="flex items-center gap-4">
                                    <FileText size={16} className="text-primary/40" />
                                    <span className="text-sm font-bold text-primary">{section.title}</span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <div className="relative">
                                      <button 
                                        onClick={() => {
                                          setIsAddDropdownOpen(!isAddDropdownOpen || addDropdownAnchorId !== section.id);
                                          setAddDropdownAnchorId(section.id);
                                        }}
                                        className="text-[10px] font-bold text-accent hover:underline uppercase tracking-widest"
                                      >
                                        Add
                                      </button>
                                      {isAddDropdownOpen && addDropdownAnchorId === section.id && (
                                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-primary/5 py-2 z-20">
                                          <button 
                                            onClick={() => {
                                              setIsQuickAddModalOpen(true);
                                              setIsAddDropdownOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-2 text-xs font-bold text-primary/60 hover:bg-primary/5 hover:text-primary flex items-center gap-2"
                                          >
                                            <Plus size={14} /> a new question
                                          </button>
                                          <button 
                                            onClick={handleOpenQuestionBank}
                                            className="w-full text-left px-4 py-2 text-xs font-bold text-primary/60 hover:bg-primary/5 hover:text-primary flex items-center gap-2"
                                          >
                                            <Plus size={14} /> from question bank
                                          </button>
                                          <button 
                                            onClick={() => {
                                              setIsRandomModalOpen(true);
                                              setIsAddDropdownOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-2 text-xs font-bold text-primary/60 hover:bg-primary/5 hover:text-primary flex items-center gap-2"
                                          >
                                            <Plus size={14} /> a random question
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={section.shuffle}
                                        onChange={(e) => {
                                          setQuizSections(prev => prev?.map(s => s.id === section.id ? { ...s, shuffle: e.target.checked } : s));
                                        }}
                                        className="w-4 h-4 rounded border-primary/20 text-primary focus:ring-primary" 
                                      />
                                      <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Shuffle</span>
                                    </label>
                                    <button 
                                      onClick={() => setQuizSections(prev => prev?.filter(s => s.id !== section.id))}
                                      className="p-1 text-primary/20 hover:text-red-500"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center gap-4 group">
                                <div className="flex-1 bg-white p-4 rounded-xl border border-primary/5 flex items-center gap-4 hover:border-primary/20 transition-all">
                                  <GripVertical size={16} className="text-primary/10 cursor-grab" />
                                  <span className="text-xs font-bold text-primary/40">{index + 1}</span>
                                  <div className="flex-1">
                                    <p className="text-sm font-bold text-primary">{q.text}</p>
                                    <p className="text-[10px] text-primary/40 uppercase tracking-widest font-bold mt-1">
                                      {courses.find(c => c.id === q.courseId)?.shortCode}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <input 
                                      type="number" 
                                      step="0.01"
                                      className="w-16 px-2 py-1 bg-white border border-primary/10 rounded text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/5 text-right"
                                      value={quizQuestionPoints[id] ?? q.points}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        setQuizQuestionPoints(prev => ({ ...prev, [id]: isNaN(val) ? 0 : val }));
                                      }}
                                    />
                                    <button 
                                      onClick={() => {
                                        setSelectedQuestionIds(prev => prev.filter(i => i !== id));
                                        setQuizQuestionPoints(prev => {
                                          const next = { ...prev };
                                          delete next[id];
                                          return next;
                                        });
                                      }}
                                      className="p-2 text-primary/20 hover:text-red-500 transition-colors"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                              <div className="flex justify-end pr-4 -my-2 relative z-10">
                                <div className="relative">
                                  <button 
                                    onClick={() => {
                                      setIsAddDropdownOpen(!isAddDropdownOpen || addDropdownAnchorId !== id);
                                      setAddDropdownAnchorId(id);
                                    }}
                                    className="text-[10px] font-bold text-accent hover:underline uppercase tracking-widest bg-white px-2"
                                  >
                                    Add
                                  </button>
                                  {isAddDropdownOpen && addDropdownAnchorId === id && (
                                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-primary/5 py-2 z-20">
                                      <button 
                                        onClick={() => {
                                          setIsQuickAddModalOpen(true);
                                          setIsAddDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-xs font-bold text-primary/60 hover:bg-primary/5 hover:text-primary flex items-center gap-2"
                                      >
                                        <Plus size={14} /> a new question
                                      </button>
                                      <button 
                                        onClick={handleOpenQuestionBank}
                                        className="w-full text-left px-4 py-2 text-xs font-bold text-primary/60 hover:bg-primary/5 hover:text-primary flex items-center gap-2"
                                      >
                                        <Plus size={14} /> from question bank
                                      </button>
                                      <button 
                                        onClick={() => {
                                          setIsRandomModalOpen(true);
                                          setIsAddDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-xs font-bold text-primary/60 hover:bg-primary/5 hover:text-primary flex items-center gap-2"
                                      >
                                        <Plus size={14} /> a random question
                                      </button>
                                      <button 
                                        onClick={handleOpenSectionModal}
                                        className="w-full text-left px-4 py-2 text-xs font-bold text-primary/60 hover:bg-primary/5 hover:text-primary flex items-center gap-2 border-t border-primary/5 mt-1 pt-3"
                                      >
                                        <Plus size={14} /> a new section heading
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <div className="py-12 text-center border-2 border-dashed border-primary/5 rounded-2xl">
                          <p className="text-xs font-bold text-primary/20 uppercase tracking-widest">No questions added yet</p>
                        </div>
                      )}
                    </div>

                    {quizSections?.filter(s => s.startQuestionId === null).map(section => (
                      <div key={section.id} className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex items-center justify-between mb-2 mt-4">
                        <div className="flex items-center gap-4">
                          <FileText size={16} className="text-primary/40" />
                          <span className="text-sm font-bold text-primary">{section.title}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <button 
                              onClick={() => {
                                setIsAddDropdownOpen(!isAddDropdownOpen || addDropdownAnchorId !== section.id);
                                setAddDropdownAnchorId(section.id);
                              }}
                              className="text-[10px] font-bold text-accent hover:underline uppercase tracking-widest"
                            >
                              Add
                            </button>
                            {isAddDropdownOpen && addDropdownAnchorId === section.id && (
                              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-primary/5 py-2 z-20">
                                <button 
                                  onClick={() => {
                                    setIsQuickAddModalOpen(true);
                                    setIsAddDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-4 py-2 text-xs font-bold text-primary/60 hover:bg-primary/5 hover:text-primary flex items-center gap-2"
                                >
                                  <Plus size={14} /> a new question
                                </button>
                                <button 
                                  onClick={handleOpenQuestionBank}
                                  className="w-full text-left px-4 py-2 text-xs font-bold text-primary/60 hover:bg-primary/5 hover:text-primary flex items-center gap-2"
                                >
                                  <Plus size={14} /> from question bank
                                </button>
                                <button 
                                  onClick={() => {
                                    setIsRandomModalOpen(true);
                                    setIsAddDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-4 py-2 text-xs font-bold text-primary/60 hover:bg-primary/5 hover:text-primary flex items-center gap-2"
                                >
                                  <Plus size={14} /> a random question
                                </button>
                              </div>
                            )}
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={section.shuffle}
                              onChange={(e) => {
                                setQuizSections(prev => prev?.map(s => s.id === section.id ? { ...s, shuffle: e.target.checked } : s));
                              }}
                              className="w-4 h-4 rounded border-primary/20 text-primary focus:ring-primary" 
                            />
                            <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Shuffle</span>
                          </label>
                          <button 
                            onClick={() => setQuizSections(prev => prev?.filter(s => s.id !== section.id))}
                            className="p-1 text-primary/20 hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}

                    <div className="flex justify-end pt-4">
                      <div className="relative">
                        <button 
                          onClick={() => {
                            setIsAddDropdownOpen(!isAddDropdownOpen || addDropdownAnchorId !== 'bottom');
                            setAddDropdownAnchorId('bottom');
                          }}
                          className="flex items-center gap-2 text-xs font-bold text-accent hover:underline uppercase tracking-widest"
                        >
                          Add <ChevronDown size={14} />
                        </button>
                        
                        {isAddDropdownOpen && addDropdownAnchorId === 'bottom' && (
                          <div className="absolute right-0 bottom-full mb-2 w-56 bg-white rounded-xl shadow-2xl border border-primary/5 py-2 z-10">
                            <button 
                              onClick={() => {
                                setIsQuickAddModalOpen(true);
                                setIsAddDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-2 text-xs font-bold text-primary/60 hover:bg-primary/5 hover:text-primary flex items-center gap-2"
                            >
                              <Plus size={14} /> a new question
                            </button>
                            <button 
                              onClick={() => {
                                setIsQuestionBankOpen(true);
                                setIsAddDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-2 text-xs font-bold text-primary/60 hover:bg-primary/5 hover:text-primary flex items-center gap-2"
                            >
                              <Plus size={14} /> from question bank
                            </button>
                            <button 
                              onClick={() => {
                                setIsRandomModalOpen(true);
                                setIsAddDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-2 text-xs font-bold text-primary/60 hover:bg-primary/5 hover:text-primary flex items-center gap-2"
                            >
                              <Plus size={14} /> a random question
                            </button>
                            <button 
                              onClick={handleOpenSectionModal}
                              className="w-full text-left px-4 py-2 text-xs font-bold text-primary/60 hover:bg-primary/5 hover:text-primary flex items-center gap-2 border-t border-primary/5 mt-1 pt-3"
                            >
                              <Plus size={14} /> a new section heading
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'results' && (
                <div className="space-y-6">
                  {attemptsLoading ? (
                    <div className="py-20 text-center font-mono text-xs text-primary/20">LOADING_ATTEMPTS...</div>
                  ) : quizAttempts.length > 0 ? (
                    <div className="bg-white rounded-2xl border border-primary/5 overflow-hidden">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-primary/5 border-b border-primary/10">
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-primary/40">Student</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-primary/40">Started</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-primary/40">Completed</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-primary/40 text-right">Grade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-primary/5">
                          {quizAttempts.map(attempt => {
                            const student = students.find(s => s.uid === attempt.studentId);
                            return (
                              <tr key={attempt.id} className="hover:bg-primary/[0.01] transition-colors">
                                <td className="px-6 py-4">
                                  <p className="text-sm font-bold text-primary">{student?.displayName || 'Unknown Student'}</p>
                                  <p className="text-[10px] text-primary/40 font-medium">{student?.email}</p>
                                </td>
                                <td className="px-6 py-4 text-xs text-primary/60 font-medium">
                                  {new Date(attempt.startedAt).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-xs text-primary/60 font-medium">
                                  {new Date(attempt.completedAt).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <span className="text-sm font-bold text-primary">{attempt.score.toFixed(2)}</span>
                                  <span className="text-[10px] text-primary/40 font-bold ml-1">/ {attempt.totalPoints}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-20 text-center border-2 border-dashed border-primary/5 rounded-3xl">
                      <p className="text-xs font-bold text-primary/20 uppercase tracking-widest">No attempts recorded for this quiz</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'bank' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-primary/40">Question Bank Management</h4>
                    <button 
                      onClick={() => setIsQuestionBankOpen(true)}
                      className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all"
                    >
                      OPEN FULL BANK
                    </button>
                  </div>
                  <div className="bg-background rounded-3xl p-8 border border-primary/5 text-center">
                    <HelpCircle size={48} className="mx-auto text-primary/10 mb-4" />
                    <p className="text-sm text-primary/60 max-w-md mx-auto">
                      Use the Question Bank to organize your assessment items. You can import questions from CSV/Excel or sync from Google Sheets.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Section Heading Modal */}
      {isSectionModalOpen && (
        <div className="fixed inset-0 bg-primary/80 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-display font-bold text-primary">New section heading</h3>
              <button onClick={() => setIsSectionModalOpen(false)} className="p-2 hover:bg-primary/5 rounded-full transition-colors">
                <X size={20} className="text-primary/40" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-2 block">Heading title</label>
                <input 
                  type="text"
                  autoFocus
                  className="w-full px-4 py-3 bg-primary/5 border-none rounded-2xl text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Enter section title..."
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirmAddSection()}
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setIsSectionModalOpen(false)}
                  className="flex-1 py-3 bg-primary/5 text-primary rounded-xl text-xs font-bold hover:bg-primary/10 transition-all"
                >
                  CANCEL
                </button>
                <button 
                  onClick={confirmAddSection}
                  className="flex-1 py-3 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  ADD SECTION
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Question Bank Modal (Moodle style selection) */}
      {isQuestionBankOpen && (
        <div className="fixed inset-0 bg-primary/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] p-8 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-display font-bold text-primary">Add from question bank</h3>
                <p className="text-xs text-primary/40 font-medium mt-1">Select questions to add to the quiz</p>
              </div>
              <button onClick={() => setIsQuestionBankOpen(false)} className="p-2 hover:bg-primary/5 rounded-full text-primary/40">
                <X size={24} />
              </button>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/20" size={16} />
                <select
                  className="w-full pl-10 pr-4 py-3 bg-background border-none rounded-xl outline-none focus:ring-2 focus:ring-primary/5 font-semibold text-primary/60 transition-all"
                  value={questionFilterCourse}
                  onChange={(e) => setQuestionFilterCourse(e.target.value)}
                >
                  <option value="">Current Course</option>
                  <option value="all">All Courses</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {filteredQuestions.map(q => {
                const isAlreadyInQuiz = selectedQuestionIds.includes(q.id);
                const isSelected = bankSelectedIds.includes(q.id);
                return (
                  <div
                    key={q.id}
                    onClick={() => {
                      if (isAlreadyInQuiz) return;
                      setBankSelectedIds(prev => 
                        prev.includes(q.id) ? prev.filter(id => id !== q.id) : [...prev, q.id]
                      );
                    }}
                    className={cn(
                      "p-4 rounded-2xl cursor-pointer transition-all border-2 flex items-center justify-between",
                      isAlreadyInQuiz ? "bg-primary/5 border-primary/10 opacity-50 cursor-not-allowed" :
                      isSelected ? "bg-primary/5 border-primary" : "bg-background border-transparent hover:bg-primary/5"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                        isAlreadyInQuiz || isSelected ? "bg-primary border-primary" : "border-primary/20"
                      )}>
                        {(isAlreadyInQuiz || isSelected) && <CheckCircle2 size={14} className="text-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-primary">
                          {q.questionNumber && <span className="text-primary/40 mr-2">Q{q.questionNumber}.</span>}
                          {q.text}
                          {isAlreadyInQuiz && <span className="ml-2 text-[10px] font-bold text-primary/40 uppercase tracking-widest">(In Quiz)</span>}
                        </p>
                        <p className="text-[10px] text-primary/40 uppercase tracking-widest font-bold mt-1">
                          {courses.find(c => c.id === q.courseId)?.shortCode} • {q.points} Points
                        </p>
                      </div>
                    </div>
                    {!isAlreadyInQuiz && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addQuestionsToQuiz([q.id]);
                          setIsQuestionBankOpen(false);
                        }}
                        className="p-2 rounded-lg text-primary/20 hover:bg-primary/5 hover:text-primary transition-all"
                        title="Add to quiz"
                      >
                        <Plus size={18} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-8 pt-8 border-t border-primary/5 flex justify-end gap-4">
              <button 
                onClick={() => {
                  addQuestionsToQuiz(bankSelectedIds);
                  setIsQuestionBankOpen(false);
                }}
                disabled={bankSelectedIds.length === 0}
                className="px-8 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ADD SELECTED QUESTIONS ({bankSelectedIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Random Question Modal */}
      {isRandomModalOpen && editingQuiz && (
        <div className="fixed inset-0 bg-primary/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl space-y-8">
            <div>
              <h3 className="text-2xl font-display font-bold text-primary">Add random questions</h3>
              <p className="text-xs text-primary/40 font-medium mt-1">Select course and number of questions</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Category (Course)</label>
                <select
                  className="w-full px-4 py-3 bg-background border-none rounded-xl outline-none focus:ring-2 focus:ring-primary/5 font-semibold text-primary/60 transition-all"
                  value={randomCourse}
                  onChange={(e) => setRandomCourse(e.target.value)}
                >
                  <option value="">Current Course ({courses.find(c => c.id === editingQuiz.courseId)?.name})</option>
                  <option value="all">All Courses</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Number of random questions</label>
                <select
                  className="w-full px-4 py-3 bg-background border-none rounded-xl outline-none focus:ring-2 focus:ring-primary/5 font-semibold text-primary/60 transition-all"
                  value={randomCount}
                  onChange={(e) => setRandomCount(parseInt(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 10, 15, 20].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setIsRandomModalOpen(false)}
                className="flex-1 py-4 bg-primary/5 text-primary rounded-2xl font-bold hover:bg-primary/10 transition-all"
              >
                CANCEL
              </button>
              <button 
                onClick={handleAddRandomQuestions}
                className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-xl shadow-primary/20"
              >
                ADD RANDOM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Question Modal */}
      {isQuickAddModalOpen && editingQuiz && (
        <div className="fixed inset-0 bg-primary/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-display font-bold text-primary">Add a new question</h3>
              <button onClick={() => setIsQuickAddModalOpen(false)} className="p-2 hover:bg-primary/5 rounded-full text-primary/40">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleQuickAddQuestion} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Question Num</label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
                    value={qaQuestionNum}
                    onChange={(e) => setQaQuestionNum(e.target.value === '' ? '' : parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Points</label>
                  <input
                    type="number"
                    required
                    className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
                    value={qaPoints}
                    onChange={(e) => setQaPoints(parseInt(e.target.value))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Question Text (English)</label>
                <textarea
                  required
                  rows={2}
                  className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none resize-none transition-all"
                  value={qaText}
                  onChange={(e) => setQaText(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Question Text (Marathi - Optional)</label>
                <textarea
                  rows={2}
                  className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none resize-none transition-all"
                  value={qaMarathiText}
                  onChange={(e) => setQaMarathiText(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {qaOptions.map((opt, idx) => (
                  <div key={idx}>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Option {idx + 1}</label>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          className="flex-1 px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...qaOptions];
                            newOpts[idx] = e.target.value;
                            setQaOptions(newOpts);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setQaCorrectIndex(idx)}
                          className={cn(
                            "px-4 rounded-xl text-[10px] font-bold transition-all border-2",
                            qaCorrectIndex === idx ? "bg-emerald-500 text-white border-emerald-500" : "bg-primary/5 text-primary/40 border-transparent hover:border-primary/10"
                          )}
                        >
                          CORRECT
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all"
              >
                ADD TO QUIZ
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminQuizzes;
