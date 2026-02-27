import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where, doc, updateDoc, arrayUnion, arrayRemove, setDoc, getFirestore, deleteDoc } from 'firebase/firestore';
import { db, firebaseConfig } from '../../lib/firebase';
import { UserProfile, Course } from '../../types';
import { Search, UserPlus, UserMinus, Upload, X, AlertCircle, CheckCircle2, Edit2, Trash2, Save } from 'lucide-react';
import { cn } from '../../lib/utils';
import Papa from 'papaparse';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, setPersistence, inMemoryPersistence } from 'firebase/auth';

const AdminStudents = () => {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkData, setBulkData] = useState<string>('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<UserProfile | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = async () => {
    const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
    const coursesSnap = await getDocs(collection(db, 'courses'));
    
    setStudents(studentsSnap.docs.map(doc => doc.data() as UserProfile));
    setCourses(coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleEnrollment = async (studentId: string, courseId: string, isEnrolled: boolean) => {
    const studentRef = doc(db, 'users', studentId);
    if (isEnrolled) {
      await updateDoc(studentRef, { courseIds: arrayRemove(courseId) });
    } else {
      await updateDoc(studentRef, { courseIds: arrayUnion(courseId) });
    }
    fetchData();
  };

  const filteredStudents = students
    .filter(s => {
      const matchesSearch = s.displayName.toLowerCase().includes(search.toLowerCase()) || 
                           s.email.toLowerCase().includes(search.toLowerCase());
      const matchesCourse = selectedCourse ? s.courseIds?.includes(selectedCourse) : true;
      return matchesSearch && matchesCourse;
    })
    .sort((a, b) => a.email.localeCompare(b.email));

  const handleBulkUpload = async () => {
    if (!navigator.onLine) {
      alert('You are offline. Please check your internet connection.');
      return;
    }
    setBulkLoading(true);
    setBulkResults(null);
    setUploadProgress({ current: 0, total: 0 });
    const results = { success: 0, failed: 0, errors: [] as string[] };

    // Robust parsing: trim headers and lowercase them
    const parsed = Papa.parse(bulkData.trim(), { 
      header: true, 
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase()
    });
    
    const studentsToUpload = parsed.data as any[];

    if (studentsToUpload.length === 0) {
      setBulkResults({ success: 0, failed: 0, errors: ['No data found in the input. Please ensure you included the header row.'] });
      setBulkLoading(false);
      return;
    }

    // Create a secondary app to avoid logging out the admin
    const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
    const secondaryAuth = getAuth(secondaryApp);
    const secondaryDb = getFirestore(secondaryApp);
    
    // CRITICAL: Ensure secondary auth doesn't touch the primary login session
    await setPersistence(secondaryAuth, inMemoryPersistence);

    // Helper for delay
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    for (let i = 0; i < studentsToUpload.length; i++) {
      const student = studentsToUpload[i];
      const rowNum = i + 1;
      
      // Throttling: increased delay between requests to avoid rate limits
      if (i > 0) await delay(500);

      const attemptRegistration = async (retryCount = 0): Promise<void> => {
        try {
          // Clean all values in the student object
          Object.keys(student).forEach(key => {
            if (typeof student[key] === 'string') {
              student[key] = student[key].trim();
            }
          });

          const email = student.email;
          const password = student.password;
          const firstName = student.firstname || '';
          const lastName = student.lastname || '';
          const fullName = `${firstName} ${lastName}`.trim();
          
          if (!email || !password) {
            const columns = Object.keys(student).filter(k => k.trim() !== '').join(', ');
            throw new Error(`Row ${rowNum}: Missing email or password. (Detected columns: [${columns}])`);
          }

          // 1. Create or Get Auth User
          let uid = '';
          try {
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            uid = userCredential.user.uid;
          } catch (authErr: any) {
            if (authErr.code === 'auth/email-already-in-use') {
              // If user exists, try to sign in to get the UID
              try {
                const userCredential = await signInWithEmailAndPassword(secondaryAuth, email, password);
                uid = userCredential.user.uid;
              } catch (loginErr: any) {
                throw new Error(`Account exists but password in CSV is incorrect for ${email}.`);
              }
            } else if ((authErr.code === 'auth/network-request-failed' || authErr.code === 'auth/internal-error') && retryCount < 5) {
              // Exponential backoff for network errors
              const waitTime = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
              await delay(waitTime);
              return attemptRegistration(retryCount + 1);
            } else {
              throw authErr;
            }
          }

          // 2. Map course short codes to IDs
          const studentCourseIds: string[] = [];
          const courseKeys = ['course1', 'course2', 'course3', 'course4'];
          
          courseKeys.forEach(key => {
            const shortCode = student[key];
            if (shortCode) {
              const course = courses.find(c => c.shortCode?.toLowerCase() === shortCode.toLowerCase());
              if (course) {
                studentCourseIds.push(course.id);
              } else {
                results.errors.push(`Row ${rowNum}: Course code "${shortCode}" not found in database.`);
              }
            }
          });

          // 3. Create Firestore Profile (Using secondaryDb so student writes their own profile)
          try {
            await setDoc(doc(secondaryDb, 'users', uid), {
              uid,
              email,
              displayName: fullName,
              role: 'student',
              courseIds: studentCourseIds,
              createdAt: Date.now(),
            });
          } catch (fsErr: any) {
            if (fsErr.code === 'permission-denied') {
              throw new Error(`Database permission denied. This usually means the student is blocked from creating their own profile. Check your Firestore Rules.`);
            }
            throw fsErr;
          }

          // 4. Sign out from secondary app to be safe
          await signOut(secondaryAuth);
          
          results.success++;
        } catch (err: any) {
          if ((err.code === 'auth/network-request-failed' || err.code === 'auth/internal-error') && retryCount < 5) {
            const waitTime = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
            await delay(waitTime);
            return attemptRegistration(retryCount + 1);
          }
          results.failed++;
          const identifier = student.email || `Row ${rowNum}`;
          results.errors.push(`${identifier}: ${err.message}`);
        }
      };

      await attemptRegistration();
      setUploadProgress({ current: i + 1, total: studentsToUpload.length });
    }

    await deleteApp(secondaryApp);
    setBulkResults(results);
    setBulkLoading(false);
    fetchData();
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;
    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, 'users', studentToDelete.uid));
      setIsDeleteModalOpen(false);
      setStudentToDelete(null);
      fetchData();
    } catch (err: any) {
      alert('Failed to delete student: ' + err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleUpdateStudent = async () => {
    if (!editingStudent || !editName.trim()) return;
    setEditLoading(true);
    try {
      await updateDoc(doc(db, 'users', editingStudent.uid), {
        displayName: editName.trim()
      });
      setIsEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert('Failed to update student: ' + err.message);
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold tracking-tight text-primary">Student Management</h2>
          <p className="text-primary/40 mt-1 font-medium">Manage enrollments and track student progress.</p>
        </div>
        <button
          onClick={() => {
            setBulkData('');
            setBulkResults(null);
            setIsBulkModalOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all"
        >
          <Upload size={18} />
          <span>BULK REGISTRATION</span>
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/20" size={18} />
          <input
            type="text"
            placeholder="Search students by name or email..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-primary/10 rounded-xl outline-none focus:ring-2 focus:ring-primary/5 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-3 bg-white border border-primary/10 rounded-xl outline-none focus:ring-2 focus:ring-primary/5 min-w-[200px] font-semibold text-primary/60 transition-all"
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
        >
          <option value="">Filter by Course</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-3xl border border-primary/5 shadow-xl shadow-primary/5 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-background border-b border-primary/5">
              <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-primary/40">Student</th>
              <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-primary/40">Enrolled Courses</th>
              <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-primary/40">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary/5">
            {filteredStudents.map((student) => (
              <tr key={student.uid} className="hover:bg-primary/[0.01] transition-colors">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center font-bold text-xs text-primary border border-primary/10">
                      {student.displayName[0]}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-primary">{student.displayName}</p>
                      <p className="text-xs text-primary/40 font-medium">{student.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-wrap gap-2">
                    {student.courseIds?.map(cid => {
                      const course = courses.find(c => c.id === cid);
                      return course ? (
                        <span key={cid} className="px-2 py-1 bg-primary/5 text-primary rounded text-[10px] font-bold uppercase tracking-wider border border-primary/10">
                          {course.name}
                        </span>
                      ) : null;
                    })}
                    {(!student.courseIds || student.courseIds.length === 0) && (
                      <span className="text-xs text-primary/20 italic">No courses enrolled</span>
                    )}
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-2">
                    {selectedCourse ? (
                      <button
                        onClick={() => toggleEnrollment(student.uid, selectedCourse, student.courseIds.includes(selectedCourse))}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border-2",
                          student.courseIds.includes(selectedCourse)
                            ? "bg-red-50 text-red-600 border-red-100 hover:bg-red-100"
                            : "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100"
                        )}
                      >
                        {student.courseIds.includes(selectedCourse) ? (
                          <><UserMinus size={14} /> UNENROLL</>
                        ) : (
                          <><UserPlus size={14} /> ENROLL</>
                        )}
                      </button>
                    ) : (
                      <span className="text-[10px] text-primary/30 italic font-medium">Select a course to manage enrollment</span>
                    )}
                    
                    <div className="flex items-center gap-1 ml-4">
                      <button
                        onClick={() => {
                          setEditingStudent(student);
                          setEditName(student.displayName);
                          setIsEditModalOpen(true);
                        }}
                        className="p-2 hover:bg-primary/5 rounded-lg text-primary/40 hover:text-primary transition-colors"
                        title="Edit Student"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setStudentToDelete(student);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-2 hover:bg-red-50 rounded-lg text-primary/40 hover:text-red-600 transition-colors"
                        title="Delete Student"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-primary/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-display font-bold text-primary">Bulk Student Registration</h3>
                <p className="text-xs text-primary/40 mt-1 font-medium uppercase tracking-widest">Paste CSV data below</p>
              </div>
              <button onClick={() => setIsBulkModalOpen(false)} className="p-2 hover:bg-primary/5 rounded-full text-primary/40">
                <X size={20} />
              </button>
            </div>

            {!bulkResults ? (
              <div className="space-y-6">
                <div className="bg-background p-4 rounded-xl border border-primary/5">
                  <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-2">Expected Format (CSV Header)</p>
                  <code className="text-[10px] text-accent font-mono break-all">
                    firstname,lastname,email,password,role,course1,course2,course3,course4
                  </code>
                </div>
                
                <textarea
                  className="w-full h-64 px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none resize-none font-mono text-xs transition-all"
                  placeholder="KUSHAL,MAHAJAN,etsr01@gmail.com,kushal@123,student,ETSR,ESSR,EDSR,WCSR..."
                  value={bulkData}
                  onChange={(e) => setBulkData(e.target.value)}
                />

                <button
                  onClick={handleBulkUpload}
                  disabled={bulkLoading || !bulkData.trim()}
                  className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {bulkLoading ? 'PROCESSING REGISTRATIONS...' : <><Upload size={18} /> START BULK UPLOAD</>}
                </button>

                {bulkLoading && uploadProgress.total > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-primary/40">
                      <span>Progress</span>
                      <span>{Math.round((uploadProgress.current / uploadProgress.total) * 100)}%</span>
                    </div>
                    <div className="w-full h-2 bg-primary/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-accent transition-all duration-300" 
                        style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-center text-[10px] text-primary/40 font-medium">
                      Registering {uploadProgress.current} of {uploadProgress.total} students...
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 text-center">
                    <p className="text-3xl font-bold text-emerald-600 tracking-tighter">{bulkResults.success}</p>
                    <p className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest">Successful</p>
                  </div>
                  <div className="bg-red-50 p-6 rounded-2xl border border-red-100 text-center">
                    <p className="text-3xl font-bold text-red-600 tracking-tighter">{bulkResults.failed}</p>
                    <p className="text-[10px] font-bold text-red-600/60 uppercase tracking-widest">Failed</p>
                  </div>
                </div>

                {bulkResults.errors.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Error Log</p>
                    <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 max-h-48 overflow-y-auto">
                      {bulkResults.errors.map((err, i) => (
                        <div key={i} className="flex items-start gap-2 text-[10px] text-red-600 font-mono mb-1">
                          <AlertCircle size={12} className="mt-0.5 shrink-0" />
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setIsBulkModalOpen(false)}
                  className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all"
                >
                  CLOSE
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 bg-primary/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-display font-bold text-primary">Edit Student</h3>
                <p className="text-xs text-primary/40 mt-1 font-medium uppercase tracking-widest">Update profile details</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-primary/5 rounded-full text-primary/40">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Full Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
                  placeholder="Student Name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <button
                onClick={handleUpdateStudent}
                disabled={editLoading || !editName.trim()}
                className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {editLoading ? 'UPDATING...' : <><Save size={18} /> SAVE CHANGES</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-primary/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto text-red-600">
                <Trash2 size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-display font-bold text-primary">Delete Student?</h3>
                <p className="text-sm text-primary/40 mt-2">
                  Are you sure you want to delete <span className="font-bold text-primary">{studentToDelete?.displayName}</span>? 
                  This action cannot be undone and will remove their profile from the system.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-4 bg-primary/5 text-primary rounded-xl font-bold hover:bg-primary/10 transition-all"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleDeleteStudent}
                  disabled={deleteLoading}
                  className="flex-1 py-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 hover:shadow-lg hover:shadow-red-200 transition-all disabled:opacity-50"
                >
                  {deleteLoading ? 'DELETING...' : 'YES, DELETE'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStudents;
