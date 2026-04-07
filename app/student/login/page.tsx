"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, User, KeyRound } from "lucide-react";
import Link from "next/link";
import { apiStudentLogin } from "@/src/lib/api-client";

export default function StudentLoginPage() {
    const router = useRouter();
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!identifier.trim() || !password) return;
        setIsLoading(true);
        setError("");

        const { data, error: apiErr } = await apiStudentLogin(identifier.trim(), password);
        setIsLoading(false);

        if (apiErr || !data) {
            setError(apiErr || "Identifiants incorrects.");
            return;
        }

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
        <main className="min-h-screen bg-gradient-to-br from-slate-800 via-indigo-950 to-slate-900 font-sans flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors text-sm font-medium">
                    <ArrowLeft size={18} /> Retour
                </Link>

                <div className="bg-white/5 border border-white/8 rounded-3xl p-8">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-blue-500/20 border border-blue-500/30 rounded-2xl flex items-center justify-center text-blue-400 mx-auto mb-4">
                            <User size={30} />
                        </div>
                        <h1 className="text-xl font-black text-white">Connexion Élève</h1>
                        <p className="text-xs text-slate-400 mt-1">
                            Utilise ton identifiant et ton mot de passe
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Identifiant</label>
                            <div className="relative">
                                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => { setIdentifier(e.target.value); setError(""); }}
                                    placeholder="prenom.nom"
                                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder-slate-500 focus:border-blue-500/50 focus:outline-none font-medium transition-colors"
                                    autoFocus
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Mot de passe</label>
                            <div className="relative">
                                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                                    placeholder="••••••"
                                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder-slate-500 focus:border-blue-500/50 focus:outline-none font-medium transition-colors"
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold rounded-xl text-center">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || !identifier.trim() || !password}
                            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold py-4 rounded-xl hover:from-blue-500 hover:to-cyan-500 active:scale-95 transition-all shadow-lg shadow-blue-900/40 disabled:opacity-40"
                        >
                            {isLoading ? "Connexion..." : "Se connecter"}
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
}
