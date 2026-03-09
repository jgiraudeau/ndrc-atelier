"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, Save, Globe, UploadCloud, Loader2, Image as ImageIcon, BrainCircuit, X, Star, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiGetProgress, apiSaveProgress, type ProgressRecord } from "@/src/lib/api-client";
import { ALL_COMPETENCIES } from "@/src/data/competencies";
import { QUIZZES } from "@/src/data/quizzes";
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
    const [status, setStatus] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [teacherStatus, setTeacherStatus] = useState<number | null>(null);
    const [teacherFeedback, setTeacherFeedback] = useState<string | null>(null);
    const [teacherGradedAt, setTeacherGradedAt] = useState<string | null>(null);

    // Quiz states
    const quizQuestions = typeof competencyId === "string" ? QUIZZES[competencyId] : null;
    const [showQuiz, setShowQuiz] = useState(false);
    const [quizPassed, setQuizPassed] = useState(false);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [quizError, setQuizError] = useState("");

    // Charger la progression existante depuis l'API
    useEffect(() => {
        const token = localStorage.getItem("ndrc_token");
        if (!token) { router.push("/student/login"); return; }

        apiGetProgress().then(({ data }) => {
            if (data && competencyId) {
                const record = data.find((p: ProgressRecord) => p.competencyId === competencyId);
                if (record) {
                    setIsAcquired(record.acquired);
                    setStatus(record.status || 0);
                    setProofInput(record.proof || "");
                    setTeacherStatus(record.teacherStatus);
                    setTeacherFeedback(record.teacherFeedback);
                    setTeacherGradedAt(record.teacherGradedAt);
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

    const handleSave = async (skipQuizCheck = false) => {
        if (!competencyId || isSaving || status === 0) {
            if (status === 0) alert("N'oublie pas de choisir ton niveau d'auto-évaluation !");
            return;
        }

        const newAcquired = status >= 3;

        // Vérification quiz
        if (newAcquired && quizQuestions && !quizPassed && skipQuizCheck !== true) {
            setShowQuiz(true);
            return;
        }

        setIsSaving(true);
        const { data, error } = await apiSaveProgress(competencyId, status, proofInput);

        setIsSaving(false);

        if (error || !data) {
            alert("Erreur lors de la sauvegarde. Veuillez réessayer.");
            return;
        }

        setIsAcquired(data.acquired);
        setStatus(data.status);
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

    const handleQuizSubmit = () => {
        if (!quizQuestions || selectedOption === null) return;
        const currentQ = quizQuestions[currentQIndex];

        if (selectedOption !== currentQ.correctAnswerIndex) {
            setQuizError("Aïe, ce n'est pas la bonne réponse... Relis bien les options !");
            return;
        }

        // Bonne réponse
        setQuizError("");
        if (currentQIndex < quizQuestions.length - 1) {
            setCurrentQIndex(prev => prev + 1);
            setSelectedOption(null);
        } else {
            // Fini et réussi !
            setQuizPassed(true);
            setShowQuiz(false);
            handleSave(true);
        }
    };

    const isImageProof = proofInput.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || proofInput.includes(".vercel.app/proofs/");

    return (
        <>
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

                    {/* Évaluation du formateur */}
                    {teacherStatus !== null && teacherStatus !== undefined && (
                        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <MessageSquare size={18} className="text-indigo-600" />
                                <h3 className="font-black text-indigo-900 text-sm uppercase tracking-wide">Évaluation du formateur</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-indigo-700 font-medium">Niveau attribué :</span>
                                <span className={cn(
                                    "px-3 py-1 rounded-full text-sm font-black",
                                    teacherStatus === 1 ? "bg-slate-200 text-slate-700" :
                                    teacherStatus === 2 ? "bg-blue-200 text-blue-800" :
                                    teacherStatus === 3 ? "bg-green-200 text-green-800" :
                                    teacherStatus === 4 ? "bg-purple-200 text-purple-800" :
                                    "bg-red-200 text-red-800"
                                )}>
                                    {teacherStatus === 0 ? "Non validé" :
                                     teacherStatus === 1 ? "Novice" :
                                     teacherStatus === 2 ? "Apprenti" :
                                     teacherStatus === 3 ? "Compétent" :
                                     teacherStatus === 4 ? "Expert" : "—"}
                                </span>
                            </div>
                            {teacherFeedback && (
                                <div className="bg-white/70 rounded-xl p-3 border border-indigo-100">
                                    <p className="text-sm text-indigo-800 italic leading-relaxed">
                                        &laquo; {teacherFeedback} &raquo;
                                    </p>
                                </div>
                            )}
                            {teacherGradedAt && (
                                <p className="text-xs text-indigo-400">
                                    Évalué le {new Date(teacherGradedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Auto-évaluation */}
                    <section className="space-y-4">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <Star className="text-yellow-400" size={18} fill="currentColor" />
                            Auto-évaluation
                        </h3>
                        <p className="text-sm text-slate-500 mb-2">Comment évalues-tu ton niveau de maîtrise ?</p>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { val: 1, title: "Novice", desc: "Je découvre" },
                                { val: 2, title: "Apprenti", desc: "Je m'entraîne" },
                                { val: 3, title: "Compétent", desc: "Autonome" },
                                { val: 4, title: "Expert", desc: "Je maîtrise" },
                            ].map(level => {
                                const isSelected = status === level.val;
                                let colors = "border-slate-200 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50/50";
                                if (isSelected) {
                                    if (level.val === 1) colors = "border-slate-500 bg-slate-50 text-slate-800 shadow-sm";
                                    else if (level.val === 2) colors = "border-blue-500 bg-blue-50 text-blue-800 shadow-sm";
                                    else if (level.val === 3) colors = "border-green-500 bg-green-50 text-green-800 shadow-sm";
                                    else if (level.val === 4) colors = "border-purple-500 bg-purple-50 text-purple-800 shadow-sm";
                                }

                                return (
                                    <button
                                        key={level.val}
                                        onClick={() => setStatus(level.val)}
                                        className={cn("flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all text-center", colors)}
                                    >
                                        <div className="font-black text-sm">{level.title}</div>
                                        <div className="text-[10px] opacity-70 font-medium">{level.desc}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

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
                            onClick={() => handleSave(false)}
                            disabled={isSaving || status === 0}
                            className={cn(
                                "w-full py-4 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-2 text-lg transition-all",
                                isSaved ? "bg-green-500 shadow-green-200"
                                    : isAcquired ? "bg-orange-500 shadow-orange-200"
                                        : bgColor,
                                (isSaving || status === 0) && "opacity-60 cursor-not-allowed"
                            )}
                        >
                            {isSaving ? (
                                <span className="animate-pulse">Enregistrement...</span>
                            ) : isSaved ? (
                                <><CheckCircle size={24} /> Enregistré !</>
                            ) : isAcquired ? (
                                <><Save size={20} /> Mettre à jour la preuve</>
                            ) : (
                                <><Save size={20} /> Valider &amp; Enregistrer</>
                            )}
                        </motion.button>
                    </section>
                </div>
            </main>

            {/* Modal Quiz */}
            <AnimatePresence>
                {showQuiz && quizQuestions && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white p-6 rounded-3xl w-full max-w-md shadow-2xl relative"
                        >
                            <button onClick={() => setShowQuiz(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full p-2 transition-colors">
                                <X size={20} />
                            </button>

                            <div className="flex items-center gap-3 mb-6 text-indigo-600">
                                <div className="p-3 bg-indigo-100 rounded-2xl">
                                    <BrainCircuit size={28} />
                                </div>
                                <div>
                                    <h3 className="font-black text-xl leading-tight">Quiz de Validation</h3>
                                    <p className="text-sm font-medium text-slate-500">
                                        Question {currentQIndex + 1} / {quizQuestions.length}
                                    </p>
                                </div>
                            </div>

                            <p className="text-slate-800 font-bold mb-6 text-lg">
                                {quizQuestions[currentQIndex].question}
                            </p>

                            <div className="space-y-3 mb-6">
                                {quizQuestions[currentQIndex].options.map((opt, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setSelectedOption(i)}
                                        className={cn(
                                            "w-full text-left p-4 rounded-2xl border-2 transition-all font-medium text-sm leading-relaxed",
                                            selectedOption === i
                                                ? "border-indigo-600 bg-indigo-50 text-indigo-800"
                                                : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-slate-50"
                                        )}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>

                            {quizError && (
                                <p className="text-red-500 text-sm font-bold mb-4 text-center">
                                    {quizError}
                                </p>
                            )}

                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={handleQuizSubmit}
                                disabled={selectedOption === null}
                                className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
                            >
                                {currentQIndex < quizQuestions.length - 1 ? "Question Suivante" : "Gooo ! Valider ma preuve"}
                            </motion.button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
