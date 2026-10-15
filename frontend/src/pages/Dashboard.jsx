import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Clock, Library as LibIcon, Cloud, Zap, Activity, ChevronRight } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLaunch } from "@/context/LaunchContext";
import GameCard from "@/components/GameCard";

function StatTile({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#181D2A] p-4" data-testid={`stat-${label}`}>
      <Icon className={`mb-2 h-5 w-5 ${accent}`} />
      <p className="font-display text-3xl font-black">{value}</p>
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { openLaunch } = useLaunch();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [library, setLibrary] = useState([]);
  const [stats, setStats] = useState(null);
  const [bestNode, setBestNode] = useState(null);

  useEffect(() => {
    api.get("/games").then(({ data }) => setGames(data));
    api.get("/library").then(({ data }) => setLibrary(data));
    api.get("/stats").then(({ data }) => setStats(data));
    api.get("/nodes").then(({ data }) => {
      const online = data.filter((n) => n.status === "online").sort((a, b) => a.ping - b.ping);
      setBestNode(online[0]);
    });
  }, []);

  const featured = games.find((g) => g.featured) || games[0];
  const recent = library.filter((g) => g.last_played).sort((a, b) => (a.last_played < b.last_played ? 1 : -1)).slice(0, 6);
  const recommended = games.filter((g) => !library.find((l) => l.id === g.id)).slice(0, 6);

  return (
    <div className="space-y-10">
      <div>
        <p className="font-mono-vx text-sm uppercase tracking-widest text-cyan-400">Olá, {user?.name?.split(" ")[0]}</p>
        <h1 className="font-display text-3xl font-black uppercase tracking-tight sm:text-4xl">Pronto para jogar?</h1>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={LibIcon} label="Na biblioteca" value={stats?.games_in_library ?? "—"} accent="text-cyan-400" />
        <StatTile icon={Clock} label="Horas jogadas" value={stats?.total_hours ?? "—"} accent="text-amber-400" />
        <StatTile icon={Cloud} label="Saves na nuvem" value={stats?.cloud_saves ?? "—"} accent="text-violet-400" />
        <StatTile icon={Zap} label="Plano" value={<span className="text-lg">{stats?.plan ?? "—"}</span>} accent="text-emerald-400" />
      </div>

      {/* featured hero */}
      {featured && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative overflow-hidden rounded-3xl border border-white/10"
          data-testid="featured-game"
        >
          <img src={featured.hero} alt={featured.title} className="h-72 w-full object-cover sm:h-96" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0C10] via-[#0A0C10]/70 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
            <span className="font-mono-vx text-xs uppercase tracking-widest text-cyan-400">Em destaque</span>
            <h2 className="mt-1 max-w-lg font-display text-4xl font-black uppercase leading-none sm:text-6xl">{featured.title}</h2>
            <p className="mt-3 max-w-md text-sm text-slate-300 line-clamp-2">{featured.description}</p>
            <div className="mt-5 flex gap-3">
              <button
                data-testid="featured-play-button"
                onClick={() => openLaunch(featured)}
                className="flex items-center gap-2 rounded-xl bg-cyan-400 px-6 py-3 font-display text-lg font-bold uppercase tracking-wide text-black transition-transform hover:scale-105"
              >
                <Play className="h-5 w-5 fill-black" /> Jogar agora
              </button>
              <button
                onClick={() => navigate("/app/catalog")}
                className="rounded-xl border border-white/20 px-6 py-3 font-display text-lg font-bold uppercase tracking-wide hover:bg-white/5"
              >
                Catálogo
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* best node widget */}
      {bestNode && (
        <div className="flex items-center justify-between rounded-2xl border border-cyan-500/20 bg-cyan-950/10 p-4" data-testid="best-node-widget">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Activity className="h-6 w-6 text-cyan-400" />
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold">Melhor servidor: {bestNode.flag} {bestNode.name}</p>
              <p className="font-mono-vx text-xs text-slate-400">{bestNode.gpu} · ping {bestNode.ping}ms · {bestNode.queue > 0 ? `fila ${bestNode.queue}` : "sem fila"}</p>
            </div>
          </div>
          <button onClick={() => navigate("/app/servers")} className="flex items-center gap-1 text-sm font-semibold text-cyan-400 hover:underline">
            Ver todos <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* recent */}
      {recent.length > 0 && (
        <section>
          <h3 className="mb-4 font-display text-2xl font-extrabold uppercase tracking-tight">Jogados recentemente</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {recent.map((g, i) => (
              <GameCard key={g.id} game={g} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* recommended */}
      <section>
        <h3 className="mb-4 font-display text-2xl font-extrabold uppercase tracking-tight">Recomendados para você</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {recommended.map((g, i) => (
            <GameCard key={g.id} game={g} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
