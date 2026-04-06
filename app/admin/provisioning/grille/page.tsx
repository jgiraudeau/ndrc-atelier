"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, RefreshCw, Globe, ShoppingCart, Copy,
  CheckCircle, XCircle, Clock, AlertCircle, Layers,
  Download, ExternalLink, Eye, EyeOff
} from "lucide-react"
import Link from "next/link"

interface Site {
  id: string
  subdomain: string
  domain: string
  url: string
  adminUrl: string | null
  adminUser: string | null
  adminPass: string | null
  status: "PENDING" | "CREATING" | "ACTIVE" | "ERROR" | "SUSPENDED"
  type: "WORDPRESS" | "PRESTASHOP"
  isModel: boolean
  cpanelUser: string
  student: { firstName: string; lastName: string; identifier: string } | null
}

interface ClassItem {
  id: string
  name: string
  code: string
  cpanelUser: string | null
  teacher?: { name: string }
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:   "bg-slate-100 text-slate-500 border-slate-200",
  CREATING:  "bg-blue-100 text-blue-600 border-blue-200 animate-pulse",
  ACTIVE:    "bg-green-100 text-green-700 border-green-200",
  ERROR:     "bg-red-100 text-red-600 border-red-200",
  SUSPENDED: "bg-amber-100 text-amber-600 border-amber-200",
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  PENDING:   <Clock size={12} />,
  CREATING:  <Clock size={12} className="animate-spin" />,
  ACTIVE:    <CheckCircle size={12} />,
  ERROR:     <XCircle size={12} />,
  SUSPENDED: <AlertCircle size={12} />,
}

export default function AdminGrillePage() {
  const router = useRouter()
  const [sites, setSites] = useState<Site[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"WORDPRESS" | "PRESTASHOP">("WORDPRESS")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sourceModel, setSourceModel] = useState<string>("")
  const [cloning, setCloning] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [revealedPass, setRevealedPass] = useState<Set<string>>(new Set())

  const token = typeof window !== "undefined" ? localStorage.getItem("ndrc_token") : null

  const loadClasses = useCallback(async () => {
    const res = await fetch("/api/admin/classes", { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 401) { router.push("/admin/login"); return }
    const data = await res.json()
    setClasses(data.classes ?? [])
  }, [token, router])

  const loadSites = useCallback(async (cpanelUser: string, showLoader = false) => {
    if (showLoader) setLoading(true)
    const res = await fetch(`/api/provisioning/sites?cpanelUser=${cpanelUser}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setSites(data.sites ?? [])
    }
    if (showLoader) setLoading(false)
  }, [token])

  useEffect(() => { loadClasses() }, [loadClasses])

  useEffect(() => {
    if (!selectedClass?.cpanelUser) return
    loadSites(selectedClass.cpanelUser, true)
    const interval = setInterval(() => loadSites(selectedClass.cpanelUser!), 5000)
    return () => clearInterval(interval)
  }, [selectedClass, loadSites])

  const filteredSites = sites.filter(s => s.type === activeTab)
  const modelSites = filteredSites.filter(s => s.isModel)
  const studentSites = filteredSites.filter(s => !s.isModel)

  const toggleSelect = (subdomain: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(subdomain)) next.delete(subdomain)
      else next.add(subdomain)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(studentSites.map(s => s.subdomain)))
  const selectNone = () => setSelected(new Set())
  const selectEmpty = () => setSelected(new Set(
    studentSites.filter(s => s.status === "PENDING" || s.status === "ERROR").map(s => s.subdomain)
  ))

  const togglePass = (subdomain: string) => {
    setRevealedPass(prev => {
      const next = new Set(prev)
      if (next.has(subdomain)) next.delete(subdomain)
      else next.add(subdomain)
      return next
    })
  }

  const handleInstall = async () => {
    if (selected.size === 0 || !selectedClass?.cpanelUser) return
    setInstalling(true)
    setMessage(null)
    const res = await fetch("/api/provisioning/install", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        subdomains: Array.from(selected),
        cpanelUser: selectedClass.cpanelUser,
        siteType: activeTab,
      }),
    })
    const data = await res.json()
    if (data.started || data.done) {
      setMessage({ type: "success", text: `Installation lancée pour ${selected.size} site(s) — les statuts se mettent à jour automatiquement.` })
      setSelected(new Set())
    } else {
      setMessage({ type: "error", text: `Erreur : ${data.error ?? "inconnue"}` })
    }
    setInstalling(false)
  }

  const handleClone = async () => {
    if (!sourceModel || selected.size === 0 || !selectedClass?.cpanelUser) return
    setCloning(true)
    setMessage(null)
    const res = await fetch("/api/provisioning/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        sourceSubdomain: sourceModel,
        targetSubdomains: Array.from(selected),
        cpanelUser: selectedClass.cpanelUser,
      }),
    })
    const data = await res.json()
    if (data.started || data.done) {
      setMessage({ type: "success", text: `Clonage lancé pour ${selected.size} site(s) — progression en cours...` })
      setSelected(new Set())
    } else {
      setMessage({ type: "error", text: `Erreur : ${data.error ?? "inconnue"}` })
    }
    setCloning(false)
  }

  const cpanelDomain = sites[0]?.domain ?? ""
  const cpanelUrl = selectedClass?.cpanelUser && cpanelDomain
    ? `https://${cpanelDomain}:2083`
    : null

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white px-6 py-4 flex items-center gap-4 shadow-lg">
        <Link href="/admin/provisioning" className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400">
            <Layers size={18} />
          </div>
          <div>
            <h1 className="text-lg font-black">Grille des sites</h1>
            <p className="text-xs text-slate-400">Installation et clonage par sous-domaine</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {cpanelUrl && (
            <a
              href={cpanelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 hover:bg-slate-500 rounded-lg text-xs font-bold text-white transition-colors"
            >
              <ExternalLink size={12} /> cPanel
            </a>
          )}
          {selectedClass && (
            <button onClick={() => loadSites(selectedClass.cpanelUser!, true)} className="text-slate-400 hover:text-white">
              <RefreshCw size={16} />
            </button>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6 space-y-5">

        {/* Sélection de la classe */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Classe / Compte cPanel</label>
          <select
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400"
            value={selectedClass?.id ?? ""}
            onChange={e => {
              const cls = classes.find(c => c.id === e.target.value) ?? null
              setSelectedClass(cls)
              setSites([])
              setSelected(new Set())
              setMessage(null)
            }}
          >
            <option value="">— Sélectionner une classe —</option>
            {classes.map(c => (
              <option key={c.id} value={c.id} disabled={!c.cpanelUser}>
                {c.name} {c.teacher ? `(${c.teacher.name})` : ""} {c.cpanelUser ? `— ${c.cpanelUser}` : "⚠ pas de compte cPanel"}
              </option>
            ))}
          </select>
        </div>

        {selectedClass && !selectedClass.cpanelUser && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm flex items-center gap-2">
            <AlertCircle size={16} /> Aucun compte cPanel assigné à cette classe.
          </div>
        )}

        {selectedClass?.cpanelUser && (
          <>
            {/* Onglets WP / PS */}
            <div className="flex gap-2">
              {(["WORDPRESS", "PRESTASHOP"] as const).map(type => (
                <button
                  key={type}
                  onClick={() => { setActiveTab(type); setSelected(new Set()) }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                    activeTab === type
                      ? type === "WORDPRESS" ? "bg-blue-600 text-white" : "bg-orange-500 text-white"
                      : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {type === "WORDPRESS" ? <Globe size={14} /> : <ShoppingCart size={14} />}
                  {type === "WORDPRESS" ? "WordPress" : "PrestaShop"}
                  <span className="text-xs opacity-70">
                    ({sites.filter(s => s.type === type).filter(s => s.status === "ACTIVE").length}/{sites.filter(s => s.type === type).length})
                  </span>
                </button>
              ))}
            </div>

            {loading && (
              <div className="text-center py-8 text-slate-400 animate-pulse">Chargement des sites...</div>
            )}

            {!loading && filteredSites.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                Aucun sous-domaine trouvé. Lancez d&apos;abord un job de provisioning.
              </div>
            )}

            {!loading && filteredSites.length > 0 && (
              <>
                {/* Section Modèles */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide flex items-center gap-2">
                      <Copy size={14} className="text-slate-400" /> Sites modèles
                    </h2>
                    <span className="text-xs text-slate-400">Cliquez pour sélectionner comme source de clonage</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {modelSites.map(site => (
                      <div
                        key={site.id}
                        className={`relative border-2 rounded-xl p-3 cursor-pointer transition-all ${
                          sourceModel === site.subdomain
                            ? "border-slate-600 bg-slate-50"
                            : "border-slate-200 hover:border-slate-400"
                        }`}
                        onClick={() => setSourceModel(sourceModel === site.subdomain ? "" : site.subdomain)}
                      >
                        {sourceModel === site.subdomain && (
                          <div className="absolute -top-2 -right-2 bg-slate-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            SOURCE
                          </div>
                        )}
                        <div className="font-mono font-bold text-slate-800 text-sm">{site.subdomain}</div>
                        <div className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLOR[site.status]}`}>
                          {STATUS_ICON[site.status]} {site.status}
                        </div>
                        {site.status === "ACTIVE" && (
                          <div className="mt-2 flex flex-col gap-1" onClick={e => e.stopPropagation()}>
                            {site.url && (
                              <a href={site.url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] text-blue-500 hover:underline truncate">
                                <Globe size={9} /> {site.url}
                              </a>
                            )}
                            {site.adminUrl && (
                              <a href={site.adminUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] text-slate-600 hover:underline truncate">
                                <ExternalLink size={9} /> Admin
                              </a>
                            )}
                            {site.adminUser && (
                              <div className="text-[9px] text-slate-400 mt-0.5 font-mono">
                                {site.adminUser}
                                {site.adminPass && (
                                  <span className="ml-1">
                                    {revealedPass.has(site.subdomain) ? site.adminPass : "••••••••"}
                                    <button onClick={() => togglePass(site.subdomain)} className="ml-1 text-slate-300 hover:text-slate-500">
                                      {revealedPass.has(site.subdomain) ? <EyeOff size={8} /> : <Eye size={8} />}
                                    </button>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section Élèves */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">
                      Sites élèves — {selected.size} sélectionné(s)
                    </h2>
                    <div className="flex gap-2">
                      <button onClick={selectEmpty} className="text-xs text-slate-500 hover:text-slate-700 underline">Vides</button>
                      <button onClick={selectAll} className="text-xs text-slate-500 hover:text-slate-700 underline">Tous</button>
                      <button onClick={selectNone} className="text-xs text-slate-500 hover:text-slate-700 underline">Aucun</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {studentSites.map(site => (
                      <div
                        key={site.id}
                        onClick={() => toggleSelect(site.subdomain)}
                        className={`relative border-2 rounded-xl p-2 cursor-pointer transition-all ${
                          selected.has(site.subdomain)
                            ? "border-slate-600 bg-slate-50"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {selected.has(site.subdomain) && (
                          <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-slate-700 rounded-full flex items-center justify-center">
                            <CheckCircle size={10} className="text-white" />
                          </div>
                        )}
                        <div className="font-mono font-bold text-slate-800 text-xs">{site.subdomain}</div>
                        <div className={`mt-1 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_COLOR[site.status]}`}>
                          {STATUS_ICON[site.status]} {site.status}
                        </div>
                        {site.student && (
                          <div className="text-[9px] text-slate-400 mt-0.5 truncate">
                            {site.student.firstName} {site.student.lastName}
                          </div>
                        )}
                        {site.status === "ACTIVE" && (
                          <div className="mt-1 flex flex-col gap-0.5" onClick={e => e.stopPropagation()}>
                            {site.url && (
                              <a href={site.url} target="_blank" rel="noopener noreferrer"
                                className="text-[8px] text-blue-500 hover:underline flex items-center gap-0.5">
                                <Globe size={7} /> Site
                              </a>
                            )}
                            {site.adminUrl && (
                              <a href={site.adminUrl} target="_blank" rel="noopener noreferrer"
                                className="text-[8px] text-slate-600 hover:underline flex items-center gap-0.5">
                                <ExternalLink size={7} /> Admin
                              </a>
                            )}
                            {site.adminUser && (
                              <div className="text-[8px] text-slate-400 font-mono truncate">
                                {site.adminUser}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Barre d'actions */}
                {selected.size > 0 && (
                  <div className="bg-slate-800 rounded-xl p-4 space-y-3">
                    <div className="text-white text-sm font-bold">
                      {selected.size} site(s) sélectionné(s) — {activeTab === "WORDPRESS" ? "WordPress" : "PrestaShop"}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={handleInstall}
                        disabled={installing || cloning}
                        className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg font-bold text-sm hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Download size={14} />
                        {installing ? "Installation..." : `Installer sur ${selected.size} site(s)`}
                      </button>

                      <div className="text-slate-400 text-xs font-bold">ou cloner depuis :</div>

                      <select
                        value={sourceModel}
                        onChange={e => setSourceModel(e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg border border-slate-600 bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                      >
                        <option value="">— Choisir le modèle source —</option>
                        {modelSites.filter(s => s.status === "ACTIVE").map(s => (
                          <option key={s.id} value={s.subdomain}>{s.subdomain}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleClone}
                        disabled={!sourceModel || cloning || installing}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg font-bold text-sm hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Copy size={14} />
                        {cloning ? "Clonage..." : `Cloner`}
                      </button>
                    </div>
                  </div>
                )}

                {message && (
                  <div className={`rounded-xl p-3 text-sm ${
                    message.type === "success"
                      ? "bg-green-50 border border-green-200 text-green-700"
                      : "bg-red-50 border border-red-200 text-red-700"
                  }`}>
                    {message.text}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}
