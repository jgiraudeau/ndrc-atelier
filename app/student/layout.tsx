"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Target, Globe, ShoppingBag, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import ChatWidget from "@/components/student/ChatWidget";

const NAV_ITEMS = [
    { href: "/student", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
    { href: "/student/missions", label: "Missions", icon: Target },
    { href: "/student/wordpress", label: "WordPress", icon: Globe },
    { href: "/student/prestashop", label: "PrestaShop", icon: ShoppingBag },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();

    const handleLogout = () => {
        localStorage.removeItem("ndrc_token");
        localStorage.removeItem("ndrc_user");
        router.push("/");
    };

    const isActive = (item: typeof NAV_ITEMS[number]) => {
        if (item.exact) return pathname === item.href;
        return pathname.startsWith(item.href);
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans flex">

            {/* ── Desktop Sidebar ─────────────────────────────── */}
            <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-100 p-6 fixed h-full z-30">
                <div className="flex items-center gap-3 mb-10 px-2">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">N</div>
                    <span className="font-extrabold text-xl tracking-tight text-indigo-900">NDRC Skills</span>
                </div>

                <nav className="flex-1 space-y-1">
                    {NAV_ITEMS.map(item => {
                        const active = isActive(item);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm",
                                    active ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                )}
                            >
                                <item.icon size={20} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="pt-6 border-t border-slate-100">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all w-full text-sm font-bold"
                    >
                        <LogOut size={20} /> Déconnexion
                    </button>
                </div>
            </aside>

            {/* ── Main Content ────────────────────────────────── */}
            <div className="flex-1 md:ml-64 min-h-screen pb-16 md:pb-0">
                {children}
            </div>

            {/* ── Chat Widget ──────────────────────────────────── */}
            <ChatWidget />

            {/* ── Mobile Bottom Nav ────────────────────────────── */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center z-30 h-16">
                {NAV_ITEMS.map(item => {
                    const active = isActive(item);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-xl transition-colors",
                                active ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            <item.icon size={22} />
                            <span className="text-[10px] font-bold">{item.label.split(" ")[0]}</span>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
