"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, UploadCloud, File, Loader2, RefreshCw, CheckCircle2, XCircle, FolderOpen } from "lucide-react"

type KnowledgeDoc = {
  id: string
  displayName: string
  category: string
  platform: string | null
  indexed: boolean
  _count?: { chunks: number }
}

type ReindexResult = {
  message: string
  indexed: number
  total: number
  results: { id: string; name: string; chunks: number; error?: string }[]
}


export default function KnowledgeBaseAdmin() {
  const [documents, setDocuments]         = useState<KnowledgeDoc[]>([])
  const [loading, setLoading]             = useState(true)
  const [file, setFile]                   = useState<File | null>(null)
  const [category, setCategory]           = useState("COURS")
  const [platform, setPlatform]           = useState("NONE")
  const [uploading, setUploading]         = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [reindexing, setReindexing]           = useState(false)
  const [reindexResult, setReindexResult]     = useState<ReindexResult | null>(null)
  const [reindexError, setReindexError]       = useState<string | null>(null)
  const [localIndexing, setLocalIndexing]     = useState(false)
  const [localProgress, setLocalProgress]     = useState<{ current: number; total: number; file: string } | null>(null)
  const [localResult, setLocalResult]         = useState<{ message: string; indexed: number; total: number; results: { file: string; chunks: number; error?: string }[] } | null>(null)
  const [localError, setLocalError]           = useState<string | null>(null)

  const token = typeof window !== "undefined" ? localStorage.getItem("ndrc_token") : null

  useEffect(() => { fetchDocuments() }, [])

  const authHeader = { Authorization: `Bearer ${token}` }

  const fetchDocuments = async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/admin/knowledge", { headers: authHeader })
      const data = await res.json()
      if (res.ok && data.documents) setDocuments(data.documents)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return setError("Veuillez sélectionner un fichier.")
    setUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append("file", file)
    formData.append("category", category)
    formData.append("platform", platform)

    try {
      const res  = await fetch("/api/admin/knowledge", {
        method: "POST",
        headers: authHeader,
        body: formData,
      })
      const data = await res.json()
      if (data.status === "success" || data.document) {
        setFile(null)
        fetchDocuments()
      } else {
        setError(data.error || data.message || "Erreur lors de l'upload.")
      }
    } catch (err: any) {
      setError(err.message || "Erreur réseau.")
    } finally {
      setUploading(false)
    }
  }

  const handleReindex = async (forceAll = false) => {
    setReindexing(true)
    setReindexResult(null)
    setReindexError(null)

    try {
      const res  = await fetch("/api/admin/knowledge/reindex", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ forceAll }),
      })
      const data = await res.json()
      if (res.ok) {
        setReindexResult(data)
        fetchDocuments()
      } else {
        setReindexError(data.error || "Erreur lors de la ré-indexation.")
      }
    } catch (err: any) {
      setReindexError(err.message || "Erreur réseau.")
    } finally {
      setReindexing(false)
    }
  }

  const handleLocalIndex = async () => {
    setLocalIndexing(true)
    setLocalResult(null)
    setLocalError(null)
    setLocalProgress(null)

    try {
      // 1. Obtenir la liste des fichiers
      const listRes  = await fetch("/api/admin/knowledge/index-local", { headers: authHeader })
      const listData = await listRes.json()
      if (!listRes.ok) {
        setLocalError(listData.error || "Impossible de lister les fichiers.")
        return
      }
      const files: { source: string; filename: string }[] = listData.files
      const total = files.length

      if (total === 0) {
        setLocalResult({ message: "Aucun fichier trouvé dans /knowledge/.", indexed: 0, total: 0, results: [] })
        return
      }

      // 2. Purge globale des anciens chunks locaux (premier appel POST avec purgeAll)
      await fetch("/api/admin/knowledge/index-local", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ purgeAll: true }),
      })

      // 3. Traiter chaque fichier un par un
      const results: { file: string; chunks: number; error?: string }[] = []
      let indexed = 0

      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        setLocalProgress({ current: i + 1, total, file: f.filename })

        try {
          const res  = await fetch("/api/admin/knowledge/index-local", {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({ singleFile: f.source }),
          })
          const data = await res.json()
          if (res.ok) {
            results.push({ file: f.source, chunks: data.chunks })
            indexed++
          } else {
            results.push({ file: f.source, chunks: 0, error: data.error || "Erreur" })
          }
        } catch (err: any) {
          results.push({ file: f.source, chunks: 0, error: err.message })
        }
      }

      const totalChunks = results.reduce((s, r) => s + r.chunks, 0)
      setLocalResult({
        message: `${indexed}/${total} fichier(s) indexé(s) — ${totalChunks} chunks créés.`,
        indexed,
        total,
        results,
      })
    } catch (err: any) {
      setLocalError(err.message || "Erreur réseau.")
    } finally {
      setLocalIndexing(false)
      setLocalProgress(null)
    }
  }

  const nonIndexed = documents.filter((d) => !d.indexed).length

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-8">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Base de Connaissances (IA)</h1>
          <p className="text-muted-foreground mt-2">
            Gérez les documents qui alimentent le moteur IA pour la génération de missions.
          </p>
        </div>

        {/* Bloc Re-indexation */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleReindex(false)}
              disabled={reindexing || nonIndexed === 0}
              title={nonIndexed === 0 ? "Tous les docs sont indexés" : `${nonIndexed} doc(s) à indexer`}
            >
              {reindexing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Indexer nouveaux ({nonIndexed})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleReindex(true)}
              disabled={reindexing}
            >
              Tout re-indexer
            </Button>
          </div>

          {/* Résultat re-indexation */}
          {reindexResult && (
            <div className="text-xs text-right text-green-600 dark:text-green-400 max-w-xs">
              <CheckCircle2 className="inline h-3 w-3 mr-1" />
              {reindexResult.message}
            </div>
          )}
          {reindexError && (
            <div className="text-xs text-right text-destructive max-w-xs">
              <XCircle className="inline h-3 w-3 mr-1" />
              {reindexError}
            </div>
          )}
        </div>
      </div>

      {/* Détail résultats si erreurs partielles */}
      {reindexResult && reindexResult.results.some((r) => r.error) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold mb-1">Erreurs sur certains documents :</p>
            <ul className="text-xs space-y-0.5">
              {reindexResult.results.filter((r) => r.error).map((r) => (
                <li key={r.id}><span className="font-medium">{r.name}</span> — {r.error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Formulaire upload */}
        <Card className="col-span-1 border-primary/20 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-primary" />
              Ajouter un document
            </CardTitle>
            <CardDescription>
              Uploadé sur Gemini et indexé automatiquement pour le RAG.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file">Fichier</Label>
                <Input id="file" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
              </div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Catégorie..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COURS">Tutoriel / Cours</SelectItem>
                    <SelectItem value="SUJET">Sujet d'examen</SelectItem>
                    <SelectItem value="CONTEXTE">Contexte Entreprise</SelectItem>
                    <SelectItem value="REFERENTIEL">Référentiel Officiel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Plateforme cible</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger><SelectValue placeholder="Plateforme..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Commun / Général</SelectItem>
                    <SelectItem value="WORDPRESS">WordPress</SelectItem>
                    <SelectItem value="PRESTASHOP">PrestaShop</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {error && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={uploading}>
                {uploading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi en cours...</>
                  : "Uploader vers Gemini"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Liste documents */}
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">
              Documents actifs ({documents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">Chargement...</p>
            ) : documents.length === 0 ? (
              <div className="text-center p-8 border border-dashed rounded-lg bg-muted/50">
                <File className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium text-muted-foreground">Aucun document en ligne.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="bg-primary/10 p-2 rounded-md shrink-0">
                        <File className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{doc.displayName}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="bg-secondary px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold text-muted-foreground">
                            {doc.category}
                          </span>
                          {doc.platform && (
                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold">
                              {doc.platform}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Statut RAG */}
                    <div className="shrink-0 text-right ml-3">
                      {doc.indexed ? (
                        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">
                            {doc._count?.chunks ?? 0} chunks
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-500">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">Non indexé</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Fichiers locaux du repo ── */}
      <Card className="border-amber-200 dark:border-amber-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-amber-500" />
            Fichiers locaux <span className="text-sm font-normal text-muted-foreground">/knowledge/</span>
          </CardTitle>
          <CardDescription>
            Indexe les PDFs et documents commités dans le repo (cours, référentiel, sujets).
            Cette opération peut prendre 2–3 minutes selon le nombre de fichiers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleLocalIndex}
            disabled={localIndexing}
            variant="outline"
            className="border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950"
          >
            {localIndexing
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {localProgress
                    ? `${localProgress.current}/${localProgress.total} — ${localProgress.file}`
                    : "Préparation…"}
                </>
              : <><RefreshCw className="h-4 w-4 mr-2" />Indexer les fichiers locaux</>}
          </Button>

          {localResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                {localResult.message}
              </div>
              {localResult.results.length > 0 && (
                <div className="max-h-48 overflow-y-auto border rounded-md divide-y text-xs">
                  {localResult.results.map((r) => (
                    <div key={r.file} className="flex items-center justify-between px-3 py-1.5">
                      <span className="truncate text-muted-foreground max-w-xs">{r.file}</span>
                      {r.error
                        ? <span className="text-destructive shrink-0 ml-2">{r.error}</span>
                        : <span className="text-green-600 dark:text-green-400 shrink-0 ml-2 font-medium">{r.chunks} chunks</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {localError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              {localError}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
