import React, { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, writeBatch, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Question, Course } from '../../types';
import { Plus, Trash2, HelpCircle, X, ChevronRight, RefreshCw, Upload, AlertCircle, Image as ImageIcon, FileText, CheckCircle2, Filter, Edit2, Eye } from 'lucide-react';
import { cn } from '../../lib/utils';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const AdminQuestions = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [syncData, setSyncData] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResults, setSyncResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  
  // Advanced Bulk State
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkImages, setBulkImages] = useState<File[]>([]);
  
  // Form state
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [previewingQuestion, setPreviewingQuestion] = useState<Question | null>(null);
  const [text, setText] = useState('');
  const [marathiText, setMarathiText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [marathiOptions, setMarathiOptions] = useState(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [points, setPoints] = useState(1);
  const [imageUrl, setImageUrl] = useState('');
  const [questionNum, setQuestionNum] = useState<number | ''>('');

  const fetchData = async () => {
    const coursesSnap = await getDocs(collection(db, 'courses'));
    const coursesList = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
    setCourses(coursesList);

    const questionsSnap = await getDocs(collection(db, 'questions'));
    setQuestions(questionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return alert('Please select a course');

    const questionData = {
      courseId: selectedCourse,
      text,
      marathiText: marathiText || null,
      options,
      marathiOptions: marathiOptions.some(o => o.trim()) ? marathiOptions : null,
      correctOptionIndex: correctIndex,
      points,
      imageUrl: imageUrl || null,
      questionNumber: questionNum !== '' ? Number(questionNum) : null,
      updatedAt: Date.now()
    };

    if (editingQuestion) {
      await updateDoc(doc(db, 'questions', editingQuestion.id), questionData);
    } else {
      await addDoc(collection(db, 'questions'), {
        ...questionData,
        createdAt: Date.now()
      });
    }

    setText('');
    setMarathiText('');
    setOptions(['', '', '', '']);
    setMarathiOptions(['', '', '', '']);
    setCorrectIndex(0);
    setPoints(1);
    setImageUrl('');
    setQuestionNum('');
    setEditingQuestion(null);
    setIsModalOpen(false);
    fetchData();
  };

  const openEditModal = (q: Question) => {
    setEditingQuestion(q);
    setSelectedCourse(q.courseId);
    setText(q.text);
    setMarathiText(q.marathiText || '');
    setOptions(q.options);
    setMarathiOptions(q.marathiOptions || ['', '', '', '']);
    setCorrectIndex(q.correctOptionIndex);
    setPoints(q.points);
    setImageUrl(q.imageUrl || '');
    setQuestionNum(q.questionNumber || '');
    setIsModalOpen(true);
  };

  const handleAdvancedBulkUpload = async () => {
    if (!bulkFile) return alert('Please select an Excel or CSV file');
    setSyncLoading(true);
    setSyncResults(null);
    const results = { success: 0, failed: 0, errors: [] as string[] };

    try {
      let data: any[] = [];
      
      // 1. Parse the file (Excel or CSV)
      if (bulkFile.name.endsWith('.csv')) {
        const text = await bulkFile.text();
        const parsed = Papa.parse(text, { 
          header: true, 
          skipEmptyLines: true,
          transformHeader: (h) => h.trim().toLowerCase()
        });
        data = parsed.data;
      } else {
        const buffer = await bulkFile.arrayBuffer();
        const workbook = XLSX.read(buffer);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(firstSheet);
        // Normalize keys to lowercase
        data = data.map(row => {
          const normalized: any = {};
          Object.keys(row).forEach(k => normalized[k.trim().toLowerCase()] = row[k]);
          return normalized;
        });
      }

      // 2. Prepare images map (filename -> Base64)
      const imagesMap = new Map<string, string>();
      for (const file of bulkImages) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        imagesMap.set(file.name.toLowerCase(), base64);
      }

      const batch = writeBatch(db);

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 1;

        try {
          const questionText = row.question || row.text || row['question text'];
          const mText = row['question (marathi)'] || row['text (marathi)'] || row['marathi question'] || row['marathi text'];
          
          const options = [
            row['option a'] || row.a || row['a'],
            row['option b'] || row.b || row['b'],
            row['option c'] || row.c || row['c'],
            row['option d'] || row.d || row['d']
          ].filter(Boolean);

          const mOptions = [
            row['option a (marathi)'] || row['a (marathi)'] || row['marathi a'],
            row['option b (marathi)'] || row['b (marathi)'] || row['marathi b'],
            row['option c (marathi)'] || row['c (marathi)'] || row['marathi c'],
            row['option d (marathi)'] || row['d (marathi)'] || row['marathi d']
          ].filter(Boolean);

          const correctVal = String(row['correct answer'] || row.correct || row['correct'] || '').trim().toUpperCase();
          const correctIndex = ['A', 'B', 'C', 'D'].indexOf(correctVal);
          const pointsValue = parseInt(row.points || row['points'] || '1');
          
          // Improved question number detection
          const qNumRaw = row['question num'] || row['number'] || row['qno'] || row['sl no'] || row['question number'] || row['sr no'] || row['sr. no.'];
          const qNumber = parseInt(String(qNumRaw || ''));

          const figureRef = String(row['figure'] || row['figure url'] || row.image || row['image url'] || '').trim().toLowerCase();
          const courseShortName = String(row['course'] || row['course short name'] || row['short code'] || '').trim().toLowerCase();

          // Find course by short code or name
          let courseId = selectedCourse;
          if (courseShortName) {
            const course = courses.find(c => 
              c.shortCode?.toLowerCase() === courseShortName || 
              c.name.toLowerCase() === courseShortName
            );
            if (course) {
              courseId = course.id;
            } else {
              throw new Error(`Row ${rowNum}: Course "${courseShortName}" not found.`);
            }
          }

          if (!courseId) {
            throw new Error(`Row ${rowNum}: No course specified. Please select a course or include a 'Course' column.`);
          }

          if (!questionText || options.length < 2 || correctIndex === -1) {
            throw new Error(`Row ${rowNum}: Invalid data. Need question, 2+ options, and correct answer (A/B/C/D).`);
          }

          // Match image from uploaded files or use URL
          let imageUrl = null;
          if (figureRef) {
            if (imagesMap.has(figureRef)) {
              imageUrl = imagesMap.get(figureRef);
            } else if (figureRef.startsWith('http')) {
              imageUrl = figureRef;
            } else {
              // Try matching without extension if user just put "fig1"
              const match = Array.from(imagesMap.keys()).find(k => k.startsWith(figureRef + '.'));
              if (match) {
                imageUrl = imagesMap.get(match);
              }
            }
          }

          const qRef = doc(collection(db, 'questions'));
          batch.set(qRef, {
            courseId,
            text: questionText,
            marathiText: mText || null,
            options,
            marathiOptions: mOptions.length > 0 ? mOptions : null,
            correctOptionIndex: correctIndex,
            points: pointsValue,
            imageUrl: imageUrl || null,
            questionNumber: isNaN(qNumber) ? null : qNumber,
            createdAt: Date.now()
          });

          results.success++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(err.message);
        }
      }

      if (results.success > 0) {
        await batch.commit();
      }
      
      setSyncResults(results);
    } catch (err: any) {
      setSyncResults({ success: 0, failed: 0, errors: [err.message] });
    } finally {
      setSyncLoading(false);
      fetchData();
    }
  };

  const handleBulkSync = async () => {
    if (!selectedCourse) return alert('Please select a course first');
    setSyncLoading(true);
    setSyncResults(null);
    const results = { success: 0, failed: 0, errors: [] as string[] };

    try {
      let csvText = syncData.trim();
      
      // If it looks like a Google Sheets URL, try to fetch it
      if (csvText.includes('docs.google.com/spreadsheets')) {
        const match = csvText.match(/\/d\/(.+?)\//);
        if (match) {
          const sheetId = match[1];
          const response = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`);
          if (!response.ok) throw new Error('Failed to fetch Google Sheet. Make sure it is public (Anyone with the link can view).');
          csvText = await response.text();
        }
      }

      const parsed = Papa.parse(csvText, { 
        header: true, 
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase()
      });

      const rows = parsed.data as any[];
      const batch = writeBatch(db);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;

        try {
          const questionText = row.question || row.text || row['question text'];
          const mText = row['question (marathi)'] || row['text (marathi)'] || row['marathi question'] || row['marathi text'];

          const options = [
            row['option a'] || row.a || row['a'],
            row['option b'] || row.b || row['b'],
            row['option c'] || row.c || row['c'],
            row['option d'] || row.d || row['d']
          ].filter(Boolean);

          const mOptions = [
            row['option a (marathi)'] || row['a (marathi)'] || row['marathi a'],
            row['option b (marathi)'] || row['b (marathi)'] || row['marathi b'],
            row['option c (marathi)'] || row['c (marathi)'] || row['marathi c'],
            row['option d (marathi)'] || row['d (marathi)'] || row['marathi d']
          ].filter(Boolean);

          const correctLetter = (row['correct answer'] || row.correct || row['correct'] || '').trim().toUpperCase();
          const correctIndex = ['A', 'B', 'C', 'D'].indexOf(correctLetter);
          const pointsValue = parseInt(row.points || row['points'] || '1');
          
          // Improved question number detection
          const qNumRaw = row['question num'] || row['number'] || row['qno'] || row['sl no'] || row['question number'] || row['sr no'] || row['sr. no.'];
          const qNumber = parseInt(String(qNumRaw || ''));

          const imageUrl = row['figure url'] || row.image || row.figure || row['image url'];

          if (!questionText || options.length < 2 || correctIndex === -1) {
            throw new Error(`Row ${rowNum}: Invalid data. Need question, 2+ options, and correct answer (A/B/C/D).`);
          }

          const qRef = doc(collection(db, 'questions'));
          batch.set(qRef, {
            courseId: selectedCourse,
            text: questionText,
            marathiText: mText || null,
            options,
            marathiOptions: mOptions.length > 0 ? mOptions : null,
            correctOptionIndex: correctIndex,
            points: pointsValue,
            imageUrl: imageUrl || null,
            questionNumber: isNaN(qNumber) ? null : qNumber,
            createdAt: Date.now()
          });

          results.success++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(err.message);
        }
      }

      if (results.success > 0) {
        await batch.commit();
      }
      
      setSyncResults(results);
    } catch (err: any) {
      setSyncResults({ success: 0, failed: 0, errors: [err.message] });
    } finally {
      setSyncLoading(false);
      fetchData();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this question?')) {
      await deleteDoc(doc(db, 'questions', id));
      fetchData();
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold tracking-tight text-primary">Question Bank</h2>
          <p className="text-primary/40 mt-1 font-medium">Build and manage your repository of assessment questions.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setSyncData('');
              setSyncResults(null);
              setIsSyncModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-primary/5 text-primary rounded-xl font-bold hover:bg-primary/10 transition-all border border-primary/10"
          >
            <RefreshCw size={18} />
            <span>SYNC FROM SHEETS</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-xl font-bold hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/20 transition-all"
          >
            <Plus size={18} />
            <span>ADD QUESTION</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-6 rounded-3xl border border-primary/5 shadow-sm">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="bg-primary/5 p-3 rounded-xl">
            <Filter size={18} className="text-primary/40" />
          </div>
          <div className="flex-1 md:w-64">
            <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-1">Filter by Course</label>
            <select
              className="w-full bg-transparent border-none outline-none text-sm font-bold text-primary p-0 cursor-pointer"
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
            >
              <option value="">All Courses</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-widest font-bold text-primary/20">
          {questions.filter(q => !selectedCourse || q.courseId === selectedCourse).length} Questions Found
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {questions
          .filter(q => !selectedCourse || q.courseId === selectedCourse)
          .sort((a, b) => (a.questionNumber || 0) - (b.questionNumber || 0))
          .map((q) => {
            const course = courses.find(c => c.id === q.courseId);
            return (
              <div key={q.id} className="bg-white px-8 py-4 rounded-2xl border border-primary/5 shadow-sm hover:shadow-md transition-all flex items-center gap-6 group">
                <div className="bg-primary/5 w-12 h-12 rounded-xl border border-primary/10 flex items-center justify-center shrink-0">
                  {q.questionNumber !== undefined && q.questionNumber !== null ? (
                    <span className="text-xs font-mono font-bold text-primary/60">
                      {String(q.questionNumber).padStart(3, '0')}
                    </span>
                  ) : (
                    <HelpCircle size={18} className="text-primary/20" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 bg-primary/5 text-primary rounded text-[8px] font-bold uppercase tracking-wider border border-primary/10">
                      {course?.name || 'Unknown Course'}
                    </span>
                    <span className="text-[8px] font-bold text-primary/20 uppercase tracking-widest">
                      {q.points} PTS
                    </span>
                  </div>
                  <p className="text-sm font-bold text-primary truncate">
                    {q.text}
                  </p>
                  {q.marathiText && (
                    <p className="text-sm font-bold text-primary truncate">
                      {q.marathiText}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => setPreviewingQuestion(q)}
                    className="p-2 hover:bg-primary/5 rounded-lg text-primary/40 hover:text-primary transition-colors"
                    title="Preview"
                  >
                    <Eye size={18} />
                  </button>
                  <button 
                    onClick={() => openEditModal(q)}
                    className="p-2 hover:bg-primary/5 rounded-lg text-primary/40 hover:text-accent transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(q.id)} 
                    className="p-2 hover:bg-red-50 rounded-lg text-primary/40 hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-primary/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-display font-bold text-primary">{editingQuestion ? 'Edit Question' : 'New Question'}</h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingQuestion(null);
                  setText('');
                  setMarathiText('');
                  setOptions(['', '', '', '']);
                  setMarathiOptions(['', '', '', '']);
                  setCorrectIndex(0);
                  setPoints(1);
                  setImageUrl('');
                  setQuestionNum('');
                }} 
                className="p-2 hover:bg-primary/5 rounded-full text-primary/40"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Select Course</label>
                  <select
                    required
                    className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                  >
                    <option value="">Choose a course...</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Question Num</label>
                  <input
                    type="number"
                    placeholder="e.g. 1"
                    className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
                    value={questionNum}
                    onChange={(e) => setQuestionNum(e.target.value === '' ? '' : parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Figure URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://example.com/image.png"
                    className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Question Text (English)</label>
                <textarea
                  required
                  rows={2}
                  className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none resize-none transition-all"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Question Text (Marathi Translation - Optional)</label>
                <textarea
                  rows={2}
                  className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none resize-none transition-all"
                  value={marathiText}
                  onChange={(e) => setMarathiText(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {options.map((opt, idx) => (
                  <div key={idx}>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Option {idx + 1}</label>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          placeholder="English"
                          className="flex-1 px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...options];
                            newOpts[idx] = e.target.value;
                            setOptions(newOpts);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setCorrectIndex(idx)}
                          className={cn(
                            "px-4 rounded-xl text-[10px] font-bold transition-all border-2",
                            correctIndex === idx ? "bg-emerald-500 text-white border-emerald-500" : "bg-primary/5 text-primary/40 border-transparent hover:border-primary/10"
                          )}
                        >
                          CORRECT
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Marathi Translation (Optional)"
                        className="w-full px-4 py-2 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all text-[10px]"
                        value={marathiOptions[idx]}
                        onChange={(e) => {
                          const newMopts = [...marathiOptions];
                          newMopts[idx] = e.target.value;
                          setMarathiOptions(newMopts);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Points</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
                  value={points}
                  onChange={(e) => setPoints(parseInt(e.target.value))}
                />
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all"
              >
                SAVE TO BANK
              </button>
            </form>
          </div>
        </div>
      )}
      {isSyncModalOpen && (
        <div className="fixed inset-0 bg-primary/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-display font-bold text-primary">Sync Question Bank</h3>
                <p className="text-xs text-primary/40 mt-1 font-medium uppercase tracking-widest">Import from Google Sheets or CSV</p>
              </div>
              <button onClick={() => setIsSyncModalOpen(false)} className="p-2 hover:bg-primary/5 rounded-full text-primary/40">
                <X size={20} />
              </button>
            </div>

            {!syncResults ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Target Course (Optional if in file)</label>
                    <select
                      className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
                      value={selectedCourse}
                      onChange={(e) => setSelectedCourse(e.target.value)}
                    >
                      <option value="">Choose a course...</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Upload Excel/CSV File</label>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                      />
                      <div className="w-full px-4 py-3 bg-background border-2 border-dashed border-primary/10 rounded-xl flex items-center gap-3 text-primary/40">
                        <FileText size={18} />
                        <span className="text-xs truncate">{bulkFile ? bulkFile.name : 'Select .xlsx or .csv'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Upload Figures (Optional)</label>
                  <div className="relative">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      onChange={(e) => setBulkImages(Array.from(e.target.files || []))}
                    />
                    <div className="w-full px-4 py-12 bg-background border-2 border-dashed border-primary/10 rounded-2xl flex flex-col items-center justify-center gap-3 text-primary/40 hover:bg-primary/5 transition-all">
                      <ImageIcon size={32} />
                      <div className="text-center">
                        <p className="text-xs font-bold uppercase tracking-widest">Select multiple images</p>
                        <p className="text-[10px] mt-1">{bulkImages.length} files selected</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-background p-4 rounded-xl border border-primary/5">
                  <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-2">Column Headers Expected</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px] text-primary/60 font-mono">
                    <div>• Question Num / SL No</div>
                    <div>• Question / Text</div>
                    <div>• Option A, B, C, D</div>
                    <div>• Correct Answer (A/B/C/D)</div>
                    <div>• Points</div>
                    <div>• Course (Short Name)</div>
                    <div>• Figure (Filename or URL)</div>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-primary/5"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold text-primary/20 bg-white px-4">
                    OR PASTE GOOGLE SHEETS URL
                  </div>
                </div>
                
                <textarea
                  className="w-full h-24 px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none resize-none font-mono text-[10px] transition-all"
                  placeholder="Paste Public Google Sheets URL here..."
                  value={syncData}
                  onChange={(e) => setSyncData(e.target.value)}
                />

                <button
                  onClick={bulkFile ? handleAdvancedBulkUpload : handleBulkSync}
                  disabled={syncLoading || (!bulkFile && !syncData.trim())}
                  className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {syncLoading ? 'PROCESSING...' : <><RefreshCw size={18} /> {bulkFile ? 'UPLOAD & SYNC' : 'SYNC FROM SHEETS'}</>}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 text-center">
                    <p className="text-3xl font-bold text-emerald-600 tracking-tighter">{syncResults.success}</p>
                    <p className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest">Imported</p>
                  </div>
                  <div className="bg-red-50 p-6 rounded-2xl border border-red-100 text-center">
                    <p className="text-3xl font-bold text-red-600 tracking-tighter">{syncResults.failed}</p>
                    <p className="text-[10px] font-bold text-red-600/60 uppercase tracking-widest">Failed</p>
                  </div>
                </div>

                {syncResults.errors.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Error Log</p>
                    <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 max-h-48 overflow-y-auto">
                      {syncResults.errors.map((err, i) => (
                        <div key={i} className="flex items-start gap-2 text-[10px] text-red-600 font-mono mb-1">
                          <AlertCircle size={12} className="mt-0.5 shrink-0" />
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setIsSyncModalOpen(false)}
                  className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all"
                >
                  CLOSE
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {previewingQuestion && (
        <div className="fixed inset-0 bg-primary/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-display font-bold text-primary">Question Preview</h3>
                <p className="text-[10px] text-primary/40 uppercase tracking-widest mt-1 font-bold">
                  {courses.find(c => c.id === previewingQuestion.courseId)?.name} • {previewingQuestion.points} Points
                </p>
              </div>
              <button onClick={() => setPreviewingQuestion(null)} className="p-2 hover:bg-primary/5 rounded-full text-primary/40">
                <X size={20} />
              </button>
            </div>

            <div className="bg-[#f0f4f8] p-8 rounded-xl space-y-6">
              <div>
                <h4 className="text-xl font-bold text-[#1a2b3c] leading-tight">
                  {previewingQuestion.questionNumber} {previewingQuestion.text}{previewingQuestion.marathiText}
                </h4>
                <p className="text-xs text-[#1a2b3c]/60 mt-4">Select one:</p>
              </div>

              {previewingQuestion.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-primary/5 bg-white p-4">
                  <img 
                    src={previewingQuestion.imageUrl} 
                    alt="Question figure" 
                    className="max-h-64 object-contain mx-auto"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              <div className="space-y-3">
                {previewingQuestion.options.map((opt, idx) => (
                  <div key={idx} className="flex items-start gap-3 group">
                    <div className={cn(
                      "w-4 h-4 rounded-full border flex-shrink-0 mt-1 flex items-center justify-center",
                      idx === previewingQuestion.correctOptionIndex ? "border-primary bg-primary/10" : "border-primary/20"
                    )}>
                      {idx === previewingQuestion.correctOptionIndex && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div className="flex-1">
                      <span className="font-bold text-base text-[#1a2b3c]">
                        {opt}{previewingQuestion.marathiOptions?.[idx]}
                      </span>
                      {idx === previewingQuestion.correctOptionIndex && (
                        <span className="ml-2 text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Correct Answer</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

              <div className="pt-8 border-t border-primary/5 flex gap-3">
                <button
                  onClick={() => {
                    const q = previewingQuestion;
                    setPreviewingQuestion(null);
                    openEditModal(q);
                  }}
                  className="flex-1 py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                >
                  <Edit2 size={18} /> EDIT QUESTION
                </button>
                <button
                  onClick={() => setPreviewingQuestion(null)}
                  className="px-8 py-4 bg-primary/5 text-primary rounded-xl font-bold hover:bg-primary/10 transition-all"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
      )}
    </div>
  );
};

export default AdminQuestions;
