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
        <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 font-sans flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 transition-colors text-sm font-medium">
                    <ArrowLeft size={18} /> Retour
                </Link>

                <div className="bg-white rounded-3xl shadow-xl border border-white/60 p-8">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mx-auto mb-4">
                            <User size={30} />
                        </div>
                        <h1 className="text-xl font-black text-slate-800">Connexion Élève</h1>
                        <p className="text-xs text-slate-400 mt-1">
                            Utilise ton identifiant et ton mot de passe
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Identifiant</label>
                            <div className="relative">
                                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => { setIdentifier(e.target.value); setError(""); }}
                                    placeholder="prenom.nom"
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none font-medium text-slate-700 transition-colors"
                                    autoFocus
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Mot de passe</label>
                            <div className="relative">
                                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                                    placeholder="••••••"
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none font-medium text-slate-700 transition-colors"
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm font-bold rounded-lg text-center">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || !identifier.trim() || !password}
                            className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200 disabled:opacity-40"
                        >
                            {isLoading ? "Connexion..." : "Se connecter"}
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
}
