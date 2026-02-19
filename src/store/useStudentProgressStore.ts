import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ALL_COMPETENCIES } from '@/src/data/competencies';

// Enregistrement de progression pour UN élève
export interface StudentRecord {
    studentId: string;         // ex: "NDRC1-1234"
    studentName: string;       // ex: "Thomas Dupont"
    classCode: string;         // ex: "NDRC1"
    acquiredIds: string[];     // liste des IDs de compétences validées
    proofs: Record<string, string>; // { competencyId: "url ou commentaire" }
    lastUpdated: string;       // ISO date
}

interface TeacherComment {
    text: string;
    date: string;
    authorName: string;
}

interface StudentProgressStore {
    // Progression des élèves (clé = studentId)
    records: Record<string, StudentRecord>;

    // Commentaires du formateur (clé = studentId)
    teacherComments: Record<string, TeacherComment[]>;

    // Actions élève
    recordProgress: (
        studentId: string,
        studentName: string,
        classCode: string,
        competencyId: string,
        acquired: boolean,
        proof?: string
    ) => void;

    // Actions formateur
    addTeacherComment: (studentId: string, text: string, authorName: string) => void;
    removeTeacherComment: (studentId: string, index: number) => void;

    // Helpers
    getStudentProgress: (studentId: string) => number; // % global (0-100)
    getStudentAcquiredCount: (studentId: string) => number;
    getAllStudentsProgressSummary: () => Array<{
        studentId: string;
        studentName: string;
        classCode: string;
        progress: number;
        acquiredCount: number;
        lastUpdated: string;
        comments: TeacherComment[];
    }>;
}

export const useStudentProgressStore = create<StudentProgressStore>()(
    persist(
        (set, get) => ({
            records: {},
            teacherComments: {},

            recordProgress: (studentId, studentName, classCode, competencyId, acquired, proof) => {
                set((state) => {
                    const existing = state.records[studentId] || {
                        studentId,
                        studentName,
                        classCode,
                        acquiredIds: [],
                        proofs: {},
                        lastUpdated: new Date().toISOString(),
                    };

                    const newAcquiredIds = acquired
                        ? Array.from(new Set([...existing.acquiredIds, competencyId]))
                        : existing.acquiredIds.filter((id) => id !== competencyId);

                    const newProofs = proof
                        ? { ...existing.proofs, [competencyId]: proof }
                        : existing.proofs;

                    return {
                        records: {
                            ...state.records,
                            [studentId]: {
                                ...existing,
                                studentName,
                                classCode,
                                acquiredIds: newAcquiredIds,
                                proofs: newProofs,
                                lastUpdated: new Date().toISOString(),
                            },
                        },
                    };
                });
            },

            addTeacherComment: (studentId, text, authorName) => {
                set((state) => {
                    const existing = state.teacherComments[studentId] || [];
                    return {
                        teacherComments: {
                            ...state.teacherComments,
                            [studentId]: [
                                ...existing,
                                { text, date: new Date().toISOString(), authorName },
                            ],
                        },
                    };
                });
            },

            removeTeacherComment: (studentId, index) => {
                set((state) => {
                    const existing = [...(state.teacherComments[studentId] || [])];
                    existing.splice(index, 1);
                    return {
                        teacherComments: {
                            ...state.teacherComments,
                            [studentId]: existing,
                        },
                    };
                });
            },

            getStudentProgress: (studentId) => {
                const record = get().records[studentId];
                if (!record) return 0;
                const total = ALL_COMPETENCIES.length;
                if (total === 0) return 0;
                return Math.round((record.acquiredIds.length / total) * 100);
            },

            getStudentAcquiredCount: (studentId) => {
                return get().records[studentId]?.acquiredIds.length ?? 0;
            },

            getAllStudentsProgressSummary: () => {
                const { records, teacherComments } = get();
                return Object.values(records).map((r) => ({
                    studentId: r.studentId,
                    studentName: r.studentName,
                    classCode: r.classCode,
                    progress: Math.round((r.acquiredIds.length / ALL_COMPETENCIES.length) * 100),
                    acquiredCount: r.acquiredIds.length,
                    lastUpdated: r.lastUpdated,
                    comments: teacherComments[r.studentId] || [],
                }));
            },
        }),
        {
            name: 'ndrc-student-progress',
            storage: createJSONStorage(() => localStorage),
            skipHydration: true,
        }
    )
);
