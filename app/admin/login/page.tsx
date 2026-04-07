"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Shield, Lock } from "lucide-react";
import Link from "next/link";
import { apiAdminLogin } from "@/src/lib/api-client";

export default function AdminLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        const { data, error: apiErr } = await apiAdminLogin(email, password);

        setIsLoading(false);

        if (apiErr || !data) {
            setError(apiErr || "Erreur de connexion");
            return;
        }

        localStorage.setItem("ndrc_token", data.token);
        localStorage.setItem("ndrc_user", JSON.stringify({ name: data.name, role: "ADMIN" }));

        router.push("/admin");
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-800 via-indigo-950 to-slate-900 font-sans flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white/5 border border-white/8 rounded-3xl shadow-lg p-8 relative">
                <Link href="/" className="absolute top-4 left-4 p-2 text-slate-500 hover:text-white transition-colors">
                    <ArrowLeft size={24} />
                </Link>

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-amber-500/20 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-400 mx-auto mb-4">
                        <Shield size={32} />
                    </div>
                    <h1 className="text-xl font-black text-white">Administration</h1>
                    <p className="text-xs text-slate-400 mt-1">Gestion des comptes formateurs</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full p-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder-slate-500 outline-none focus:border-amber-500/50 transition-colors"
                            placeholder="admin@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Mot de passe</label>
                        <div className="relative">
                            <input
                                type="password"
                                required
                                className="w-full p-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder-slate-500 outline-none focus:border-amber-500/50 transition-colors"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <Lock className="absolute right-3 top-3 text-slate-500" size={18} />
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-400 text-xs font-bold text-center bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-bold py-3 rounded-xl hover:from-amber-400 hover:to-orange-400 active:scale-95 transition-all shadow-md shadow-amber-900/30 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? "Connexion..." : "Se connecter"}
                    </button>
                </form>
            </div>
        </main>
    );
}
