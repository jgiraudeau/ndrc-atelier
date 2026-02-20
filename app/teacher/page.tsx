"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Users, Download, LogOut, FileSpreadsheet, Search,
    Upload, CheckCircle2, XCircle, MessageSquarePlus,
    ChevronDown, ChevronUp, Trash2, Send, BookOpen, RefreshCw,
    Globe, Save
} from "lucide-react";
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

function parseCSV(text: string): Array<{ firstName: string; lastName: string; classCode: string; pin: string }> {
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
            const pin = parts[3]?.trim() || Math.floor(1000 + Math.random() * 9000).toString();
            if (lastName && firstName && classCode) {
                result.push({ firstName, lastName, classCode, pin });
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
        const content = "Nom;Prénom;CodeClasse;PIN\nDupont;Thomas;NDRC1;1234\nMartin;Sophie;NDRC2;5678";
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
        setImportStatus({ type: "success", message: `${data.imported} élève(s) importé(s) !${data.errors.length > 0 ? ` (${data.errors.length} erreur(s))` : ""}` });
        fetchStudents(); // Recharger la liste
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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-slate-400 font-medium animate-pulse">Chargement...</div>
        </div>
    );

    return (
        <main className="min-h-screen bg-slate-50 font-sans pb-20">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <h1 className="font-bold text-slate-700 text-lg flex items-center gap-2">
                        <Users className="text-purple-600" size={22} />
                        Console — <span className="text-purple-600">{teacherName}</span>
                    </h1>
                    <div className="flex items-center gap-2">
                        <button onClick={fetchStudents} className="p-2 text-slate-400 hover:text-purple-600 transition-colors rounded-lg" title="Actualiser">
                            <RefreshCw size={18} />
                        </button>
                        <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 transition-colors rounded-lg" title="Déconnexion">
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-5xl mx-auto p-6 space-y-8">

                {/* Import CSV */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                        <label htmlFor="csv-input">
                            <div
                                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={handleDrop}
                                className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all flex flex-col items-center justify-center gap-3 cursor-pointer
                                    ${dragging ? "border-purple-500 bg-purple-50" : "border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50/30"}`}
                                style={{ minHeight: "180px" }}
                            >
                                <Upload size={36} className={dragging ? "text-purple-500" : "text-slate-300"} />
                                <div>
                                    <p className="font-bold text-slate-700">{dragging ? "Déposez ici !" : "Glissez votre CSV"}</p>
                                    <p className="text-slate-400 text-sm mt-1">ou <span className="text-purple-600 font-semibold underline">cliquez pour parcourir</span></p>
                                </div>
                            </div>
                        </label>
                        <input id="csv-input" type="file" accept=".csv" onChange={handleFileInput} className="hidden" />
                        {importStatus && (
                            <div className={`mt-3 px-4 py-3 rounded-xl flex items-center gap-3 font-medium text-sm ${importStatus.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                                {importStatus.type === "success" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                                {importStatus.message}
                                <button onClick={() => setImportStatus(null)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
                            </div>
                        )}
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col justify-between">
                        <div>
                            <h3 className="font-bold text-slate-700 mb-1 flex items-center gap-2">
                                <FileSpreadsheet size={18} className="text-purple-500" /> Modèle CSV
                            </h3>
                            <p className="text-slate-400 text-xs mb-4">Format attendu</p>
                            <div className="bg-slate-50 rounded-lg p-3 font-mono text-xs text-slate-600 border border-slate-100 leading-relaxed">
                                Nom;Prénom;CodeClasse;PIN<br />
                                Dupont;Pierre;NDRC1;1234<br />
                                Martin;Alice;NDRC2;5678
                            </div>
                        </div>
                        <button onClick={downloadCsvTemplate} className="mt-4 w-full bg-purple-600 text-white px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors">
                            <Download size={16} /> Télécharger le modèle
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "Élèves", value: students.length, color: "text-slate-800" },
                        { label: "Classes", value: classes.length, color: "text-purple-600" },
                        { label: "Actifs", value: activeStudents, color: "text-green-600" },
                        { label: "Moy. Classe", value: `${avgProgress}%`, color: "text-blue-600" },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
                            <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{label}</div>
                            <div className={`text-3xl font-black ${color}`}>{value}</div>
                        </div>
                    ))}
                </div>

                {/* Filtres */}
                <div className="flex flex-col md:flex-row gap-3 justify-between items-center">
                    <div className="flex gap-2 overflow-x-auto pb-1 w-full md:w-auto">
                        <button onClick={() => setSelectedClassId(null)} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${!selectedClassId ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>
                            Toutes
                        </button>
                        {classes.map(code => (
                            <button key={code} onClick={() => setSelectedClassId(code)} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${selectedClassId === code ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>
                                {code}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-purple-500 text-sm transition-colors" />
                    </div>
                </div>

                {/* Liste élèves */}
                {filteredStudents.length > 0 ? (
                    <div className="space-y-3">
                        {filteredStudents.map(student => {
                            const isExpanded = expandedStudentId === student.id;
                            const pColor = student.progress >= 70 ? "bg-green-500" : student.progress >= 30 ? "bg-blue-500" : "bg-slate-300";

                            return (
                                <div key={student.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50/50 transition-colors" onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}>
                                        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 font-black flex items-center justify-center text-sm flex-shrink-0">
                                            {student.firstName[0]}{student.lastName[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-800 truncate">
                                                {student.firstName} <span className="uppercase">{student.lastName}</span>
                                                <span className="ml-2 inline-block px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-bold rounded-md">{student.classCode}</span>
                                            </div>
                                            <div className="mt-1.5"><ProgressBar value={student.progress} color={pColor} /></div>
                                        </div>
                                        <div className="flex-shrink-0 text-right hidden sm:block">
                                            <div className="text-xs text-slate-400">{student.acquiredCount}/{TOTAL_COMPETENCIES} compétences</div>
                                            {student.lastActive && <div className="text-xs text-slate-300 mt-0.5">{new Date(student.lastActive).toLocaleDateString("fr-FR")}</div>}
                                            {student.comments.length > 0 && <div className="text-xs text-purple-500 font-bold mt-0.5">💬 {student.comments.length}</div>}
                                        </div>
                                        <div className="text-slate-400 flex-shrink-0">{isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</div>
                                    </div>

                                    {isExpanded && (
                                        <div className="border-t border-slate-100 bg-slate-50/50">
                                            <div className="p-5 border-b border-slate-100">
                                                <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-3">
                                                    <Globe size={15} className="text-purple-500" />
                                                    Liens des sites élèves
                                                </h4>
                                                <div className="flex flex-col md:flex-row gap-3">
                                                    <div className="flex-1">
                                                        <label className="block text-xs text-slate-500 font-medium mb-1">WordPress</label>
                                                        <input
                                                            type="text"
                                                            placeholder="https://wp.eleve.com"
                                                            value={wpInputs[student.id] !== undefined ? wpInputs[student.id] : (student.wpUrl || "")}
                                                            onChange={e => setWpInputs(prev => ({ ...prev, [student.id]: e.target.value }))}
                                                            className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-purple-400 bg-white"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="block text-xs text-slate-500 font-medium mb-1">PrestaShop</label>
                                                        <input
                                                            type="text"
                                                            placeholder="https://presta.eleve.com"
                                                            value={prestaInputs[student.id] !== undefined ? prestaInputs[student.id] : (student.prestaUrl || "")}
                                                            onChange={e => setPrestaInputs(prev => ({ ...prev, [student.id]: e.target.value }))}
                                                            className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-purple-400 bg-white"
                                                        />
                                                    </div>
                                                    <div className="flex items-end">
                                                        <button onClick={() => handleUpdateUrls(student.id)} className="bg-purple-100 text-purple-700 px-4 py-2 rounded-xl text-sm justify-center font-bold hover:bg-purple-200 transition-colors w-full md:w-auto flex items-center gap-2">
                                                            <Save size={16} /> Enregistrer
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                                {/* Compétences */}
                                                <div className="p-5">
                                                    <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-3">
                                                        <BookOpen size={15} className="text-purple-500" />
                                                        Compétences validées ({student.acquiredCount})
                                                    </h4>
                                                    {student.competencies.filter(c => c.acquired).length > 0 ? (
                                                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                                            {student.competencies.filter(c => c.acquired).map(c => {
                                                                const comp = ALL_COMPETENCIES.find(x => x.id === c.competencyId);
                                                                const STATUS_LABELS: Record<number, { label: string; color: string; bg: string }> = {
                                                                    1: { label: "Novice", color: "text-slate-600", bg: "bg-slate-100" },
                                                                    2: { label: "Apprenti", color: "text-blue-600", bg: "bg-blue-50" },
                                                                    3: { label: "Compétent", color: "text-green-600", bg: "bg-green-50" },
                                                                    4: { label: "Expert", color: "text-purple-600", bg: "bg-purple-50" }
                                                                };
                                                                const s = STATUS_LABELS[c.status] || STATUS_LABELS[3];

                                                                return comp ? (
                                                                    <div key={c.competencyId} className="flex items-start gap-2 text-xs py-1.5 border-b border-slate-100 last:border-0">
                                                                        <CheckCircle2 size={13} className="text-green-500 mt-0.5 flex-shrink-0" />
                                                                        <div className="min-w-0">
                                                                            <div className="font-medium text-slate-700 flex items-center gap-2">
                                                                                {comp.label}
                                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${s.bg} ${s.color}`}>
                                                                                    {s.label}
                                                                                </span>
                                                                            </div>
                                                                            {c.proof && (
                                                                                c.proof.startsWith("http") ? (
                                                                                    <a href={c.proof} target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:text-purple-700 hover:underline truncate mt-0.5 block">
                                                                                        <span className="flex items-center gap-1"><BookOpen size={10} /> Voir la preuve jointe</span>
                                                                                    </a>
                                                                                ) : (
                                                                                    <div className="text-slate-400 truncate mt-0.5">{c.proof}</div>
                                                                                )
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ) : null;
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <p className="text-slate-400 text-xs italic">Aucune compétence validée.</p>
                                                    )}
                                                </div>

                                                {/* Commentaires */}
                                                <div className="p-5">
                                                    <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-3">
                                                        <MessageSquarePlus size={15} className="text-purple-500" />
                                                        Commentaires formateur
                                                    </h4>
                                                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1 mb-3">
                                                        {student.comments.length > 0 ? student.comments.map((c) => (
                                                            <div key={c.id} className="flex items-start gap-2 bg-white rounded-xl p-3 border border-slate-100">
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-xs text-slate-700 font-medium">{c.text}</p>
                                                                    <p className="text-[10px] text-slate-400 mt-1">{c.authorName} • {new Date(c.date).toLocaleDateString("fr-FR")}</p>
                                                                </div>
                                                                <button onClick={() => deleteComment(student.id, c.id)} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        )) : (
                                                            <p className="text-slate-400 text-xs italic">Aucun commentaire.</p>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Ajouter un commentaire..."
                                                            value={commentInputs[student.id] || ""}
                                                            onChange={e => setCommentInputs(prev => ({ ...prev, [student.id]: e.target.value }))}
                                                            onKeyDown={e => e.key === "Enter" && sendComment(student.id)}
                                                            className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-purple-400 bg-white"
                                                        />
                                                        <button onClick={() => sendComment(student.id)} disabled={!commentInputs[student.id]?.trim()} className="bg-purple-600 text-white px-3 py-2 rounded-xl hover:bg-purple-700 disabled:opacity-30 transition-colors">
                                                            <Send size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-16 text-slate-400 text-sm">
                        {students.length === 0 ? "Aucun élève — glissez un fichier CSV pour commencer." : "Aucun résultat."}
                    </div>
                )}
            </div>
        </main>
    );
}
