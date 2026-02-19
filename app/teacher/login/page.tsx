"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, User, Lock, UserPlus } from "lucide-react";
import Link from "next/link";
import { apiTeacherLogin, apiTeacherRegister } from "@/src/lib/api-client";

export default function TeacherLoginPage() {
    const router = useRouter();
    const [mode, setMode] = useState<"login" | "register">("login");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        const { data, error: apiErr } = mode === "login"
            ? await apiTeacherLogin(email, password)
            : await apiTeacherRegister(name, email, password);

        setIsLoading(false);

        if (apiErr || !data) {
            setError(apiErr || "Erreur de connexion");
            return;
        }

        // Stocker le token JWT dans localStorage
        localStorage.setItem("ndrc_token", data.token);
        localStorage.setItem("ndrc_user", JSON.stringify({ name: data.name, role: "TEACHER" }));

        router.push("/teacher");
    };

    return (
        <main className="min-h-screen bg-slate-50 font-sans flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg border border-slate-100 p-8 relative">
                <Link href="/" className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600">
                    <ArrowLeft size={24} />
                </Link>

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 mx-auto mb-4">
                        <User size={32} />
                    </div>
                    <h1 className="text-xl font-black text-slate-800">Espace Formateur</h1>
                    <p className="text-xs text-slate-400 mt-1">Accès réservé aux enseignants</p>
                </div>

                {/* Toggle Login / Register */}
                <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
                    <button
                        onClick={() => { setMode("login"); setError(""); }}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === "login" ? "bg-white text-purple-700 shadow-sm" : "text-slate-500"}`}
                    >
                        Connexion
                    </button>
                    <button
                        onClick={() => { setMode("register"); setError(""); }}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === "register" ? "bg-white text-purple-700 shadow-sm" : "text-slate-500"}`}
                    >
                        Créer un compte
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === "register" && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom complet</label>
                            <input
                                type="text"
                                required
                                className="w-full p-3 rounded-lg border border-slate-200 outline-none focus:border-purple-500 transition-colors"
                                placeholder="Jean Dupont"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full p-3 rounded-lg border border-slate-200 outline-none focus:border-purple-500 transition-colors"
                            placeholder="prof@academie.fr"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            {mode === "register" ? "Mot de passe (8 car. min)" : "Mot de passe"}
                        </label>
                        <div className="relative">
                            <input
                                type="password"
                                required
                                minLength={mode === "register" ? 8 : 1}
                                className="w-full p-3 rounded-lg border border-slate-200 outline-none focus:border-purple-500 transition-colors"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <Lock className="absolute right-3 top-3 text-slate-400" size={18} />
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-500 text-xs font-bold text-center bg-red-50 p-3 rounded-lg">
                            ⚠️ {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 active:scale-95 transition-all shadow-md mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <span className="animate-pulse">Chargement...</span>
                        ) : mode === "login" ? (
                            "Se connecter"
                        ) : (
                            <><UserPlus size={18} /> Créer mon compte</>
                        )}
                    </button>
                </form>
            </div>
        </main>
    );
}
