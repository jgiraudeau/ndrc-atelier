"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, RefreshCw, Globe, ShoppingCart, Copy,
  CheckCircle, XCircle, Clock, AlertCircle, Layers,
  Download, ExternalLink, Eye, EyeOff, UserCheck
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
  student: { id: string; firstName: string; lastName: string; identifier: string } | null
}

interface ClassItem {
  id: string
  name: string
  code: string
  cpanelUser: string | null
  students?: { id: string }[]
}

interface Student {
  id: string
  firstName: string
  lastName: string
  identifier: string
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:   "bg-white/5 text-slate-500 border-white/10",
  CREATING:  "bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse",
  ACTIVE:    "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  ERROR:     "bg-red-500/20 text-red-400 border-red-500/30",
  SUSPENDED: "bg-amber-500/20 text-amber-400 border-amber-500/30",
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  PENDING:   <Clock size={12} />,
  CREATING:  <Clock size={12} className="animate-spin" />,
  ACTIVE:    <CheckCircle size={12} />,
  ERROR:     <XCircle size={12} />,
  SUSPENDED: <AlertCircle size={12} />,
}

export default function GrillePage() {
  const router = useRouter()
  const [sites, setSites] = useState<Site[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"WORDPRESS" | "PRESTASHOP">("WORDPRESS")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sourceModel, setSourceModel] = useState<string>("")
  const [cloning, setCloning] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const [affectMode, setAffectMode] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [revealedPass, setRevealedPass] = useState<Set<string>>(new Set())

  const token = typeof window !== "undefined" ? localStorage.getItem("ndrc_token") : null

  const loadClasses = useCallback(async () => {
    const res = await fetch("/api/teacher/classes", { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 401) { router.push("/teacher/login"); return }
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

  const loadStudents = useCallback(async (classId: string) => {
    const res = await fetch(`/api/teacher/students?classId=${classId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setStudents(data.students ?? [])
    }
  }, [token])

  useEffect(() => { loadClasses() }, [loadClasses])

  useEffect(() => {
    if (!selectedClass?.cpanelUser) return
    loadSites(selectedClass.cpanelUser, true)
    loadStudents(selectedClass.id)
    const interval = setInterval(() => loadSites(selectedClass.cpanelUser!), 5000)
    return () => clearInterval(interval)
  }, [selectedClass, loadSites, loadStudents])

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

  const handleAssign = async (siteId: string, studentId: string | null) => {
    await fetch("/api/provisioning/sites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ siteId, studentId }),
    })
    // Mise à jour locale immédiate
    setSites(prev => prev.map(s => {
      if (s.id !== siteId) return s
      const student = students.find(st => st.id === studentId) ?? null
      return { ...s, student: student ? { id: student.id, firstName: student.firstName, lastName: student.lastName, identifier: student.identifier } : null }
    }))
  }

  const handleInstall = async () => {
    if (selected.size === 0 || !selectedClass?.cpanelUser) return
    setInstalling(true)
    setMessage(null)
    const res = await fetch("/api/provisioning/install", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subdomains: Array.from(selected), cpanelUser: selectedClass.cpanelUser, siteType: activeTab }),
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
      body: JSON.stringify({ sourceSubdomain: sourceModel, targetSubdomains: Array.from(selected), cpanelUser: selectedClass.cpanelUser }),
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

  const openCpanel = async () => {
    if (!selectedClass?.cpanelUser) return
    const res = await fetch(`/api/provisioning/cpanel-url?cpanelUser=${selectedClass.cpanelUser}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.url) window.open(data.url, "_blank")
    else alert("Impossible d'ouvrir cPanel : " + (data.error ?? "erreur inconnue"))
  }

  const handleRepair = async () => {
    if (!selectedClass?.cpanelUser) return
    setRepairing(true)
    setMessage(null)
    const res = await fetch("/api/provisioning/repair-urls", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ cpanelUser: selectedClass.cpanelUser }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage({ type: "success", text: `Sync Softaculous : ${data.repaired} site(s) actif(s) trouvés, ${data.reset} remis en attente.` })
      loadSites(selectedClass.cpanelUser, false)
    } else {
      setMessage({ type: "error", text: `Erreur réparation : ${data.error ?? "inconnue"}` })
    }
    setRepairing(false)
  }

  // Élèves déjà affectés sur cet onglet (pour éviter double affectation)
  const assignedStudentIds = new Set(studentSites.filter(s => s.student).map(s => s.student!.id))

  // Un site est "installé" s'il a un adminUrl OU s'il est un modèle ACTIVE (créé manuellement)
  const isInstalled = (site: Site) => !!site.adminUrl || (site.isModel && site.status === "ACTIVE")

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-800 via-indigo-950 to-slate-900">
      <header className="sticky top-0 z-20 bg-slate-900/70 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center gap-4">
        <Link href="/teacher/provisioning" className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-purple-500/20 border border-purple-500/30 rounded-xl flex items-center justify-center text-purple-400">
            <Layers size={18} />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Grille des sites</h1>
            <p className="text-xs text-slate-400">Installation, clonage et affectation</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {selectedClass?.cpanelUser && (
            <button onClick={openCpanel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-xs font-bold text-slate-300 transition-all">
              <ExternalLink size={12} /> cPanel
            </button>
          )}
          {selectedClass?.cpanelUser && (
            <button onClick={handleRepair} disabled={repairing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-xs font-bold text-slate-300 transition-all disabled:opacity-40">
              <RefreshCw size={12} className={repairing ? "animate-spin" : ""} />
              {repairing ? "Sync…" : "Réparer URLs"}
            </button>
          )}
          {selectedClass && filteredSites.some(s => !s.isModel && s.status === "ACTIVE") && (
            <button onClick={() => setAffectMode(m => !m)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                affectMode
                  ? "bg-amber-500/20 border border-amber-500/30 text-amber-400"
                  : "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
              }`}>
              <UserCheck size={12} /> {affectMode ? "Terminer affectation" : "Affecter élèves"}
            </button>
          )}
          {selectedClass && (
            <button onClick={() => loadSites(selectedClass.cpanelUser!, true)} className="text-slate-500 hover:text-white transition-colors">
              <RefreshCw size={16} />
            </button>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6 space-y-5">

        {/* Sélection de la classe */}
        <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Classe / Compte cPanel</label>
          {classes.length === 0 ? (
            <div className="text-sm text-amber-400 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
              <AlertCircle size={14} /> Aucune classe assignée à votre compte. Contactez l&apos;administrateur.
            </div>
          ) : (
            <select
              className="w-full px-3 py-2 text-sm bg-black/20 border border-white/10 text-white rounded-xl focus:outline-none focus:border-purple-500/50"
              value={selectedClass?.id ?? ""}
              onChange={e => {
                const cls = classes.find(c => c.id === e.target.value) ?? null
                setSelectedClass(cls)
                setSites([])
                setStudents([])
                setSelected(new Set())
                setMessage(null)
                setAffectMode(false)
              }}
            >
              <option value="">— Sélectionner une classe —</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.cpanelUser ? `(${c.cpanelUser})` : "⚠ pas de compte cPanel"}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedClass && !selectedClass.cpanelUser && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-amber-400 text-sm flex items-center gap-2">
            <AlertCircle size={16} /> Aucun compte cPanel assigné à cette classe.
          </div>
        )}

        {selectedClass?.cpanelUser && (
          <>
            {/* Onglets WP / PS */}
            <div className="flex gap-2">
              {(["WORDPRESS", "PRESTASHOP"] as const).map(type => {
                const total = sites.filter(s => s.type === type).length
                const installed = sites.filter(s => s.type === type && isInstalled(s)).length
                return (
                  <button key={type}
                    onClick={() => { setActiveTab(type); setSelected(new Set()); setAffectMode(false) }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border ${
                      activeTab === type
                        ? type === "WORDPRESS"
                          ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                          : "bg-orange-500/20 border-orange-500/40 text-orange-400"
                        : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    {type === "WORDPRESS" ? <Globe size={14} /> : <ShoppingCart size={14} />}
                    {type === "WORDPRESS" ? "WordPress" : "PrestaShop"}
                    <span className="text-xs opacity-70">({installed} installés / {total})</span>
                  </button>
                )
              })}
            </div>

            {loading && <div className="text-center py-8 text-slate-500 animate-pulse">Chargement des sites...</div>}

            {!loading && filteredSites.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                Aucun sous-domaine trouvé. Lancez d&apos;abord une création de sites.
              </div>
            )}

            {!loading && filteredSites.length > 0 && (
              <>
                {/* Légende */}
                <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/50 inline-block" /> Installé</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white/5 border border-white/10 inline-block" /> Vide (sous-domaine seul)</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-500/30 border border-indigo-500/50 inline-block" /> Sélectionné</span>
                </div>

                {/* Sites modèles */}
                <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                      <Copy size={13} className="text-purple-400" /> Sites modèles
                    </h2>
                    <span className="text-[10px] text-slate-500">Cliquez pour sélectionner comme source de clonage</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {modelSites.map(site => {
                      const installed = isInstalled(site)
                      const isSource = sourceModel === site.subdomain
                      return (
                        <div key={site.id}
                          className={`relative border-2 rounded-xl p-3 cursor-pointer transition-all ${
                            isSource
                              ? "border-purple-500/60 bg-purple-500/10"
                              : installed
                                ? "border-emerald-500/40 bg-emerald-500/8 hover:border-emerald-500/60"
                                : "border-white/10 bg-white/3 hover:border-white/20"
                          }`}
                          onClick={() => setSourceModel(isSource ? "" : site.subdomain)}
                        >
                          {isSource && (
                            <div className="absolute -top-2 -right-2 bg-purple-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">SOURCE</div>
                          )}
                          {installed && !isSource && (
                            <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                              <CheckCircle size={8} /> Installé
                            </div>
                          )}
                          <div className="font-mono font-bold text-white text-sm">{site.subdomain}</div>
                          <div className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLOR[site.status]}`}>
                            {STATUS_ICON[site.status]} {site.status}
                          </div>
                          {site.status === "ACTIVE" && (
                            <>
                              <div className="mt-2 flex gap-1" onClick={e => e.stopPropagation()}>
                                {site.url && (
                                  <a href={site.url} target="_blank" rel="noopener noreferrer"
                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 rounded-lg text-[10px] font-bold transition-colors">
                                    <Globe size={10} /> Site
                                  </a>
                                )}
                                {site.adminUrl && (
                                  <a href={site.adminUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 rounded-lg text-[10px] font-bold transition-colors">
                                    <ExternalLink size={10} /> Admin
                                  </a>
                                )}
                              </div>
                              {site.adminUser && (
                                <div className="mt-1 text-[9px] text-slate-500 font-mono" onClick={e => e.stopPropagation()}>
                                  {site.adminUser}
                                  {site.adminPass && (
                                    <span className="ml-1">
                                      {revealedPass.has(site.subdomain) ? site.adminPass : "••••••"}
                                      <button onClick={() => togglePass(site.subdomain)} className="ml-1 text-slate-600 hover:text-slate-400 align-middle">
                                        {revealedPass.has(site.subdomain) ? <EyeOff size={8} /> : <Eye size={8} />}
                                      </button>
                                    </span>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Sites élèves */}
                <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-white text-xs uppercase tracking-wider">
                      {affectMode
                        ? <span className="flex items-center gap-2 text-amber-400"><UserCheck size={13} /> Mode affectation</span>
                        : <>Sites élèves — <span className="text-purple-400">{selected.size} sélectionné(s)</span></>
                      }
                    </h2>
                    {!affectMode && (
                      <div className="flex gap-3">
                        <button onClick={selectEmpty} className="text-[11px] text-slate-500 hover:text-slate-300 underline">Vides</button>
                        <button onClick={selectAll} className="text-[11px] text-slate-500 hover:text-slate-300 underline">Tous</button>
                        <button onClick={selectNone} className="text-[11px] text-slate-500 hover:text-slate-300 underline">Aucun</button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {studentSites.map(site => {
                      const installed = isInstalled(site)
                      const isSelected = selected.has(site.subdomain)
                      return (
                        <div key={site.id}
                          onClick={() => !affectMode && toggleSelect(site.subdomain)}
                          className={`relative border-2 rounded-xl p-2 transition-all ${
                            affectMode ? "cursor-default" : "cursor-pointer"
                          } ${
                            isSelected
                              ? "border-indigo-500/60 bg-indigo-500/15"
                              : installed
                                ? "border-emerald-500/40 bg-emerald-500/8 hover:border-emerald-500/60"
                                : "border-white/8 bg-white/3 hover:border-white/18"
                          }`}
                        >
                          {isSelected && !affectMode && (
                            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                              <CheckCircle size={9} className="text-white" />
                            </div>
                          )}
                          {installed && !isSelected && (
                            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-500/80 rounded-full flex items-center justify-center">
                              <CheckCircle size={9} className="text-white" />
                            </div>
                          )}
                          <div className={`font-mono font-bold text-xs ${installed ? "text-white" : "text-slate-400"}`}>
                            {site.subdomain}
                          </div>
                          <div className={`mt-1 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_COLOR[site.status]}`}>
                            {STATUS_ICON[site.status]} {site.status}
                          </div>

                          {affectMode && site.status === "ACTIVE" ? (
                            <select
                              value={site.student?.id ?? ""}
                              onChange={e => handleAssign(site.id, e.target.value || null)}
                              onClick={e => e.stopPropagation()}
                              className="mt-1 w-full text-[8px] bg-black/30 border border-white/10 text-white rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                            >
                              <option value="">— aucun —</option>
                              {students.map(st => (
                                <option key={st.id} value={st.id}
                                  disabled={assignedStudentIds.has(st.id) && site.student?.id !== st.id}
                                >
                                  {st.firstName} {st.lastName}
                                  {assignedStudentIds.has(st.id) && site.student?.id !== st.id ? " ✓" : ""}
                                </option>
                              ))}
                            </select>
                          ) : (
                            site.student && (
                              <div className="text-[9px] text-emerald-400 font-bold mt-0.5 truncate">
                                {site.student.firstName} {site.student.lastName}
                              </div>
                            )
                          )}

                          {installed && !affectMode && (
                            <div className="mt-1 flex gap-1" onClick={e => e.stopPropagation()}>
                              {site.url && (
                                <a href={site.url} target="_blank" rel="noopener noreferrer"
                                  className="flex-1 flex items-center justify-center gap-0.5 px-1.5 py-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 rounded text-[8px] font-bold transition-colors">
                                  <Globe size={8} /> Site
                                </a>
                              )}
                              {site.adminUrl && (
                                <a href={site.adminUrl} target="_blank" rel="noopener noreferrer"
                                  className="flex-1 flex items-center justify-center gap-0.5 px-1.5 py-1 bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 rounded text-[8px] font-bold transition-colors">
                                  <ExternalLink size={8} /> Admin
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Barre d'actions */}
                {!affectMode && selected.size > 0 && (
                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 space-y-3">
                    <div className="text-white text-sm font-bold">
                      {selected.size} site(s) sélectionné(s) — {activeTab === "WORDPRESS" ? "WordPress" : "PrestaShop"}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button onClick={handleInstall} disabled={installing || cloning}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-bold text-sm hover:from-emerald-500 hover:to-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-900/30">
                        <Download size={14} />
                        {installing ? "Installation..." : `Installer sur ${selected.size} site(s)`}
                      </button>
                      <div className="text-slate-500 text-xs font-bold">ou cloner depuis :</div>
                      <select value={sourceModel} onChange={e => setSourceModel(e.target.value)}
                        className="px-3 py-2 text-sm rounded-xl bg-black/20 border border-white/10 text-white focus:outline-none focus:border-purple-500/50">
                        <option value="">— Choisir le modèle source —</option>
                        {modelSites.filter(s => s.status === "ACTIVE").map(s => (
                          <option key={s.id} value={s.subdomain}>{s.subdomain}{isInstalled(s) ? " ✓" : ""}</option>
                        ))}
                      </select>
                      <button onClick={handleClone} disabled={!sourceModel || cloning || installing}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-sm hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-900/30">
                        <Copy size={14} />
                        {cloning ? "Clonage..." : "Cloner"}
                      </button>
                    </div>
                  </div>
                )}

                {message && (
                  <div className={`rounded-xl p-3 text-sm border ${
                    message.type === "success"
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : "bg-red-500/10 border-red-500/20 text-red-400"
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
