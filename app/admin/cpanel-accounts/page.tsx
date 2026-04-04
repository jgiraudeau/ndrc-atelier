"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, UserCog, Plus, Download, CheckCircle, AlertCircle,
  Link2, RefreshCw, Eye, EyeOff, Copy, Trash2, PenLine
} from "lucide-react"
import Link from "next/link"

interface CpanelAccount {
  id: string; username: string; domain: string; plan: string; status: string; createdAt: string
  cpanelToken: string | null
  whmConfig: { label: string; host: string }
}
interface WhmAccount { user: string; domain: string; diskused: string; disklimit: string; plan: string }
interface WhmConfig { id: string; label: string; host: string }
interface ClassItem {
  id: string; name: string; code: string; cpanelUser: string | null
  teacher: { name: string }; _count: { students: number }
}

type Tab = "managed" | "create" | "import"

function ManualImport({ whmConfigId, token, onImported }: { whmConfigId: string; token: string | null; onImported: () => void }) {
  const [username, setUsername] = useState("")
  const [domain, setDomain] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")
    const res = await fetch("/api/admin/cpanel-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ whmConfigId, username: username.trim(), domain: domain.trim(), password: "imported", skipWhmCreate: true }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? "Erreur"); setLoading(false); return }
    setSuccess(`Compte "${username}" importé !`)
    setUsername("")
    setDomain("")
    setLoading(false)
    onImported()
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <PenLine size={13} /> Saisie manuelle (sans API WHM)
      </h3>
      {error && <div className="text-xs text-red-600 mb-2 flex items-center gap-1"><AlertCircle size={12} />{error}</div>}
      {success && <div className="text-xs text-green-600 mb-2 flex items-center gap-1"><CheckCircle size={12} />{success}</div>}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-[10px] font-bold text-slate-500 mb-1">Nom du compte cPanel</label>
          <input type="text" placeholder="ndrc1a" value={username} onChange={e => setUsername(e.target.value.toLowerCase())}
            className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" required />
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-bold text-slate-500 mb-1">Domaine</label>
          <input type="text" placeholder="ndrc1a.campus01.o2switch.net" value={domain} onChange={e => setDomain(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" required />
        </div>
        <button type="submit" disabled={loading}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-40 transition-colors shrink-0">
          {loading ? "..." : "Importer"}
        </button>
      </form>
    </div>
  )
}

export default function CpanelAccountsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("managed")
  const [accounts, setAccounts] = useState<CpanelAccount[]>([])
  const [whmAccounts, setWhmAccounts] = useState<WhmAccount[]>([])
  const [configs, setConfigs] = useState<WhmConfig[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [whmLoading, setWhmLoading] = useState(false)
  const [whmError, setWhmError] = useState("")

  // Form création
  const [form, setForm] = useState({ whmConfigId: "", username: "", domain: "", plan: "default" })
  const [creating, setCreating] = useState(false)
  const [createdPassword, setCreatedPassword] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)
  const [createError, setCreateError] = useState("")

  // Token cPanel
  const [editingToken, setEditingToken] = useState<string | null>(null)
  const [tokenValue, setTokenValue] = useState("")
  const [savingToken, setSavingToken] = useState(false)

  // Assignation
  const [assigning, setAssigning] = useState<string | null>(null)
  const [assignClassId, setAssignClassId] = useState<Record<string, string>>({})

  const token = typeof window !== "undefined" ? localStorage.getItem("ndrc_token") : null

  const load = useCallback(async () => {
    const [acRes, cfgRes, clsRes] = await Promise.all([
      fetch("/api/admin/cpanel-accounts", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/admin/whm-config", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/admin/classes", { headers: { Authorization: `Bearer ${token}` } }),
    ])
    if (acRes.status === 401) { router.push("/admin/login"); return }
    const [acData, cfgData, clsData] = await Promise.all([acRes.json(), cfgRes.json(), clsRes.json()])
    setAccounts(acData.accounts ?? [])
    setConfigs(cfgData.configs ?? [])
    setClasses(clsData.classes ?? [])
    setLoading(false)
  }, [token, router])

  useEffect(() => { load() }, [load])

  const loadWhmAccounts = async () => {
    if (!form.whmConfigId) return
    setWhmLoading(true)
    setWhmError("")
    try {
      const res = await fetch(`/api/admin/cpanel-accounts/whm-list?whmConfigId=${form.whmConfigId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { setWhmError(data.error ?? `Erreur ${res.status}`); setWhmLoading(false); return }
      setWhmAccounts(data.accounts ?? [])
    } catch (e: unknown) {
      setWhmError(e instanceof Error ? e.message : "Erreur réseau")
    }
    setWhmLoading(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError("")
    setCreatedPassword(null)
    const res = await fetch("/api/admin/cpanel-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setCreateError(data.error ?? "Erreur"); setCreating(false); return }
    setCreatedPassword(data.password)
    setCreating(false)
    load()
  }

  const handleAssign = async (username: string, classId: string) => {
    if (!classId) return
    setAssigning(username)
    await fetch("/api/admin/classes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ classId, cpanelUser: username }),
    })
    setAssigning(null)
    load()
  }

  const handleUnassign = async (classId: string) => {
    await fetch("/api/admin/classes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ classId, cpanelUser: null }),
    })
    load()
  }

  const saveToken = async (id: string) => {
    setSavingToken(true)
    await fetch("/api/admin/cpanel-accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, cpanelToken: tokenValue }),
    })
    setSavingToken(false)
    setEditingToken(null)
    load()
  }

  const copyPassword = () => {
    if (createdPassword) { navigator.clipboard.writeText(createdPassword); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  if (loading) return (
    <main className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400 animate-pulse">Chargement...</div>
    </main>
  )

  const classesWithCpanel = classes.filter(c => c.cpanelUser)
  const classesWithout = classes.filter(c => !c.cpanelUser)

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white px-6 py-4 flex items-center gap-4 shadow-lg">
        <Link href="/admin" className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-green-500/20 rounded-full flex items-center justify-center text-green-400">
            <UserCog size={18} />
          </div>
          <div>
            <h1 className="text-lg font-black">Comptes cPanel</h1>
            <p className="text-xs text-slate-400">1 compte par classe — hébergement des sites élèves</p>
          </div>
        </div>
        <button onClick={load} className="ml-auto text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={16} />
        </button>
      </header>

      {/* Onglets */}
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 flex gap-1 pt-2">
          {([
            { key: "managed" as Tab, label: "Comptes gérés", count: accounts.length },
            { key: "create" as Tab, label: "Créer un compte" },
            { key: "import" as Tab, label: "Importer depuis WHM" },
          ]).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${tab === key ? "bg-slate-50 border border-b-0 border-slate-200 text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
            >
              {label}{count !== undefined && <span className="ml-1.5 bg-slate-200 text-slate-600 text-xs px-1.5 py-0.5 rounded-full">{count}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-4">

        {/* Onglet : Comptes gérés */}
        {tab === "managed" && (
          <>
            {/* Résumé assignations */}
            {classes.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-xl p-4">
                  <div className="text-2xl font-black text-green-700">{classesWithCpanel.length}</div>
                  <div className="text-xs font-bold text-green-600">Classe{classesWithCpanel.length !== 1 ? "s" : ""} avec compte cPanel</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-4">
                  <div className="text-2xl font-black text-amber-700">{classesWithout.length}</div>
                  <div className="text-xs font-bold text-amber-600">Classe{classesWithout.length !== 1 ? "s" : ""} sans compte cPanel</div>
                </div>
              </div>
            )}

            {accounts.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <UserCog size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-bold">Aucun compte cPanel géré</p>
                <p className="text-sm mt-1">Créez un compte ou importez depuis WHM</p>
                <button onClick={() => setTab("create")} className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors">
                  Créer un compte
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {accounts.map((acc) => {
                  const assignedClasses = classes.filter(c => c.cpanelUser === acc.username)
                  return (
                    <div key={acc.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-black text-slate-800">{acc.username}</h3>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${acc.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                              {acc.status}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500">{acc.domain}</p>
                          <p className="text-xs text-slate-400">{acc.whmConfig.label} — {acc.whmConfig.host}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {assignedClasses.length > 0 ? (
                            <div className="space-y-1">
                              {assignedClasses.map(c => (
                                <div key={c.id} className="flex items-center gap-1 text-xs">
                                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{c.code}</span>
                                  <button onClick={() => handleUnassign(c.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Non assigné</span>
                          )}
                        </div>
                      </div>

                      {/* Token API cPanel */}
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        {editingToken === acc.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Token API cPanel (Security → Manage API Tokens)"
                              value={tokenValue}
                              onChange={e => setTokenValue(e.target.value)}
                              className="flex-1 text-xs px-2 py-1.5 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
                            />
                            <button onClick={() => saveToken(acc.id)} disabled={savingToken}
                              className="px-2 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-40 shrink-0">
                              {savingToken ? "..." : "Sauvegarder"}
                            </button>
                            <button onClick={() => setEditingToken(null)} className="px-2 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs hover:bg-slate-200 shrink-0">
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {acc.cpanelToken ? (
                              <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                                <CheckCircle size={11} /> Token cPanel configuré
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                                <AlertCircle size={11} /> Pas de token cPanel
                              </span>
                            )}
                            <button
                              onClick={() => { setEditingToken(acc.id); setTokenValue(acc.cpanelToken ?? "") }}
                              className="text-xs text-blue-600 hover:underline">
                              {acc.cpanelToken ? "Modifier" : "Ajouter le token →"}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Assigner à une classe */}
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                        <Link2 size={14} className="text-slate-400 shrink-0" />
                        <select
                          value={assignClassId[acc.username] ?? ""}
                          onChange={e => setAssignClassId({ ...assignClassId, [acc.username]: e.target.value })}
                          className="flex-1 text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                        >
                          <option value="">Assigner à une classe...</option>
                          {classes.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.code}) — {c._count.students} élèves
                              {c.cpanelUser ? ` [actuellement: ${c.cpanelUser}]` : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAssign(acc.username, assignClassId[acc.username])}
                          disabled={!assignClassId[acc.username] || assigning === acc.username}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 disabled:opacity-40 transition-colors shrink-0"
                        >
                          {assigning === acc.username ? "..." : "Assigner"}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Onglet : Créer un compte */}
        {tab === "create" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Nouveau compte cPanel</h2>

            {configs.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-700 text-sm flex items-center gap-2">
                <AlertCircle size={14} />
                Aucun serveur WHM configuré. <Link href="/admin/whm-config" className="font-bold underline">Configurer →</Link>
              </div>
            )}

            {createError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle size={14} /> {createError}
              </div>
            )}

            {createdPassword && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-green-700 font-bold text-sm mb-2">
                  <CheckCircle size={16} /> Compte créé avec succès !
                </div>
                <p className="text-xs text-green-600 mb-2">Conservez ce mot de passe — il ne sera plus affiché :</p>
                <div className="flex items-center gap-2 bg-white rounded-lg border border-green-200 px-3 py-2">
                  <code className="flex-1 text-sm font-mono text-slate-800">
                    {showPassword ? createdPassword : "•".repeat(createdPassword.length)}
                  </code>
                  <button onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={copyPassword} className="text-slate-400 hover:text-green-600">
                    {copied ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Serveur WHM</label>
                <select value={form.whmConfigId} onChange={e => setForm({ ...form, whmConfigId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" required>
                  <option value="">Sélectionner</option>
                  {configs.map(c => <option key={c.id} value={c.id}>{c.label} ({c.host})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nom du compte</label>
                  <input type="text" placeholder="ndrc1" value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "") })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" required />
                  <p className="text-[10px] text-slate-400 mt-0.5">Minuscules + chiffres, max 8 car.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Domaine principal</label>
                  <input type="text" placeholder="ndrc1.campus01.o2switch.net" value={form.domain}
                    onChange={e => setForm({ ...form, domain: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Plan d&apos;hébergement</label>
                <input type="text" placeholder="default" value={form.plan}
                  onChange={e => setForm({ ...form, plan: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <button type="submit" disabled={creating || configs.length === 0}
                className="w-full py-2.5 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                <Plus size={16} /> {creating ? "Création en cours..." : "Créer le compte cPanel"}
              </button>
            </form>
          </div>
        )}

        {/* Onglet : Importer depuis WHM */}
        {tab === "import" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-600 mb-1">Serveur WHM</label>
                <select value={form.whmConfigId} onChange={e => setForm({ ...form, whmConfigId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">Sélectionner un serveur</option>
                  {configs.map(c => <option key={c.id} value={c.id}>{c.label} ({c.host})</option>)}
                </select>
              </div>
              <button onClick={loadWhmAccounts} disabled={!form.whmConfigId || whmLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-40 transition-colors shrink-0">
                <Download size={14} /> {whmLoading ? "Chargement..." : "Charger les comptes"}
              </button>
            </div>

            {whmAccounts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">{whmAccounts.length} comptes sur le serveur</p>
                {whmAccounts.map((acc) => {
                  const alreadyManaged = accounts.some(a => a.username === acc.user)
                  const assignedClass = classes.find(c => c.cpanelUser === acc.user)
                  return (
                    <div key={acc.user} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-800 text-sm">{acc.user}</h3>
                          {alreadyManaged && <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">Géré</span>}
                          {assignedClass && <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">{assignedClass.code}</span>}
                        </div>
                        <p className="text-xs text-slate-400">{acc.domain} — {acc.diskused}/{acc.disklimit}</p>
                      </div>
                      {!alreadyManaged && (
                        <button
                          onClick={async () => {
                            await fetch("/api/admin/cpanel-accounts", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ whmConfigId: form.whmConfigId, username: acc.user, domain: acc.domain, password: "imported", plan: acc.plan, skipWhmCreate: true }),
                            })
                            load()
                          }}
                          className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors shrink-0"
                        >
                          Importer
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {whmError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div><strong>Erreur de connexion WHM :</strong><br />{whmError}</div>
                </div>
                {whmError.includes("403") && (
                  <div className="bg-red-100 rounded-lg p-3 text-xs text-red-800 space-y-1">
                    <p className="font-bold">Causes possibles (403 Forbidden) :</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Le token API a des <strong>restrictions d&apos;ACL</strong> : dans WHM → <em>Development → Manage API Tokens</em>, vérifiez que le token a accès à <code>list-accts</code> et <code>create-user-session</code> (ou choisissez &quot;All Features&quot;)</li>
                      <li>Le token a une <strong>restriction d&apos;IP</strong> : supprimez-la ou mettez &quot;All IPs&quot; pour autoriser Vercel</li>
                      <li>O2switch mutualisé bloque cet appel WHM API pour les revendeurs</li>
                    </ul>
                    <p className="mt-1 font-bold">Astuce : utilisez la saisie manuelle ci-dessous pour importer quand même.</p>
                  </div>
                )}
              </div>
            )}

            {/* Saisie manuelle comme alternative */}
            {form.whmConfigId && (
              <ManualImport whmConfigId={form.whmConfigId} token={token} onImported={load} />
            )}

            {whmAccounts.length === 0 && !whmLoading && !whmError && form.whmConfigId && (
              <div className="text-center py-4 text-slate-400 text-sm">Cliquez sur &quot;Charger les comptes&quot; ou utilisez la saisie manuelle ci-dessous.</div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
