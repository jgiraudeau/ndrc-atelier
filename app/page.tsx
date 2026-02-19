"use client";

import Link from "next/link";
import { GraduationCap, Briefcase, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

export default function LandingPage() {
    return (
        <main className="min-h-screen bg-slate-50 font-sans flex items-center justify-center p-4">
            <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8">

                {/* Colonne Élève */}
                <Link href="/student" className="group h-full">
                    <motion.div
                        whileHover={{ y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        className="h-full bg-white rounded-3xl p-8 border-2 border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-blue-100 transition-all flex flex-col items-center justify-center text-center gap-6 cursor-pointer relative overflow-hidden"
                    >
                        <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-2 group-hover:bg-blue-100 transition-colors">
                            <GraduationCap size={48} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">espace ÉLÈVE</h2>
                            <p className="text-slate-500 text-sm max-w-xs mx-auto">
                                Accède à ton parcours de compétences, valide tes acquis et suis ta progression.
                            </p>
                        </div>
                        <div className="absolute bottom-6 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight className="text-blue-400 animate-pulse" />
                        </div>
                    </motion.div>
                </Link>

                {/* Colonne Professeur */}
                <Link href="/teacher" className="group h-full">
                    <motion.div
                        whileHover={{ y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        className="h-full bg-white rounded-3xl p-8 border-2 border-slate-100 shadow-sm hover:border-purple-200 hover:shadow-purple-100 transition-all flex flex-col items-center justify-center text-center gap-6 cursor-pointer relative overflow-hidden"
                    >
                        <div className="w-24 h-24 bg-purple-50 rounded-full flex items-center justify-center text-purple-500 mb-2 group-hover:bg-purple-100 transition-colors">
                            <Briefcase size={48} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 mb-2 group-hover:text-purple-600 transition-colors">espace FORMATEUR</h2>
                            <p className="text-slate-500 text-sm max-w-xs mx-auto">
                                Suis la progression de tes classes, importe tes listes d'élèves et valide les compétences.
                            </p>
                        </div>
                        <div className="absolute bottom-6 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight className="text-purple-400 animate-pulse" />
                        </div>
                    </motion.div>
                </Link>

            </div>

            <div className="fixed bottom-4 text-xs text-slate-300 font-mono">
                v0.2.0 • NDRC Skills Tracker
            </div>
        </main>
    );
}
