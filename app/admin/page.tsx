"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Shield, CheckCircle, XCircle, Trash2, Users, BookOpen, LogOut, Clock, Filter, Server, Zap, UserCog, Layers, Brain } from "lucide-react";
import Link from "next/link";
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
                return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-amber-500/20 border border-amber-500/20 text-amber-400">En attente</span>;
            case "active":
                return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-emerald-500/20 border border-emerald-500/20 text-emerald-400">Actif</span>;
            case "rejected":
                return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-red-500/20 border border-red-500/20 text-red-400">Refusé</span>;
            default:
                return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-white/8 border border-white/5 text-slate-400">{status}</span>;
        }
    };

    if (isLoading) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-slate-800 via-indigo-950 to-slate-900 flex items-center justify-center">
                <div className="text-slate-400 animate-pulse text-lg">Chargement...</div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-800 via-indigo-950 to-slate-900 font-sans pb-20">
            {/* Header */}
            <header className="sticky top-0 z-20 bg-slate-900/70 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500/20 border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-400">
                        <Shield size={20} />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-white">Console Admin</h1>
                        <p className="text-xs text-slate-400">Gestion des formateurs</p>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-400 transition-colors"
                >
                    <LogOut size={16} /> Déconnexion
                </button>
            </header>

            <div className="max-w-4xl mx-auto p-6">
                {/* Liens rapides nouveaux modules */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                    <Link href="/admin/whm-config" className="flex items-center gap-3 p-4 bg-white/5 border border-white/8 rounded-2xl hover:bg-white/10 transition-all group">
                        <div className="w-10 h-10 bg-blue-500/20 border border-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 group-hover:bg-blue-500/30 transition-colors">
                            <Server size={18} />
                        </div>
                        <div>
                            <div className="font-bold text-white text-sm">Config WHM</div>
                            <div className="text-xs text-slate-400">Serveurs o2switch</div>
                        </div>
                    </Link>
                    <Link href="/admin/cpanel-accounts" className="flex items-center gap-3 p-4 bg-white/5 border border-white/8 rounded-2xl hover:bg-white/10 transition-all group">
                        <div className="w-10 h-10 bg-emerald-500/20 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/30 transition-colors">
                            <UserCog size={18} />
                        </div>
                        <div>
                            <div className="font-bold text-white text-sm">Comptes cPanel</div>
                            <div className="text-xs text-slate-400">1 par classe</div>
                        </div>
                    </Link>
                    <Link href="/admin/provisioning" className="flex items-center gap-3 p-4 bg-white/5 border border-white/8 rounded-2xl hover:bg-white/10 transition-all group">
                        <div className="w-10 h-10 bg-amber-500/20 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 group-hover:bg-amber-500/30 transition-colors">
                            <Zap size={18} />
                        </div>
                        <div>
                            <div className="font-bold text-white text-sm">Création des sites</div>
                            <div className="text-xs text-slate-400">Sous-domaines WP/PS</div>
                        </div>
                    </Link>
                    <Link href="/admin/provisioning/grille" className="flex items-center gap-3 p-4 bg-white/5 border border-white/8 rounded-2xl hover:bg-white/10 transition-all group">
                        <div className="w-10 h-10 bg-white/8 border border-white/10 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-white/15 transition-colors">
                            <Layers size={18} />
                        </div>
                        <div>
                            <div className="font-bold text-white text-sm">Grille des sites</div>
                            <div className="text-xs text-slate-400">Installer &amp; cloner</div>
                        </div>
                    </Link>
                    <Link href="/admin/knowledge" className="flex items-center gap-3 p-4 bg-white/5 border border-white/8 rounded-2xl hover:bg-white/10 transition-all group">
                        <div className="w-10 h-10 bg-violet-500/20 border border-violet-500/20 rounded-xl flex items-center justify-center text-violet-400 group-hover:bg-violet-500/30 transition-colors">
                            <Brain size={18} />
                        </div>
                        <div>
                            <div className="font-bold text-white text-sm">Base IA</div>
                            <div className="text-xs text-slate-400">Connaissances RAG</div>
                        </div>
                    </Link>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {([
                        { key: "all" as StatusFilter, label: "Total", count: counts.all, color: "bg-white/5 border border-white/8 text-slate-300" },
                        { key: "pending" as StatusFilter, label: "En attente", count: counts.pending, color: "bg-amber-500/10 border border-amber-500/20 text-amber-400" },
                        { key: "active" as StatusFilter, label: "Actifs", count: counts.active, color: "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" },
                        { key: "rejected" as StatusFilter, label: "Refusés", count: counts.rejected, color: "bg-red-500/10 border border-red-500/20 text-red-400" },
                    ]).map(({ key, label, count, color }) => (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            className={`p-4 rounded-2xl text-center transition-all ${color} ${filter === key ? "ring-2 ring-amber-500/50 shadow-md shadow-amber-900/20" : "opacity-70 hover:opacity-100"}`}
                        >
                            <div className="text-2xl font-black">{count}</div>
                            <div className="text-xs font-bold uppercase">{label}</div>
                        </button>
                    ))}
                </div>

                {/* Filter label */}
                <div className="flex items-center gap-2 mb-4 text-sm text-slate-400">
                    <Filter size={14} />
                    <span>
                        {filter === "all" ? "Tous les formateurs" :
                         filter === "pending" ? "En attente de validation" :
                         filter === "active" ? "Formateurs actifs" : "Formateurs refusés"}
                    </span>
                </div>

                {/* Teachers List */}
                {filtered.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <Users size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="font-bold">Aucun formateur dans cette catégorie</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((teacher) => (
                            <div
                                key={teacher.id}
                                className="bg-white/5 border border-white/8 rounded-2xl p-4 hover:border-white/15 transition-all"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-white truncate">{teacher.name}</h3>
                                            {statusBadge(teacher.status)}
                                        </div>
                                        <p className="text-sm text-slate-400">{teacher.email}</p>
                                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
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
                                                className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                                            >
                                                <CheckCircle size={14} /> Valider
                                            </button>
                                        )}
                                        {teacher.status !== "rejected" && teacher.status !== "pending" && (
                                            <button
                                                onClick={() => handleAction(teacher.id, "reject")}
                                                disabled={actionLoading === teacher.id}
                                                className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                                            >
                                                <XCircle size={14} /> Rejeter
                                            </button>
                                        )}

                                        {confirmDelete === teacher.id ? (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleAction(teacher.id, "delete")}
                                                    disabled={actionLoading === teacher.id}
                                                    className="px-3 py-2 text-xs font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                                                >
                                                    Confirmer
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete(null)}
                                                    className="px-3 py-2 text-xs font-bold rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 transition-colors"
                                                >
                                                    Annuler
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmDelete(teacher.id)}
                                                disabled={actionLoading === teacher.id}
                                                className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
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
