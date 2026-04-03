"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Server, Plus, Trash2, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface WhmConfig {
  id: string
  label: string
  host: string
  port: number
  whmUser: string
  isActive: boolean
  createdAt: string
}

export default function WhmConfigPage() {
  const router = useRouter()
  const [configs, setConfigs] = useState<WhmConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ label: "", host: "", whmUser: "", whmToken: "", port: "2087" })
  const [error, setError] = useState("")

  const token = typeof window !== "undefined" ? localStorage.getItem("ndrc_token") : null

  const load = async () => {
    const res = await fetch("/api/admin/whm-config", {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 401) { router.push("/admin/login"); return }
    const data = await res.json()
    setConfigs(data.configs ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    const res = await fetch("/api/admin/whm-config", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, port: Number(form.port) }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? "Erreur"); setSaving(false); return }
    setShowForm(false)
    setForm({ label: "", host: "", whmUser: "", whmToken: "", port: "2087" })
    setSaving(false)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette configuration ?")) return
    await fetch(`/api/admin/whm-config?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    load()
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
          <div className="w-9 h-9 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400">
            <Server size={18} />
          </div>
          <div>
            <h1 className="text-lg font-black">Configuration WHM</h1>
            <p className="text-xs text-slate-400">Serveurs o2switch</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <div className="flex justify-end">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} /> Ajouter un serveur
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-sm">
            <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Nouveau serveur WHM</h2>
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle size={14} /> {error}
              </div>
            )}
            {[
              { name: "label", label: "Nom", placeholder: "o2switch Campus 01" },
              { name: "host", label: "Hôte", placeholder: "campus01.o2switch.net" },
              { name: "port", label: "Port WHM", placeholder: "2087" },
              { name: "whmUser", label: "Utilisateur WHM", placeholder: "root" },
              { name: "whmToken", label: "Token WHM API", placeholder: "WHM:TOKEN..." },
            ].map(({ name, label, placeholder }) => (
              <div key={name}>
                <label className="block text-xs font-bold text-slate-600 mb-1">{label}</label>
                <input
                  type={name === "whmToken" ? "password" : "text"}
                  placeholder={placeholder}
                  value={form[name as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [name]: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold text-sm hover:bg-slate-200 transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        {configs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Server size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">Aucun serveur configuré</p>
            <p className="text-sm mt-1">Ajoutez votre serveur o2switch pour commencer</p>
          </div>
        ) : (
          <div className="space-y-3">
            {configs.map((config) => (
              <div key={config.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800">{config.label}</h3>
                    {config.isActive ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        <CheckCircle size={10} /> Actif
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Inactif</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">{config.host}:{config.port}</p>
                  <p className="text-xs text-slate-400">Utilisateur : {config.whmUser}</p>
                </div>
                <button
                  onClick={() => handleDelete(config.id)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
