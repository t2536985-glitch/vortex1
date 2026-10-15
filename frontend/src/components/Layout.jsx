import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Gamepad2,
  Library,
  Server,
  Cloud,
  User,
  LogOut,
  Zap,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { to: "/app", label: "Início", icon: LayoutDashboard, end: true, id: "dashboard" },
  { to: "/app/catalog", label: "Catálogo", icon: Gamepad2, id: "catalog" },
  { to: "/app/library", label: "Biblioteca", icon: Library, id: "library" },
  { to: "/app/servers", label: "Servidores", icon: Server, id: "servers" },
  { to: "/app/saves", label: "Saves na Nuvem", icon: Cloud, id: "saves" },
  { to: "/app/profile", label: "Perfil", icon: User, id: "profile" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  const SidebarInner = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 vx-glow-border">
          <Zap className="h-5 w-5 text-cyan-400" strokeWidth={2.5} />
        </div>
        <span className="font-display text-2xl font-black uppercase tracking-tight">
          Vortex
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((n) => (
          <NavLink
            key={n.id}
            to={n.to}
            end={n.end}
            data-testid={`nav-${n.id}-link`}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
                isActive
                  ? "bg-cyan-500/10 text-cyan-300 shadow-[inset_2px_0_0_0_#00F0FF]"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              }`
            }
          >
            <n.icon className="h-[18px] w-[18px]" />
            {n.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/5 p-3">
        <div className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 font-display text-lg font-bold">
            {(user?.name || "U")[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user?.name}</p>
            <p className="truncate text-xs text-cyan-400">{user?.plan}</p>
          </div>
        </div>
        <button
          data-testid="logout-button"
          onClick={doLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-400 transition-all hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0C10] text-slate-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/5 bg-[#0d1017] lg:block">
        {SidebarInner}
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/5 bg-[#0d1017]/90 px-4 py-3 backdrop-blur-lg lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15">
            <Zap className="h-4 w-4 text-cyan-400" strokeWidth={2.5} />
          </div>
          <span className="font-display text-xl font-black uppercase">Vortex</span>
        </div>
        <button
          data-testid="mobile-menu-toggle"
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg p-2 text-slate-300 hover:bg-white/5"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 lg:hidden"
        >
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            className="absolute inset-y-0 left-0 w-64 border-r border-white/10 bg-[#0d1017]"
          >
            {SidebarInner}
          </motion.div>
        </motion.div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8 sm:py-10">{children}</div>
      </main>
    </div>
  );
}
