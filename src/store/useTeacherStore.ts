import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Student {
    id: string; // Généré ou PIN
    firstName: string;
    lastName: string;
    classCode: string;
    pin: string;
    progress: number; // 0-100
    lastActive?: string;
}

export interface TeacherClass {
    id: string;
    name: string;
    studentCount: number;
    averageProgress: number;
}

interface TeacherStore {
    classes: TeacherClass[];
    students: Student[];

    // Actions
    importStudentsFromCSV: (csvContent: string) => { success: boolean, count: number, message?: string };
    addStudent: (student: Omit<Student, 'id' | 'progress'>) => void;
    removeStudent: (id: string) => void;
    updateStudentProgress: (id: string, progress: number) => void; // Sera appelé par le dashboard élève en théorie
    resetData: () => void;
}

export const useTeacherStore = create<TeacherStore>()(
    persist(
        (set, get) => ({
            classes: [
                { id: 'NDRC1', name: 'BTS NDRC 1', studentCount: 0, averageProgress: 0 },
                { id: 'NDRC2', name: 'BTS NDRC 2', studentCount: 0, averageProgress: 0 },
            ],
            students: [],

            importStudentsFromCSV: (csvContent) => {
                const lines = csvContent.split('\n');
                let count = 0;
                const newStudents: Student[] = [];

                // Détection automatique du séparateur (virgule ou point-virgule)
                const firstLine = lines[0] || '';
                const separator = firstLine.includes(';') ? ';' : ',';

                // Ignorer l'entête si présent
                const startIndex = firstLine.toLowerCase().includes('nom') ? 1 : 0;

                for (let i = startIndex; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const parts = line.split(separator);
                    if (parts.length >= 3) {
                        const lastName = parts[0].trim();
                        const firstName = parts[1].trim();
                        const classCode = parts[2].trim().toUpperCase();
                        const pin = parts[3]?.trim() || Math.floor(1000 + Math.random() * 9000).toString();

                        newStudents.push({
                            id: `${classCode}-${pin}`,
                            firstName,
                            lastName,
                            classCode,
                            pin,
                            progress: 0,
                            lastActive: 'Jamais'
                        });
                        count++;
                    }
                }

                if (count > 0) {
                    set((state) => {
                        const updatedStudents = [...state.students, ...newStudents];

                        // Récupérer toutes les classes uniques (existantes + nouvelles)
                        const allClassCodes = Array.from(new Set([
                            ...state.classes.map(c => c.id),
                            ...newStudents.map(s => s.classCode)
                        ]));

                        // Reconstruire la liste des classes avec les compteurs à jour
                        const updatedClasses = allClassCodes.map(code => {
                            const existingClass = state.classes.find(c => c.id === code);
                            const classStudents = updatedStudents.filter(s => s.classCode === code);

                            // Calcul moyenne progession
                            const totalProgress = classStudents.reduce((acc, s) => acc + (s.progress || 0), 0);
                            const avg = classStudents.length > 0 ? Math.round(totalProgress / classStudents.length) : 0;

                            return {
                                id: code,
                                name: existingClass?.name || `Classe ${code}`, // Nom par défaut si nouvelle
                                studentCount: classStudents.length,
                                averageProgress: avg
                            };
                        });

                        return { students: updatedStudents, classes: updatedClasses };
                    });
                    return { success: true, count };
                }
                return { success: false, message: "Aucun élève valide trouvé.", count: 0 };
            },

            addStudent: (student) => set((state) => ({
                students: [...state.students, { ...student, id: Math.random().toString(), progress: 0 }]
            })),

            removeStudent: (id) => set((state) => ({
                students: state.students.filter((s) => s.id !== id),
            })),

            updateStudentProgress: (id, progress) => set((state) => ({
                students: state.students.map(s => s.id === id ? { ...s, progress } : s)
            })),

            resetData: () => set({ students: [], classes: [] }),
        }),
        {
            name: 'ndrc-teacher-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
