"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Zap, ArrowLeft, Play, CheckCircle, XCircle, Clock,
  AlertCircle, RefreshCw, Globe, ShoppingCart, Trash2
} from "lucide-react"
import Link from "next/link"

interface ProvisioningJob {
  id: string
  siteType: "WORDPRESS" | "PRESTASHOP"
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "PARTIAL"
  log: string[]
  createdAt: string
  class: { name: string; code: string }
  sites: { id: string; status: string; type: string; studentId: string }[]
}

interface WhmConfig { id: string; label: string; host: string }
interface ClassItem {
  id: string
  name: string
  code: string
  students: { id: string }[]
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "text-amber-600 bg-amber-50",
  RUNNING: "text-blue-600 bg-blue-50",
  COMPLETED: "text-green-600 bg-green-50",
  FAILED: "text-red-600 bg-red-50",
  PARTIAL: "text-orange-600 bg-orange-50",
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  RUNNING: "En cours...",
  COMPLETED: "Terminé",
  FAILED: "Échec",
  PARTIAL: "Partiel",
}

export default function TeacherProvisioningPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<ProvisioningJob[]>([])
  const [configs, setConfigs] = useState<WhmConfig[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [running, setRunning] = useState<string | null>(null)
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [form, setForm] = useState({ classId: "", siteType: "WORDPRESS", whmConfigId: "" })
  const [error, setError] = useState("")

  const token = typeof window !== "undefined" ? localStorage.getItem("ndrc_token") : null

  const loadClasses = useCallback(async () => {
    const res = await fetch("/api/teacher/classes", {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setClasses(data.classes ?? [])
    }
  }, [token])

  const load = useCallback(async () => {
    const [jobsRes, configsRes] = await Promise.all([
      fetch("/api/provisioning/jobs", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/teacher/whm-config", { headers: { Authorization: `Bearer ${token}` } }),
    ])
    if (jobsRes.status === 401) { router.push("/teacher/login"); return }
    const [jobsData, configsData] = await Promise.all([jobsRes.json(), configsRes.json()])
    setJobs(jobsData.jobs ?? [])
    setConfigs(configsData.configs ?? [])
    await loadClasses()
    setLoading(false)
  }, [token, router, loadClasses])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const hasRunning = jobs.some((j) => j.status === "RUNNING")
    if (!hasRunning) return
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [jobs, load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError("")
    const res = await fetch("/api/provisioning/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? "Erreur"); setCreating(false); return }
    setShowForm(false)
    setCreating(false)
    load()
  }

  const handleRun = async (jobId: string) => {
    setRunning(jobId)

    // 1. Initialiser le job (PENDING → RUNNING, crée les Sites)
    await fetch(`/api/provisioning/jobs/${jobId}/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })

    // 2. Déclencher le provisioning sur Railway (fire-and-forget côté Vercel)
    // Railway traite tous les élèves sans limite de temps.
    // Le polling toutes les 3s (useEffect ci-dessous) affiche la progression.
    fetch(`/api/provisioning/jobs/${jobId}/step`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })

    setRunning(null)
    await load()
  }

  if (loading) return (
    <main className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400 animate-pulse">Chargement...</div>
    </main>
  )

  const hasActiveConfig = configs.length > 0

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-indigo-900 text-white px-6 py-4 flex items-center gap-4 shadow-lg">
        <Link href="/teacher" className="text-indigo-300 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400">
            <Zap size={18} />
          </div>
          <div>
            <h1 className="text-lg font-black">Créer les sites élèves</h1>
            <p className="text-xs text-indigo-300">1 WordPress + 1 PrestaShop par élève</p>
          </div>
        </div>
        <button onClick={load} className="ml-auto text-indigo-300 hover:text-white transition-colors">
          <RefreshCw size={16} />
        </button>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-4">
        {/* Info cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-3">
            <Globe size={24} className="text-blue-500" />
            <div>
              <div className="font-bold text-blue-800 text-sm">WordPress</div>
              <div className="text-xs text-blue-600">Site vitrine / blog</div>
            </div>
          </div>
          <div className="bg-orange-50 rounded-xl p-4 flex items-center gap-3">
            <ShoppingCart size={24} className="text-orange-500" />
            <div>
              <div className="font-bold text-orange-800 text-sm">PrestaShop</div>
              <div className="text-xs text-orange-600">E-commerce</div>
            </div>
          </div>
        </div>

        {!hasActiveConfig && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            Aucun serveur WHM disponible. Contactez l&apos;administrateur.
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(!showForm)}
            disabled={!hasActiveConfig || classes.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg font-bold text-sm hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Zap size={16} /> Lancer un provisioning
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-sm">
            <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Nouveau job</h2>
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle size={14} /> {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Type de site</label>
              <div className="grid grid-cols-2 gap-2">
                {["WORDPRESS", "PRESTASHOP"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm({ ...form, siteType: type })}
                    className={`py-2 rounded-lg text-sm font-bold border-2 transition-colors ${form.siteType === type
                      ? type === "WORDPRESS" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {type === "WORDPRESS" ? "WordPress" : "PrestaShop"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Classe cible</label>
              <select
                value={form.classId}
                onChange={(e) => setForm({ ...form, classId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                required
              >
                <option value="">Sélectionner une classe</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.students.length} élèves
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Serveur WHM</label>
              <select
                value={form.whmConfigId}
                onChange={(e) => setForm({ ...form, whmConfigId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                required
              >
                <option value="">Sélectionner</option>
                {configs.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={creating}
                className="flex-1 py-2 bg-amber-500 text-white rounded-lg font-bold text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors">
                {creating ? "Création..." : "Créer le job"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold text-sm hover:bg-slate-200 transition-colors">
                Annuler
              </button>
            </div>
          </form>
        )}

        {/* Liste des jobs */}
        {jobs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Zap size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">Aucun job lancé</p>
            <p className="text-sm mt-1">Cliquez sur &quot;Lancer un provisioning&quot; pour créer les sites de votre classe</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${job.siteType === "WORDPRESS" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                        {job.siteType}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_STYLE[job.status]}`}>
                        {STATUS_LABEL[job.status]}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-800">{job.class.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(job.createdAt).toLocaleString("fr-FR")}
                      {job.sites.length > 0 && (
                        <> — {job.sites.filter((s) => s.status === "ACTIVE").length}/{job.sites.length} sites créés</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {job.status === "PENDING" && (
                      <button
                        onClick={() => handleRun(job.id)}
                        disabled={running === job.id}
                        className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg font-bold text-xs hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {running === job.id
                          ? <><Clock size={12} className="animate-spin" /> Démarrage</>
                          : <><Play size={12} /> Lancer</>
                        }
                      </button>
                    )}
                    {(job.status === "RUNNING" || job.status === "PENDING") && running !== job.id && (
                      <button
                        onClick={async () => {
                          await fetch(`/api/provisioning/jobs/${job.id}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${token}` } })
                          load()
                        }}
                        className="flex items-center gap-1 px-2 py-1.5 bg-red-100 text-red-600 rounded-lg font-bold text-xs hover:bg-red-200 transition-colors"
                      >
                        <XCircle size={12} /> Annuler
                      </button>
                    )}
                    {job.status === "COMPLETED" && <CheckCircle size={20} className="text-green-500" />}
                    {job.status === "FAILED" && <XCircle size={20} className="text-red-500" />}
                    {(job.status === "FAILED" || job.status === "COMPLETED" || job.status === "PARTIAL") && (
                      <button
                        onClick={async () => {
                          if (!confirm("Supprimer ce job ?")) return
                          await fetch(`/api/provisioning/jobs/${job.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
                          load()
                        }}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    {job.log.length > 0 && (
                      <button
                        onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                        className="text-xs text-slate-400 hover:text-slate-600 underline"
                      >
                        {expandedJob === job.id ? "Masquer" : "Logs"}
                      </button>
                    )}
                  </div>
                </div>

                {expandedJob === job.id && job.log.length > 0 && (
                  <div className="border-t border-slate-100 bg-slate-900 p-3 max-h-48 overflow-y-auto">
                    {job.log.map((line, i) => (
                      <p key={i} className={`text-xs font-mono ${line.includes("✓") ? "text-green-400" : line.includes("✗") || line.includes("ERREUR") ? "text-red-400" : "text-slate-300"}`}>
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
