"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, BookOpen, MessageSquare, LogOut,
  User, CheckCircle2, Trophy, Clock, ChevronRight, AlertCircle, ShoppingBag, Globe, Target
} from "lucide-react";
import Link from "next/link";
import { apiStudentDashboard, type StudentDashboardData } from "@/src/lib/api-client";
import { cn } from "@/lib/utils";

export default function StudentDashboard() {
  const router = useRouter();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("ndrc_token");
    if (!token) { router.push("/student/login"); return; }

    apiStudentDashboard().then(({ data, error }) => {
      setLoading(false); // Toujours arrêter le chargement
      if (error) {
        console.error("Dashboard error:", error);
        if (error.includes("authentifié") || error.includes("invalide") || error.includes("interdit")) {
          // Token expiré ou invalide
          localStorage.removeItem("ndrc_token");
          router.push("/student/login");
        } else {
          setErrorMsg(error);
        }
        return;
      }
      setData(data);
    });
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("ndrc_token");
    localStorage.removeItem("ndrc_user");
    router.push("/");
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  );

  if (errorMsg) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
      <h1 className="text-xl font-bold text-slate-800 mb-2">Oups, une erreur 😕</h1>
      <p className="text-red-500 font-medium mb-6">{errorMsg}</p>
      <button
        onClick={() => { localStorage.removeItem("ndrc_token"); router.push("/student/login"); }}
        className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition"
      >
        Retour à la connexion
      </button>
    </div>
  );

  if (!data) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800">

      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-100 p-6 fixed h-full z-10">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">N</div>
          <span className="font-extrabold text-xl tracking-tight text-indigo-900">NDRC Skills</span>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="Tableau de bord" active />
          <NavItem icon={<Target size={20} />} label="Missions" href="/student/missions" />
          <NavItem icon={<Globe size={20} />} label="WordPress" href="/student/wordpress" />
          <NavItem icon={<ShoppingBag size={20} />} label="PrestaShop" href="/student/prestashop" />
        </nav>

        <div className="pt-6 border-t border-slate-100">
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all w-full text-sm font-bold">
            <LogOut size={20} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* Mobile Header / Top Bar */}
      <div className="md:hidden fixed top-0 w-full bg-white border-b border-slate-100 z-20 px-4 py-3 flex justify-between items-center">
        <span className="font-extrabold text-indigo-900">NDRC Skills</span>
        <button onClick={handleLogout} className="p-2 text-slate-400"><LogOut size={20} /></button>
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-6 md:p-10 pt-20 md:pt-10 max-w-7xl mx-auto w-full">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900">
              Bonjour, {data.firstName} 👋
            </h1>
            <p className="text-slate-400 mt-1 font-medium text-sm">Prêt à valider de nouvelles compétences ?</p>
          </div>
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
              {data.firstName[0]}{data.lastName[0]}
            </div>
            <div className="text-xs font-bold text-slate-600 pr-2">
              {data.classCode}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column (2/3) */}
          <div className="lg:col-span-2 space-y-8">

            {/* Progress Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Main Progress */}
              <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 relative overflow-hidden flex flex-col justify-between min-h-[200px]">
                <div className="relative z-10">
                  <h3 className="font-bold text-indigo-100 text-sm uppercase tracking-wider mb-1">Progression Globale</h3>
                  <div className="text-5xl font-black">{data.progress.total}%</div>
                  <div className="mt-2 text-indigo-200 text-xs font-medium">
                    {data.progress.acquiredCount} / {data.progress.totalCount} compétences validées
                  </div>
                </div>
                <div className="absolute right-[-20px] top-[-20px] w-40 h-40 border-[20px] border-indigo-500 rounded-full opacity-30" />
                <div className="absolute right-[-40px] bottom-[-40px] w-60 h-60 bg-indigo-500 rounded-full opacity-30 blur-2xl" />

                <div className="relative z-10 mt-6 flex gap-3">
                  <Link href="/student/wordpress" className="flex-1 bg-white/10 hover:bg-white/20 backdrop-blur-sm py-2 px-3 rounded-xl text-xs font-bold text-center transition-colors">
                    Voir WordPress
                  </Link>
                  <Link href="/student/prestashop" className="flex-1 bg-white/10 hover:bg-white/20 backdrop-blur-sm py-2 px-3 rounded-xl text-xs font-bold text-center transition-colors">
                    Voir PrestaShop
                  </Link>
                </div>
              </div>

              {/* Detailed Stats */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-center gap-6">
                <PlatformProgress
                  label="WordPress"
                  value={data.progress.wordpress}
                  color="bg-blue-500"
                  href="/student/wordpress"
                />
                <PlatformProgress
                  label="PrestaShop"
                  value={data.progress.prestashop}
                  color="bg-pink-500"
                  href="/student/prestashop"
                />
              </div>
            </div>

            {/* Recent Activity */}
            <section>
              <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
                <Clock size={20} className="text-slate-400" /> Activité Récente
              </h3>
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                {data.recentActivity.length > 0 ? (
                  <div className="divide-y divide-slate-50">
                    {data.recentActivity.map((activity) => (
                      <div key={activity.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                        <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-700 text-sm truncate">{activity.label}</h4>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(activity.date).toLocaleDateString("fr-FR", { day: 'numeric', month: 'long' })} • {activity.platform}
                          </p>
                        </div>
                        <Link href={`/student/competency/${activity.id}`} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors">
                          <ChevronRight size={20} />
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    Aucune activité récente. Commence par valider une compétence !
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column (1/3) */}
          <div className="space-y-8">
            {/* Notifications / Messages */}
            <section>
              <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
                <MessageSquare size={20} className="text-slate-400" /> Messages Prof
              </h3>
              <div className="space-y-3">
                {data.comments.length > 0 ? (
                  data.comments.map((comment) => (
                    <div key={comment.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative">
                      <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <div className="flex items-center gap-2 mb-2">
                        <User size={14} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-500 uppercase">{comment.author}</span>
                        <span className="text-[10px] text-slate-300">• {new Date(comment.date).toLocaleDateString("fr-FR")}</span>
                      </div>
                      <p className="text-sm text-slate-700 font-medium leading-relaxed">
                        &quot;{comment.text}&quot;
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="bg-white p-6 rounded-3xl border border-dashed border-slate-200 text-center">
                    <p className="text-sm text-slate-400">Aucun nouveau message.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Mes sites */}
            <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
                <Globe size={20} className="text-slate-400" /> Mes Sites Accessibles
              </h3>
              <div className="space-y-3">
                {data.wpUrl ? (
                  <a href={data.wpUrl.startsWith("http") ? data.wpUrl : `https://${data.wpUrl}`} target="_blank" rel="noopener noreferrer" className="block w-full bg-blue-600 text-white font-bold text-center py-3 rounded-xl shadow-md hover:bg-blue-700 transition-all text-sm">
                    🚀 Ouvrir mon WordPress
                  </a>
                ) : (
                  <div className="w-full border-2 border-dashed border-slate-200 text-slate-400 font-bold text-center py-3 rounded-xl text-sm italic">
                    Lien WordPress non configuré
                  </div>
                )}
                {data.prestaUrl ? (
                  <a href={data.prestaUrl.startsWith("http") ? data.prestaUrl : `https://${data.prestaUrl}`} target="_blank" rel="noopener noreferrer" className="block w-full bg-pink-600 text-white font-bold text-center py-3 rounded-xl shadow-md hover:bg-pink-700 transition-all text-sm">
                    🛒 Ouvrir mon PrestaShop
                  </a>
                ) : (
                  <div className="w-full border-2 border-dashed border-slate-200 text-slate-400 font-bold text-center py-3 rounded-xl text-sm italic">
                    Lien PrestaShop non configuré
                  </div>
                )}
              </div>
            </section>

            {/* Quick Actions */}
            <section className="bg-indigo-50 rounded-3xl p-6 border border-indigo-100">
              <h3 className="font-bold text-indigo-900 text-sm uppercase mb-4 flex items-center gap-2">
                <Trophy size={16} /> Objectifs
              </h3>
              <p className="text-sm text-indigo-700 mb-4 leading-relaxed">
                Pour valider ton E5, assure-toi d'avoir au moins 80% de progression sur les deux plateformes.
              </p>
              <Link href="/student/wordpress" className="block w-full bg-indigo-600 text-white font-bold text-center py-3 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-[1.02] transition-all text-sm">
                Continuer ma progression
              </Link>
            </section>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-slate-200 flex justify-around p-3 z-20 pb-safe">
        <MobileNavItem icon={<LayoutDashboard size={24} />} active href="/student" />
        <MobileNavItem icon={<Target size={24} />} href="/student/missions" />
        <MobileNavItem icon={<Globe size={24} />} href="/student/wordpress" />
        <MobileNavItem icon={<ShoppingBag size={24} />} href="/student/prestashop" />
      </nav>
    </div>
  );
}

function NavItem({ icon, label, active = false, href = "#" }: { icon: React.ReactNode, label: string, active?: boolean, href?: string }) {
  return (
    <Link href={href} className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm",
      active ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
    )}>
      {icon}
      {label}
    </Link>
  );
}

function MobileNavItem({ icon, active = false, href = "#" }: { icon: React.ReactNode, active?: boolean, href?: string }) {
  return (
    <Link href={href} className={cn(
      "p-2 rounded-xl transition-colors",
      active ? "text-indigo-600 bg-indigo-50" : "text-slate-400"
    )}>
      {icon}
    </Link>
  );
}

function PlatformProgress({ label, value, color, href }: { label: string, value: number, color: string, href: string }) {
  return (
    <Link href={href} className="group block">
      <div className="flex justify-between items-end mb-2">
        <span className="font-bold text-slate-700 text-sm group-hover:text-indigo-600 transition-colors">{label}</span>
        <span className="font-black text-slate-800 text-xl">{value}%</span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-1000`} style={{ width: `${value}%` }} />
      </div>
    </Link>
  );
}
