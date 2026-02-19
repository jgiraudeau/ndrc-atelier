"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, GraduationCap, Users, LayoutDashboard, Globe, ShoppingBag } from "lucide-react";
import Image from "next/image";

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans overflow-hidden selection:bg-indigo-500 selection:text-white">

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600 rounded-full blur-[120px] opacity-20 animate-pulse" />
                <div className="absolute bottom-[0%] right-[-10%] w-[600px] h-[600px] bg-purple-600 rounded-full blur-[120px] opacity-20 animate-pulse delay-1000" />
            </div>

            {/* Navbar */}
            <nav className="relative z-10 max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">N</div>
                    <span className="font-extrabold text-xl tracking-tight">NDRC Skills</span>
                </div>
                {/* Desktop Menu - could be added here */}
                <Link href="/teacher/login" className="text-sm font-semibold text-slate-300 hover:text-white transition-colors">
                    Accès Formateur →
                </Link>
            </nav>

            {/* Hero Section */}
            <main className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32 flex flex-col items-center text-center">

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-6 animate-fade-in-up">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                    <span className="text-xs font-medium text-slate-300">Nouveau : Tableau de bord étudiant disponible</span>
                </div>

                <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400 max-w-4xl">
                    Maîtrisez vos compétences <span className="text-indigo-400">E5</span>.
                </h1>

                <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
                    La plateforme tout-en-un pour valider vos acquis sur <span className="text-slate-200 font-semibold">WordPress</span> et <span className="text-slate-200 font-semibold">PrestaShop</span>. Préparez votre examen BTS NDRC en toute sérénité.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                    <Link href="/student/login" className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 group">
                        Espace Étudiant
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <Link href="/teacher/login" className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl font-bold transition-all backdrop-blur-sm flex items-center justify-center gap-2">
                        <Users size={18} />
                        Espace Formateur
                    </Link>
                </div>

                {/* Dashboard Preview Mockup */}
                <div className="mt-20 relative w-full max-w-5xl group perspective-1000">
                    <div className="absolute inset-0 bg-gradient-to-t from-indigo-500 via-purple-500 to-pink-500 rounded-3xl blur-[60px] opacity-20 group-hover:opacity-30 transition-opacity duration-700" />
                    <div className="relative bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl transform group-hover:rotate-x-2 transition-transform duration-700">
                        {/* Fake Browser Header */}
                        <div className="h-8 bg-slate-800 border-b border-white/5 flex items-center gap-2 px-4">
                            <div className="w-3 h-3 rounded-full bg-red-500/50" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                            <div className="w-3 h-3 rounded-full bg-green-500/50" />
                        </div>
                        {/* Mockup Content - Simplified representation of the dashboard */}
                        <div className="p-6 md:p-10 bg-slate-900 grid grid-cols-1 md:grid-cols-3 gap-6 opacity-80 group-hover:opacity-100 transition-opacity">
                            {/* Sidebar Mock */}
                            <div className="hidden md:block col-span-1 space-y-4 border-r border-white/5 pr-6">
                                <div className="h-8 w-3/4 bg-slate-800 rounded-lg animate-pulse" />
                                <div className="h-4 w-1/2 bg-slate-800 rounded animate-pulse opacity-50" />
                                <div className="space-y-2 mt-8">
                                    <div className="h-10 w-full bg-indigo-500/20 rounded-lg border border-indigo-500/30" />
                                    <div className="h-10 w-full bg-slate-800/50 rounded-lg" />
                                    <div className="h-10 w-full bg-slate-800/50 rounded-lg" />
                                </div>
                            </div>
                            {/* Main Content Mock */}
                            <div className="col-span-2 space-y-6">
                                <div className="flex gap-4">
                                    <div className="flex-1 h-32 bg-slate-800 rounded-2xl border border-white/5 p-4 flex flex-col justify-between">
                                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 mb-2" />
                                        <div className="w-1/2 h-4 bg-slate-700 rounded" />
                                    </div>
                                    <div className="flex-1 h-32 bg-slate-800 rounded-2xl border border-white/5 p-4 flex flex-col justify-between">
                                        <div className="w-8 h-8 rounded-full bg-purple-500/20 mb-2" />
                                        <div className="w-1/2 h-4 bg-slate-700 rounded" />
                                    </div>
                                </div>
                                <div className="h-48 bg-slate-800/50 rounded-2xl border border-white/5 p-4">
                                    <div className="w-1/3 h-5 bg-slate-700 rounded mb-4" />
                                    <div className="space-y-3">
                                        <div className="w-full h-12 bg-slate-800 rounded-xl border border-white/5" />
                                        <div className="w-full h-12 bg-slate-800 rounded-xl border border-white/5" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </main>

            {/* Features Section */}
            <section className="relative z-10 py-24 bg-slate-900 border-t border-white/5">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<LayoutDashboard className="text-indigo-400" size={32} />}
                            title="Suivi en temps réel"
                            description="Visualisez votre progression globale et détaillée par compétence. Sachez exactement où vous en êtes."
                        />
                        <FeatureCard
                            icon={<CheckCircle2 className="text-green-400" size={32} />}
                            title="Validation Formateur"
                            description="Soumettez vos preuves et recevez des feedbacks directs de votre formateur pour valider chaque acquis."
                        />
                        <FeatureCard
                            icon={<GraduationCap className="text-purple-400" size={32} />}
                            title="Objectif Examen E5"
                            description="Un référentiel 100% conforme aux attentes du BTS NDRC pour réussir l'épreuve de digitalisation."
                        />
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/5 py-12 bg-slate-950 text-center relative z-10">
                <p className="text-slate-500 text-sm">
                    © {new Date().getFullYear()} NDRC Skills. Développé avec ❤️ pour les BTS NDRC.
                </p>
                <div className="flex justify-center gap-6 mt-4">
                    <span className="text-slate-600 text-xs">Mentions Légales</span>
                    <span className="text-slate-600 text-xs">Contact</span>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group cursor-default">
            <div className="mb-6 p-4 rounded-2xl bg-slate-900 inline-block border border-white/5 shadow-inner group-hover:scale-110 transition-transform duration-300">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
            <p className="text-slate-400 leading-relaxed">
                {description}
            </p>
        </div>
    );
}
