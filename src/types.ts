export type UserRole = 'admin' | 'student';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  courseIds: string[]; // For students, courses they are enrolled in
  createdAt: number;
}

export interface Course {
  id: string;
  name: string;
  shortCode: string;
  description: string;
  adminId: string;
  createdAt: number;
}

export interface Question {
  id: string;
  courseId: string;
  text: string;
  marathiText?: string;
  options: string[];
  marathiOptions?: string[];
  correctOptionIndex: number;
  points: number;
  imageUrl?: string;
  questionNumber?: number;
  createdAt: number;
}

export interface Quiz {
  id: string;
  courseId: string;
  title: string;
  description: string;
  questionIds: string[];
  questionPoints?: Record<string, number>;
  sections?: {
    id: string;
    title: string;
    startQuestionId: string | null; // ID of the first question in this section. null for the very first section if it starts at index 0.
    shuffle: boolean;
  }[];
  durationMinutes: number;
  maxGrade?: number;
  reviewOptions?: {
    showMarks: boolean;
    showWhetherCorrect: boolean;
    showRightAnswer: boolean;
    showFeedback: boolean;
  };
  createdAt: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  answers: number[]; // Index of selected option for each question
  score: number;
  totalPoints: number;
  startedAt: number;
  completedAt: number;
}
