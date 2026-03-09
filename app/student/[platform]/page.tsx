"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Lock, ChevronDown, ChevronUp, Trophy, MessageSquare } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ALL_COMPETENCIES } from "@/src/data/competencies";
import { useProgressStore } from "@/src/store/useProgressStore";
import { useAuthStore } from "@/src/store/useAuthStore";
import { apiGetProgress } from "@/src/lib/api-client";
import { jsPDF } from "jspdf";

// Configuration des styles par plateforme
const PLATFORM_CONFIG = {
    wordpress: {
        name: "WordPress",
        color: "bg-[#2271b1]",
        lightColor: "bg-[#e5f5ff]",
        borderColor: "border-[#2271b1]",
        textColor: "text-[#2271b1]",
        icon: "W",
    },
    prestashop: {
        name: "PrestaShop",
        color: "bg-[#df0067]",
        lightColor: "bg-[#ffe5f0]",
        borderColor: "border-[#df0067]",
        textColor: "text-[#df0067]",
        icon: "P",
    },
};

const LEVELS = [
    { id: 1, title: "Découverte", description: "Les bases indispensables" },
    { id: 2, title: "Construction", description: "Créer du contenu riche" },
    { id: 3, title: "Gestion", description: "Administrer le site au quotidien" },
    { id: 4, title: "Expertise", description: "Optimisation et techniques avancées" },
];

export default function PlatformPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuthStore();
    const [hydrated, setHydrated] = useState(false);
    const [serverProgress, setServerProgress] = useState<Record<string, { acquired: boolean; status: number; teacherStatus: number | null; teacherFeedback: string | null }>>({});

    // Gestion sécurisée du paramètre 'platform'
    const platformId = Array.isArray(params?.platform) ? params.platform[0] : params?.platform;
    const platformKey = (platformId as "wordpress" | "prestashop") || "wordpress";

    // Récupération de la config (couleurs, nom)
    const config = PLATFORM_CONFIG[platformKey] || PLATFORM_CONFIG.wordpress;

    // Filtrage des compétences pour cette plateforme
    const platformCompetencies = ALL_COMPETENCIES.filter(
        (c) => c.platform === platformKey.toUpperCase()
    );

    useEffect(() => {
        useProgressStore.persist.rehydrate();
        useAuthStore.persist.rehydrate();

        apiGetProgress().then(({ data }) => {
            if (data) {
                const pMap: Record<string, { acquired: boolean; status: number; teacherStatus: number | null; teacherFeedback: string | null }> = {};
                data.forEach(p => {
                    pMap[p.competencyId] = { acquired: p.acquired, status: p.status || 0, teacherStatus: p.teacherStatus, teacherFeedback: p.teacherFeedback };
                });
                setServerProgress(pMap);
            }
            setHydrated(true);
        });
    }, []);

    // Calcul progression locale
    const acquiredCount = platformCompetencies.filter(c => serverProgress[c.id]?.acquired).length;
    const totalCount = platformCompetencies.length;
    const percentage = totalCount > 0 ? Math.round((acquiredCount / totalCount) * 100) : 0;

    const generateCertificate = () => {
        try {
            console.log("Tentative de génération PDF...");
            if (typeof jsPDF === 'undefined') {
                throw new Error("La librairie jsPDF n'est pas chargée.");
            }

            const doc = new jsPDF({
                orientation: "landscape",
                unit: "mm",
                format: "a4"
            });

            // Fond décoratif
            doc.setFillColor(248, 250, 252); // slate-50
            doc.rect(0, 0, 297, 210, 'F');

            doc.setDrawColor(config.color === "bg-[#2271b1]" ? 34 : 223, config.color === "bg-[#2271b1]" ? 113 : 0, config.color === "bg-[#2271b1]" ? 177 : 103);
            doc.setLineWidth(2);
            doc.rect(10, 10, 277, 190);

            // Header
            doc.setFont("helvetica", "bold");
            doc.setFontSize(30);
            doc.setTextColor(40, 40, 40);
            doc.text("Attestation de Compétences Digitales", 148.5, 40, { align: "center" });

            doc.setFontSize(16);
            doc.setTextColor(100, 100, 100);
            doc.text("Brevet de Technicien Supérieur - NDRC", 148.5, 55, { align: "center" });

            // Corps
            doc.setFontSize(20);
            doc.setTextColor(0, 0, 0);
            doc.text("Certifie que l'étudiant(e)", 148.5, 80, { align: "center" });

            doc.setFont("helvetica", "bolditalic");
            doc.setFontSize(40);
            doc.setTextColor(config.color === "bg-[#2271b1]" ? 34 : 223, config.color === "bg-[#2271b1]" ? 113 : 0, config.color === "bg-[#2271b1]" ? 177 : 103);
            doc.text(user?.name || "Étudiant Inconnu", 148.5, 100, { align: "center" });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(20);
            doc.setTextColor(0, 0, 0);
            doc.text(`a validé ${percentage}% du parcours ${config.name}`, 148.5, 120, { align: "center" });

            // Date et Signature
            const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
            doc.setFontSize(14);
            doc.text(`Fait le ${date}`, 200, 160);

            doc.setFont("courier", "bold");
            doc.text("L'équipe Pédagogique", 200, 170);

            const fileName = `Attestation_${config.name}_${(user?.name || "etudiant").replace(/\s+/g, '_')}.pdf`;
            doc.save(fileName);
            console.log("PDF téléchargé :", fileName);
        } catch (err: any) {
            console.error("Erreur PDF : ", err);
            alert("Erreur JS lors de la génération PDF : " + (err.message || String(err)));
        }
    };

    if (!hydrated) {
        return <div className="min-h-screen bg-slate-50 font-sans flex items-center justify-center text-slate-400">Chargement...</div>;
    }

    return (
        <main className="min-h-screen bg-slate-50 font-sans pb-20">

            {/* Header Sticky */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/student" className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors">
                        <ArrowLeft size={24} />
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className={cn("w-6 h-6 rounded-md flex items-center justify-center text-white font-bold text-xs", config.color)}>
                            {config.icon}
                        </div>
                        <h1 className="font-extrabold text-slate-700 text-lg tracking-tight">
                            Parcours {config.name}
                        </h1>
                    </div>
                    <div className="w-8" />
                </div>
            </header>

            {/* Parcours des Niveaux */}
            <div className="max-w-md mx-auto">
                {LEVELS.map((level, index) => {
                    // Compétences de ce niveau
                    const levelCompetencies = platformCompetencies.filter((c) => c.level === level.id);

                    return (
                        <section
                            key={level.id}
                            className={cn(
                                "py-8 px-4 border-b border-slate-100 relative",
                                index % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                            )}
                        >
                            {/* Titre du Niveau */}
                            <div className="mb-6 text-center">
                                <h2 className={cn("text-xl font-black mb-1", config.textColor)}>
                                    NIVEAU {level.id}
                                </h2>
                                <p className="text-slate-500 font-bold text-sm uppercase tracking-wide">
                                    {level.title}
                                </p>
                                <p className="text-slate-400 text-xs mt-1">{level.description}</p>
                            </div>

                            {/* Chemin des compétences (Snake Layout) */}
                            <div className="flex flex-col items-center gap-6 relative z-10">
                                {levelCompetencies.map((comp, i) => {
                                    const progressData = serverProgress[comp.id];
                                    const status = progressData?.status || 0;
                                    const tStatus = progressData?.teacherStatus;
                                    const tFeedback = progressData?.teacherFeedback;

                                    let cardBg = "bg-white border-slate-200 text-slate-700 hover:border-slate-300";
                                    let circleBg = "bg-slate-50 border-slate-100 text-slate-300";
                                    let chevronColor = "text-slate-300";

                                    if (status === 1) { // Novice
                                        cardBg = "bg-slate-50 border-slate-300 text-slate-800";
                                        circleBg = "bg-slate-100 border-slate-400 text-slate-600";
                                        chevronColor = "text-slate-500";
                                    } else if (status === 2) { // Apprenti
                                        cardBg = "bg-blue-50 border-blue-300 text-blue-900";
                                        circleBg = "bg-blue-100 border-blue-400 text-blue-600";
                                        chevronColor = "text-blue-500";
                                    } else if (status === 3) { // Compétent
                                        cardBg = "bg-green-50 border-green-300 text-green-900";
                                        circleBg = "bg-green-100 border-green-400 text-green-600";
                                        chevronColor = "text-green-500";
                                    } else if (status === 4) { // Expert
                                        cardBg = "bg-purple-50 border-purple-300 text-purple-900";
                                        circleBg = "bg-purple-100 border-purple-400 text-purple-600";
                                        chevronColor = "text-purple-500";
                                    }

                                    return (
                                        <motion.div
                                            key={comp.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            className="relative group w-full max-w-[320px]"
                                        >
                                            <Link
                                                href={`/student/competency/${comp.id}`}
                                                className={cn(
                                                    "w-full p-4 rounded-2xl border-b-4 text-left transition-all active:scale-95 active:border-b-0 active:translate-y-1 flex items-start gap-4 cursor-pointer block",
                                                    cardBg
                                                )}
                                            >
                                                {/* Zone Checkbox (Visuelle via Status) */}
                                                <div
                                                    className={cn(
                                                        "w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-transform",
                                                        circleBg
                                                    )}>
                                                    {status > 0 ? <Check size={20} className="stroke-[3]" /> : <div className="w-3 h-3 rounded-full bg-slate-200" />}
                                                </div>

                                                {/* Zone Détails */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-bold opacity-70 mb-1 uppercase tracking-wider">
                                                        {comp.category}
                                                    </div>
                                                    <div className="font-bold leading-tight text-sm group-hover:underline decoration-2 underline-offset-2">
                                                        {comp.label}
                                                    </div>
                                                    {tStatus !== null && tStatus !== undefined && (
                                                        <div className="flex items-center gap-1.5 mt-1.5">
                                                            <MessageSquare size={12} className="text-indigo-500" />
                                                            <span className={cn(
                                                                "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                                                                tStatus === 1 ? "bg-slate-200 text-slate-600" :
                                                                tStatus === 2 ? "bg-blue-100 text-blue-700" :
                                                                tStatus === 3 ? "bg-green-100 text-green-700" :
                                                                tStatus === 4 ? "bg-purple-100 text-purple-700" :
                                                                "bg-red-100 text-red-700"
                                                            )}>
                                                                Prof : {tStatus === 0 ? "Non validé" : tStatus === 1 ? "Novice" : tStatus === 2 ? "Apprenti" : tStatus === 3 ? "Compétent" : "Expert"}
                                                            </span>
                                                            {tFeedback && (
                                                                <span className="text-[10px] text-indigo-400 truncate max-w-[120px]" title={tFeedback}>
                                                                    — {tFeedback}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className={cn("mt-1", chevronColor)}>
                                                    <ChevronDown className="-rotate-90" size={20} />
                                                </div>
                                            </Link>

                                            {/* Line connector */}
                                            {i < levelCompetencies.length - 1 && (
                                                <div className="absolute left-9 bottom-[-24px] w-1 h-6 bg-slate-200 -z-10" />
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </div>

                        </section>
                    );
                })}

                {/* Bravo final */}
                <div className="py-12 text-center px-6">
                    <div className="w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center text-white mx-auto mb-4 shadow-lg rotate-12">
                        <Trophy size={48} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-2">Wow, quelle ascension !</h3>
                    <p className="text-slate-500">Tu as parcouru tout le programme E5.</p>
                </div>
            </div>

            {percentage > 50 && (
                <div className="fixed bottom-8 left-0 right-0 flex justify-center z-50 px-4 pointer-events-none">
                    <button
                        onClick={generateCertificate}
                        className="pointer-events-auto bg-slate-900 text-white font-bold py-3 px-6 rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border-2 border-white/20 backdrop-blur-md animate-bounce"
                    >
                        🏅 Télécharger mon Attestation ({percentage}%)
                    </button>
                </div>
            )}
        </main>
    );
}
