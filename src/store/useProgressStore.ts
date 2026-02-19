import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ALL_COMPETENCIES } from '@/src/data/competencies';
import { useStudentProgressStore } from './useStudentProgressStore';
import { useAuthStore } from './useAuthStore';

// Interface du Store
interface ProgressStore {
    progress: Record<string, boolean>; // {'id': isAcquired}
    proofs: Record<string, string>;    // {'id': 'url_ou_commentaire'}
    toggleCompetency: (id: string) => void;
    setProof: (id: string, proof: string) => void;
    resetProgress: () => void;

    // Helpers calculés
    getPlatformProgress: (platform: string) => number; // Retourne un % (0-100)
}

// Helper : récupère l'identité de l'élève connecté
function getStudentIdentity() {
    const { user } = useAuthStore.getState();
    if (!user || user.role !== 'STUDENT') return null;
    return {
        studentId: `${user.classCode}-${user.name}`, // id unique
        studentName: user.name,
        classCode: user.classCode || 'UNKNOWN',
    };
}

// Création du Store avec persistance LocalStorage
export const useProgressStore = create<ProgressStore>()(
    persist(
        (set, get) => ({
            progress: {},
            proofs: {},

            toggleCompetency: (id) => {
                set((state) => {
                    const newAcquired = !state.progress[id];
                    const newProgress = { ...state.progress, [id]: newAcquired };

                    // Synchroniser avec le store partagé (lisible par le formateur)
                    const identity = getStudentIdentity();
                    if (identity) {
                        useStudentProgressStore.getState().recordProgress(
                            identity.studentId,
                            identity.studentName,
                            identity.classCode,
                            id,
                            newAcquired,
                            state.proofs[id]
                        );
                    }

                    return { progress: newProgress };
                });
            },

            setProof: (id, proof) =>
                set((state) => {
                    const newProofs = { ...state.proofs, [id]: proof };

                    // Synchroniser la preuve dans le store partagé
                    const identity = getStudentIdentity();
                    if (identity && state.progress[id]) {
                        useStudentProgressStore.getState().recordProgress(
                            identity.studentId,
                            identity.studentName,
                            identity.classCode,
                            id,
                            true,
                            proof
                        );
                    }

                    return { proofs: newProofs };
                }),

            resetProgress: () => set({ progress: {} }),

            getPlatformProgress: (platform) => {
                const state = get();
                // Filtrer les compétences de cette plateforme
                const platformCompetencies = ALL_COMPETENCIES.filter(
                    (c) => c.platform === platform.toUpperCase()
                );

                if (platformCompetencies.length === 0) return 0;

                // Compter celles qui sont 'true' dans le store
                const acquiredCount = platformCompetencies.filter(
                    (c) => state.progress[c.id] === true
                ).length;

                return Math.round((acquiredCount / platformCompetencies.length) * 100);
            },
        }),
        {
            name: 'ndrc-skills-storage', // Nom de la clé dans LocalStorage
            storage: createJSONStorage(() => localStorage), // Explicite pour Next.js Client Side
            skipHydration: true, // Important pour éviter le mismatch SSR/Client au premier render
        }
    )
);
