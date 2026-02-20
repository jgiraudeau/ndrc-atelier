"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Target, Settings, Briefcase, ChevronRight, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { apiGetProgress, type ProgressRecord } from "@/src/lib/api-client";
import { ALL_COMPETENCIES } from "@/src/data/competencies";
import { cn } from "@/lib/utils";

export default function MissionsPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    // Competencies that need practice
    const [needsPractice, setNeedsPractice] = useState<typeof ALL_COMPETENCIES>([]);

    // Form selections
    const [selectedContext, setSelectedContext] = useState("");
    const [selectedPlatform, setSelectedPlatform] = useState<"WORDPRESS" | "PRESTASHOP" | "ALL">("WORDPRESS");

    // Result
    const [missionMarkdown, setMissionMarkdown] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        const token = localStorage.getItem("ndrc_token");
        if (!token) { router.push("/student/login"); return; }

        apiGetProgress().then(({ data, error }) => {
            setIsLoading(false);
            if (error) {
                console.error("Erreur serveur", error);
                return;
            }

            if (data) {
                // Map records
                const progressMap: Record<string, { status: number }> = {};
                data.forEach((p: ProgressRecord) => {
                    progressMap[p.competencyId] = { status: p.status || 0 };
                });

                // Find ALL_COMPETENCIES where status < 3
                const lacking = ALL_COMPETENCIES.filter(c => {
                    const status = progressMap[c.id]?.status || 0;
                    return status < 3; // 0, 1, or 2
                });

                setNeedsPractice(lacking);
            }
        });
    }, [router]);

    const handleGenerate = async () => {
        if (!process.env.NEXT_PUBLIC_ALLOW_API) {
            // Basic verification it's not totally broken
        }

        // Filter the competencies list by platform explicitly if requested
        let targeting = needsPractice;
        if (selectedPlatform !== "ALL") {
            targeting = needsPractice.filter(c => c.platform === selectedPlatform);
        }

        if (targeting.length === 0) {
            setErrorMsg("Tu as des compétences Expertes/Compétentes partout pour cette plateforme ! Bravo !");
            return;
        }

        // Take up to 3 random missing skills to form a realistic mission
        const shuffled = targeting.sort(() => 0.5 - Math.random());
        const selectedIds = shuffled.slice(0, 3).map(c => c.id);

        setGenerating(true);
        setErrorMsg("");
        setMissionMarkdown(null);

        try {
            const token = localStorage.getItem("ndrc_token");
            const res = await fetch("/api/missions/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    competencyIds: selectedIds,
                    context: selectedContext
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Erreur serveur");
            }

            setMissionMarkdown(data.mission);
        } catch (err: any) {
            setErrorMsg(err.message || "Impossible de joindre Gemini pour générer cette mission.");
        } finally {
            setGenerating(false);
        }
    };

    if (isLoading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <Loader2 className="animate-spin text-indigo-500 w-8 h-8" />
        </div>
    );

    return (
        <main className="min-h-screen bg-slate-50 font-sans pb-20">
            {/* Header */}
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
                    <MissionResult markdown={missionMarkdown} onReset={() => setMissionMarkdown(null)} />
                ) : (
                    <>
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center gap-3">
                            <div className="bg-amber-100 p-4 rounded-full text-amber-600">
                                <Sparkles size={32} />
                            </div>
                            <h2 className="text-xl font-black text-slate-800">Générer un Cas Pratique</h2>
                            <p className="text-slate-500 text-sm">
                                L'IA analyse tes compétences ({needsPractice.length} à améliorer) et crée un scénario d'entreprise sur mesure pour t'entraîner !
                            </p>
                        </div>

                        {/* Configuration de la mission */}
                        <div className="space-y-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Plateforme ciblée</label>
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

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Contexte d'Entreprise <span className="text-slate-400 font-normal">(Optionnel)</span></label>
                                <input
                                    type="text"
                                    value={selectedContext}
                                    onChange={(e) => setSelectedContext(e.target.value)}
                                    placeholder="Ex: Boutique de sneakers, Agence web, Fleuriste local..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors"
                                />
                            </div>

                            {errorMsg && (
                                <p className="text-sm text-red-500 font-bold p-3 bg-red-50 rounded-xl border border-red-100">{errorMsg}</p>
                            )}

                            <button
                                onClick={handleGenerate}
                                disabled={generating || needsPractice.length === 0}
                                className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                {generating ? <><Loader2 size={18} className="animate-spin" /> Préparation de la mission...</> : <><Target size={18} /> Générer ma Mission (<Sparkles size={14} className="inline ml-1" />)</>}
                            </button>
                        </div>
                    </>
                )}
            </div>

        </main>
    );
}

function MissionResult({ markdown, onReset }: { markdown: string, onReset: () => void }) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                    onClick={onReset}
                    className="col-span-1 bg-white border-2 border-slate-200 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-50 transition-colors"
                >
                    Autre Mission
                </button>
                <Link
                    href="/student/wordpress"
                    className="col-span-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-200/50 flex items-center justify-center gap-2 transition-all"
                >
                    <Settings size={18} /> À moi de jouer
                </Link>
            </div>
        </div>
    );
}

// Very basic inline markdown formatter to keep things lightweight
function formatMarkdown(text: string) {
    let html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold mt-4 mb-2">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-black mt-6 mb-3">$1</h2>')
        .replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-indigo-200 pl-4 py-1 italic bg-indigo-50/50 my-4 text-slate-600">$1</blockquote>')
        .replace(/\n\n/g, '</p><p class="mb-4">')
        .replace(/\n/g, '<br />');

    // Basic list handling (simple)
    html = html.replace(/<br \/>- (.*?)(?=<br \/>|$)/g, '<li class="ml-4 mb-2">$1</li>');
    html = html.replace(/(<li.*<\/li>)/, '<ul class="list-disc my-4">$1</ul>'); // attempt wrap without the s flag

    return `<p>${html}</p>`;
}
