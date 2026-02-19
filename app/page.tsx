"use client";

import Link from "next/link";
import {
    ArrowRight, CheckCircle2, GraduationCap, Users, LayoutDashboard,
    Globe, ShoppingBag, BarChart3, Mail, MonitorSmartphone, Share2, ShieldCheck, PenTool
} from "lucide-react";
import Image from "next/image";

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[#0f172a] text-white font-sans overflow-hidden selection:bg-indigo-500 selection:text-white">

            {/* Background Gradients plus subtils */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] opacity-30" />
                <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[100px] opacity-20" />
            </div>

            {/* Navbar */}
            <nav className="relative z-10 max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center font-black text-white shadow-xl shadow-indigo-500/20 text-lg">N</div>
                    <span className="font-extrabold text-2xl tracking-tight text-white">NDRC Skills</span>
                </div>
                <div className="flex items-center gap-6">
                    <Link href="/teacher/login" className="hidden md:block text-sm font-medium text-slate-300 hover:text-white transition-colors">
                        Espace Formateur
                    </Link>
                    <Link href="/student/login" className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full text-sm font-bold transition-all backdrop-blur-md">
                        Connexion
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="relative z-10 max-w-7xl mx-auto px-6 pt-10 pb-20 text-center">

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-sm mb-8 animate-fade-in-up">
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    <span className="text-xs font-bold text-indigo-300 tracking-wide uppercase">Le compagnon officiel BTS NDRC</span>
                </div>

                <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-tight">
                    Votre passeport pour <br />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                        l'épreuve E5 Digitale
                    </span>
                </h1>

                <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed font-medium">
                    Ne laissez plus le hasard décider de votre note. <br className="hidden md:block" />
                    Maîtrisez <span className="text-white">WordPress</span>, <span className="text-white">PrestaShop</span> et les stratégies digitales grâce à un suivi précis de vos compétences.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto mb-16">
                    <Link href="/student/login" className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-indigo-600/20 hover:scale-105 flex items-center justify-center gap-2">
                        Je connecte mon Espace Étudiant
                        <ArrowRight size={18} />
                    </Link>
                    <Link href="/teacher/login" className="w-full sm:w-auto px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 border border-slate-700">
                        Accès Professeur
                    </Link>
                </div>

                {/* Ecosysteme Outils - "The Stack" */}
                <div className="border-y border-white/5 bg-white/[0.02] py-12 mb-20">
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-8">Les outils que vous allez maîtriser</p>
                    <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
                        <ToolItem icon={<Globe size={32} />} label="WordPress" />
                        <ToolItem icon={<ShoppingBag size={32} />} label="PrestaShop" />
                        <ToolItem icon={<BarChart3 size={32} />} label="SEO & Analytics" />
                        <ToolItem icon={<Mail size={32} />} label="Emailing" />
                        <ToolItem icon={<MonitorSmartphone size={32} />} label="Social Media" />
                        <ToolItem icon={<PenTool size={32} />} label="Canva / Design" />
                    </div>
                </div>

                {/* Features Grid */}
                <div className="grid md:grid-cols-3 gap-6 text-left">
                    <FeatureCard
                        icon={<ShieldCheck className="text-emerald-400" size={28} />}
                        title="Validation Certifiée"
                        description="Chaque compétence est validée par votre formateur. Un gage de sérieux pour votre dossier d'examen."
                        color="bg-emerald-500/10 border-emerald-500/20"
                    />
                    <FeatureCard
                        icon={<LayoutDashboard className="text-blue-400" size={28} />}
                        title="Tableau de Bord E5"
                        description="Une vue d'ensemble claire pour savoir exactement où vous en êtes avant le jour J. Fini le stress."
                        color="bg-blue-500/10 border-blue-500/20"
                    />
                    <FeatureCard
                        icon={<Share2 className="text-pink-400" size={28} />}
                        title="Portfolio Pro"
                        description="Constituez au fil de l'année un portfolio de preuves concrètes : sites, campagnes, stats."
                        color="bg-pink-500/10 border-pink-500/20"
                    />
                </div>

            </main>

            {/* Footer */}
            <footer className="border-t border-white/5 py-8 bg-[#020617] text-center relative z-10 text-slate-600 text-sm">
                <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="w-6 h-6 bg-slate-800 rounded-lg flex items-center justify-center font-bold text-white text-xs">N</div>
                    <span className="font-bold text-slate-400">NDRC Skills</span>
                </div>
                <p>© {new Date().getFullYear()} - La plateforme de réussite pour le BTS Négociation et Digitalisation de la Relation Client.</p>
            </footer>
        </div>
    );
}

function ToolItem({ icon, label }: { icon: React.ReactNode, label: string }) {
    return (
        <div className="flex items-center gap-3 group cursor-default">
            <div className="bg-white/5 p-3 rounded-xl border border-white/5 group-hover:bg-white/10 group-hover:border-white/10 transition-colors">
                {icon}
            </div>
            <span className="font-bold text-lg text-slate-300 group-hover:text-white transition-colors">{label}</span>
        </div>
    );
}

function FeatureCard({ icon, title, description, color }: { icon: React.ReactNode, title: string, description: string, color: string }) {
    return (
        <div className={`p-8 rounded-3xl border transition-all hover:scale-[1.02] ${color} bg-slate-900/50 backdrop-blur-sm`}>
            <div className="mb-4 inline-flex">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-slate-400 leading-relaxed text-sm">
                {description}
            </p>
        </div>
    );
}
