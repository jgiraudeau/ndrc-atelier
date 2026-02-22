"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Shield, CheckCircle, XCircle, Trash2, Users, BookOpen, LogOut, Clock, Filter } from "lucide-react";
import { apiGetTeachers, apiManageTeacher, type TeacherAdmin } from "@/src/lib/api-client";

type StatusFilter = "all" | "pending" | "active" | "rejected";

export default function AdminDashboardPage() {
    const router = useRouter();
    const [teachers, setTeachers] = useState<TeacherAdmin[]>([]);
    const [filter, setFilter] = useState<StatusFilter>("all");
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const loadTeachers = useCallback(async () => {
        const { data, error } = await apiGetTeachers();
        if (error) {
            // Not authenticated or unauthorized
            router.push("/admin/login");
            return;
        }
        if (data) setTeachers(data);
        setIsLoading(false);
    }, [router]);

    useEffect(() => {
        // Check auth
        const user = localStorage.getItem("ndrc_user");
        if (!user || !JSON.parse(user).role || JSON.parse(user).role !== "ADMIN") {
            router.push("/admin/login");
            return;
        }
        loadTeachers();
    }, [router, loadTeachers]);

    const handleAction = async (teacherId: string, action: "approve" | "reject" | "delete") => {
        setActionLoading(teacherId);
        const { error } = await apiManageTeacher(teacherId, action);
        setActionLoading(null);
        setConfirmDelete(null);

        if (!error) {
            loadTeachers();
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("ndrc_token");
        localStorage.removeItem("ndrc_user");
        router.push("/admin/login");
    };

    const filtered = teachers.filter((t) =>
        filter === "all" ? true : t.status === filter
    );

    const counts = {
        all: teachers.length,
        pending: teachers.filter((t) => t.status === "pending").length,
        active: teachers.filter((t) => t.status === "active").length,
        rejected: teachers.filter((t) => t.status === "rejected").length,
    };

    const statusBadge = (status: string) => {
        switch (status) {
            case "pending":
                return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-amber-100 text-amber-700">En attente</span>;
            case "active":
                return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-green-100 text-green-700">Actif</span>;
            case "rejected":
                return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-red-100 text-red-700">Refusé</span>;
            default:
                return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-slate-100 text-slate-500">{status}</span>;
        }
    };

    if (isLoading) {
        return (
            <main className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-slate-400 animate-pulse text-lg">Chargement...</div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 font-sans">
            {/* Header */}
            <header className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400">
                        <Shield size={20} />
                    </div>
                    <div>
                        <h1 className="text-lg font-black">Console Admin</h1>
                        <p className="text-xs text-slate-400">Gestion des formateurs</p>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                    <LogOut size={16} /> Déconnexion
                </button>
            </header>

            <div className="max-w-4xl mx-auto p-6">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {([
                        { key: "all" as StatusFilter, label: "Total", count: counts.all, color: "bg-slate-100 text-slate-700" },
                        { key: "pending" as StatusFilter, label: "En attente", count: counts.pending, color: "bg-amber-50 text-amber-700" },
                        { key: "active" as StatusFilter, label: "Actifs", count: counts.active, color: "bg-green-50 text-green-700" },
                        { key: "rejected" as StatusFilter, label: "Refusés", count: counts.rejected, color: "bg-red-50 text-red-700" },
                    ]).map(({ key, label, count, color }) => (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            className={`p-4 rounded-xl text-center transition-all ${color} ${filter === key ? "ring-2 ring-amber-500 shadow-md" : "opacity-70 hover:opacity-100"}`}
                        >
                            <div className="text-2xl font-black">{count}</div>
                            <div className="text-xs font-bold uppercase">{label}</div>
                        </button>
                    ))}
                </div>

                {/* Filter label */}
                <div className="flex items-center gap-2 mb-4 text-sm text-slate-500">
                    <Filter size={14} />
                    <span>
                        {filter === "all" ? "Tous les formateurs" :
                         filter === "pending" ? "En attente de validation" :
                         filter === "active" ? "Formateurs actifs" : "Formateurs refusés"}
                    </span>
                </div>

                {/* Teachers List */}
                {filtered.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <Users size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="font-bold">Aucun formateur dans cette catégorie</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((teacher) => (
                            <div
                                key={teacher.id}
                                className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-slate-800 truncate">{teacher.name}</h3>
                                            {statusBadge(teacher.status)}
                                        </div>
                                        <p className="text-sm text-slate-500">{teacher.email}</p>
                                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <Clock size={12} />
                                                {new Date(teacher.createdAt).toLocaleDateString("fr-FR")}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Users size={12} />
                                                {teacher._count.students} élève{teacher._count.students !== 1 ? "s" : ""}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <BookOpen size={12} />
                                                {teacher._count.classes} classe{teacher._count.classes !== 1 ? "s" : ""}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {teacher.status !== "active" && (
                                            <button
                                                onClick={() => handleAction(teacher.id, "approve")}
                                                disabled={actionLoading === teacher.id}
                                                className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                                            >
                                                <CheckCircle size={14} /> Valider
                                            </button>
                                        )}
                                        {teacher.status !== "rejected" && teacher.status !== "pending" && (
                                            <button
                                                onClick={() => handleAction(teacher.id, "reject")}
                                                disabled={actionLoading === teacher.id}
                                                className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors disabled:opacity-50"
                                            >
                                                <XCircle size={14} /> Rejeter
                                            </button>
                                        )}

                                        {confirmDelete === teacher.id ? (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleAction(teacher.id, "delete")}
                                                    disabled={actionLoading === teacher.id}
                                                    className="px-3 py-2 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                                                >
                                                    Confirmer
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete(null)}
                                                    className="px-3 py-2 text-xs font-bold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                                                >
                                                    Annuler
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmDelete(teacher.id)}
                                                disabled={actionLoading === teacher.id}
                                                className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                                            >
                                                <Trash2 size={14} /> Supprimer
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
