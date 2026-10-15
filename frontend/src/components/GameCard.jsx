import React from "react";
import { motion } from "framer-motion";
import { Play, Star } from "lucide-react";
import { useLaunch } from "@/context/LaunchContext";

export default function GameCard({ game, index = 0, onInfo }) {
  const { openLaunch } = useLaunch();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
      className="group relative overflow-hidden rounded-xl border border-white/8 bg-[#181D2A]"
      data-testid={`game-card-${game.id}`}
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        <img
          src={game.cover}
          alt={game.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-80" />

        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 backdrop-blur">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          <span className="font-mono-vx text-[11px] font-bold text-amber-400">{game.rating}</span>
        </div>

        {/* hover actions */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
          <button
            data-testid={`launch-game-button-${game.id}`}
            onClick={() => openLaunch(game)}
            className="flex items-center gap-2 rounded-full bg-cyan-400 px-5 py-2.5 font-display text-sm font-bold uppercase tracking-wide text-black transition-transform hover:scale-105"
          >
            <Play className="h-4 w-4 fill-black" /> Jogar
          </button>
          {onInfo && (
            <button
              data-testid={`game-info-button-${game.id}`}
              onClick={() => onInfo(game)}
              className="rounded-full border border-white/20 px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
            >
              Detalhes
            </button>
          )}
        </div>
      </div>

      <div className="p-3">
        <h3 className="truncate font-display text-base font-bold uppercase tracking-wide">{game.title}</h3>
        <p className="truncate text-xs text-slate-400">{game.genre}</p>
      </div>
    </motion.div>
  );
}
