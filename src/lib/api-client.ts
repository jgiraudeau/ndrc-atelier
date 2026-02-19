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

export async function apiStudentLogin(classCode: string, pin: string) {
    return apiFetch<{ token: string; name: string; role: string; classCode: string; studentId: string }>(
        "/api/auth/student/login",
        { method: "POST", body: JSON.stringify({ classCode, pin }) }
    );
}

// =============================================================
// ÉLÈVES (formateur)
// =============================================================

export interface StudentWithProgress {
    id: string;
    firstName: string;
    lastName: string;
    classCode: string;
    className: string;
    acquiredCount: number;
    lastActive: string | null;
    competencies: Array<{
        competencyId: string;
        acquired: boolean;
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

export async function apiImportStudents(
    students: Array<{ firstName: string; lastName: string; classCode: string; pin: string }>
) {
    return apiFetch<{ imported: number; errors: string[] }>(
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

export async function apiSaveProgress(competencyId: string, acquired: boolean, proof?: string) {
    return apiFetch<ProgressRecord>(
        "/api/progress",
        { method: "POST", body: JSON.stringify({ competencyId, acquired, proof }) }
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
