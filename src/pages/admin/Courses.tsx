import React, { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Course } from '../../types';
import { Plus, Trash2, Edit2, X, LayoutList } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const AdminCourses = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchCourses = async () => {
    const snap = await getDocs(collection(db, 'courses'));
    setCourses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (editingId) {
      await updateDoc(doc(db, 'courses', editingId), { name, shortCode, description });
    } else {
      await addDoc(collection(db, 'courses'), {
        name,
        shortCode,
        description,
        adminId: user.uid,
        createdAt: Date.now()
      });
    }

    setName('');
    setShortCode('');
    setDescription('');
    setEditingId(null);
    setIsModalOpen(false);
    fetchCourses();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this course?')) {
      await deleteDoc(doc(db, 'courses', id));
      fetchCourses();
    }
  };

  const handleEdit = (course: Course) => {
    setEditingId(course.id);
    setName(course.name);
    setShortCode(course.shortCode || '');
    setDescription(course.description);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold tracking-tight text-primary">Course Management</h2>
          <p className="text-primary/40 mt-1 font-medium">Organize your curriculum and learning paths.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setName('');
            setDescription('');
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-xl font-bold hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/20 transition-all"
        >
          <Plus size={18} />
          <span>NEW COURSE</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <div key={course.id} className="bg-white p-8 rounded-3xl border border-primary/5 shadow-xl shadow-primary/5 group hover:shadow-primary/10 transition-all">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-accent mb-1 block">{course.shortCode}</span>
                <h3 className="text-xl font-bold tracking-tight text-primary">{course.name}</h3>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEdit(course)} className="p-2 hover:bg-primary/5 rounded-lg text-primary/40 hover:text-primary">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(course.id)} className="p-2 hover:bg-red-50 rounded-lg text-primary/40 hover:text-red-500">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <p className="text-sm text-primary/60 line-clamp-2 mb-6 font-medium">{course.description}</p>
            <div className="flex items-center justify-between pt-6 border-t border-primary/5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/30">
                Created {new Date(course.createdAt).toLocaleDateString()}
              </span>
              <button 
                onClick={() => navigate(`/admin/quizzes?courseId=${course.id}`)}
                className="flex items-center gap-2 text-xs font-bold text-accent hover:underline"
              >
                <LayoutList size={14} />
                MANAGE QUIZZES
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-primary/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-display font-bold text-primary">
                {editingId ? 'Edit Course' : 'Create New Course'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-primary/5 rounded-full text-primary/40">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Course Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Short Code</label>
                  <input
                    type="text"
                    required
                    placeholder="CS101"
                    className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none transition-all"
                    value={shortCode}
                    onChange={(e) => setShortCode(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-primary/40 mb-2">Description</label>
                <textarea
                  required
                  rows={4}
                  className="w-full px-4 py-3 bg-background border-2 border-transparent rounded-xl focus:border-primary/20 focus:bg-white outline-none resize-none transition-all"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all"
              >
                {editingId ? 'UPDATE COURSE' : 'PUBLISH COURSE'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCourses;
