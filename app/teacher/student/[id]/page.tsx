"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, CheckCircle2, BookOpen, Save, ExternalLink,
    ChevronDown, ChevronUp, Loader2, Globe, User, Filter
} from "lucide-react";
import { ALL_COMPETENCIES } from "@/src/data/competencies";
import { apiGetStudent, apiGradeCompetency, type StudentWithProgress } from "@/src/lib/api-client";

const TOTAL_COMPETENCIES = ALL_COMPETENCIES.length;

const STATUS_LABELS: Record<number, { label: string; color: string; bg: string }> = {
    0: { label: "Non évalué", color: "text-slate-400", bg: "bg-slate-50" },
    1: { label: "Novice", color: "text-slate-600", bg: "bg-slate-100" },
    2: { label: "Apprenti", color: "text-blue-600", bg: "bg-blue-50" },
    3: { label: "Compétent", color: "text-green-600", bg: "bg-green-50" },
    4: { label: "Expert", color: "text-purple-600", bg: "bg-purple-50" },
};

const LEVEL_NAMES: Record<number, string> = {
    1: "Découverte",
    2: "Construction",
    3: "Gestion",
    4: "Expertise",
};

type PlatformFilter = "ALL" | "WORDPRESS" | "PRESTASHOP";
type EvalFilter = "ALL" | "TO_EVALUATE" | "VALIDATED" | "REJECTED";

export default function StudentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const studentId = Array.isArray(params?.id) ? params.id[0] : params?.id;

    const [student, setStudent] = useState<StudentWithProgress | null>(null);
    const [loading, setLoading] = useState(true);

    // Filtres
    const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("ALL");
    const [levelFilter, setLevelFilter] = useState<number | null>(null);
    const [evalFilter, setEvalFilter] = useState<EvalFilter>("ALL");

    // État local de notation : { [competencyId]: { teacherStatus, teacherFeedback } }
    const [gradeInputs, setGradeInputs] = useState<Record<string, { teacherStatus: number; teacherFeedback: string }>>({});
    const [savingId, setSavingId] = useState<string | null>(null);
    const [savedId, setSavedId] = useState<string | null>(null);

    // Sections dépliées/repliées
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

    const fetchStudent = useCallback(async () => {
        if (!studentId) return;
        const token = localStorage.getItem("ndrc_token");
        if (!token) { router.push("/teacher/login"); return; }

        const { data, error } = await apiGetStudent(studentId);
        if (error || !data) { router.push("/teacher"); return; }

        setStudent(data);

        // Initialiser les inputs depuis les données existantes
        const inputs: Record<string, { teacherStatus: number; teacherFeedback: string }> = {};
        data.competencies.forEach(c => {
            inputs[c.competencyId] = {
                teacherStatus: c.teacherStatus ?? -1,
                teacherFeedback: c.teacherFeedback ?? "",
            };
        });
        setGradeInputs(inputs);
        setLoading(false);
    }, [studentId, router]);

    useEffect(() => { fetchStudent(); }, [fetchStudent]);

    // Map competencyId -> progress
    const progressMap = useMemo(() => {
        const map: Record<string, NonNullable<typeof student>["competencies"][0]> = {};
        student?.competencies.forEach(c => { map[c.competencyId] = c; });
        return map;
    }, [student]);

    // Statistiques
    const stats = useMemo(() => {
        if (!student) return { studentAcquired: 0, teacherEvaluated: 0, teacherValidated: 0 };
        let teacherEvaluated = 0;
        let teacherValidated = 0;
        student.competencies.forEach(c => {
            if (c.teacherStatus != null) {
                teacherEvaluated++;
                if (c.teacherStatus >= 3) teacherValidated++;
            }
        });
        return {
            studentAcquired: student.acquiredCount,
            teacherEvaluated,
            teacherValidated,
        };
    }, [student]);

    // Filtrer les compétences
    const filteredCompetencies = useMemo(() => {
        return ALL_COMPETENCIES.filter(comp => {
            if (platformFilter !== "ALL" && comp.platform !== platformFilter) return false;
            if (levelFilter !== null && comp.level !== levelFilter) return false;
            if (evalFilter !== "ALL") {
                const progress = progressMap[comp.id];
                const ts = progress?.teacherStatus;
                if (evalFilter === "TO_EVALUATE" && ts != null) return false;
                if (evalFilter === "VALIDATED" && (ts == null || ts < 3)) return false;
                if (evalFilter === "REJECTED" && (ts == null || ts >= 3 || ts === 0)) return false;
            }
            return true;
        });
    }, [platformFilter, levelFilter, evalFilter, progressMap]);

    // Grouper : plateforme -> niveau -> catégorie -> compétences
    const grouped = useMemo(() => {
        const platforms: string[] = platformFilter === "ALL"
            ? ["WORDPRESS", "PRESTASHOP"]
            : [platformFilter];

        return platforms.map(platform => {
            const platComps = filteredCompetencies.filter(c => c.platform === platform);
            const levels = [1, 2, 3, 4].map(level => {
                const levelComps = platComps.filter(c => c.level === level);
                const categories = [...new Set(levelComps.map(c => c.category))];
                return {
                    level,
                    categories: categories.map(cat => ({
                        name: cat,
                        competencies: levelComps.filter(c => c.category === cat),
                    })),
                };
            }).filter(l => l.categories.length > 0);
            return { platform, levels };
        }).filter(p => p.levels.length > 0);
    }, [filteredCompetencies, platformFilter]);

    const toggleSection = (key: string) => {
        setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleGrade = async (competencyId: string) => {
        if (!studentId) return;
        const input = gradeInputs[competencyId];
        if (!input || input.teacherStatus < 0) return;

        setSavingId(competencyId);
        const { data, error } = await apiGradeCompetency(
            studentId, competencyId, input.teacherStatus, input.teacherFeedback
        );
        setSavingId(null);

        if (!error && data) {
            setStudent(prev => {
                if (!prev) return prev;
                const existing = prev.competencies.find(c => c.competencyId === competencyId);
                if (existing) {
                    return {
                        ...prev,
                        competencies: prev.competencies.map(c =>
                            c.competencyId === competencyId
                                ? { ...c, teacherStatus: data.teacherStatus, teacherFeedback: data.teacherFeedback, teacherGradedAt: data.teacherGradedAt }
                                : c
                        ),
                    };
                } else {
                    return {
                        ...prev,
                        competencies: [...prev.competencies, {
                            competencyId, acquired: false, status: 0, proof: null,
                            updatedAt: new Date().toISOString(),
                            teacherStatus: data.teacherStatus,
                            teacherFeedback: data.teacherFeedback,
                            teacherGradedAt: data.teacherGradedAt,
                        }],
                    };
                }
            });
            setSavedId(competencyId);
            setTimeout(() => setSavedId(null), 2000);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-purple-500" />
            </div>
        );
    }

    if (!student) return null;

    const progress = TOTAL_COMPETENCIES > 0 ? Math.round((student.acquiredCount / TOTAL_COMPETENCIES) * 100) : 0;

    return (
        <div className="min-h-screen bg-slate-50/50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
                    <Link href="/teacher" className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-black text-slate-800 truncate">
                            {student.firstName} {student.lastName}
                        </h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-bold rounded-md">{student.classCode}</span>
                            <span className="px-2 py-0.5 bg-purple-50 text-purple-500 text-xs font-mono rounded-md">{student.identifier}</span>
                        </div>
                    </div>
                    <div className="text-right hidden sm:block">
                        <div className="text-sm font-bold text-slate-700">{student.acquiredCount}/{TOTAL_COMPETENCIES}</div>
                        <div className="text-xs text-slate-400">compétences acquises</div>
                    </div>
                </div>
            </header>

            <div className="max-w-5xl mx-auto p-6 space-y-6">
                {/* Info élève + Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* URLs */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-3">
                            <Globe size={15} className="text-purple-500" /> Sites élève
                        </h3>
                        <div className="space-y-2">
                            {student.wpUrl && (
                                <a href={student.wpUrl} target="_blank" rel="noopener noreferrer"
                                   className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                                    <ExternalLink size={13} /> WordPress
                                </a>
                            )}
                            {student.prestaUrl && (
                                <a href={student.prestaUrl} target="_blank" rel="noopener noreferrer"
                                   className="flex items-center gap-2 text-sm text-pink-600 hover:underline">
                                    <ExternalLink size={13} /> PrestaShop
                                </a>
                            )}
                            {!student.wpUrl && !student.prestaUrl && (
                                <p className="text-xs text-slate-400 italic">Aucun site renseigné</p>
                            )}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-3">
                            <User size={15} className="text-purple-500" /> Progression
                        </h3>
                        {/* Barre de progression */}
                        <div className="flex items-center gap-2 mb-3">
                            <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${progress >= 70 ? "bg-green-500" : progress >= 30 ? "bg-blue-500" : "bg-slate-300"}`}
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <span className="text-sm font-bold text-slate-700 w-10 text-right">{progress}%</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div>
                                <div className="text-lg font-black text-green-600">{stats.studentAcquired}</div>
                                <div className="text-[10px] text-slate-400 uppercase font-bold">Acquises</div>
                            </div>
                            <div>
                                <div className="text-lg font-black text-purple-600">{stats.teacherEvaluated}</div>
                                <div className="text-[10px] text-slate-400 uppercase font-bold">Évaluées</div>
                            </div>
                            <div>
                                <div className="text-lg font-black text-blue-600">{stats.teacherValidated}</div>
                                <div className="text-[10px] text-slate-400 uppercase font-bold">Validées prof</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filtres */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Filter size={14} className="text-purple-500" />
                        <span className="text-xs font-bold text-slate-500 uppercase">Filtres</span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {/* Plateforme */}
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            {(["ALL", "WORDPRESS", "PRESTASHOP"] as PlatformFilter[]).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPlatformFilter(p)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                                        platformFilter === p
                                            ? "bg-white text-slate-800 shadow-sm"
                                            : "text-slate-400 hover:text-slate-600"
                                    }`}
                                >
                                    {p === "ALL" ? "Toutes" : p === "WORDPRESS" ? "WordPress" : "PrestaShop"}
                                </button>
                            ))}
                        </div>

                        {/* Niveau */}
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button
                                onClick={() => setLevelFilter(null)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                                    levelFilter === null ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                }`}
                            >
                                Tous
                            </button>
                            {[1, 2, 3, 4].map(l => (
                                <button
                                    key={l}
                                    onClick={() => setLevelFilter(l)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                                        levelFilter === l ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    }`}
                                >
                                    Niv.{l}
                                </button>
                            ))}
                        </div>

                        {/* Statut évaluation */}
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            {([
                                { key: "ALL" as EvalFilter, label: "Toutes" },
                                { key: "TO_EVALUATE" as EvalFilter, label: "À évaluer" },
                                { key: "VALIDATED" as EvalFilter, label: "Validées" },
                                { key: "REJECTED" as EvalFilter, label: "Insuffisant" },
                            ]).map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => setEvalFilter(f.key)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                                        evalFilter === f.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Compétences groupées */}
                {grouped.length === 0 && (
                    <div className="text-center py-12 text-slate-400 text-sm">
                        Aucune compétence ne correspond aux filtres sélectionnés.
                    </div>
                )}

                {grouped.map(({ platform, levels }) => (
                    <div key={platform} className="space-y-4">
                        {/* Titre plateforme */}
                        <h2 className={`text-sm font-black uppercase tracking-wider ${
                            platform === "WORDPRESS" ? "text-blue-600" : "text-pink-600"
                        }`}>
                            {platform === "WORDPRESS" ? "WordPress" : "PrestaShop"}
                        </h2>

                        {levels.map(({ level, categories }) => {
                            const sectionKey = `${platform}-${level}`;
                            const isCollapsed = collapsedSections[sectionKey];
                            const levelComps = categories.flatMap(c => c.competencies);
                            const evaluatedCount = levelComps.filter(c => progressMap[c.id]?.teacherStatus != null).length;

                            return (
                                <div key={sectionKey} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    {/* Header niveau */}
                                    <button
                                        onClick={() => toggleSection(sectionKey)}
                                        className="w-full flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                                                platform === "WORDPRESS" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"
                                            }`}>
                                                Niveau {level}
                                            </span>
                                            <span className="text-sm font-bold text-slate-700">{LEVEL_NAMES[level]}</span>
                                            <span className="text-xs text-slate-400">
                                                {evaluatedCount}/{levelComps.length} évaluées
                                            </span>
                                        </div>
                                        {isCollapsed ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronUp size={18} className="text-slate-400" />}
                                    </button>

                                    {/* Contenu */}
                                    {!isCollapsed && (
                                        <div className="border-t border-slate-100 divide-y divide-slate-50">
                                            {categories.map(({ name: catName, competencies: comps }) => (
                                                <div key={catName} className="p-4 space-y-3">
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{catName}</div>
                                                    {comps.map(comp => {
                                                        const prog = progressMap[comp.id];
                                                        const input = gradeInputs[comp.id] || { teacherStatus: -1, teacherFeedback: "" };
                                                        const isSaving = savingId === comp.id;
                                                        const isSaved = savedId === comp.id;

                                                        return (
                                                            <div key={comp.id} className="rounded-xl border border-slate-100 p-3 space-y-2 hover:border-slate-200 transition-colors">
                                                                {/* Compétence label */}
                                                                <div className="text-sm font-medium text-slate-800">{comp.label}</div>

                                                                {/* Bloc auto-évaluation élève */}
                                                                {prog && prog.status > 0 ? (
                                                                    <div className={`rounded-lg px-3 py-2 flex items-center justify-between gap-3 ${
                                                                        prog.status >= 3 ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"
                                                                    }`}>
                                                                        <div className="flex items-center gap-2">
                                                                            {prog.status >= 3
                                                                                ? <CheckCircle2 size={15} className="text-green-600" />
                                                                                : <div className="w-4 h-4 rounded-full border-2 border-amber-400" />
                                                                            }
                                                                            <span className="text-xs font-bold text-slate-600">Auto-évaluation élève :</span>
                                                                            <span className={`px-2 py-0.5 rounded-md text-xs font-black ${STATUS_LABELS[prog.status].bg} ${STATUS_LABELS[prog.status].color}`}>
                                                                                {STATUS_LABELS[prog.status].label}
                                                                            </span>
                                                                        </div>
                                                                        {prog.proof && (
                                                                            prog.proof.startsWith("http") ? (
                                                                                <a href={prog.proof} target="_blank" rel="noopener noreferrer"
                                                                                   className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg text-xs font-bold text-purple-600 hover:text-purple-800 hover:underline border border-purple-200 shadow-sm">
                                                                                    <ExternalLink size={12} /> Voir la preuve
                                                                                </a>
                                                                            ) : (
                                                                                <span className="text-xs text-slate-500 italic max-w-[200px] truncate">{prog.proof}</span>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="rounded-lg px-3 py-2 bg-slate-50 border border-slate-100 text-xs text-slate-400 italic">
                                                                        Non évalué par l&apos;élève
                                                                    </div>
                                                                )}

                                                                {/* Contrôles notation formateur */}
                                                                <div className="border-t border-slate-50 pt-2 flex flex-col sm:flex-row gap-2">
                                                                    <div className="flex-shrink-0">
                                                                        <div className="text-[9px] font-bold text-purple-400 uppercase mb-1">Éval. formateur</div>
                                                                        <select
                                                                            value={input.teacherStatus}
                                                                            onChange={e => setGradeInputs(prev => ({
                                                                                ...prev,
                                                                                [comp.id]: { ...prev[comp.id] || { teacherFeedback: "" }, teacherStatus: parseInt(e.target.value) }
                                                                            }))}
                                                                            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-purple-400 focus:outline-none bg-white"
                                                                        >
                                                                            <option value={-1}>-- Choisir --</option>
                                                                            <option value={1}>Novice</option>
                                                                            <option value={2}>Apprenti</option>
                                                                            <option value={3}>Compétent</option>
                                                                            <option value={4}>Expert</option>
                                                                        </select>
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <div className="text-[9px] font-bold text-purple-400 uppercase mb-1">Annotation</div>
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Commentaire..."
                                                                            value={input.teacherFeedback}
                                                                            onChange={e => setGradeInputs(prev => ({
                                                                                ...prev,
                                                                                [comp.id]: { ...prev[comp.id] || { teacherStatus: -1 }, teacherFeedback: e.target.value }
                                                                            }))}
                                                                            onKeyDown={e => { if (e.key === "Enter" && input.teacherStatus >= 0) handleGrade(comp.id); }}
                                                                            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-purple-400 focus:outline-none bg-white"
                                                                        />
                                                                    </div>
                                                                    <div className="flex items-end">
                                                                        <button
                                                                            onClick={() => handleGrade(comp.id)}
                                                                            disabled={isSaving || input.teacherStatus < 0}
                                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                                                                                isSaved
                                                                                    ? "bg-green-100 text-green-700"
                                                                                    : "bg-purple-100 text-purple-700 hover:bg-purple-200"
                                                                            } ${(isSaving || input.teacherStatus < 0) ? "opacity-50 cursor-not-allowed" : ""}`}
                                                                        >
                                                                            {isSaving ? <Loader2 size={12} className="animate-spin" /> :
                                                                             isSaved ? <CheckCircle2 size={12} /> : <Save size={12} />}
                                                                            {isSaved ? "OK" : "Évaluer"}
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {/* Date dernière évaluation */}
                                                                {prog?.teacherGradedAt && (
                                                                    <div className="text-[10px] text-slate-300">
                                                                        Évalué le {new Date(prog.teacherGradedAt).toLocaleDateString("fr-FR")}
                                                                        {prog.teacherFeedback && (
                                                                            <span className="ml-2 text-slate-400">— {prog.teacherFeedback}</span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}
