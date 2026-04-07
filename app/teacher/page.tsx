"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users, Download, LogOut, FileSpreadsheet, Search,
    Upload, CheckCircle2, XCircle, MessageSquarePlus,
    ChevronDown, ChevronUp, Trash2, Send, BookOpen, RefreshCw,
    Globe, Save, Target, Zap, TrendingUp, GraduationCap, BarChart3
} from "lucide-react";
import Link from "next/link";
import {
    apiGetStudents, apiImportStudents, apiAddComment, apiDeleteComment, apiUpdateStudent,
    type StudentWithProgress
} from "@/src/lib/api-client";
import { ALL_COMPETENCIES } from "@/src/data/competencies";

const TOTAL_COMPETENCIES = ALL_COMPETENCIES.length;

function ProgressBar({ value, color = "bg-purple-500" }: { value: number; color?: string }) {
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${value}%` }} />
            </div>
            <span className="text-sm font-bold text-slate-700 w-9 text-right">{value}%</span>
        </div>
    );
}

function parseCSV(text: string): Array<{ firstName: string; lastName: string; classCode: string; password: string }> {
    const lines = text.split("\n");
    const firstLine = lines[0] || "";
    const sep = firstLine.includes(";") ? ";" : ",";
    const startIndex = firstLine.toLowerCase().includes("nom") ? 1 : 0;
    const result = [];
    for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].trim().split(sep);
        if (parts.length >= 3) {
            const lastName = parts[0].trim();
            const firstName = parts[1].trim();
            const classCode = parts[2].trim().toUpperCase();
            const password = parts[3]?.trim() || Math.random().toString(36).slice(-6);
            if (lastName && firstName && classCode) {
                result.push({ firstName, lastName, classCode, password });
            }
        }
    }
    return result;
}

export default function TeacherDashboard() {
    const [students, setStudents] = useState<StudentWithProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [dragging, setDragging] = useState(false);
    const [importStatus, setImportStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
    const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
    const [wpInputs, setWpInputs] = useState<Record<string, string>>({});
    const [prestaInputs, setPrestaInputs] = useState<Record<string, string>>({});
    const [teacherName, setTeacherName] = useState("Formateur");

    const router = useRouter();

    const handleUpdateUrls = async (studentId: string) => {
        const wpUrl = wpInputs[studentId] !== undefined ? wpInputs[studentId] : students.find(s => s.id === studentId)?.wpUrl;
        const prestaUrl = prestaInputs[studentId] !== undefined ? prestaInputs[studentId] : students.find(s => s.id === studentId)?.prestaUrl;

        const { error } = await apiUpdateStudent(studentId, { wpUrl: wpUrl || "", prestaUrl: prestaUrl || "" });
        if (!error) {
            setStudents(prev => prev.map(s => s.id === studentId ? { ...s, wpUrl: wpUrl || "", prestaUrl: prestaUrl || "" } : s));
            alert("Liens enregistrés avec succès !");
        } else {
            alert(error);
        }
    };

    const fetchStudents = useCallback(async () => {
        setLoading(true);
        const { data, error } = await apiGetStudents();
        if (error) {
            // Token invalide → redirection
            if (error.includes("authentifié") || error.includes("invalide")) {
                router.push("/teacher/login");
                return;
            }
        }
        setStudents(data || []);
        setLoading(false);
    }, [router]);

    useEffect(() => {
        const token = localStorage.getItem("ndrc_token");
        if (!token) { router.push("/teacher/login"); return; }
        const userData = JSON.parse(localStorage.getItem("ndrc_user") || "{}");
        setTeacherName(userData.name || "Formateur");
        fetchStudents();
    }, [fetchStudents, router]);

    const handleLogout = () => {
        localStorage.removeItem("ndrc_token");
        localStorage.removeItem("ndrc_user");
        router.push("/");
    };

    const downloadCsvTemplate = () => {
        const content = "Nom;Prénom;CodeClasse;MotDePasse\nDupont;Thomas;NDRC1;monmdp1\nMartin;Sophie;NDRC2;monmdp2";
        const blob = new Blob(['\uFEFF' + content], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "modele_import_eleves.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const processFile = async (file: File) => {
        if (!file.name.endsWith(".csv")) {
            setImportStatus({ type: "error", message: "Fichier invalide — déposez un .csv" });
            return;
        }
        const text = await file.text();
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
            setImportStatus({ type: "error", message: "Aucun élève trouvé dans le fichier." });
            return;
        }
        const { data, error } = await apiImportStudents(parsed);
        if (error || !data) {
            setImportStatus({ type: "error", message: error || "Erreur lors de l'import." });
            return;
        }
        const identifiersList = data.createdStudents?.map(s => `${s.firstName} ${s.lastName} → ${s.identifier}`).join(", ") || "";
        setImportStatus({
            type: "success",
            message: `${data.stats.created} créé(s), ${data.stats.updated} mis à jour.${identifiersList ? ` Identifiants : ${identifiersList}` : ""}`
        });
        fetchStudents();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
        e.target.value = "";
    };

    const sendComment = async (studentId: string) => {
        const text = commentInputs[studentId]?.trim();
        if (!text) return;
        const { data, error } = await apiAddComment(studentId, text);
        if (error || !data) return;
        setCommentInputs(prev => ({ ...prev, [studentId]: "" }));
        // Mettre à jour localement
        setStudents(prev => prev.map(s =>
            s.id === studentId
                ? { ...s, comments: [...s.comments, data] }
                : s
        ));
    };

    const deleteComment = async (studentId: string, commentId: string) => {
        await apiDeleteComment(commentId);
        setStudents(prev => prev.map(s =>
            s.id === studentId
                ? { ...s, comments: s.comments.filter(c => c.id !== commentId) }
                : s
        ));
    };

    // Dérive les classes depuis les élèves
    const classes = Array.from(new Set(students.map(s => s.classCode))).sort();

    const filteredStudents = students
        .filter(s => (selectedClassId ? s.classCode === selectedClassId : true))
        .filter(s =>
            s.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.lastName.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .map(s => ({
            ...s,
            progress: TOTAL_COMPETENCIES > 0 ? Math.round((s.acquiredCount / TOTAL_COMPETENCIES) * 100) : 0,
        }));

    const avgProgress = filteredStudents.length > 0
        ? Math.round(filteredStudents.reduce((acc, s) => acc + s.progress, 0) / filteredStudents.length)
        : 0;
    const activeStudents = filteredStudents.filter(s => s.acquiredCount > 0).length;

    if (loading) return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                    <RefreshCw size={20} className="text-purple-400 animate-spin" />
                </div>
                <p className="text-purple-300/70 text-sm font-medium">Chargement...</p>
            </div>
        </div>
    );

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 font-sans pb-20">

            {/* Header */}
            <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-md border-b border-white/5">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-900/50">
                            <GraduationCap size={16} className="text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-white text-sm leading-none">Console Prof</h1>
                            <p className="text-purple-400 text-xs mt-0.5">{teacherName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Link href="/teacher/provisioning"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition-all">
                            <Zap size={13} /> Sites élèves
                        </Link>
                        <Link href="/teacher/missions"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg transition-all">
                            <Target size={13} /> Missions
                        </Link>
                        <button onClick={fetchStudents}
                            className="p-2 text-slate-500 hover:text-purple-400 transition-colors rounded-lg hover:bg-white/5" title="Actualiser">
                            <RefreshCw size={16} />
                        </button>
                        <button onClick={handleLogout}
                            className="p-2 text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-white/5" title="Déconnexion">
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-5xl mx-auto p-6 space-y-6">

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: "Élèves", value: students.length, icon: Users, gradient: "from-violet-500 to-purple-600", glow: "shadow-purple-900/50" },
                        { label: "Classes", value: classes.length, icon: BookOpen, gradient: "from-blue-500 to-cyan-600", glow: "shadow-blue-900/50" },
                        { label: "Actifs", value: activeStudents, icon: TrendingUp, gradient: "from-emerald-500 to-green-600", glow: "shadow-green-900/50" },
                        { label: "Progression", value: `${avgProgress}%`, icon: BarChart3, gradient: "from-orange-500 to-amber-600", glow: "shadow-orange-900/50" },
                    ].map(({ label, value, icon: Icon, gradient, glow }, i) => (
                        <motion.div key={label}
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                            className="relative bg-white/5 border border-white/8 rounded-2xl p-4 overflow-hidden">
                            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10`} />
                            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 shadow-lg ${glow}`}>
                                <Icon size={15} className="text-white" />
                            </div>
                            <div className="text-2xl font-black text-white">{value}</div>
                            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">{label}</div>
                        </motion.div>
                    ))}
                </div>

                {/* Import CSV */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <label htmlFor="csv-input">
                            <div
                                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={handleDrop}
                                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all flex flex-col items-center justify-center gap-3 cursor-pointer
                                    ${dragging
                                        ? "border-purple-500 bg-purple-500/10"
                                        : "border-white/10 bg-white/5 hover:border-purple-500/50 hover:bg-purple-500/5"}`}
                                style={{ minHeight: "160px" }}
                            >
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${dragging ? "bg-purple-500/20" : "bg-white/5"}`}>
                                    <Upload size={22} className={dragging ? "text-purple-400" : "text-slate-500"} />
                                </div>
                                <div>
                                    <p className="font-bold text-white text-sm">{dragging ? "Déposez ici !" : "Glissez votre CSV"}</p>
                                    <p className="text-slate-500 text-xs mt-1">ou <span className="text-purple-400 font-semibold">cliquez pour parcourir</span></p>
                                </div>
                            </div>
                        </label>
                        <input id="csv-input" type="file" accept=".csv" onChange={handleFileInput} className="hidden" />
                        <AnimatePresence>
                            {importStatus && (
                                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className={`mt-3 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium border ${importStatus.type === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                                    {importStatus.type === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                    {importStatus.message}
                                    <button onClick={() => setImportStatus(null)} className="ml-auto opacity-50 hover:opacity-100">✕</button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <div className="bg-white/5 border border-white/8 rounded-2xl p-5 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <FileSpreadsheet size={16} className="text-purple-400" />
                                <h3 className="font-bold text-white text-sm">Modèle CSV</h3>
                            </div>
                            <p className="text-slate-500 text-xs mb-3">Format attendu</p>
                            <div className="bg-black/30 rounded-xl p-3 font-mono text-xs text-slate-400 border border-white/5 leading-relaxed">
                                Nom;Prénom;CodeClasse;MotDePasse<br />
                                Dupont;Pierre;NDRC1;monmdp1<br />
                                Martin;Alice;NDRC2;monmdp2
                            </div>
                        </div>
                        <button onClick={downloadCsvTemplate}
                            className="mt-4 w-full bg-gradient-to-r from-purple-600 to-violet-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:from-purple-500 hover:to-violet-500 transition-all shadow-lg shadow-purple-900/40">
                            <Download size={14} /> Télécharger le modèle
                        </button>
                    </div>
                </div>

                {/* Filtres */}
                <div className="flex flex-col md:flex-row gap-3 justify-between items-center">
                    <div className="flex gap-2 overflow-x-auto pb-1 w-full md:w-auto">
                        <button onClick={() => setSelectedClassId(null)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${!selectedClassId ? "bg-white text-slate-900 border-white shadow-lg" : "bg-white/5 text-slate-400 border-white/10 hover:border-white/20"}`}>
                            Toutes
                        </button>
                        {classes.map(code => (
                            <button key={code} onClick={() => setSelectedClassId(code)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${selectedClassId === code ? "bg-white text-slate-900 border-white shadow-lg" : "bg-white/5 text-slate-400 border-white/10 hover:border-white/20"}`}>
                                {code}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <input type="text" placeholder="Rechercher un élève..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-purple-500/50 text-sm text-white placeholder-slate-500 transition-all" />
                    </div>
                </div>

                {/* Liste élèves */}
                {filteredStudents.length > 0 ? (
                    <div className="space-y-2">
                        {filteredStudents.map((student, i) => {
                            const isExpanded = expandedStudentId === student.id;
                            const pGradient = student.progress >= 70 ? "from-emerald-500 to-green-400" : student.progress >= 30 ? "from-blue-500 to-cyan-400" : "from-slate-600 to-slate-500";
                            const accentColor = student.progress >= 70 ? "bg-emerald-500" : student.progress >= 30 ? "bg-blue-500" : "bg-slate-600";

                            return (
                                <motion.div key={student.id}
                                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                                    className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden hover:border-white/15 transition-all">
                                    {/* Accent bar */}
                                    <div className={`h-0.5 bg-gradient-to-r ${pGradient}`} />
                                    <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}>
                                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${pGradient} flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-lg`}>
                                            {student.firstName[0]}{student.lastName[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-white text-sm truncate flex items-center gap-2 flex-wrap">
                                                {student.firstName} <span className="uppercase">{student.lastName}</span>
                                                <span className="px-2 py-0.5 bg-white/8 text-slate-400 text-[10px] font-bold rounded-md border border-white/5">{student.classCode}</span>
                                                <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-[10px] font-mono rounded-md border border-purple-500/20">{student.identifier}</span>
                                            </div>
                                            <div className="mt-2 flex items-center gap-2">
                                                <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full bg-gradient-to-r ${pGradient} transition-all duration-700`} style={{ width: `${student.progress}%` }} />
                                                </div>
                                                <span className="text-xs font-bold text-slate-400 w-8 text-right">{student.progress}%</span>
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0 text-right hidden sm:block">
                                            <a href={`/teacher/student/${student.id}`} onClick={e => e.stopPropagation()}
                                                className="text-[11px] text-purple-400 hover:text-purple-300 font-bold hover:underline block">
                                                {student.acquiredCount}/{TOTAL_COMPETENCIES} compétences
                                            </a>
                                            {student.lastActive && <div className="text-[10px] text-slate-600 mt-0.5">{new Date(student.lastActive).toLocaleDateString("fr-FR")}</div>}
                                            {student.comments.length > 0 && <div className="text-[10px] text-purple-500 font-bold mt-0.5">💬 {student.comments.length}</div>}
                                        </div>
                                        <div className="text-slate-600 flex-shrink-0">
                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                                                className="overflow-hidden border-t border-white/5">
                                                {/* Liens sites */}
                                                <div className="p-5 border-b border-white/5">
                                                    <h4 className="font-bold text-white text-xs flex items-center gap-2 mb-3 uppercase tracking-wider">
                                                        <Globe size={13} className="text-purple-400" /> Liens des sites élèves
                                                    </h4>
                                                    <div className="flex flex-col md:flex-row gap-3">
                                                        <div className="flex-1">
                                                            <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5">WordPress</label>
                                                            <input type="text" placeholder="https://wp.eleve.com"
                                                                value={wpInputs[student.id] !== undefined ? wpInputs[student.id] : (student.wpUrl || "")}
                                                                onChange={e => setWpInputs(prev => ({ ...prev, [student.id]: e.target.value }))}
                                                                className="w-full text-sm px-3 py-2 rounded-xl bg-black/20 border border-white/10 focus:outline-none focus:border-purple-500/50 text-white placeholder-slate-600" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5">PrestaShop</label>
                                                            <input type="text" placeholder="https://presta.eleve.com"
                                                                value={prestaInputs[student.id] !== undefined ? prestaInputs[student.id] : (student.prestaUrl || "")}
                                                                onChange={e => setPrestaInputs(prev => ({ ...prev, [student.id]: e.target.value }))}
                                                                className="w-full text-sm px-3 py-2 rounded-xl bg-black/20 border border-white/10 focus:outline-none focus:border-purple-500/50 text-white placeholder-slate-600" />
                                                        </div>
                                                        <div className="flex items-end">
                                                            <button onClick={() => handleUpdateUrls(student.id)}
                                                                className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-4 py-2 rounded-xl text-sm font-bold hover:bg-purple-500/30 transition-all w-full md:w-auto flex items-center justify-center gap-2">
                                                                <Save size={14} /> Enregistrer
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">
                                                    {/* Compétences */}
                                                    <div className="p-5">
                                                        <a href={`/teacher/student/${student.id}`}
                                                            className="font-bold text-purple-400 hover:text-purple-300 text-xs flex items-center gap-2 mb-3 hover:underline uppercase tracking-wider">
                                                            <BookOpen size={13} />
                                                            Compétences ({student.competencies.filter(c => c.status > 0).length}/{TOTAL_COMPETENCIES})
                                                        </a>
                                                        {student.competencies.filter(c => c.status > 0).length > 0 ? (
                                                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                                                {student.competencies.filter(c => c.status > 0).map(c => {
                                                                    const comp = ALL_COMPETENCIES.find(x => x.id === c.competencyId);
                                                                    const STATUS_LABELS: Record<number, { label: string; color: string; bg: string }> = {
                                                                        1: { label: "Novice", color: "text-slate-400", bg: "bg-white/5" },
                                                                        2: { label: "Apprenti", color: "text-blue-400", bg: "bg-blue-500/10" },
                                                                        3: { label: "Compétent", color: "text-emerald-400", bg: "bg-emerald-500/10" },
                                                                        4: { label: "Expert", color: "text-purple-400", bg: "bg-purple-500/10" }
                                                                    };
                                                                    const s = STATUS_LABELS[c.status] || STATUS_LABELS[1];
                                                                    return comp ? (
                                                                        <div key={c.competencyId} className="flex items-start gap-2 text-xs py-1.5 border-b border-white/5 last:border-0">
                                                                            {c.acquired
                                                                                ? <CheckCircle2 size={13} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                                                                : <div className="w-3.5 h-3.5 rounded-full border-2 border-white/10 mt-0.5 flex-shrink-0" />
                                                                            }
                                                                            <div className="min-w-0">
                                                                                <div className="font-medium text-slate-300 flex items-center gap-2 flex-wrap">
                                                                                    {comp.label}
                                                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${s.bg} ${s.color}`}>{s.label}</span>
                                                                                </div>
                                                                                {c.proof && (
                                                                                    c.proof.startsWith("http") ? (
                                                                                        <a href={c.proof} target="_blank" rel="noopener noreferrer"
                                                                                            className="text-purple-400 hover:text-purple-300 hover:underline truncate mt-0.5 block flex items-center gap-1">
                                                                                            <BookOpen size={10} /> Voir la preuve
                                                                                        </a>
                                                                                    ) : (
                                                                                        <div className="text-slate-600 truncate mt-0.5">{c.proof}</div>
                                                                                    )
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ) : null;
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <p className="text-slate-600 text-xs italic">Aucune compétence évaluée.</p>
                                                        )}
                                                    </div>

                                                    {/* Commentaires */}
                                                    <div className="p-5">
                                                        <h4 className="font-bold text-slate-400 text-xs flex items-center gap-2 mb-3 uppercase tracking-wider">
                                                            <MessageSquarePlus size={13} className="text-purple-400" /> Commentaires formateur
                                                        </h4>
                                                        <div className="space-y-2 max-h-36 overflow-y-auto pr-1 mb-3">
                                                            {student.comments.length > 0 ? student.comments.map((c) => (
                                                                <div key={c.id} className="flex items-start gap-2 bg-black/20 rounded-xl p-3 border border-white/5">
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-xs text-slate-300 font-medium">{c.text}</p>
                                                                        <p className="text-[10px] text-slate-600 mt-1">{c.authorName} • {new Date(c.date).toLocaleDateString("fr-FR")}</p>
                                                                    </div>
                                                                    <button onClick={() => deleteComment(student.id, c.id)}
                                                                        className="text-slate-700 hover:text-red-400 transition-colors flex-shrink-0">
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </div>
                                                            )) : (
                                                                <p className="text-slate-600 text-xs italic">Aucun commentaire.</p>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <input type="text" placeholder="Ajouter un commentaire..."
                                                                value={commentInputs[student.id] || ""}
                                                                onChange={e => setCommentInputs(prev => ({ ...prev, [student.id]: e.target.value }))}
                                                                onKeyDown={e => e.key === "Enter" && sendComment(student.id)}
                                                                className="flex-1 text-xs px-3 py-2 rounded-xl bg-black/20 border border-white/10 focus:outline-none focus:border-purple-500/50 text-white placeholder-slate-600" />
                                                            <button onClick={() => sendComment(student.id)} disabled={!commentInputs[student.id]?.trim()}
                                                                className="bg-purple-600 text-white px-3 py-2 rounded-xl hover:bg-purple-500 disabled:opacity-20 transition-all">
                                                                <Send size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mx-auto mb-4">
                            <Users size={24} className="text-slate-600" />
                        </div>
                        <p className="text-slate-500 text-sm">
                            {students.length === 0 ? "Aucun élève — glissez un fichier CSV pour commencer." : "Aucun résultat."}
                        </p>
                    </div>
                )}
            </div>
        </main>
    );
}
