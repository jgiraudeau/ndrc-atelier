"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, Save, Globe, UploadCloud, Loader2, Image as ImageIcon } from "lucide-react";
import { motion } from "framer-motion";
import { apiGetProgress, apiSaveProgress, type ProgressRecord } from "@/src/lib/api-client";
import { ALL_COMPETENCIES } from "@/src/data/competencies";
import { cn } from "@/lib/utils";
import Link from "next/link";
import confetti from "canvas-confetti";

export default function CompetencyProofPage() {
    const params = useParams();
    const router = useRouter();
    const competencyId = Array.isArray(params?.id) ? params.id[0] : params?.id;
    const competency = ALL_COMPETENCIES.find((c) => c.id === competencyId);

    const [proofInput, setProofInput] = useState("");
    const [isSaved, setIsSaved] = useState(false);
    const [isAcquired, setIsAcquired] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Charger la progression existante depuis l'API
    useEffect(() => {
        const token = localStorage.getItem("ndrc_token");
        if (!token) { router.push("/student/login"); return; }

        apiGetProgress().then(({ data }) => {
            if (data && competencyId) {
                const record = data.find((p: ProgressRecord) => p.competencyId === competencyId);
                if (record) {
                    setIsAcquired(record.acquired);
                    setProofInput(record.proof || "");
                }
            }
            setIsLoading(false);
        });
    }, [competencyId, router]);

    if (isLoading) return <div className="p-8 text-center text-slate-400 animate-pulse">Chargement...</div>;
    if (!competency) return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
            <h1 className="text-xl font-bold text-slate-800">Compétence introuvable 😕</h1>
            <Link href="/student" className="mt-4 text-blue-600 underline">Retour</Link>
        </div>
    );

    const isWordPress = competency.platform === "WORDPRESS";
    const bgColor = isWordPress ? "bg-[#2271b1]" : "bg-[#df0067]";
    const themeColor = isWordPress ? "text-[#2271b1]" : "text-[#df0067]";
    const lightBg = isWordPress ? "bg-[#e5f5ff]" : "bg-[#ffe5f0]";

    const handleSave = async () => {
        if (!competencyId || isSaving) return;
        setIsSaving(true);

        const newAcquired = !isAcquired; // toggle
        const { data, error } = await apiSaveProgress(competencyId, newAcquired, proofInput);

        setIsSaving(false);

        if (error || !data) {
            alert("Erreur lors de la sauvegarde. Veuillez réessayer.");
            return;
        }

        setIsAcquired(data.acquired);
        setIsSaved(true);

        if (data.acquired) {
            confetti({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 },
                colors: isWordPress ? ["#2271b1", "#e5f5ff", "#ffffff"] : ["#df0067", "#ffe5f0", "#ffffff"],
                disableForReducedMotion: true,
            });
        }

        setTimeout(() => setIsSaved(false), 2500);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert("L'image est trop lourde (5Mo maximum).");
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        const token = localStorage.getItem("ndrc_token");

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData,
            });

            const data = await res.json();
            if (res.ok && data.url) {
                // Remplacer l'URL textuelle par l'URL de l'image
                setProofInput(data.url);
            } else {
                alert(data.error || "Erreur lors de l'envoi de l'image.");
            }
        } catch (err) {
            alert("Erreur réseau de connexion au serveur.");
        } finally {
            setIsUploading(false);
        }
    };

    const isImageProof = proofInput.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || proofInput.includes(".vercel.app/proofs/");

    return (
        <main className="min-h-screen bg-slate-50 font-sans pb-20">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
                    <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-400 hover:text-slate-600">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="font-bold text-slate-700 text-base truncate max-w-[200px]">Preuve de compétence</h1>
                    <div className="w-8" />
                </div>
            </header>

            <div className="max-w-md mx-auto p-6 space-y-6">
                {/* Carte compétence */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
                    <div className={cn("absolute top-0 left-0 w-2 h-full", bgColor)} />
                    <div className="flex items-start justify-between mb-4">
                        <span className={cn("text-xs font-black uppercase tracking-wider px-2 py-1 rounded-md", lightBg, themeColor)}>
                            Niveau {competency.level} • {competency.category}
                        </span>
                        {isAcquired && (
                            <div className="flex items-center gap-1 text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded-full">
                                <CheckCircle size={14} /> Validé
                            </div>
                        )}
                    </div>
                    <h2 className="text-xl font-black text-slate-800 leading-tight mb-2">{competency.label}</h2>
                    <p className="text-slate-500 text-sm">
                        Apporte la preuve de ta réalisation pour valider cette compétence {competency.platform === "WORDPRESS" ? "WordPress" : "PrestaShop"}.
                    </p>
                </div>

                {/* Zone preuve */}
                <section className="space-y-4">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <Globe className="text-slate-400" size={18} />
                        Lien ou Commentaire
                    </h3>
                    <div className="relative">
                        <textarea
                            value={proofInput}
                            onChange={(e) => setProofInput(e.target.value)}
                            placeholder="Colle ici l'URL de ta page ou de ta preuve..."
                            className="w-full h-32 p-4 rounded-xl border-2 border-slate-200 focus:border-slate-400 focus:outline-none resize-none font-medium text-slate-700 bg-white shadow-sm text-sm"
                        />
                        {isImageProof && proofInput && (
                            <div className="mt-3 p-3 bg-white border border-slate-200 shadow-sm rounded-xl">
                                <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                                    <ImageIcon size={14} /> Aperçu de l'image
                                </div>
                                <img src={proofInput} alt="Preuve" className="max-h-48 rounded-lg object-contain w-full" />
                            </div>
                        )}
                        <input type="file" id="upload-proof" accept="image/*" onChange={handleFileUpload} className="hidden" />
                        <label htmlFor="upload-proof" className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-indigo-700 rounded-xl font-bold text-sm cursor-pointer transition-colors shadow-sm border border-slate-200">
                            {isUploading ? (
                                <><Loader2 className="animate-spin text-indigo-500" size={16} /> Upload en cours...</>
                            ) : (
                                <><UploadCloud size={16} className="text-slate-500" /> Uploader une capture d'écran</>
                            )}
                        </label>
                    </div>

                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleSave}
                        disabled={isSaving}
                        className={cn(
                            "w-full py-4 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-2 text-lg transition-all",
                            isSaved ? "bg-green-500 shadow-green-200"
                                : isAcquired ? "bg-orange-500 shadow-orange-200"
                                    : bgColor,
                            isSaving && "opacity-60 cursor-not-allowed"
                        )}
                    >
                        {isSaving ? (
                            <span className="animate-pulse">Enregistrement...</span>
                        ) : isSaved ? (
                            <><CheckCircle size={24} /> Enregistré !</>
                        ) : isAcquired ? (
                            <><Save size={20} /> Modifier / Désacquérir</>
                        ) : (
                            <><Save size={20} /> Valider &amp; Enregistrer</>
                        )}
                    </motion.button>
                </section>
            </div>
        </main>
    );
}
