"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  User, CheckCircle2, Trophy, Clock, ChevronRight, Globe, ShoppingBag, MessageSquare, KeyRound, LogOut
} from "lucide-react";
import Link from "next/link";
import { apiStudentDashboard, apiChangePassword, type StudentDashboardData } from "@/src/lib/api-client";
import { cn } from "@/lib/utils";

export default function StudentDashboard() {
  const router = useRouter();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: "error", text: "Les mots de passe ne correspondent pas" });
      return;
    }
    if (newPwd.length < 4) {
      setPwdMsg({ type: "error", text: "4 caractères minimum" });
      return;
    }
    setPwdLoading(true);
    const { error } = await apiChangePassword(currentPwd, newPwd);
    setPwdLoading(false);
    if (error) {
      setPwdMsg({ type: "error", text: error });
    } else {
      setPwdMsg({ type: "success", text: "Mot de passe modifié !" });
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      setTimeout(() => setShowPwdForm(false), 2000);
    }
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">


      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 pt-6 md:pt-10 max-w-7xl mx-auto w-full">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900">
              Bonjour, {data.firstName} 👋
            </h1>
            <p className="text-slate-400 mt-1 font-medium text-sm">Prêt à valider de nouvelles compétences ?</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                {data.firstName[0]}{data.lastName[0]}
              </div>
              <div className="text-xs font-bold text-slate-600 pr-2">
                {data.classCode}
              </div>
            </div>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 transition-colors rounded-lg" title="Déconnexion">
              <LogOut size={18} />
            </button>
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
                          {activity.teacherStatus !== null && activity.teacherStatus !== undefined && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <MessageSquare size={11} className="text-indigo-500" />
                              <span className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                                activity.teacherStatus === 1 ? "bg-slate-200 text-slate-600" :
                                activity.teacherStatus === 2 ? "bg-blue-100 text-blue-700" :
                                activity.teacherStatus === 3 ? "bg-green-100 text-green-700" :
                                activity.teacherStatus === 4 ? "bg-purple-100 text-purple-700" :
                                "bg-red-100 text-red-700"
                              )}>
                                Prof : {activity.teacherStatus === 0 ? "Non validé" : activity.teacherStatus === 1 ? "Novice" : activity.teacherStatus === 2 ? "Apprenti" : activity.teacherStatus === 3 ? "Compétent" : "Expert"}
                              </span>
                              {activity.teacherFeedback && (
                                <span className="text-[10px] text-indigo-400 truncate max-w-[140px]" title={activity.teacherFeedback}>
                                  — {activity.teacherFeedback}
                                </span>
                              )}
                            </div>
                          )}
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
                <Link href="/student/sites" className="block w-full border border-slate-200 text-slate-600 font-bold text-center py-2 rounded-xl text-sm hover:bg-slate-50 transition-colors">
                  Voir mes sites &amp; identifiants →
                </Link>
              </div>
            </section>

            {/* Objectifs */}
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

            {/* Changer mot de passe */}
            <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <button
                onClick={() => { setShowPwdForm(!showPwdForm); setPwdMsg(null); }}
                className="w-full flex items-center justify-between text-sm font-bold text-slate-700"
              >
                <span className="flex items-center gap-2"><KeyRound size={16} className="text-slate-400" /> Changer mon mot de passe</span>
                <ChevronRight size={16} className={`text-slate-400 transition-transform ${showPwdForm ? "rotate-90" : ""}`} />
              </button>
              {showPwdForm && (
                <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
                  <input
                    type="password"
                    placeholder="Mot de passe actuel"
                    value={currentPwd}
                    onChange={e => setCurrentPwd(e.target.value)}
                    className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-400"
                    autoComplete="current-password"
                  />
                  <input
                    type="password"
                    placeholder="Nouveau mot de passe"
                    value={newPwd}
                    onChange={e => setNewPwd(e.target.value)}
                    className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-400"
                    autoComplete="new-password"
                  />
                  <input
                    type="password"
                    placeholder="Confirmer le nouveau mot de passe"
                    value={confirmPwd}
                    onChange={e => setConfirmPwd(e.target.value)}
                    className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-400"
                    autoComplete="new-password"
                  />
                  {pwdMsg && (
                    <div className={`p-2.5 rounded-lg text-xs font-bold text-center ${pwdMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                      {pwdMsg.text}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={pwdLoading || !currentPwd || !newPwd || !confirmPwd}
                    className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-indigo-700 disabled:opacity-40 transition-all"
                  >
                    {pwdLoading ? "..." : "Modifier"}
                  </button>
                </form>
              )}
            </section>
          </div>
        </div>
      </main>

    </div>
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
