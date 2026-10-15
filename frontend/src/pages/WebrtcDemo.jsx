import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Radio, MonitorUp, Smartphone, Copy, Check, Wifi, WifiOff, Loader2, Info, Link2,
} from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const WS_BASE = BACKEND_URL.replace(/^http/, "ws");
const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };

function randomRoom() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function WebrtcDemo() {
  const params = new URLSearchParams(window.location.search);
  const [room, setRoom] = useState(params.get("room") || randomRoom());
  const [role, setRole] = useState(params.get("role") || "");
  const [status, setStatus] = useState("idle"); // idle | connecting | waiting | live | failed
  const [copied, setCopied] = useState(false);
  const [statLine, setStatLine] = useState("");

  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pendingIce = useRef([]);
  const negotiating = useRef(false);

  const cleanup = () => {
    try { wsRef.current?.close(); } catch {}
    try { pcRef.current?.close(); } catch {}
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    wsRef.current = null;
    pcRef.current = null;
    localStreamRef.current = null;
    pendingIce.current = [];
    negotiating.current = false;
  };

  useEffect(() => () => cleanup(), []);

  const send = (obj) => {
    if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify(obj));
  };

  const buildPeer = () => {
    const pc = new RTCPeerConnection(ICE);
    pc.onicecandidate = (e) => {
      if (e.candidate) send({ type: "ice", candidate: e.candidate });
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === "connected") setStatus("live");
      if (st === "failed" || st === "disconnected") setStatus("failed");
      setStatLine(`conexão: ${st}`);
    };
    pc.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
        remoteVideoRef.current.play?.().catch(() => {});
      }
    };
    pcRef.current = pc;
    return pc;
  };

  const flushIce = async () => {
    const pc = pcRef.current;
    while (pendingIce.current.length) {
      const c = pendingIce.current.shift();
      try { await pc.addIceCandidate(c); } catch {}
    }
  };

  const makeOffer = async () => {
    if (negotiating.current || role !== "host") return;
    negotiating.current = true;
    try {
      const pc = pcRef.current;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ type: "offer", sdp: pc.localDescription });
    } finally {
      negotiating.current = false;
    }
  };

  const connectSignaling = (chosenRole) => {
    const ws = new WebSocket(`${WS_BASE}/api/ws/signal/${room}`);
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => setStatus(chosenRole === "host" ? "waiting" : "connecting");

    ws.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data);
      const pc = pcRef.current;
      if (msg.type === "joined") {
        if (chosenRole === "host" && msg.peers > 1) makeOffer();
      } else if (msg.type === "peer-joined") {
        if (chosenRole === "host") makeOffer();
      } else if (msg.type === "peer-left") {
        setStatLine("o outro dispositivo saiu");
      } else if (msg.type === "offer" && chosenRole === "viewer") {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        await flushIce();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ type: "answer", sdp: pc.localDescription });
      } else if (msg.type === "answer" && chosenRole === "host") {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        await flushIce();
      } else if (msg.type === "ice") {
        const cand = new RTCIceCandidate(msg.candidate);
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try { await pc.addIceCandidate(cand); } catch {}
        } else {
          pendingIce.current.push(cand);
        }
      }
    };

    ws.onerror = () => setStatus("failed");
  };

  const startHost = async () => {
    setRole("host");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 60 },
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play?.().catch(() => {});
      }
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        toast.info("Compartilhamento encerrado");
        cleanup();
        setStatus("idle");
      });
      const pc = buildPeer();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      connectSignaling("host");
    } catch (e) {
      toast.error("Não foi possível capturar a tela");
      setStatus("idle");
    }
  };

  const startViewer = () => {
    setRole("viewer");
    buildPeer();
    connectSignaling("viewer");
  };

  const viewerLink = `${window.location.origin}/app/webrtc?room=${room}&role=viewer`;
  const copyLink = () => {
    navigator.clipboard.writeText(viewerLink);
    setCopied(true);
    toast.success("Link copiado! Abra no celular.");
    setTimeout(() => setCopied(false), 2000);
  };

  const StatusBadge = () => {
    const map = {
      idle: { t: "Pronto", c: "text-slate-400", i: WifiOff },
      connecting: { t: "Conectando...", c: "text-amber-400", i: Loader2 },
      waiting: { t: "Aguardando o outro dispositivo...", c: "text-cyan-400", i: Loader2 },
      live: { t: "AO VIVO · transmitindo", c: "text-emerald-400", i: Wifi },
      failed: { t: "Falha na conexão P2P", c: "text-red-400", i: WifiOff },
    };
    const s = map[status];
    const Icon = s.i;
    return (
      <span className={`flex items-center gap-2 text-sm font-semibold ${s.c}`} data-testid="webrtc-status">
        <Icon className={`h-4 w-4 ${status === "connecting" || status === "waiting" ? "animate-spin" : ""}`} />
        {s.t} {statLine && <span className="font-mono-vx text-xs text-slate-500">· {statLine}</span>}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-black uppercase tracking-tight sm:text-4xl">Stream Real · Demo WebRTC</h1>
        <p className="text-sm text-slate-400">
          Transmissão P2P de verdade: um dispositivo compartilha a tela (ex.: um jogo no navegador) e o outro assiste ao vivo pela internet.
        </p>
      </div>

      {/* how it works / honesty box */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5 text-sm text-amber-200/90">
        <p className="mb-2 flex items-center gap-2 font-bold text-amber-300"><Info className="h-4 w-4" /> Para rodar jogos de PC de verdade você precisa de:</p>
        <ul className="ml-1 list-inside list-disc space-y-1 text-amber-200/80">
          <li><b>Uma máquina host com GPU</b> (PC físico ou GPU na nuvem: AWS g4dn/g5, Paperspace, Shadow PC, Vast.ai). Como você não tem uma, essa é a peça que falta.</li>
          <li><b>O jogo instalado e licenciado</b> nessa máquina (via Steam, Epic, etc.).</li>
          <li><b>Um encoder de stream com baixa latência</b> na máquina (Sunshine/Moonlight, Parsec) ou WebRTC com encode por GPU.</li>
          <li><b>Servidores de sinalização + TURN</b> para atravessar NAT (esta demo usa sinalização própria + STUN público).</li>
        </ul>
        <p className="mt-2 text-amber-200/70">
          Esta demo prova a parte de transmissão com tecnologia real (WebRTC), usando o <b>navegador deste computador como host</b> — sem máquina dedicada.
          Compartilhe a janela de um jogo que roda no navegador (ex.: um jogo livre em HTML5) e assista no celular.
        </p>
      </div>

      {/* room controls */}
      <div className="rounded-2xl border border-white/8 bg-[#181D2A] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Código da sala</label>
            <input
              data-testid="webrtc-room-input"
              value={room}
              onChange={(e) => setRoom(e.target.value.toUpperCase())}
              disabled={status !== "idle"}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 font-mono-vx text-lg font-bold tracking-widest text-cyan-400 outline-none focus:border-cyan-400 disabled:opacity-60"
            />
          </div>
          <div>
            <StatusBadge />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
          <Link2 className="h-4 w-4 flex-shrink-0 text-slate-500" />
          <input readOnly value={viewerLink} className="min-w-0 flex-1 bg-transparent text-xs text-slate-400 outline-none" />
          <button data-testid="webrtc-copy-link" onClick={copyLink} className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/20">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />} Copiar link do celular
          </button>
        </div>

        {status === "idle" && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              data-testid="webrtc-start-host"
              onClick={startHost}
              className="flex items-center justify-center gap-2 rounded-xl bg-cyan-400 py-3.5 font-display text-lg font-bold uppercase text-black transition-transform hover:scale-[1.02]"
            >
              <MonitorUp className="h-5 w-5" /> Transmitir (este PC)
            </button>
            <button
              data-testid="webrtc-start-viewer"
              onClick={startViewer}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/15 py-3.5 font-display text-lg font-bold uppercase text-white hover:bg-white/5"
            >
              <Smartphone className="h-5 w-5" /> Assistir (celular)
            </button>
          </div>
        )}
      </div>

      {/* video surfaces */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {role === "host" && (
          <div className="overflow-hidden rounded-2xl border border-cyan-500/30 bg-black">
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2 text-xs font-semibold uppercase text-cyan-400">
              <MonitorUp className="h-4 w-4" /> Sua transmissão (preview)
            </div>
            <video ref={localVideoRef} autoPlay muted playsInline className="aspect-video w-full bg-black" data-testid="webrtc-local-video" />
          </div>
        )}
        {role === "viewer" && (
          <div className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-black lg:col-span-2">
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2 text-xs font-semibold uppercase text-emerald-400">
              <Radio className="h-4 w-4" /> Recebendo stream ao vivo
            </div>
            <video ref={remoteVideoRef} autoPlay playsInline controls className="aspect-video w-full bg-black" data-testid="webrtc-remote-video" />
          </div>
        )}
      </div>

      {status !== "idle" && (
        <button
          data-testid="webrtc-stop"
          onClick={() => { cleanup(); setStatus("idle"); setRole(""); }}
          className="rounded-xl border border-red-500/30 px-5 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10"
        >
          Encerrar transmissão
        </button>
      )}
    </div>
  );
}
