"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, KeyRound, Building2 } from "lucide-react";
import Link from "next/link";
import { apiStudentLogin } from "@/src/lib/api-client";
import { cn } from "@/lib/utils";

export default function StudentLoginPage() {
    const router = useRouter();
    const [classCode, setClassCode] = useState("");
    const [pin, setPin] = useState("");
    const [step, setStep] = useState(1);
    const [error, setError] = useState("");
    const [validClassName, setValidClassName] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Étape 1 : vérifier si le code classe existe (appel API)
    const handleClassCodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (classCode.length < 2) return setError("Code trop court.");
        setIsLoading(true);
        setError("");

        // On passe directement à l'étape PIN — la vérification de classe
        // se fait lors du login complet pour éviter l'énumération des classes
        setValidClassName(`Classe ${classCode.toUpperCase()}`);
        setIsLoading(false);
        setStep(2);
    };

    const handlePinSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pin.length < 4) return setError("PIN à 4 chiffres requis.");
        setIsLoading(true);
        setError("");

        const { data, error: apiErr } = await apiStudentLogin(classCode.toUpperCase(), pin);
        setIsLoading(false);

        if (apiErr || !data) {
            setError(apiErr || "Identifiants incorrects.");
            setPin("");
            return;
        }

        // Stocker le token JWT
        localStorage.setItem("ndrc_token", data.token);
        localStorage.setItem("ndrc_user", JSON.stringify({
            name: data.name,
            role: "STUDENT",
            classCode: data.classCode,
            studentId: data.studentId,
        }));

        router.push("/student");
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 font-sans flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 transition-colors text-sm font-medium">
                    <ArrowLeft size={18} /> Retour
                </Link>

                <div className="bg-white rounded-3xl shadow-xl border border-white/60 p-8">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mx-auto mb-4">
                            {step === 1 ? <Building2 size={30} /> : <KeyRound size={30} />}
                        </div>
                        <h1 className="text-xl font-black text-slate-800">
                            {step === 1 ? "Code Classe" : validClassName}
                        </h1>
                        <p className="text-xs text-slate-400 mt-1">
                            {step === 1 ? "Entrez le code de votre classe" : "Entrez votre PIN personnel"}
                        </p>
                    </div>

                    {/* Indicateur étapes */}
                    <div className="flex gap-2 mb-8 justify-center">
                        {[1, 2].map((s) => (
                            <div key={s} className={cn("h-1.5 w-10 rounded-full transition-all duration-300",
                                s <= step ? "bg-blue-500" : "bg-slate-200"
                            )} />
                        ))}
                    </div>

                    <AnimatePresence mode="wait">
                        {step === 1 ? (
                            <motion.form
                                key="step1"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                onSubmit={handleClassCodeSubmit}
                                className="space-y-4"
                            >
                                <input
                                    type="text"
                                    value={classCode}
                                    onChange={(e) => { setClassCode(e.target.value.toUpperCase()); setError(""); }}
                                    placeholder="ex: NDRC1"
                                    maxLength={10}
                                    className="w-full px-4 py-4 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none font-bold text-2xl text-center tracking-widest uppercase transition-colors"
                                    autoFocus
                                />
                                {error && (
                                    <div className="p-3 bg-red-50 text-red-600 text-sm font-bold rounded-lg text-center">
                                        ⚠️ {error}
                                    </div>
                                )}
                                <button
                                    type="submit"
                                    disabled={isLoading || classCode.length < 2}
                                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200 disabled:opacity-40"
                                >
                                    {isLoading ? "..." : "Continuer →"}
                                </button>
                            </motion.form>
                        ) : (
                            <motion.form
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                onSubmit={handlePinSubmit}
                                className="space-y-4"
                            >
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={pin}
                                    onChange={(e) => { setPin(e.target.value); setError(""); }}
                                    placeholder="••••"
                                    maxLength={6}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none font-bold text-3xl text-center tracking-[0.5em] transition-colors"
                                    autoFocus
                                />
                                {error && (
                                    <div className="p-3 bg-red-50 text-red-600 text-sm font-bold rounded-lg text-center">
                                        ⚠️ {error}
                                    </div>
                                )}
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { setStep(1); setError(""); setPin(""); }}
                                        className="flex-1 bg-slate-100 text-slate-500 font-bold py-4 rounded-xl hover:bg-slate-200 active:scale-95 transition-all"
                                    >
                                        Retour
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isLoading || pin.length < 4}
                                        className="flex-[2] bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200 disabled:opacity-40"
                                    >
                                        {isLoading ? "Connexion..." : "Valider"}
                                    </button>
                                </div>
                                <div className="text-center text-xs text-slate-400 mt-2">
                                    Utilise le PIN que ton formateur t&apos;a attribué
                                </div>
                            </motion.form>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </main>
    );
}
