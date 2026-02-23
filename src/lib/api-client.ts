/**
 * Client API centralisé
 * Toutes les fonctions qui appellent les endpoints backend
 */

const getBaseUrl = () =>
    typeof window !== "undefined" ? "" : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("ndrc_token");
}

async function apiFetch<T>(
    path: string,
    options: RequestInit = {}
): Promise<{ data: T | null; error: string | null }> {
    const token = getToken();
    const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    try {
        const res = await fetch(`${getBaseUrl()}${path}`, { ...options, headers });
        const json = await res.json();

        if (!res.ok) {
            return { data: null, error: json.error || "Erreur inconnue" };
        }
        return { data: json as T, error: null };
    } catch (err) {
        return { data: null, error: "Erreur de connexion au serveur" };
    }
}

// =============================================================
// AUTH
// =============================================================

export async function apiTeacherLogin(email: string, password: string) {
    return apiFetch<{ token: string; name: string; role: string }>(
        "/api/auth/teacher/login",
        { method: "POST", body: JSON.stringify({ email, password }) }
    );
}

export async function apiTeacherRegister(name: string, email: string, password: string) {
    return apiFetch<{ token: string; name: string; role: string }>(
        "/api/auth/teacher/register",
        { method: "POST", body: JSON.stringify({ name, email, password }) }
    );
}

export async function apiStudentLogin(identifier: string, password: string) {
    return apiFetch<{ token: string; name: string; role: string; classCode: string; studentId: string }>(
        "/api/auth/student/login",
        { method: "POST", body: JSON.stringify({ identifier, password }) }
    );
}

export async function apiChangePassword(currentPassword: string, newPassword: string) {
    return apiFetch<{ message: string }>(
        "/api/student/password",
        { method: "PATCH", body: JSON.stringify({ currentPassword, newPassword }) }
    );
}

// =============================================================
// ÉLÈVES (formateur)
// =============================================================

export interface StudentWithProgress {
    id: string;
    firstName: string;
    lastName: string;
    identifier: string;
    classCode: string;
    className: string;
    wpUrl?: string | null;
    prestaUrl?: string | null;
    acquiredCount: number;
    lastActive: string | null;
    competencies: Array<{
        competencyId: string;
        acquired: boolean;
        status: number;
        proof: string | null;
        updatedAt: string;
    }>;
    comments: Array<{
        id: string;
        text: string;
        authorName: string;
        date: string;
    }>;
}

export async function apiGetStudents() {
    return apiFetch<StudentWithProgress[]>("/api/students");
}

export async function apiUpdateStudent(id: string, data: { wpUrl?: string; prestaUrl?: string }) {
    return apiFetch<{ message: string; student: any }>(
        `/api/students/${id}`,
        { method: "PATCH", body: JSON.stringify(data) }
    );
}

export async function apiImportStudents(
    students: Array<{ firstName: string; lastName: string; classCode: string; password: string }>
) {
    return apiFetch<{
        message: string;
        stats: { created: number; updated: number };
        createdStudents: Array<{ firstName: string; lastName: string; identifier: string }>;
    }>(
        "/api/students",
        { method: "POST", body: JSON.stringify({ students }) }
    );
}

// =============================================================
// PROGRESSION (élève)
// =============================================================

export interface ProgressRecord {
    competencyId: string;
    acquired: boolean;
    status: number;
    proof: string | null;
    updatedAt: string;
}

export async function apiGetProgress() {
    return apiFetch<ProgressRecord[]>("/api/progress");
}

export interface StudentDashboardData {
    firstName: string;
    lastName: string;
    classCode: string;
    wpUrl?: string | null;
    prestaUrl?: string | null;
    progress: {
        total: number;
        wordpress: number;
        prestashop: number;
        acquiredCount: number;
        totalCount: number;
    };
    recentActivity: Array<{
        id: string;
        label: string;
        platform: string;
        date: string;
    }>;
    comments: Array<{
        id: string;
        text: string;
        author: string;
        date: string;
    }>;
}

export async function apiStudentDashboard() {
    return apiFetch<StudentDashboardData>("/api/student/dashboard");
}

export async function apiSaveProgress(competencyId: string, status: number, proof?: string) {
    // Legacy support for acquired: consider >= 3 (Competent) as acquired
    const acquired = status >= 3;
    return apiFetch<ProgressRecord>(
        "/api/progress",
        { method: "POST", body: JSON.stringify({ competencyId, acquired, status, proof }) }
    );
}

// =============================================================
// COMMENTAIRES (formateur)
// =============================================================

export async function apiAddComment(studentId: string, text: string) {
    return apiFetch<{ id: string; text: string; authorName: string; date: string }>(
        "/api/comments",
        { method: "POST", body: JSON.stringify({ studentId, text }) }
    );
}

export async function apiDeleteComment(commentId: string) {
    return apiFetch<{ deleted: boolean }>(
        `/api/comments/${commentId}`,
        { method: "DELETE" }
    );
}

// =============================================================
// ADMIN
// =============================================================

export async function apiAdminLogin(email: string, password: string) {
    return apiFetch<{ token: string; name: string; role: string }>(
        "/api/auth/admin/login",
        { method: "POST", body: JSON.stringify({ email, password }) }
    );
}

export interface TeacherAdmin {
    id: string;
    email: string;
    name: string;
    status: string;
    createdAt: string;
    _count: { students: number; classes: number };
}

export async function apiGetTeachers() {
    return apiFetch<TeacherAdmin[]>("/api/admin/teachers");
}

export async function apiManageTeacher(teacherId: string, action: "approve" | "reject" | "delete") {
    return apiFetch<{ message: string }>(
        "/api/admin/teachers",
        { method: "PATCH", body: JSON.stringify({ teacherId, action }) }
    );
}

// =============================================================
// MISSIONS
// =============================================================

export interface MissionData {
    id: string;
    title: string;
    content: string;
    platform: string;
    level: number;
    competencyIds: string[];
    createdBy: string;
    createdByRole: string;
    createdAt: string;
    _count?: { assignments: number };
}

export interface MissionAssignmentData {
    id: string;
    missionId: string;
    title: string;
    content: string;
    platform: string;
    level: number;
    competencyIds: string[];
    status: string;
    assignedAt: string;
    completedAt: string | null;
    teacherName: string;
}

// Sauvegarder une mission (prof ou élève)
export async function apiSaveMission(data: {
    title: string; content: string; platform: string;
    level: number; competencyIds: string[];
}) {
    return apiFetch<MissionData>("/api/missions", {
        method: "POST", body: JSON.stringify(data),
    });
}

// Lister les missions du formateur
export async function apiGetMissions(platform?: string) {
    const query = platform ? `?platform=${platform}` : "";
    return apiFetch<MissionData[]>(`/api/missions${query}`);
}

// Supprimer une mission
export async function apiDeleteMission(id: string) {
    return apiFetch<{ deleted: boolean }>(`/api/missions/${id}`, { method: "DELETE" });
}

// Assigner une mission
export async function apiAssignMission(missionId: string, target: { studentIds?: string[]; classId?: string }) {
    return apiFetch<{ assigned: number }>("/api/missions/assign", {
        method: "POST", body: JSON.stringify({ missionId, ...target }),
    });
}

// Missions assignées à l'étudiant
export async function apiGetMyMissions() {
    return apiFetch<MissionAssignmentData[]>("/api/student/missions");
}

// Mettre à jour le statut d'une mission assignée
export async function apiUpdateMissionStatus(assignmentId: string, status: string) {
    return apiFetch<MissionAssignmentData>(`/api/student/missions/${assignmentId}`, {
        method: "PATCH", body: JSON.stringify({ status }),
    });
}
