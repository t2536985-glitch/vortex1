# PRD — Vortex Cloud Gaming

## Problema original
Usuário (PT-BR) quer um "cloud gaming" com servidor próprio para jogar jogos de PC (Elden Ring, God of War Ragnarök) pelo celular, dependendo só de internet, com o jogo rodando num servidor potente e sendo salvo.

## Escopo acordado (via ask_human)
- Plataforma/painel web FUNCIONAL de cloud gaming; o streaming de vídeo em si é SIMULADO/MOCKADO.
- Nomes reais de jogos usados apenas como placeholders de catálogo.
- Login e-mail + senha (JWT).
- Sem planos pagos (planos são apenas demonstrativos).
- Visual gaming escuro/vibrante (definido pelo E1): "Tactical Obsidian" + ciano/âmbar/violeta, fontes Barlow Condensed + Inter.

## Arquitetura
- Backend: FastAPI + MongoDB (motor). Auth JWT (Bearer no body + cookie httpOnly). Seed de 12 jogos, 5 nós de servidor e admin no startup.
- Frontend: React + Tailwind + framer-motion + lucide-react + sonner. AuthContext (localStorage vx_token), LaunchContext (diálogo de lançamento), páginas protegidas.

## Implementado (2026-06)
- Landing pública com hero, features e disclaimer de "como funciona".
- Auth: register, login, logout, me (JWT). Rotas protegidas com redirect.
- Dashboard: stats, jogo em destaque, melhor servidor, recentes e recomendados.
- Catálogo: busca, filtro por gênero, modal de detalhes, adicionar à biblioteca.
- Biblioteca: horas jogadas, favoritar, remover, jogar.
- Sessão de stream (/play): overlay de conexão, superfície de vídeo mockada com scanlines, HUD animado (FPS/ping/bitrate/resolução/perda), seletor de qualidade, gamepad virtual (mobile), save rápido, encerrar sessão.
- Status de servidores: 5 nós com ping/GPU/fila/carga, auto-refresh 5s.
- Saves na nuvem: listar, criar (modal), restaurar (mock), excluir.
- Perfil: dados, stats, preferências (codec/controle), planos demonstrativos.
- Testado via testing_agent: backend 100% (16/16), frontend 100%, sem bugs.

## MOCKADO / Limitações
- O vídeo do jogo é SIMULADO (imagem estática + métricas sintéticas). Não há GPU/stream real nem jogos reais licenciados — inviável tecnicamente/legalmente neste ambiente.

## Backlog / próximos passos
- P1: Watch party / co-op, histórico de sessões, conquistas.
- P1: Teste real de ping do navegador até os nós.
- P2: CORS explícito por origem + brute-force lockout no login para produção.
- P2: Protótipo real de WebRTC transmitindo tela de uma máquina (jogo livre).
