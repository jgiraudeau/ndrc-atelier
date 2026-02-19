"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Trophy, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProgressStore } from "@/src/store/useProgressStore";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/src/store/useAuthStore";

const PLATFORM_METADATA = [
  {
    id: "wordpress",
    name: "WordPress E5",
    color: "bg-[#2271b1]",
    lightColor: "bg-[#e5f5ff]",
    textColor: "text-[#2271b1]",
    icon: "W",
    level: 2,
    description: "Maîtrise le CMS n°1 mondial",
  },
  {
    id: "prestashop",
    name: "PrestaShop E5",
    color: "bg-[#df0067]",
    lightColor: "bg-[#ffe5f0]",
    textColor: "text-[#df0067]",
    icon: "P",
    level: 1,
    description: "Deviens un expert E-Commerce",
  },
];

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const getProgress = useProgressStore((state) => state.getPlatformProgress);

  useEffect(() => {
    useProgressStore.persist.rehydrate();
    useAuthStore.persist.rehydrate();
    setHydrated(true);

    if (!useAuthStore.getState().isAuthenticated || useAuthStore.getState().user?.role !== 'STUDENT') {
      router.push("/student/login");
    }
  }, []);

  if (!hydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans flex items-center justify-center text-slate-400">
        Chargement...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 font-sans pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { useAuthStore.getState().logout(); router.push("/"); }}
              className="p-2 -ml-2 text-slate-400 hover:text-red-600 transition-colors"
              title="Déconnexion"
            >
              <ArrowRight className="rotate-180" size={24} />
            </button>
            <div className="w-8 h-8 bg-yellow-400 rounded-xl flex items-center justify-center text-white font-bold ml-2">
              <Trophy size={18} />
            </div>
            <span className="font-extrabold text-slate-700 text-lg tracking-tight hidden sm:block">
              NDRC Skills
            </span>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full">
            <Star size={16} className="text-yellow-500 fill-yellow-500" />
            <span className="font-bold text-slate-600 text-sm">340 XP</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-4 pt-8 pb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 mb-2">
          Salut, {user?.name.split(' ')[0]} ! 👋
        </h1>
        <p className="text-slate-500 font-medium">
          Choisis une plateforme pour t'entraîner aujourd'hui.
        </p>
      </div>

      {/* Cards Grid */}
      <div className="max-w-4xl mx-auto px-4 grid md:grid-cols-2 gap-6">
        {PLATFORM_METADATA.map((platform) => {
          const progress = getProgress(platform.id);

          return (
            <Link href={`/student/${platform.id}`} key={platform.id} className="group">
              <motion.div
                whileHover={{ y: -5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "relative overflow-hidden rounded-3xl border-2 border-b-4 p-6 transition-colors h-full flex flex-col justify-between cursor-pointer shadow-sm",
                  platform.id === "wordpress"
                    ? "border-blue-200 hover:border-[#2271b1] bg-white"
                    : "border-pink-200 hover:border-[#df0067] bg-white"
                )}
              >
                {/* Card Header */}
                <div className="flex justify-between items-start mb-6">
                  <div
                    className={cn(
                      "w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-md",
                      platform.color
                    )}
                  >
                    {platform.icon}
                  </div>
                  <div
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide",
                      platform.lightColor,
                      platform.textColor
                    )}
                  >
                    Niveau {platform.level}
                  </div>
                </div>

                {/* Content */}
                <div>
                  <h2 className="text-2xl font-black text-slate-800 mb-1 group-hover:text-black">
                    {platform.name}
                  </h2>
                  <p className="text-slate-500 font-medium text-sm mb-6">
                    {platform.description}
                  </p>

                  {/* Progress Bar Dynamic */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-400 uppercase">
                      <span>Progression</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700 ease-out",
                          platform.color
                        )}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Hover Arrow */}
                <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1">
                  <ArrowRight
                    className={cn(
                      "w-6 h-6",
                      platform.id === "wordpress"
                        ? "text-[#2271b1]"
                        : "text-[#df0067]"
                    )}
                  />
                </div>
              </motion.div>
            </Link>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="max-w-4xl mx-auto px-4 mt-8 flex justify-center">
        <div className="bg-white border-2 border-slate-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm text-slate-500 text-sm font-medium">
          💡 Astuce : Connecte ton site pour valider automatiquement certaines compétences !
        </div>
      </div>
    </main>
  );
}
