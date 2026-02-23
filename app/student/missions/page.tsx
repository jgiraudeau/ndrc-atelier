"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Target, Briefcase, Loader2, Sparkles, Download, FileText, LayoutDashboard, BookmarkCheck } from "lucide-react";
import Link from "next/link";
import { apiGetProgress, type ProgressRecord } from "@/src/lib/api-client";
import { ALL_COMPETENCIES } from "@/src/data/competencies";
import { cn } from "@/lib/utils";
import { jsPDF } from "jspdf";

const SAVED_MISSION_KEY = "ndrc_saved_mission";

export default function MissionsPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    const [selectedContext, setSelectedContext] = useState("");
    const [selectedPlatform, setSelectedPlatform] = useState<"WORDPRESS" | "PRESTASHOP" | "ALL">("WORDPRESS");
    const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3 | 4>(2);
    const [selectedCategory, setSelectedCategory] = useState<string>("Toutes");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const [missionMarkdown, setMissionMarkdown] = useState<{ text: string, ids: string[] } | null>(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [savedMission, setSavedMission] = useState<string | null>(null);
    const [justSaved, setJustSaved] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("ndrc_token");
        if (!token) { router.push("/student/login"); return; }

        const saved = localStorage.getItem(SAVED_MISSION_KEY);
        if (saved) setSavedMission(saved);

        apiGetProgress().then(({ data, error }) => {
            setIsLoading(false);
            if (error) { console.error("Erreur serveur", error); return; }
        });
    }, [router]);

    const handleGenerate = async () => {
        if (selectedIds.length === 0) {
            setErrorMsg("Sélectionne au moins une compétence pour ta mission.");
            return;
        }

        setGenerating(true);
        setErrorMsg("");
        setMissionMarkdown(null);

        try {
            const token = localStorage.getItem("ndrc_token");
            const res = await fetch("/api/missions/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({
                    competencyIds: selectedIds,
                    context: selectedContext,
                    level: selectedLevel
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur serveur");
            setMissionMarkdown({ text: data.mission, ids: selectedIds });
        } catch (err: any) {
            setErrorMsg(err.message || "Impossible de joindre Gemini pour générer cette mission.");
        } finally {
            setGenerating(false);
        }
    };

    const handleSaveMission = (text: string) => {
        localStorage.setItem(SAVED_MISSION_KEY, JSON.stringify({ text, ids: selectedIds }));
        setSavedMission(text);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
    };

    // Derived data for the form (must be before hooks that depend on them)
    const platformCompetencies = ALL_COMPETENCIES.filter(c => selectedPlatform === "ALL" || c.platform === selectedPlatform);
    const categories = ["Toutes", ...Array.from(new Set(platformCompetencies.map(c => c.category)))];

    // Auto-select "Toutes" if current category doesn't exist in new platform
    useEffect(() => {
        if (!categories.includes(selectedCategory)) {
            setSelectedCategory("Toutes");
        }
        setSelectedIds([]); // Reset selection on platform change
    }, [selectedPlatform]);

    const displayCompetencies = platformCompetencies.filter(c => selectedCategory === "Toutes" || c.category === selectedCategory);

    if (isLoading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <Loader2 className="animate-spin text-indigo-500 w-8 h-8" />
        </div>
    );

    const toggleCompetency = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    return (
        <main className="min-h-screen bg-slate-50 font-sans pb-20">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/student" className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors">
                        <ArrowLeft size={24} />
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-indigo-100 text-indigo-600">
                            <Target size={16} className="stroke-[3]" />
                        </div>
                        <h1 className="font-extrabold text-slate-700 text-lg tracking-tight">
                            Missions d'entraînement
                        </h1>
                    </div>
                    <div className="w-8" />
                </div>
            </header>

            <div className="max-w-md mx-auto p-6 space-y-6">
                {missionMarkdown ? (
                    <MissionResult
                        markdown={missionMarkdown.text}
                        targetIds={missionMarkdown.ids}
                        onReset={() => {
                            setMissionMarkdown(null);
                            setSelectedIds([]);
                        }}
                        onSave={() => handleSaveMission(missionMarkdown.text)}
                        justSaved={justSaved}
                    />
                ) : (
                    <>
                        {savedMission && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                                <BookmarkCheck size={20} className="text-amber-600 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-amber-800">Mission sauvegardée</p>
                                    <p className="text-xs text-amber-600 truncate">
                                        {savedMission.startsWith("{") ? JSON.parse(savedMission).text.slice(0, 80) : savedMission.slice(0, 80)}...
                                    </p>
                                </div>
                                <button onClick={() => {
                                    if (savedMission.startsWith("{")) {
                                        const parsed = JSON.parse(savedMission);
                                        setMissionMarkdown({ text: parsed.text, ids: parsed.ids || [] });
                                    } else {
                                        setMissionMarkdown({ text: savedMission, ids: [] });
                                    }
                                }} className="text-xs font-bold text-amber-700 underline whitespace-nowrap ml-2">Revoir</button>
                            </div>
                        )}

                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center gap-3">
                            <div className="bg-amber-100 p-4 rounded-full text-amber-600">
                                <Sparkles size={32} />
                            </div>
                            <h2 className="text-xl font-black text-slate-800">Créer une Mission</h2>
                            <p className="text-slate-500 text-sm">
                                Paramètre les objectifs de ton entraînement. L'IA générera un scénario sur mesure.
                            </p>
                        </div>

                        <div className="space-y-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            {/* Plateforme */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">1. Plateforme ciblée</label>
                                <div className="flex bg-slate-100 p-1 rounded-xl">
                                    <button
                                        onClick={() => setSelectedPlatform("WORDPRESS")}
                                        className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-colors", selectedPlatform === "WORDPRESS" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                                    >WordPress</button>
                                    <button
                                        onClick={() => setSelectedPlatform("PRESTASHOP")}
                                        className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-colors", selectedPlatform === "PRESTASHOP" ? "bg-white text-pink-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                                    >PrestaShop</button>
                                </div>
                            </div>

                            {/* Niveau */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">2. Niveau d'exigence</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { val: 1, label: "Découverte", desc: "Très très guidé" },
                                        { val: 2, label: "Construction", desc: "Cadre structuré" },
                                        { val: 3, label: "Gestion", desc: "Objectif métier" },
                                        { val: 4, label: "Expertise", desc: "Scénario complexe" }
                                    ].map(lvl => (
                                        <button
                                            key={lvl.val}
                                            onClick={() => setSelectedLevel(lvl.val as 1 | 2 | 3 | 4)}
                                            className={cn(
                                                "p-3 rounded-xl border text-left transition-all relative overflow-hidden",
                                                selectedLevel === lvl.val
                                                    ? "bg-indigo-50 border-indigo-400 text-indigo-900 shadow-sm ring-1 ring-indigo-400"
                                                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                            )}
                                        >
                                            <div className="font-bold text-sm mb-1 text-slate-800">Niveau {lvl.val}</div>
                                            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{lvl.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Compétences */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-bold text-slate-700">3. Compétences à travailler</label>
                                    <span className="text-xs font-bold text-slate-400 p-1 bg-slate-100 rounded-md">{selectedIds.length} sélectionnées</span>
                                </div>

                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all outline-none text-slate-700 mb-3"
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                >
                                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>

                                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                    {displayCompetencies.map(comp => {
                                        const isSelected = selectedIds.includes(comp.id);
                                        return (
                                            <div
                                                key={comp.id}
                                                onClick={() => toggleCompetency(comp.id)}
                                                className={cn(
                                                    "p-3 rounded-xl border cursor-pointer transition-all flex gap-3 select-none",
                                                    isSelected ? "bg-indigo-600 border-indigo-600 text-white shadow-md" : "bg-white border-slate-200 hover:border-indigo-300 text-slate-700 hover:bg-slate-50"
                                                )}
                                            >
                                                <div className={cn("w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border", isSelected ? "bg-white border-white text-indigo-600" : "border-slate-300")}>
                                                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
                                                </div>
                                                <span className="text-xs font-medium leading-relaxed">{comp.label}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Contexte */}
                            <div className="pt-2 border-t border-slate-100">
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    4. Contexte d'Entreprise <span className="text-slate-400 font-normal">(Optionnel)</span>
                                </label>
                                <input
                                    type="text"
                                    value={selectedContext}
                                    onChange={(e) => setSelectedContext(e.target.value)}
                                    placeholder="Ex: Boutique de sneakers, Agence web..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors"
                                />
                            </div>

                            {errorMsg && (
                                <p className="text-sm text-red-500 font-bold p-3 bg-red-50 rounded-xl border border-red-100">{errorMsg}</p>
                            )}

                            <button
                                onClick={handleGenerate}
                                disabled={generating || selectedIds.length === 0}
                                className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                {generating
                                    ? <><Loader2 size={18} className="animate-spin" /> Préparation de la mission...</>
                                    : <><Target size={18} /> Générer ma Mission <Sparkles size={14} /></>
                                }
                            </button>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}

function MissionResult({ markdown, targetIds, onReset, onSave, justSaved }: {
    markdown: string;
    targetIds: string[];
    onReset: () => void;
    onSave: () => void;
    justSaved: boolean;
}) {
    const downloadPdf = () => {
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

        const plainText = markdown
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/^#{1,3} /gm, '')
            .replace(/^> /gm, '');

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 41, 59);

        const lines = doc.splitTextToSize(plainText, 170);
        doc.text(lines, 20, 42);

        doc.save(`Mission_NDRC_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    const downloadWord = () => {
        const htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>Mission NDRC</title>
<style>body { font-family: Calibri, sans-serif; font-size: 12pt; margin: 2cm; }</style>
</head>
<body>
<h1>Mission d'Entraînement NDRC</h1>
<p style="color:#64748b; font-size:10pt;">Généré le ${new Date().toLocaleDateString("fr-FR")}</p>
<hr/>
${formatMarkdown(markdown)}
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
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-3xl overflow-hidden shadow-lg border border-slate-200">
                <div className="bg-slate-900 px-6 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
                        <Briefcase size={20} />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-sm">Nouveau Message</h3>
                        <p className="text-slate-400 text-xs">Directeur de projet NDRC</p>
                    </div>
                </div>

                <div className="p-6 prose prose-sm max-w-none prose-headings:text-slate-800 prose-a:text-indigo-600 prose-li:text-slate-600">
                    <div dangerouslySetInnerHTML={{ __html: formatMarkdown(markdown) }} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={onSave}
                    className={cn(
                        "col-span-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm border-2 transition-all",
                        justSaved ? "bg-green-50 border-green-300 text-green-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                >
                    <BookmarkCheck size={16} /> {justSaved ? "Sauvegardé !" : "Sauvegarder"}
                </button>

                <button
                    onClick={onReset}
                    className="col-span-1 bg-white border-2 border-slate-200 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-50 transition-colors text-sm"
                >
                    Autre Mission
                </button>

                <button
                    onClick={downloadPdf}
                    className="col-span-1 bg-rose-50 border-2 border-rose-200 text-rose-700 font-bold py-3 rounded-xl hover:bg-rose-100 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                    <Download size={16} /> Télécharger PDF
                </button>

                <button
                    onClick={downloadWord}
                    className="col-span-1 bg-blue-50 border-2 border-blue-200 text-blue-700 font-bold py-3 rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                    <FileText size={16} /> Télécharger Word
                </button>

                {/* Validation rapide */}
                {targetIds && targetIds.length > 0 && (
                    <div className="col-span-2 bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-col gap-3">
                        <p className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Mission terminée ?</p>
                        <p className="text-sm text-indigo-700 mb-1">N'oublie pas d'aller valider les compétences que tu viens de t'entraîner à maîtriser :</p>
                        <div className="flex flex-col gap-2">
                            {targetIds.map(id => {
                                const c = ALL_COMPETENCIES.find(comp => comp.id === id);
                                if (!c) return null;
                                return (
                                    <Link key={id} href={`/student/competency/${id}`} className="block w-full bg-white p-3 rounded-lg border border-indigo-100 text-xs font-bold text-slate-700 hover:border-indigo-400 hover:shadow-sm transition-all focus:outline-indigo-600">
                                        👉 {c.label}
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

function formatMarkdown(text: string) {
    let html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold mt-4 mb-2">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-black mt-6 mb-3">$1</h2>')
        .replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-indigo-200 pl-4 py-1 italic bg-indigo-50/50 my-4 text-slate-600">$1</blockquote>')
        .replace(/\n\n/g, '</p><p class="mb-4">')
        .replace(/\n/g, '<br />');

    html = html.replace(/<br \/>- (.*?)(?=<br \/>|$)/g, '<li class="ml-4 mb-2">$1</li>');
    html = html.replace(/(<li.*<\/li>)/, '<ul class="list-disc my-4">$1</ul>');

    return `<p>${html}</p>`;
}
