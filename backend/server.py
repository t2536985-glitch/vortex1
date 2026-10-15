import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import logging
import random
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, WebSocket, WebSocketDisconnect
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, BeforeValidator, ConfigDict

# ----------------------------------------------------------------------------
# DB
# ----------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Vortex Cloud Gaming API")
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
logger = logging.getLogger("vortex")
logging.basicConfig(level=logging.INFO)

PyObjectId = Annotated[str, BeforeValidator(str)]


# ----------------------------------------------------------------------------
# Auth helpers
# ----------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token inválido")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


# ----------------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class StartSessionInput(BaseModel):
    game_id: str
    node_id: str


class CreateSaveInput(BaseModel):
    game_id: str
    label: Optional[str] = None
    session_id: Optional[str] = None


# ----------------------------------------------------------------------------
# Seed data
# ----------------------------------------------------------------------------
GAMES_SEED = [
    {"id": "elden-ring", "title": "Elden Ring", "genre": "RPG de Ação", "studio": "FromSoftware",
     "rating": 96, "size_gb": 60, "year": 2022, "hdr": True, "featured": True,
     "tags": ["Mundo Aberto", "Souls", "Fantasia Sombria"],
     "description": "Erga-se, Maculado, e seja guiado pela graça para brandir o poder do Anel Prístino e tornar-se um Lorde Prístino nas Terras Intermédias.",
     "cover": "https://images.unsplash.com/photo-1640903581708-8d491706515b?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1696027944149-c1c074b01b03?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "gow-ragnarok", "title": "God of War Ragnarök", "genre": "Ação / Aventura", "studio": "Santa Monica",
     "rating": 94, "size_gb": 90, "year": 2022, "hdr": True, "featured": True,
     "tags": ["Nórdico", "Narrativa", "Cinematográfico"],
     "description": "Kratos e Atreus embarcam numa jornada mítica em busca de respostas enquanto o Ragnarök se aproxima dos Nove Reinos.",
     "cover": "https://images.unsplash.com/photo-1675345842723-841fd8153628?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1629794332921-5c3648de80cc?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "cyberpunk-2077", "title": "Cyberpunk 2077", "genre": "RPG de Ação", "studio": "CD Projekt Red",
     "rating": 86, "size_gb": 70, "year": 2020, "hdr": True, "featured": True,
     "tags": ["Cyberpunk", "Mundo Aberto", "Sci-Fi"],
     "description": "Torne-se um mercenário cibernético em Night City, uma megalópole obcecada por poder, glamour e modificações corporais.",
     "cover": "https://images.unsplash.com/photo-1672872476232-da16b45c9001?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1600998837340-4887228e311f?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "black-myth-wukong", "title": "Black Myth: Wukong", "genre": "RPG de Ação", "studio": "Game Science",
     "rating": 82, "size_gb": 130, "year": 2024, "hdr": True, "featured": False,
     "tags": ["Mitologia", "Souls", "Chinês"],
     "description": "Embarque numa épica jornada baseada em 'Jornada ao Oeste', encarnando o Destinado para desvendar a verdade por trás de um passado glorioso.",
     "cover": "https://images.unsplash.com/photo-1692124483246-c7f2a8085034?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1686700529666-a5358f4a2c98?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "starfield", "title": "Starfield", "genre": "RPG Espacial", "studio": "Bethesda",
     "rating": 83, "size_gb": 125, "year": 2023, "hdr": True, "featured": False,
     "tags": ["Espaço", "Exploração", "Sci-Fi"],
     "description": "Crie qualquer personagem e explore com liberdade sem precedentes num universo com mais de mil planetas.",
     "cover": "https://images.unsplash.com/photo-1688407832489-cc9db90773f5?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1761212625300-e37d470be2ed?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "witcher-3", "title": "The Witcher 3: Wild Hunt", "genre": "RPG de Ação", "studio": "CD Projekt Red",
     "rating": 93, "size_gb": 50, "year": 2015, "hdr": True, "featured": False,
     "tags": ["Fantasia", "Mundo Aberto", "Narrativa"],
     "description": "Geralt de Rívia, caçador de monstros, parte numa busca para encontrar a criança da profecia num vasto mundo aberto.",
     "cover": "https://images.unsplash.com/photo-1460194436988-671f763436b7?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1599721765154-0f596e632cba?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "horizon-fw", "title": "Horizon Forbidden West", "genre": "Ação / Aventura", "studio": "Guerrilla Games",
     "rating": 88, "size_gb": 100, "year": 2022, "hdr": True, "featured": False,
     "tags": ["Pós-apocalíptico", "Mundo Aberto", "Robôs"],
     "description": "Junte-se a Aloy enquanto ela desbrava fronteiras perigosas para desvendar os mistérios por trás de pragas que ameaçam a vida.",
     "cover": "https://images.unsplash.com/photo-1711319551836-f7ca9764a898?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1599721765154-0f596e632cba?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "spiderman-2", "title": "Marvel's Spider-Man 2", "genre": "Ação / Aventura", "studio": "Insomniac",
     "rating": 90, "size_gb": 98, "year": 2023, "hdr": True, "featured": False,
     "tags": ["Super-herói", "Mundo Aberto", "Marvel"],
     "description": "Peter Parker e Miles Morales enfrentam a ameaça definitiva de Venom numa Nova York maior e mais vibrante.",
     "cover": "https://images.unsplash.com/photo-1586968272237-a3d597214887?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1624075250557-9e020cecaaf6?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "hogwarts-legacy", "title": "Hogwarts Legacy", "genre": "RPG de Ação", "studio": "Avalanche",
     "rating": 84, "size_gb": 85, "year": 2023, "hdr": True, "featured": False,
     "tags": ["Magia", "Mundo Aberto", "Fantasia"],
     "description": "Viva uma aventura inédita no mundo mágico dos anos 1800, frequentando Hogwarts e dominando feitiços e poções.",
     "cover": "https://images.unsplash.com/photo-1599937054672-14f207a40120?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1696027944149-c1c074b01b03?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "baldurs-gate-3", "title": "Baldur's Gate 3", "genre": "RPG", "studio": "Larian Studios",
     "rating": 96, "size_gb": 122, "year": 2023, "hdr": True, "featured": True,
     "tags": ["D&D", "Turnos", "Narrativa"],
     "description": "Reúna seu grupo e retorne aos Reinos Esquecidos numa história de companheirismo, traição e sobrevivência.",
     "cover": "https://images.unsplash.com/photo-1686700529666-a5358f4a2c98?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1692124483246-c7f2a8085034?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "alan-wake-2", "title": "Alan Wake 2", "genre": "Survival Horror", "studio": "Remedy",
     "rating": 89, "size_gb": 90, "year": 2023, "hdr": True, "featured": False,
     "tags": ["Terror", "Narrativa", "Suspense"],
     "description": "Um escritor preso num pesadelo e uma agente do FBI investigam assassinatos rituais numa cidade assombrada.",
     "cover": "https://images.unsplash.com/photo-1600998837340-4887228e311f?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1672872476232-da16b45c9001?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "red-dead-2", "title": "Red Dead Redemption 2", "genre": "Ação / Aventura", "studio": "Rockstar",
     "rating": 97, "size_gb": 120, "year": 2018, "hdr": True, "featured": True,
     "tags": ["Faroeste", "Mundo Aberto", "Narrativa"],
     "description": "América, 1899. Arthur Morgan e a gangue Van der Linde fogem enquanto a era dos fora-da-lei chega ao fim.",
     "cover": "https://images.unsplash.com/photo-1599721765154-0f596e632cba?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1711319551836-f7ca9764a898?crop=entropy&cs=srgb&fm=jpg&q=85"},
]

NODES_SEED = [
    {"id": "sao-paulo", "name": "São Paulo", "country": "Brasil", "flag": "🇧🇷", "gpu": "RTX 4090",
     "base_ping": 12, "region": "América do Sul"},
    {"id": "virginia", "name": "Virgínia", "country": "EUA", "flag": "🇺🇸", "gpu": "RTX 4090",
     "base_ping": 128, "region": "América do Norte"},
    {"id": "frankfurt", "name": "Frankfurt", "country": "Alemanha", "flag": "🇩🇪", "gpu": "RTX 4080",
     "base_ping": 210, "region": "Europa"},
    {"id": "tokyo", "name": "Tóquio", "country": "Japão", "flag": "🇯🇵", "gpu": "RTX 4090",
     "base_ping": 265, "region": "Ásia"},
    {"id": "santiago", "name": "Santiago", "country": "Chile", "flag": "🇨🇱", "gpu": "RTX 4070 Ti",
     "base_ping": 38, "region": "América do Sul"},
]


# ----------------------------------------------------------------------------
# Auth endpoints
# ----------------------------------------------------------------------------
def _public_user(doc: dict) -> dict:
    return {"id": str(doc["_id"]), "name": doc.get("name"), "email": doc.get("email"),
            "role": doc.get("role", "user"), "plan": doc.get("plan", "Free Trial"),
            "created_at": doc.get("created_at")}


def _set_cookie(response: Response, token: str):
    response.set_cookie(key="access_token", value=token, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")


@api_router.post("/auth/register")
async def register(payload: RegisterInput, response: Response):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Este e-mail já está cadastrado")
    doc = {"name": payload.name, "email": email, "password_hash": hash_password(payload.password),
           "role": "user", "plan": "Free Trial", "created_at": datetime.now(timezone.utc).isoformat()}
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    token = create_access_token(str(res.inserted_id), email)
    _set_cookie(response, token)
    return {"user": _public_user(doc), "token": token}


@api_router.post("/auth/login")
async def login(payload: LoginInput, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")
    token = create_access_token(str(user["_id"]), email)
    _set_cookie(response, token)
    return {"user": _public_user(user), "token": token}


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": {"id": user["_id"], "name": user.get("name"), "email": user.get("email"),
                     "role": user.get("role", "user"), "plan": user.get("plan", "Free Trial"),
                     "created_at": user.get("created_at")}}


# ----------------------------------------------------------------------------
# Games
# ----------------------------------------------------------------------------
@api_router.get("/games")
async def list_games():
    games = await db.games.find({}, {"_id": 0}).to_list(1000)
    return games


@api_router.get("/games/{game_id}")
async def get_game(game_id: str):
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Jogo não encontrado")
    return game


# ----------------------------------------------------------------------------
# Nodes (with dynamic live-ish metrics)
# ----------------------------------------------------------------------------
@api_router.get("/nodes")
async def list_nodes():
    nodes = await db.nodes.find({}, {"_id": 0}).to_list(1000)
    out = []
    for n in nodes:
        jitter = random.randint(-4, 6)
        load = random.randint(35, 92)
        queue = 0 if load < 85 else random.randint(1, 4)
        out.append({**n, "ping": max(5, n["base_ping"] + jitter), "load": load,
                    "gpu_util": random.randint(40, 98), "queue": queue,
                    "status": "online" if load < 97 else "degraded"})
    return out


# ----------------------------------------------------------------------------
# Library
# ----------------------------------------------------------------------------
@api_router.get("/library")
async def get_library(user: dict = Depends(get_current_user)):
    items = await db.library.find({"user_id": user["_id"]}, {"_id": 0}).to_list(1000)
    games_by_id = {g["id"]: g for g in await db.games.find({}, {"_id": 0}).to_list(1000)}
    result = []
    for it in items:
        g = games_by_id.get(it["game_id"])
        if g:
            result.append({**g, "hours_played": it.get("hours_played", 0),
                           "favorite": it.get("favorite", False),
                           "added_at": it.get("added_at"),
                           "last_played": it.get("last_played")})
    return result


@api_router.post("/library/{game_id}")
async def add_to_library(game_id: str, user: dict = Depends(get_current_user)):
    game = await db.games.find_one({"id": game_id})
    if not game:
        raise HTTPException(status_code=404, detail="Jogo não encontrado")
    existing = await db.library.find_one({"user_id": user["_id"], "game_id": game_id})
    if existing:
        return {"ok": True, "already": True}
    await db.library.insert_one({"user_id": user["_id"], "game_id": game_id,
                                 "hours_played": 0, "favorite": False,
                                 "added_at": datetime.now(timezone.utc).isoformat()})
    return {"ok": True}


@api_router.delete("/library/{game_id}")
async def remove_from_library(game_id: str, user: dict = Depends(get_current_user)):
    await db.library.delete_one({"user_id": user["_id"], "game_id": game_id})
    return {"ok": True}


@api_router.post("/library/{game_id}/favorite")
async def toggle_favorite(game_id: str, user: dict = Depends(get_current_user)):
    item = await db.library.find_one({"user_id": user["_id"], "game_id": game_id})
    if not item:
        raise HTTPException(status_code=404, detail="Jogo não está na biblioteca")
    new_val = not item.get("favorite", False)
    await db.library.update_one({"_id": item["_id"]}, {"$set": {"favorite": new_val}})
    return {"ok": True, "favorite": new_val}


# ----------------------------------------------------------------------------
# Sessions
# ----------------------------------------------------------------------------
@api_router.post("/sessions/start")
async def start_session(payload: StartSessionInput, user: dict = Depends(get_current_user)):
    game = await db.games.find_one({"id": payload.game_id}, {"_id": 0})
    node = await db.nodes.find_one({"id": payload.node_id}, {"_id": 0})
    if not game or not node:
        raise HTTPException(status_code=404, detail="Jogo ou servidor inválido")
    # auto-add to library
    if not await db.library.find_one({"user_id": user["_id"], "game_id": payload.game_id}):
        await db.library.insert_one({"user_id": user["_id"], "game_id": payload.game_id,
                                     "hours_played": 0, "favorite": False,
                                     "added_at": datetime.now(timezone.utc).isoformat()})
    # end previous active sessions
    await db.sessions.update_many({"user_id": user["_id"], "active": True},
                                  {"$set": {"active": False, "ended_at": datetime.now(timezone.utc).isoformat()}})
    sess_id = secrets.token_hex(8)
    queue = node.get("base_ping", 0) and random.choice([0, 0, 0, 1])
    doc = {"id": sess_id, "user_id": user["_id"], "game_id": payload.game_id,
           "node_id": payload.node_id, "active": True, "queue_position": queue,
           "started_at": datetime.now(timezone.utc).isoformat()}
    await db.sessions.insert_one(doc)
    await db.library.update_one({"user_id": user["_id"], "game_id": payload.game_id},
                                {"$set": {"last_played": datetime.now(timezone.utc).isoformat()}})
    return {"session": {k: v for k, v in doc.items() if k != "_id"}, "game": game, "node": node}


@api_router.get("/sessions/active")
async def active_session(user: dict = Depends(get_current_user)):
    doc = await db.sessions.find_one({"user_id": user["_id"], "active": True}, {"_id": 0})
    if not doc:
        return {"session": None}
    game = await db.games.find_one({"id": doc["game_id"]}, {"_id": 0})
    node = await db.nodes.find_one({"id": doc["node_id"]}, {"_id": 0})
    return {"session": doc, "game": game, "node": node}


@api_router.get("/sessions/{session_id}/metrics")
async def session_metrics(session_id: str, user: dict = Depends(get_current_user)):
    doc = await db.sessions.find_one({"id": session_id, "user_id": user["_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    node = await db.nodes.find_one({"id": doc["node_id"]}, {"_id": 0})
    base = node.get("base_ping", 20) if node else 20
    fps = random.choice([60, 90, 120, 120, 120, 118, 116])
    return {"fps": fps, "ping": max(5, base + random.randint(-3, 8)),
            "bitrate": random.randint(38, 55), "resolution": "4K HDR",
            "packet_loss": round(random.uniform(0, 0.4), 2),
            "codec": random.choice(["AV1", "H.265"])}


@api_router.post("/sessions/{session_id}/end")
async def end_session(session_id: str, user: dict = Depends(get_current_user)):
    doc = await db.sessions.find_one({"id": session_id, "user_id": user["_id"]})
    if doc:
        await db.sessions.update_one({"_id": doc["_id"]},
                                     {"$set": {"active": False, "ended_at": datetime.now(timezone.utc).isoformat()}})
        # accrue some play time
        started = datetime.fromisoformat(doc["started_at"])
        mins = (datetime.now(timezone.utc) - started).total_seconds() / 3600
        await db.library.update_one({"user_id": user["_id"], "game_id": doc["game_id"]},
                                    {"$inc": {"hours_played": round(mins, 2)}})
    return {"ok": True}


@api_router.get("/sessions/history")
async def sessions_history(user: dict = Depends(get_current_user)):
    docs = await db.sessions.find({"user_id": user["_id"]}, {"_id": 0}).sort("started_at", -1).to_list(500)
    games_by_id = {g["id"]: g for g in await db.games.find({}, {"_id": 0}).to_list(1000)}
    nodes_by_id = {n["id"]: n for n in await db.nodes.find({}, {"_id": 0}).to_list(1000)}
    out = []
    for d in docs:
        g = games_by_id.get(d["game_id"])
        n = nodes_by_id.get(d["node_id"])
        start = datetime.fromisoformat(d["started_at"])
        end = datetime.fromisoformat(d["ended_at"]) if d.get("ended_at") else datetime.now(timezone.utc)
        duration = int((end - start).total_seconds())
        saves = await db.saves.find({"user_id": user["_id"], "session_id": d["id"]}, {"_id": 0}).to_list(100)
        out.append({
            "id": d["id"],
            "active": d.get("active", False),
            "started_at": d["started_at"],
            "ended_at": d.get("ended_at"),
            "duration_seconds": duration,
            "game": {"id": g["id"], "title": g["title"], "cover": g["cover"]} if g else None,
            "node": {"id": n["id"], "name": n["name"], "flag": n["flag"], "gpu": n["gpu"]} if n else None,
            "saves": [{"id": s["id"], "label": s["label"]} for s in saves],
        })
    return out


# ----------------------------------------------------------------------------
# Cloud Saves
# ----------------------------------------------------------------------------
@api_router.get("/saves")
async def list_saves(game_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"user_id": user["_id"]}
    if game_id:
        q["game_id"] = game_id
    saves = await db.saves.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    games_by_id = {g["id"]: g for g in await db.games.find({}, {"_id": 0}).to_list(1000)}
    for s in saves:
        g = games_by_id.get(s["game_id"])
        if g:
            s["game_title"] = g["title"]
            s["game_cover"] = g["cover"]
    return saves


@api_router.post("/saves")
async def create_save(payload: CreateSaveInput, user: dict = Depends(get_current_user)):
    game = await db.games.find_one({"id": payload.game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Jogo não encontrado")
    count = await db.saves.count_documents({"user_id": user["_id"], "game_id": payload.game_id})
    doc = {"id": secrets.token_hex(8), "user_id": user["_id"], "game_id": payload.game_id,
           "label": payload.label or f"Slot {count + 1}",
           "size_mb": random.randint(8, 240),
           "thumbnail": game["hero"],
           "sync_status": "synced",
           "session_id": payload.session_id,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.saves.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api_router.delete("/saves/{save_id}")
async def delete_save(save_id: str, user: dict = Depends(get_current_user)):
    await db.saves.delete_one({"id": save_id, "user_id": user["_id"]})
    return {"ok": True}


@api_router.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    lib_count = await db.library.count_documents({"user_id": user["_id"]})
    saves_count = await db.saves.count_documents({"user_id": user["_id"]})
    items = await db.library.find({"user_id": user["_id"]}, {"_id": 0}).to_list(1000)
    total_hours = round(sum(i.get("hours_played", 0) for i in items), 1)
    return {"games_in_library": lib_count, "cloud_saves": saves_count,
            "total_hours": total_hours, "plan": user.get("plan", "Free Trial")}


# ----------------------------------------------------------------------------
# Startup
# ----------------------------------------------------------------------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    # seed games
    for g in GAMES_SEED:
        await db.games.update_one({"id": g["id"]}, {"$set": g}, upsert=True)
    for n in NODES_SEED:
        await db.nodes.update_one({"id": n["id"]}, {"$set": n}, upsert=True)
    # seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@vortex.gg")
    admin_password = os.environ.get("ADMIN_PASSWORD", "vortex123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({"name": "Vortex Admin", "email": admin_email,
                                   "password_hash": hash_password(admin_password), "role": "admin",
                                   "plan": "Ultra Rig", "created_at": datetime.now(timezone.utc).isoformat()})
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})
    logger.info("Vortex seed complete")


# ----------------------------------------------------------------------------
# WebRTC Signaling (real peer-to-peer screen stream demo)
# ----------------------------------------------------------------------------
class SignalRooms:
    def __init__(self):
        self.rooms: dict = {}

    async def join(self, room: str, ws: WebSocket):
        self.rooms.setdefault(room, set()).add(ws)

    def leave(self, room: str, ws: WebSocket):
        if room in self.rooms:
            self.rooms[room].discard(ws)
            if not self.rooms[room]:
                self.rooms.pop(room, None)

    async def broadcast(self, room: str, sender: WebSocket, message: str):
        for peer in list(self.rooms.get(room, set())):
            if peer is not sender:
                try:
                    await peer.send_text(message)
                except Exception:
                    pass

    def count(self, room: str) -> int:
        return len(self.rooms.get(room, set()))


signal_rooms = SignalRooms()


@api_router.websocket("/ws/signal/{room}")
async def signal_ws(websocket: WebSocket, room: str):
    await websocket.accept()
    await signal_rooms.join(room, websocket)
    # tell the newcomer how many peers are already here and notify others
    await websocket.send_text(f'{{"type":"joined","peers":{signal_rooms.count(room)}}}')
    await signal_rooms.broadcast(room, websocket, '{"type":"peer-joined"}')
    try:
        while True:
            data = await websocket.receive_text()
            await signal_rooms.broadcast(room, websocket, data)
    except WebSocketDisconnect:
        pass
    finally:
        signal_rooms.leave(room, websocket)
        await signal_rooms.broadcast(room, websocket, '{"type":"peer-left"}')


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()
