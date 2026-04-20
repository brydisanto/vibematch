import { requireAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminTokenGate from "./_components/AdminTokenGate";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    // Session-layer gate (username in ADMIN_USERNAMES). The second factor —
    // the ADMIN_ACCESS_TOKEN header — is enforced per-API in requireAdmin()
    // and surfaced to the user by the AdminTokenGate client component.
    const admin = await requireAdmin();
    if (!admin) {
        redirect("/");
    }

    return (
        <div className="min-h-screen bg-[#0D0A1A] text-white">
            {/* Top bar */}
            <div className="border-b border-white/10 bg-[#1A0A2E]">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Link href="/admin" className="font-display font-black text-xl text-[#FFE048] uppercase tracking-wider">
                            VibeMatch Admin
                        </Link>
                        <nav className="flex gap-4 text-sm text-white/70">
                            <Link href="/admin" className="hover:text-[#FFE048] transition-colors">Overview</Link>
                            <Link href="/admin/anomalies" className="hover:text-[#FFE048] transition-colors">Anomalies</Link>
                            <Link href="/admin/transactions" className="hover:text-[#FFE048] transition-colors">Transactions</Link>
                        </nav>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                        <span className="text-white/50">Logged in as</span>
                        <span className="text-[#FFE048] font-bold">{admin}</span>
                        <Link href="/" className="text-white/50 hover:text-white border border-white/20 rounded-full px-3 py-1">
                            Back to game
                        </Link>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                <AdminTokenGate>{children}</AdminTokenGate>
            </div>
        </div>
    );
}
