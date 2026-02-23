"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, Target, Sparkles, Loader2, Trash2, Users, Send,
    ChevronDown, ChevronUp, Download, FileText, BookmarkCheck
} from "lucide-react";
import {
    apiGetStudents, apiGetMissions, apiSaveMission, apiDeleteMission, apiAssignMission,
    type MissionData, type StudentWithProgress
} from "@/src/lib/api-client";
import { ALL_COMPETENCIES } from "@/src/data/competencies";
import { cn } from "@/lib/utils";
import { jsPDF } from "jspdf";

type Tab = "generate" | "list";

export default function TeacherMissionsPage() {
    const router = useRouter();
    const [tab, setTab] = useState<Tab>("list");
    const [missions, setMissions] = useState<MissionData[]>([]);
    const [students, setStudents] = useState<StudentWithProgress[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Generation state
    const [selectedPlatform, setSelectedPlatform] = useState<"WORDPRESS" | "PRESTASHOP">("WORDPRESS");
    const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3 | 4>(2);
    const [selectedCategory, setSelectedCategory] = useState("Toutes");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [context, setContext] = useState("");
    const [generating, setGenerating] = useState(false);
    const [generatedMission, setGeneratedMission] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState("");

    // Mission list state
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [assignMode, setAssignMode] = useState<"class" | "students">("class");
    const [assignTarget, setAssignTarget] = useState<string>("");
    const [assignStudentIds, setAssignStudentIds] = useState<string[]>([]);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        const [missionsRes, studentsRes] = await Promise.all([
            apiGetMissions(),
            apiGetStudents(),
        ]);
        if (missionsRes.error || studentsRes.error) {
            router.push("/teacher/login");
            return;
        }
        setMissions(missionsRes.data || []);
        setStudents(studentsRes.data || []);
        setIsLoading(false);
    }, [router]);

    useEffect(() => {
        const token = localStorage.getItem("ndrc_token");
        if (!token) { router.push("/teacher/login"); return; }
        loadData();
    }, [router, loadData]);

    // Derived competency data
    const platformCompetencies = ALL_COMPETENCIES.filter(c => c.platform === selectedPlatform);
    const categories = ["Toutes", ...Array.from(new Set(platformCompetencies.map(c => c.category)))];

    useEffect(() => {
        if (!categories.includes(selectedCategory)) setSelectedCategory("Toutes");
        setSelectedIds([]);
    }, [selectedPlatform]);

    const displayCompetencies = platformCompetencies.filter(c => selectedCategory === "Toutes" || c.category === selectedCategory);

    // Classes uniques
    const classMap = new Map<string, string>();
    students.forEach(s => { if (!classMap.has(s.classCode)) classMap.set(s.classCode, s.className); });
    const classes = Array.from(classMap.entries()).map(([code, name]) => ({ code, name }));

    const handleGenerate = async () => {
        if (selectedIds.length === 0) { setErrorMsg("Sélectionne au moins une compétence."); return; }
        setGenerating(true); setErrorMsg(""); setGeneratedMission(null);
        try {
            const token = localStorage.getItem("ndrc_token");
            const res = await fetch("/api/missions/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ competencyIds: selectedIds, context, level: selectedLevel }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur serveur");
            setGeneratedMission(data.mission);
        } catch (err: any) {
            setErrorMsg(err.message || "Erreur de génération");
        } finally { setGenerating(false); }
    };

    const handleSave = async () => {
        if (!generatedMission) return;
        const title = `Mission ${selectedPlatform} Niv.${selectedLevel} — ${new Date().toLocaleDateString("fr-FR")}`;
        const { error } = await apiSaveMission({
            title, content: generatedMission, platform: selectedPlatform,
            level: selectedLevel, competencyIds: selectedIds,
        });
        if (!error) {
            setGeneratedMission(null); setSelectedIds([]); setContext("");
            setTab("list");
            loadData();
        }
    };

    const handleDelete = async (id: string) => {
        await apiDeleteMission(id);
        setConfirmDeleteId(null);
        loadData();
    };

    const handleAssign = async (missionId: string) => {
        if (assignMode === "class" && assignTarget) {
            const classStudents = students.filter(s => s.classCode === assignTarget);
            const { data, error } = await apiAssignMission(missionId, { studentIds: classStudents.map(s => s.id) });
            if (!error && data) alert(`${data.assigned} étudiant(s) assigné(s)`);
        } else if (assignMode === "students" && assignStudentIds.length > 0) {
            const { data, error } = await apiAssignMission(missionId, { studentIds: assignStudentIds });
            if (!error && data) alert(`${data.assigned} étudiant(s) assigné(s)`);
        }
        setAssigningId(null); setAssignTarget(""); setAssignStudentIds([]);
        loadData();
    };

    if (isLoading) return (
        <main className="min-h-screen bg-slate-50 flex items-center justify-center">
            <Loader2 className="animate-spin text-purple-500 w-8 h-8" />
        </main>
    );

    return (
        <main className="min-h-screen bg-slate-50 font-sans pb-20">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/teacher" className="p-2 -ml-2 text-slate-400 hover:text-slate-600">
                            <ArrowLeft size={22} />
                        </Link>
                        <div className="flex items-center gap-2">
                            <Target className="text-purple-600" size={20} />
                            <h1 className="font-bold text-slate-700 text-lg">Missions</h1>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-4xl mx-auto p-6">
                {/* Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                    <button
                        onClick={() => setTab("list")}
                        className={cn("flex-1 py-2.5 text-sm font-bold rounded-lg transition-all", tab === "list" ? "bg-white text-purple-700 shadow-sm" : "text-slate-500")}
                    >
                        Mes missions ({missions.length})
                    </button>
                    <button
                        onClick={() => setTab("generate")}
                        className={cn("flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5", tab === "generate" ? "bg-white text-purple-700 shadow-sm" : "text-slate-500")}
                    >
                        <Sparkles size={14} /> Générer
                    </button>
                </div>

                {tab === "generate" ? (
                    <div className="space-y-6">
                        {generatedMission ? (
                            <div className="space-y-4">
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="bg-slate-900 px-6 py-4 flex items-center gap-3">
                                        <Target size={20} className="text-white" />
                                        <h3 className="text-white font-bold text-sm">Mission générée</h3>
                                    </div>
                                    <div className="p-6 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: formatMarkdown(generatedMission) }} />
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={handleSave} className="flex-1 bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 transition-colors flex items-center justify-center gap-2">
                                        <BookmarkCheck size={18} /> Sauvegarder
                                    </button>
                                    <button onClick={() => setGeneratedMission(null)} className="px-6 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors">
                                        Annuler
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                {/* Plateforme */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">1. Plateforme</label>
                                    <div className="flex bg-slate-100 p-1 rounded-xl">
                                        <button onClick={() => setSelectedPlatform("WORDPRESS")} className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-colors", selectedPlatform === "WORDPRESS" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500")}>WordPress</button>
                                        <button onClick={() => setSelectedPlatform("PRESTASHOP")} className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-colors", selectedPlatform === "PRESTASHOP" ? "bg-white text-pink-600 shadow-sm" : "text-slate-500")}>PrestaShop</button>
                                    </div>
                                </div>

                                {/* Niveau */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">2. Niveau</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { val: 1, label: "Découverte" },
                                            { val: 2, label: "Construction" },
                                            { val: 3, label: "Gestion" },
                                            { val: 4, label: "Expertise" },
                                        ].map(lvl => (
                                            <button key={lvl.val} onClick={() => setSelectedLevel(lvl.val as 1|2|3|4)}
                                                className={cn("p-3 rounded-xl border text-center transition-all",
                                                    selectedLevel === lvl.val ? "bg-purple-50 border-purple-400 ring-1 ring-purple-400" : "bg-white border-slate-200 hover:border-slate-300"
                                                )}>
                                                <div className="font-bold text-sm">{lvl.val}</div>
                                                <div className="text-[10px] text-slate-400 uppercase font-bold">{lvl.label}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Compétences */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-bold text-slate-700">3. Compétences</label>
                                        <span className="text-xs font-bold text-slate-400 p-1 bg-slate-100 rounded-md">{selectedIds.length} sélectionnées</span>
                                    </div>
                                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none mb-3"
                                        value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                        {displayCompetencies.map(comp => {
                                            const sel = selectedIds.includes(comp.id);
                                            return (
                                                <div key={comp.id} onClick={() => setSelectedIds(prev => sel ? prev.filter(i => i !== comp.id) : [...prev, comp.id])}
                                                    className={cn("p-3 rounded-xl border cursor-pointer transition-all flex gap-3 select-none",
                                                        sel ? "bg-purple-600 border-purple-600 text-white shadow-md" : "bg-white border-slate-200 hover:border-purple-300 text-slate-700"
                                                    )}>
                                                    <div className={cn("w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border", sel ? "bg-white border-white text-purple-600" : "border-slate-300")}>
                                                        {sel && <div className="w-2.5 h-2.5 rounded-full bg-purple-600" />}
                                                    </div>
                                                    <span className="text-xs font-medium leading-relaxed">{comp.label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Contexte */}
                                <div>
                                    <label className="text-sm font-bold text-slate-700 mb-2 block">4. Contexte <span className="text-slate-400 font-normal">(optionnel)</span></label>
                                    <input type="text" value={context} onChange={e => setContext(e.target.value)}
                                        placeholder="Ex: Boutique de sneakers, Agence web..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-400" />
                                </div>

                                {errorMsg && <p className="text-sm text-red-500 font-bold p-3 bg-red-50 rounded-xl">{errorMsg}</p>}

                                <button onClick={handleGenerate} disabled={generating || selectedIds.length === 0}
                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 flex justify-center items-center gap-2">
                                    {generating ? <><Loader2 size={18} className="animate-spin" /> Génération en cours...</> : <><Sparkles size={18} /> Générer la mission</>}
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Liste des missions */
                    <div className="space-y-3">
                        {missions.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <Target size={48} className="mx-auto mb-3 opacity-30" />
                                <p className="font-bold">Aucune mission sauvegardée</p>
                                <p className="text-sm mt-1">Génère ta première mission dans l'onglet "Générer"</p>
                            </div>
                        ) : missions.map(mission => (
                            <div key={mission.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                {/* Header */}
                                <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                                    onClick={() => setExpandedId(expandedId === mission.id ? null : mission.id)}>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-slate-800 text-sm truncate">{mission.title}</h3>
                                            <span className={cn("px-2 py-0.5 text-[10px] font-bold uppercase rounded-full",
                                                mission.platform === "WORDPRESS" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"
                                            )}>{mission.platform}</span>
                                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-slate-100 text-slate-500">Niv.{mission.level}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-400">
                                            <span>{new Date(mission.createdAt).toLocaleDateString("fr-FR")}</span>
                                            <span className="flex items-center gap-1"><Users size={12} /> {mission._count?.assignments || 0} assignée(s)</span>
                                        </div>
                                    </div>
                                    {expandedId === mission.id ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                                </div>

                                {/* Expanded content */}
                                {expandedId === mission.id && (
                                    <div className="border-t border-slate-100">
                                        <div className="p-4 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: formatMarkdown(mission.content) }} />

                                        {/* Actions */}
                                        <div className="p-4 border-t border-slate-100 flex flex-wrap gap-2">
                                            <button onClick={() => { setAssigningId(assigningId === mission.id ? null : mission.id); setAssignMode("class"); setAssignTarget(""); setAssignStudentIds([]); }}
                                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors">
                                                <Send size={14} /> Assigner
                                            </button>
                                            {confirmDeleteId === mission.id ? (
                                                <div className="flex gap-1">
                                                    <button onClick={() => handleDelete(mission.id)} className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700">Confirmer</button>
                                                    <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-100 text-slate-600">Annuler</button>
                                                </div>
                                            ) : (
                                                <button onClick={() => setConfirmDeleteId(mission.id)}
                                                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                                                    <Trash2 size={14} /> Supprimer
                                                </button>
                                            )}
                                        </div>

                                        {/* Assign panel */}
                                        {assigningId === mission.id && (
                                            <div className="p-4 border-t border-slate-100 bg-purple-50/50">
                                                <div className="flex bg-white p-1 rounded-lg mb-3 w-fit">
                                                    <button onClick={() => setAssignMode("class")} className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-colors", assignMode === "class" ? "bg-purple-100 text-purple-700" : "text-slate-500")}>Par classe</button>
                                                    <button onClick={() => setAssignMode("students")} className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-colors", assignMode === "students" ? "bg-purple-100 text-purple-700" : "text-slate-500")}>Par étudiant</button>
                                                </div>

                                                {assignMode === "class" ? (
                                                    <div className="space-y-2">
                                                        <select value={assignTarget} onChange={e => setAssignTarget(e.target.value)}
                                                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold outline-none">
                                                            <option value="">Choisir une classe...</option>
                                                            {classes.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                                                        </select>
                                                        {assignTarget && (
                                                            <p className="text-xs text-slate-500">{students.filter(s => s.classCode === assignTarget).length} étudiant(s) dans cette classe</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1 max-h-40 overflow-y-auto">
                                                        {students.map(s => (
                                                            <label key={s.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer">
                                                                <input type="checkbox" checked={assignStudentIds.includes(s.id)}
                                                                    onChange={() => setAssignStudentIds(prev => prev.includes(s.id) ? prev.filter(i => i !== s.id) : [...prev, s.id])}
                                                                    className="rounded border-slate-300" />
                                                                <span className="text-sm font-medium text-slate-700">{s.firstName} {s.lastName}</span>
                                                                <span className="text-xs text-slate-400">{s.classCode}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}

                                                <button onClick={() => handleAssign(mission.id)}
                                                    disabled={(assignMode === "class" && !assignTarget) || (assignMode === "students" && assignStudentIds.length === 0)}
                                                    className="mt-3 bg-purple-600 text-white font-bold py-2 px-6 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors">
                                                    Assigner la mission
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}

function formatMarkdown(text: string) {
    let html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 class="text-xl font-black mt-6 mb-3">$1</h2>')
        .replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-purple-200 pl-4 py-1 italic bg-purple-50/50 my-4 text-slate-600">$1</blockquote>')
        .replace(/\n\n/g, '</p><p class="mb-4">')
        .replace(/\n/g, '<br />');
    html = html.replace(/<br \/>- (.*?)(?=<br \/>|$)/g, '<li class="ml-4 mb-2">$1</li>');
    html = html.replace(/(<li.*<\/li>)/, '<ul class="list-disc my-4">$1</ul>');
    return `<p>${html}</p>`;
}
