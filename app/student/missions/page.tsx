"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Target, Briefcase, Loader2, Sparkles, Download, FileText, BookmarkCheck, Clock, CheckCircle2, Play, RotateCcw } from "lucide-react";
import Link from "next/link";
import { apiGetProgress, apiGetMyMissions, apiUpdateMissionStatus, apiSaveMission, type MissionAssignmentData } from "@/src/lib/api-client";
import { ALL_COMPETENCIES } from "@/src/data/competencies";
import { cn } from "@/lib/utils";
import { jsPDF } from "jspdf";

type Tab = "assigned" | "generate";

export default function MissionsPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [tab, setTab] = useState<Tab>("assigned");
    const [generating, setGenerating] = useState(false);

    // Assigned missions
    const [assignedMissions, setAssignedMissions] = useState<MissionAssignmentData[]>([]);
    const [expandedMissionId, setExpandedMissionId] = useState<string | null>(null);

    // Generate form
    const [selectedContext, setSelectedContext] = useState("");
    const [selectedPlatform, setSelectedPlatform] = useState<"WORDPRESS" | "PRESTASHOP">("WORDPRESS");
    const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3 | 4>(2);
    const [selectedCategory, setSelectedCategory] = useState<string>("Toutes");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const [missionMarkdown, setMissionMarkdown] = useState<{ text: string, ids: string[] } | null>(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [justSaved, setJustSaved] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("ndrc_token");
        if (!token) { router.push("/student/login"); return; }

        Promise.all([
            apiGetProgress(),
            apiGetMyMissions(),
        ]).then(([progressRes, missionsRes]) => {
            if (progressRes.error) { console.error("Erreur serveur", progressRes.error); }
            if (missionsRes.data) setAssignedMissions(missionsRes.data);
            setIsLoading(false);
        });
    }, [router]);

    // Derived competency data
    const platformCompetencies = ALL_COMPETENCIES.filter(c => c.platform === selectedPlatform);
    const categories = ["Toutes", ...Array.from(new Set(platformCompetencies.map(c => c.category)))];

    useEffect(() => {
        if (!categories.includes(selectedCategory)) setSelectedCategory("Toutes");
        setSelectedIds([]);
    }, [selectedPlatform]);

    const displayCompetencies = platformCompetencies.filter(c => selectedCategory === "Toutes" || c.category === selectedCategory);

    const handleGenerate = async () => {
        if (selectedIds.length === 0) { setErrorMsg("Sélectionne au moins une compétence pour ta mission."); return; }
        setGenerating(true); setErrorMsg(""); setMissionMarkdown(null);
        try {
            const token = localStorage.getItem("ndrc_token");
            const res = await fetch("/api/missions/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ competencyIds: selectedIds, context: selectedContext, level: selectedLevel }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur serveur");
            setMissionMarkdown({ text: data.mission, ids: selectedIds });
        } catch (err: any) {
            setErrorMsg(err.message || "Impossible de joindre Gemini pour générer cette mission.");
        } finally { setGenerating(false); }
    };

    const handleSaveMission = async (text: string) => {
        const title = `Mission ${selectedPlatform} Niv.${selectedLevel} — ${new Date().toLocaleDateString("fr-FR")}`;
        const { error } = await apiSaveMission({
            title, content: text, platform: selectedPlatform,
            level: selectedLevel, competencyIds: selectedIds,
        });
        if (!error) {
            setJustSaved(true);
            setTimeout(() => setJustSaved(false), 2000);
        }
    };

    const handleUpdateStatus = async (assignmentId: string, status: string) => {
        const { error } = await apiUpdateMissionStatus(assignmentId, status);
        if (!error) {
            setAssignedMissions(prev => prev.map(m =>
                m.id === assignmentId ? { ...m, status, completedAt: status === "completed" ? new Date().toISOString() : m.completedAt } : m
            ));
        }
    };

    const toggleCompetency = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    if (isLoading) return (
        <div className="min-h-screen bg-gradient-to-br from-slate-800 via-indigo-950 to-slate-900 flex items-center justify-center">
            <Loader2 className="animate-spin text-indigo-400 w-8 h-8" />
        </div>
    );

    const pendingCount = assignedMissions.filter(m => m.status === "pending").length;

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-800 via-indigo-950 to-slate-900 font-sans pb-20">
            <header className="sticky top-0 z-20 bg-slate-900/70 backdrop-blur-md border-b border-white/5">
                <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/student" className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft size={24} />
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
                            <Target size={16} className="stroke-[3]" />
                        </div>
                        <h1 className="font-extrabold text-white text-lg tracking-tight">Missions</h1>
                    </div>
                    <div className="w-8" />
                </div>
            </header>

            <div className="max-w-3xl mx-auto p-6 space-y-6">
                {/* Tabs */}
                <div className="flex bg-black/20 border border-white/5 p-1 rounded-xl">
                    <button onClick={() => setTab("assigned")}
                        className={cn("flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
                            tab === "assigned" ? "bg-white/10 text-indigo-300 shadow-sm" : "text-slate-500")}>
                        Mes missions {pendingCount > 0 && <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center">{pendingCount}</span>}
                    </button>
                    <button onClick={() => setTab("generate")}
                        className={cn("flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
                            tab === "generate" ? "bg-white/10 text-indigo-300 shadow-sm" : "text-slate-500")}>
                        <Sparkles size={14} /> Générer
                    </button>
                </div>

                {tab === "assigned" ? (
                    /* Onglet Mes Missions */
                    <div className="space-y-3">
                        {assignedMissions.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <Target size={48} className="mx-auto mb-3 opacity-30" />
                                <p className="font-bold">Aucune mission assignée</p>
                                <p className="text-sm mt-1">Ton formateur t'assignera des missions ici</p>
                            </div>
                        ) : assignedMissions.map(mission => (
                            <div key={mission.id} className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden hover:border-white/15 transition-all">
                                <div className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                                    onClick={() => setExpandedMissionId(expandedMissionId === mission.id ? null : mission.id)}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="font-bold text-white text-sm flex-1 truncate">{mission.title}</h3>
                                        <StatusBadge status={mission.status} />
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-400">
                                        <span className={cn("px-2 py-0.5 rounded-full font-bold",
                                            mission.platform === "WORDPRESS" ? "bg-blue-500/20 text-blue-400" : "bg-pink-500/20 text-pink-400"
                                        )}>{mission.platform}</span>
                                        <span>Niv.{mission.level}</span>
                                        <span className="flex items-center gap-1"><Clock size={12} /> {new Date(mission.assignedAt).toLocaleDateString("fr-FR")}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Par {mission.teacherName}</p>
                                </div>

                                {expandedMissionId === mission.id && (
                                    <div className="border-t border-white/5">
                                        <div className="p-5 prose prose-sm max-w-none prose-headings:text-white prose-headings:font-bold prose-p:text-slate-200 prose-li:text-slate-200 prose-strong:text-white prose-blockquote:text-slate-300 prose-blockquote:border-indigo-400 text-slate-200 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatMarkdown(mission.content) }} />
                                        <div className="p-4 border-t border-white/5 flex flex-wrap gap-2">
                                            {mission.status === "pending" && (
                                                <button onClick={() => handleUpdateStatus(mission.id, "in_progress")}
                                                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-amber-500/20 border border-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors">
                                                    <Play size={14} /> Commencer
                                                </button>
                                            )}
                                            {mission.status === "in_progress" && (
                                                <button onClick={() => handleUpdateStatus(mission.id, "completed")}
                                                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">
                                                    <CheckCircle2 size={14} /> Marquer terminée
                                                </button>
                                            )}
                                            {mission.status === "completed" && (
                                                <button onClick={() => handleUpdateStatus(mission.id, "in_progress")}
                                                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-slate-500/20 border border-slate-500/30 text-slate-400 hover:bg-slate-500/30 transition-colors">
                                                    <RotateCcw size={14} /> Réouvrir
                                                </button>
                                            )}
                                            <button onClick={() => downloadMissionPdf(mission.content)}
                                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors">
                                                <Download size={14} /> PDF
                                            </button>
                                            <button onClick={() => downloadMissionWord(mission.content)}
                                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors">
                                                <FileText size={14} /> Word
                                            </button>

                                            {mission.competencyIds.length > 0 && (
                                                <div className="w-full mt-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3">
                                                    <p className="text-xs font-bold text-indigo-300 uppercase mb-2">Compétences ciblées</p>
                                                    <div className="flex flex-col gap-1.5">
                                                        {mission.competencyIds.map(id => {
                                                            const c = ALL_COMPETENCIES.find(comp => comp.id === id);
                                                            if (!c) return null;
                                                            return (
                                                                <Link key={id} href={`/student/competency/${id}`}
                                                                    className="block bg-white/5 border border-white/8 p-2 rounded-lg text-xs font-medium text-slate-300 hover:border-indigo-500/40 hover:text-white transition-all">
                                                                    {c.label}
                                                                </Link>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Onglet Générer */
                    <div className="space-y-6">
                        {missionMarkdown ? (
                            <MissionResult
                                markdown={missionMarkdown.text}
                                targetIds={missionMarkdown.ids}
                                onReset={() => { setMissionMarkdown(null); setSelectedIds([]); }}
                                onSave={() => handleSaveMission(missionMarkdown.text)}
                                justSaved={justSaved}
                            />
                        ) : (
                            <>
                                <div className="bg-white/5 border border-white/8 p-6 rounded-3xl flex flex-col items-center text-center gap-3">
                                    <div className="bg-amber-500/20 border border-amber-500/30 p-4 rounded-2xl text-amber-400">
                                        <Sparkles size={32} />
                                    </div>
                                    <h2 className="text-xl font-black text-white">Créer une Mission</h2>
                                    <p className="text-slate-400 text-sm">
                                        Paramètre les objectifs de ton entraînement. L'IA générera un scénario sur mesure.
                                    </p>
                                </div>

                                <div className="space-y-6 bg-white/5 border border-white/8 p-6 rounded-3xl">
                                    {/* Plateforme */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-300 mb-2">1. Plateforme ciblée</label>
                                        <div className="flex bg-black/20 border border-white/5 p-1 rounded-xl">
                                            <button onClick={() => setSelectedPlatform("WORDPRESS")}
                                                className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-colors", selectedPlatform === "WORDPRESS" ? "bg-white/10 text-blue-400 shadow-sm" : "text-slate-500")}>WordPress</button>
                                            <button onClick={() => setSelectedPlatform("PRESTASHOP")}
                                                className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-colors", selectedPlatform === "PRESTASHOP" ? "bg-white/10 text-pink-400 shadow-sm" : "text-slate-500")}>PrestaShop</button>
                                        </div>
                                    </div>

                                    {/* Niveau */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-300 mb-2">2. Niveau d'exigence</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { val: 1, label: "Découverte" },
                                                { val: 2, label: "Construction" },
                                                { val: 3, label: "Gestion" },
                                                { val: 4, label: "Expertise" }
                                            ].map(lvl => (
                                                <button key={lvl.val} onClick={() => setSelectedLevel(lvl.val as 1 | 2 | 3 | 4)}
                                                    className={cn("p-3 rounded-xl border text-left transition-all",
                                                        selectedLevel === lvl.val ? "bg-indigo-500/20 border-indigo-500/50 ring-1 ring-indigo-500/50" : "bg-white/5 border-white/10 hover:border-white/20"
                                                    )}>
                                                    <div className="font-bold text-sm text-white">Niveau {lvl.val}</div>
                                                    <div className="text-[10px] uppercase font-bold text-slate-500">{lvl.label}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Compétences */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-sm font-bold text-slate-300">3. Compétences à travailler</label>
                                            <span className="text-xs font-bold text-slate-400 p-1 bg-white/5 border border-white/5 rounded-md">{selectedIds.length} sélectionnées</span>
                                        </div>
                                        <select className="w-full bg-black/20 border border-white/10 text-white rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500/50 mb-3"
                                            value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        </select>
                                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                            {displayCompetencies.map(comp => {
                                                const isSelected = selectedIds.includes(comp.id);
                                                return (
                                                    <div key={comp.id} onClick={() => toggleCompetency(comp.id)}
                                                        className={cn("p-3 rounded-xl border cursor-pointer transition-all flex gap-3 select-none",
                                                            isSelected ? "bg-indigo-600/30 border-indigo-500/50 text-white shadow-md" : "bg-white/5 border-white/10 hover:border-indigo-500/30 text-slate-300"
                                                        )}>
                                                        <div className={cn("w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border", isSelected ? "bg-indigo-500 border-indigo-400 text-white" : "border-white/20")}>
                                                            {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                                                        </div>
                                                        <span className="text-xs font-medium leading-relaxed">{comp.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Contexte */}
                                    <div className="pt-2 border-t border-white/5">
                                        <label className="block text-sm font-bold text-slate-300 mb-2">
                                            4. Contexte d'Entreprise <span className="text-slate-500 font-normal">(Optionnel)</span>
                                        </label>
                                        <input type="text" value={selectedContext} onChange={e => setSelectedContext(e.target.value)}
                                            placeholder="Ex: Boutique de sneakers, Agence web..."
                                            className="w-full bg-black/20 border border-white/10 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500/50" />
                                    </div>

                                    {errorMsg && <p className="text-sm text-red-400 font-bold p-3 bg-red-500/10 border border-red-500/20 rounded-xl">{errorMsg}</p>}

                                    <button onClick={handleGenerate} disabled={generating || selectedIds.length === 0}
                                        className="mt-6 w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-900/40 transition-all disabled:opacity-50 flex justify-center items-center gap-2">
                                        {generating
                                            ? <><Loader2 size={18} className="animate-spin" /> Préparation de la mission...</>
                                            : <><Target size={18} /> Générer ma Mission <Sparkles size={14} /></>}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}

function StatusBadge({ status }: { status: string }) {
    switch (status) {
        case "pending":
            return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-amber-500/20 border border-amber-500/20 text-amber-400">À faire</span>;
        case "in_progress":
            return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-blue-500/20 border border-blue-500/20 text-blue-400">En cours</span>;
        case "completed":
            return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-500/20 border border-emerald-500/20 text-emerald-400">Terminée</span>;
        default:
            return null;
    }
}

function MissionResult({ markdown, targetIds, onReset, onSave, justSaved }: {
    markdown: string; targetIds: string[]; onReset: () => void; onSave: () => void; justSaved: boolean;
}) {
    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white/5 border border-white/8 rounded-3xl overflow-hidden">
                <div className="bg-black/30 border-b border-white/5 px-6 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
                        <Briefcase size={20} />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-sm">Nouveau Message</h3>
                        <p className="text-slate-400 text-xs">Directeur de projet NDRC</p>
                    </div>
                </div>
                <div className="p-6 text-slate-200 leading-relaxed">
                    <div dangerouslySetInnerHTML={{ __html: formatMarkdown(markdown) }} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <button onClick={onSave}
                    className={cn("col-span-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm border transition-all",
                        justSaved ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10")}>
                    <BookmarkCheck size={16} /> {justSaved ? "Sauvegardé !" : "Sauvegarder"}
                </button>
                <button onClick={onReset} className="col-span-1 bg-white/5 border border-white/10 text-slate-300 font-bold py-3 rounded-xl hover:bg-white/10 transition-colors text-sm">
                    Autre Mission
                </button>
                <button onClick={() => downloadMissionPdf(markdown)}
                    className="col-span-1 bg-white/5 border border-white/10 text-slate-300 font-bold py-3 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-sm">
                    <Download size={16} /> PDF
                </button>
                <button onClick={() => downloadMissionWord(markdown)}
                    className="col-span-1 bg-white/5 border border-white/10 text-slate-300 font-bold py-3 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-sm">
                    <FileText size={16} /> Word
                </button>

                {targetIds && targetIds.length > 0 && (
                    <div className="col-span-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex flex-col gap-3">
                        <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Mission terminée ?</p>
                        <p className="text-sm text-slate-400 mb-1">N'oublie pas d'aller valider les compétences :</p>
                        <div className="flex flex-col gap-2">
                            {targetIds.map(id => {
                                const c = ALL_COMPETENCIES.find(comp => comp.id === id);
                                if (!c) return null;
                                return (
                                    <Link key={id} href={`/student/competency/${id}`}
                                        className="block w-full bg-white/5 border border-white/8 p-3 rounded-lg text-xs font-bold text-slate-300 hover:border-indigo-500/40 hover:text-white transition-all">
                                        {c.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function downloadMissionPdf(markdown: string) {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text("Mission d'Entraînement NDRC", 20, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, 20, 28);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(20, 32, 190, 32);
    const plainText = markdown.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/^#{1,3} /gm, '').replace(/^> /gm, '');
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(plainText, 170);
    doc.text(lines, 20, 42);
    doc.save(`Mission_NDRC_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function downloadMissionWord(markdown: string) {
    const htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>Mission NDRC</title>
<style>body { font-family: Calibri, sans-serif; font-size: 12pt; margin: 2cm; }</style>
</head><body>
<h1>Mission d'Entraînement NDRC</h1>
<p style="color:#64748b; font-size:10pt;">Généré le ${new Date().toLocaleDateString("fr-FR")}</p>
<hr/>${formatMarkdown(markdown)}
</body></html>`;
    const blob = new Blob([htmlContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Mission_NDRC_${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function formatMarkdown(text: string) {
    let html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em class="text-slate-200">$1</em>')
        .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-white mt-5 mb-2">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 class="text-xl font-black text-white mt-6 mb-3 pb-2 border-b border-white/10">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-black text-white mt-6 mb-4">$1</h1>')
        .replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-indigo-400 pl-4 py-2 italic bg-indigo-500/10 my-4 rounded-r-lg text-slate-300">$1</blockquote>')
        .replace(/\n\n/g, '</p><p class="mb-4 text-slate-200 leading-relaxed">')
        .replace(/\n/g, '<br />');
    html = html.replace(/<br \/>- (.*?)(?=<br \/>|$)/g, '<li class="ml-4 mb-1.5 text-slate-200">$1</li>');
    html = html.replace(/(<li[^>]*>.*?<\/li>)+/g, '<ul class="list-disc list-inside my-3 space-y-1">$&</ul>');
    return `<p class="mb-4 text-slate-200 leading-relaxed">${html}</p>`;
}
