"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Zap, ArrowLeft, Play, CheckCircle, XCircle, Clock, AlertCircle, RefreshCw, Trash2 } from "lucide-react"
import Link from "next/link"

interface ProvisioningJob {
  id: string
  siteType: "WORDPRESS" | "PRESTASHOP"
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "PARTIAL"
  createdAt: string
  updatedAt: string
  class: { name: string; code: string }
  sites: { id: string; status: string; type: string }[]
}

interface WhmConfig { id: string; label: string; host: string }
interface Class { id: string; name: string; code: string; _count: { students: number } }

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "En attente", color: "text-amber-600 bg-amber-50" },
  RUNNING: { label: "En cours...", color: "text-blue-600 bg-blue-50" },
  COMPLETED: { label: "Terminé", color: "text-green-600 bg-green-50" },
  FAILED: { label: "Échec", color: "text-red-600 bg-red-50" },
  PARTIAL: { label: "Partiel", color: "text-orange-600 bg-orange-50" },
}

export default function AdminProvisioningPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<ProvisioningJob[]>([])
  const [configs, setConfigs] = useState<WhmConfig[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [running, setRunning] = useState<string | null>(null)
  const [form, setForm] = useState({ classId: "", siteType: "WORDPRESS", whmConfigId: "" })
  const [error, setError] = useState("")

  const token = typeof window !== "undefined" ? localStorage.getItem("ndrc_token") : null

  const load = useCallback(async () => {
    const [jobsRes, configsRes, classesRes] = await Promise.all([
      fetch("/api/provisioning/jobs", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/admin/whm-config", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/admin/classes", { headers: { Authorization: `Bearer ${token}` } }),
    ])
    if (jobsRes.status === 401) { router.push("/admin/login"); return }
    const [jobsData, configsData, classesData] = await Promise.all([jobsRes.json(), configsRes.json(), classesRes.json()])
    setJobs(jobsData.jobs ?? [])
    setConfigs(configsData.configs ?? [])
    setClasses(classesData.classes ?? [])
    setLoading(false)
  }, [token, router])

  useEffect(() => { load() }, [load])

  // Polling auto si un job est en cours
  useEffect(() => {
    const running = jobs.some((j) => j.status === "RUNNING")
    if (!running) return
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

    // 1. Initialiser le job
    await fetch(`/api/provisioning/jobs/${jobId}/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })

    // 2. Déclencher le provisioning sur Railway (fire-and-forget côté Vercel)
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

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white px-6 py-4 flex items-center gap-4 shadow-lg">
        <Link href="/admin" className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400">
            <Zap size={18} />
          </div>
          <div>
            <h1 className="text-lg font-black">Provisioning Sites</h1>
            <p className="text-xs text-slate-400">Création automatique WP / PrestaShop</p>
          </div>
        </div>
        <button onClick={load} className="ml-auto text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={16} />
        </button>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-4">
        {configs.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            Aucun serveur WHM configuré.{" "}
            <Link href="/admin/whm-config" className="font-bold underline">Configurer maintenant →</Link>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(!showForm)}
            disabled={configs.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg font-bold text-sm hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Zap size={16} /> Nouveau job
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-sm">
            <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Créer un job de provisioning</h2>
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle size={14} /> {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Type de site</label>
              <select
                value={form.siteType}
                onChange={(e) => setForm({ ...form, siteType: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="WORDPRESS">WordPress</option>
                <option value="PRESTASHOP">PrestaShop</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Classe</label>
              <select
                value={form.classId}
                onChange={(e) => setForm({ ...form, classId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                required
              >
                <option value="">Sélectionner une classe</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code}) — {c._count.students} élèves
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
                <option value="">Sélectionner un serveur</option>
                {configs.map((c) => (
                  <option key={c.id} value={c.id}>{c.label} ({c.host})</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={creating}
                className="flex-1 py-2 bg-amber-500 text-white rounded-lg font-bold text-sm hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {creating ? "Création..." : "Créer le job"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold text-sm hover:bg-slate-200 transition-colors">
                Annuler
              </button>
            </div>
          </form>
        )}

        {jobs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Zap size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">Aucun job de provisioning</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const st = STATUS_LABELS[job.status]
              const active = job.sites.filter((s) => s.status === "ACTIVE").length
              const errors = job.sites.filter((s) => s.status === "ERROR").length
              return (
                <div key={job.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${job.siteType === "WORDPRESS" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                          {job.siteType}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${st.color}`}>
                          {job.status === "RUNNING" ? <span className="flex items-center gap-1"><Clock size={10} className="animate-spin" /> {st.label}</span> : st.label}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-800">{job.class.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(job.createdAt).toLocaleString("fr-FR")}
                        {job.sites.length > 0 && ` — ${active} ✓  ${errors > 0 ? `${errors} ✗` : ""}`}
                      </p>
                    </div>
                    {job.status === "PENDING" && (
                      <button
                        onClick={() => handleRun(job.id)}
                        disabled={running === job.id}
                        className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg font-bold text-xs hover:bg-green-700 transition-colors disabled:opacity-50 shrink-0"
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
                    {job.status === "COMPLETED" && <CheckCircle size={20} className="text-green-500 shrink-0" />}
                    {job.status === "FAILED" && <XCircle size={20} className="text-red-500 shrink-0" />}
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
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
