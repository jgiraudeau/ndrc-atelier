"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Globe, ShoppingCart, ExternalLink, ArrowLeft, Lock, CheckCircle, Clock, AlertCircle } from "lucide-react"
import Link from "next/link"

interface Site {
  id: string
  type: "WORDPRESS" | "PRESTASHOP"
  url: string
  adminUrl: string | null
  adminUser: string | null
  status: "PENDING" | "CREATING" | "ACTIVE" | "ERROR" | "SUSPENDED"
  createdAt: string
}

const STATUS_INFO: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  PENDING: { label: "En attente", icon: <Clock size={14} />, color: "text-amber-600 bg-amber-50" },
  CREATING: { label: "Création en cours...", icon: <Clock size={14} className="animate-spin" />, color: "text-blue-600 bg-blue-50" },
  ACTIVE: { label: "Opérationnel", icon: <CheckCircle size={14} />, color: "text-green-600 bg-green-50" },
  ERROR: { label: "Erreur", icon: <AlertCircle size={14} />, color: "text-red-600 bg-red-50" },
  SUSPENDED: { label: "Suspendu", icon: <Lock size={14} />, color: "text-slate-500 bg-slate-100" },
}

export default function StudentSitesPage() {
  const router = useRouter()
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)

  const token = typeof window !== "undefined" ? localStorage.getItem("ndrc_token") : null

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/student/sites", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) { router.push("/student/login"); return }
      const data = await res.json()
      setSites(data.sites ?? [])
      setLoading(false)
    }
    load()
  }, [token, router])

  const wpSite = sites.find((s) => s.type === "WORDPRESS")
  const psSite = sites.find((s) => s.type === "PRESTASHOP")

  if (loading) return (
    <main className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400 animate-pulse">Chargement...</div>
    </main>
  )

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <header className="px-6 py-4 flex items-center gap-4">
        <Link href="/student" className="text-indigo-300 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-white font-black text-lg">Mes Sites</h1>
      </header>

      <div className="max-w-2xl mx-auto px-6 pb-8 space-y-4">
        <p className="text-indigo-300 text-sm">
          Accédez à vos espaces de travail WordPress et PrestaShop pour pratiquer et valider vos compétences.
        </p>

        {sites.length === 0 ? (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-8 text-center">
            <Globe size={48} className="mx-auto mb-3 text-indigo-300 opacity-50" />
            <p className="text-white font-bold">Aucun site encore créé</p>
            <p className="text-indigo-300 text-sm mt-1">
              Ton formateur va créer tes sites prochainement.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {[
              { site: wpSite, type: "WORDPRESS", icon: <Globe size={24} />, label: "WordPress", color: "from-blue-600 to-blue-800", lightColor: "bg-blue-500/20 text-blue-300" },
              { site: psSite, type: "PRESTASHOP", icon: <ShoppingCart size={24} />, label: "PrestaShop", color: "from-orange-600 to-orange-800", lightColor: "bg-orange-500/20 text-orange-300" },
            ].map(({ site, type, icon, label, color, lightColor }) => (
              <div key={type} className={`bg-gradient-to-br ${color} rounded-2xl p-5 shadow-xl`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${lightColor} rounded-full flex items-center justify-center`}>
                      {icon}
                    </div>
                    <div>
                      <h2 className="text-white font-black">{label}</h2>
                      {site && (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_INFO[site.status].color}`}>
                          {STATUS_INFO[site.status].icon}
                          {STATUS_INFO[site.status].label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {!site ? (
                  <div className="bg-white/10 rounded-xl p-3 text-center text-white/60 text-sm">
                    Site non encore créé
                  </div>
                ) : site.status !== "ACTIVE" ? (
                  <div className="bg-white/10 rounded-xl p-3 text-center text-white/60 text-sm">
                    {STATUS_INFO[site.status].label}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between w-full bg-white/10 hover:bg-white/20 transition-colors rounded-xl px-4 py-3 text-white"
                    >
                      <span className="font-bold text-sm">Voir mon site</span>
                      <ExternalLink size={16} />
                    </a>
                    {site.adminUrl && (
                      <a
                        href={site.adminUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between w-full bg-white/5 hover:bg-white/10 transition-colors rounded-xl px-4 py-3 text-white/80"
                      >
                        <div>
                          <span className="font-bold text-sm">Administration</span>
                          {site.adminUser && (
                            <span className="block text-xs text-white/50">Identifiant : {site.adminUser}</span>
                          )}
                        </div>
                        <Lock size={16} />
                      </a>
                    )}
                    <div className="text-white/40 text-xs text-right">
                      Créé le {new Date(site.createdAt).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <Link
          href="/student"
          className="block text-center text-indigo-300 hover:text-white text-sm font-bold py-2 transition-colors"
        >
          ← Retour au tableau de bord
        </Link>
      </div>
    </main>
  )
}
