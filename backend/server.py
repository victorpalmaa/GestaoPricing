from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import re
from supabase import create_client, Client
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
from jose import jwt, JWTError
import requests

SECRET_KEY = os.environ.get("SECRET_KEY", "change-me")
ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
ACCESS_TOKEN_EXPIRE_LONG_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_LONG_MINUTES", "43200"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# Supabase connection
SUPABASE_URL = os.environ.get("SUPABASE_URL")
# Fallback para evitar má configuração de env em diferentes ambientes
SUPABASE_SERVICE_ROLE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("SUPABASE_SECRET")
    or os.environ.get("SUPABASE_SERVICE_ROLE")
    or os.environ.get("SUPABASE_KEY")
)

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        # Aviso: se a chave não for service role, operações podem falhar por RLS
        key_source = (
            "SUPABASE_SERVICE_ROLE_KEY" if os.environ.get("SUPABASE_SERVICE_ROLE_KEY") else
            "SUPABASE_SECRET" if os.environ.get("SUPABASE_SECRET") else
            "SUPABASE_SERVICE_ROLE" if os.environ.get("SUPABASE_SERVICE_ROLE") else
            "SUPABASE_KEY"
        )
        logging.info(f"Supabase client initialized with key from {key_source}")
    except Exception as e:
        logging.error(f"Failed to initialize Supabase client: {e}")
        supabase = None

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class UserOut(BaseModel):
    id: str
    nome: str
    sobrenome: str
    email: EmailStr
    area: str

class UserCreate(BaseModel):
    nome: str
    sobrenome: str
    email: EmailStr
    area: str
    password: str

class LoginInput(BaseModel):
    email: EmailStr
    password: str
    remember: bool = False

class ForgotPasswordInput(BaseModel):
    email: EmailStr

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int

class AuthResponse(BaseModel):
    token: Token
    user: UserOut

class ResetPasswordInput(BaseModel):
    email: EmailStr
    token: str
    new_password: str

class Price(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    cliente: str
    sku: str
    pricingId: str = ""
    precoLiquido: float
    precoBruto: float
    margemBruta: float
    volume: int
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = 'em_aberto'

class PriceCreate(BaseModel):
    cliente: str
    sku: str
    pricingId: str = ""
    precoLiquido: float
    precoBruto: float
    margemBruta: float
    volume: int
    status: str = 'em_aberto'

@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.get("/status")
async def status():
    return {
        "supabase_url": bool(SUPABASE_URL),
        "supabase_key": bool(SUPABASE_SERVICE_ROLE_KEY),
        "supabase_client": bool(supabase),
        "email_from": os.environ.get("EMAIL_FROM") or "",
        "resend": bool(os.environ.get("RESEND_API_KEY")),
        "cors": os.environ.get("CORS_ORIGINS") or "*",
    }

@api_router.get("/debug/users-count")
async def users_count():
    try:
        if supabase is None:
            return {"supabase": False, "count": 0}
        r = supabase.table("users").select("id").execute()
        return {"supabase": True, "count": len(r.data or [])}
    except Exception as e:
        return {"supabase": True, "error": str(e)}


def require_supabase():
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.")

def create_access_token(subject: dict, minutes: Optional[int] = None) -> str:
    to_encode = subject.copy()
    m = minutes if minutes is not None else ACCESS_TOKEN_EXPIRE_MINUTES
    expire = datetime.now(timezone.utc) + timedelta(minutes=m)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)) -> UserOut:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_data = {
            "id": payload.get("sub"),
            "nome": payload.get("nome"),
            "sobrenome": payload.get("sobrenome"),
            "email": payload.get("email"),
            "area": payload.get("area"),
        }
        if not user_data["id"] or not user_data["email"]:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
        return UserOut(**user_data)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado")

def send_reset_email_resend(to_email: str, subject: str, html: str) -> bool:
    key = os.environ.get("RESEND_API_KEY")
    if not key:
        return False
    frm = os.environ.get("EMAIL_FROM", "onboarding@resend.dev")
    try:
        r = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json={
                "from": frm,
                "to": to_email,
                "subject": subject,
                "html": html,
            },
            timeout=10,
        )
        return 200 <= r.status_code < 300
    except Exception:
        return False

def create_reset_token(email: str, minutes: int = 60) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    payload = {
        "type": "reset_password",
        "email": email,
        "exp": exp,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def validate_reset_jwt(token: str, email: str) -> bool:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("type") == "reset_password" and str(payload.get("email")).lower() == email.lower()
    except JWTError:
        return False

def ensure_auth_user(email: str) -> None:
    try:
        try:
            supabase.auth.admin.create_user({
                "email": email,
                "password": "Init-" + uuid.uuid4().hex[:12],
                "email_confirm": True,
            })
        except Exception:
            pass
    except Exception:
        pass

def validate_supabase_recovery(token: str, email: str) -> bool:
    try:
        if not hasattr(supabase, "auth"):
            return False
        ok = False
        try:
            if "." in token and hasattr(supabase.auth, "get_user"):
                u = supabase.auth.get_user(token)
                if u and getattr(u, "user", None):
                    user_obj = getattr(u, "user")
                    em = getattr(user_obj, "email", None) or (isinstance(user_obj, dict) and user_obj.get("email"))
                    if em and em.lower() == email.lower():
                        ok = True
            elif hasattr(supabase.auth, "verify_otp"):
                supabase.auth.verify_otp({"email": email, "type": "recovery", "token": token})
                ok = True
        except Exception:
            ok = False
        return ok
    except Exception:
        return False

# Users endpoints
@api_router.post("/users/register", response_model=UserOut)
async def register_user(input: UserCreate):
    require_supabase()

    corp_only = (os.environ.get("CORPORATE_ONLY") or "true").lower()
    if corp_only in ("1","true","yes") and not input.email.endswith("@pronutrition.com.br"):
        raise HTTPException(status_code=400, detail="Email deve ser corporativo (@pronutrition.com.br)")

    # Check existing user
    try:
        existing = supabase.table("users").select("id").eq("email", input.email).limit(1).execute()
        if existing.data:
            raise HTTPException(status_code=409, detail="Usuário já existe")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro verificando usuário: {e}")

    password_hash = bcrypt.hashpw(input.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user_id = str(uuid.uuid4())
    record = {
        "id": user_id,
        "nome": input.nome,
        "sobrenome": input.sobrenome,
        "email": input.email,
        "area": input.area,
        "password_hash": password_hash,
    }
    try:
        supabase.table("users").insert(record).execute()
        try:
            supabase.auth.admin.create_user({
                "email": input.email,
                "password": input.password,
                "email_confirm": True,
            })
        except Exception:
            pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro criando usuário: {e}")
    return UserOut(**{k: record[k] for k in ["id","nome","sobrenome","email","area"]})


@api_router.post("/users/sync-auth")
async def sync_auth_users():
    require_supabase()
    try:
        res = supabase.table("users").select("email").execute()
        emails = [u.get("email") for u in res.data if u.get("email")]
        synced = 0
        for em in emails:
            try:
                supabase.auth.admin.create_user({
                    "email": em,
                    "password": "Init-" + uuid.uuid4().hex[:12],
                    "email_confirm": True,
                })
                synced += 1
            except Exception:
                pass
        return {"synced": synced}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro sincronizando usuários: {e}")

@api_router.post("/login", response_model=AuthResponse)
async def login(input: LoginInput):
    require_supabase()
    try:
        res = supabase.table("users").select("*").eq("email", input.email).limit(1).execute()
        if not res.data:
            raise HTTPException(status_code=401, detail="Credenciais inválidas")
        user = res.data[0]
        stored_hash = user.get("password_hash") or ""
        if not stored_hash or not bcrypt.checkpw(input.password.encode("utf-8"), stored_hash.encode("utf-8")):
            raise HTTPException(status_code=401, detail="Credenciais inválidas")
        claims = {
            "sub": user["id"],
            "email": user["email"],
            "nome": user.get("nome", ""),
            "sobrenome": user.get("sobrenome", ""),
            "area": user.get("area", ""),
        }
        minutes = ACCESS_TOKEN_EXPIRE_LONG_MINUTES if bool(input.remember) else ACCESS_TOKEN_EXPIRE_MINUTES
        token = create_access_token(claims, minutes)
        return AuthResponse(
            token=Token(access_token=token, expires_in=minutes * 60),
            user=UserOut(**{k: user[k] for k in ["id","nome","sobrenome","email","area"]})
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao autenticar: {e}")

@api_router.post("/forgot-password")
async def forgot_password(input: ForgotPasswordInput):
    require_supabase()
    try:
        if not input.email:
            raise HTTPException(status_code=400, detail="E-mail inválido")

        try:
            existing = supabase.table("users").select("id").eq("email", input.email).limit(1).execute()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erro verificando usuário: {e}")
        if not existing.data:
            raise HTTPException(status_code=404, detail="Não há usuário com este e-mail cadastrado")

        base = os.environ.get("SUPABASE_RESET_REDIRECT") or os.environ.get("SITE_URL") or "http://localhost:5174"
        redirect_to = base if base.rstrip("/").endswith("/update-password") else f"{base.rstrip('/')}" + "/update-password"
        sent_via_supabase = False
        try:
            if hasattr(supabase, "auth") and hasattr(supabase.auth, "reset_password_for_email"):
                ensure_auth_user(input.email)
                supabase.auth.reset_password_for_email(input.email, {"redirect_to": redirect_to})
                sent_via_supabase = True
        except Exception:
            sent_via_supabase = False

        token = create_reset_token(input.email, 60)
        reset_link = f"{redirect_to}?token={token}&email={input.email}"
        html = (
            "<p>Para redefinir sua senha, clique no botão abaixo:</p>"
            f"<p><a href=\"{reset_link}\" style=\"display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none\">Redefinir senha</a></p>"
        )
        sent_via_resend = send_reset_email_resend(input.email, "Redefinição de senha", html)
        return {"detail": "Enviamos um e-mail para recuperar sua senha.", "link": reset_link, "sent_via": "supabase" if sent_via_supabase else ("resend" if sent_via_resend else "none")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar solicitação: {e}")

@api_router.post("/reset-password")
async def reset_password(input: ResetPasswordInput):
    require_supabase()
    try:
        if not (input.email and input.token and input.new_password):
            raise HTTPException(status_code=400, detail="Parâmetros inválidos")

        valid_via_jwt = validate_reset_jwt(input.token, input.email)
        if not valid_via_jwt:
            import hashlib as _hl
            token_hash = _hl.sha256(input.token.encode("utf-8")).hexdigest()
            valid_via_table = False
            try:
                res = supabase.table("password_resets").select("token_hash,expires_at").eq("email", input.email).eq("token_hash", token_hash).limit(1).execute()
                if res.data:
                    rec = res.data[0]
                    try:
                        exp_dt = datetime.fromisoformat(rec.get("expires_at"))
                    except Exception:
                        exp_dt = datetime.now(timezone.utc)
                    if datetime.now(timezone.utc) <= exp_dt:
                        valid_via_table = True
            except Exception:
                valid_via_table = False
            if not valid_via_table and not validate_supabase_recovery(input.token, input.email):
                raise HTTPException(status_code=400, detail="Token inválido ou expirado")

        new_hash = bcrypt.hashpw(input.new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        try:
            updated = False
            try:
                if hasattr(supabase, "auth") and hasattr(supabase.auth, "get_user"):
                    gu = supabase.auth.get_user(input.token)
                    uid = None
                    if gu and getattr(gu, "user", None):
                        user_obj = getattr(gu, "user")
                        uid = getattr(user_obj, "id", None) or (isinstance(user_obj, dict) and user_obj.get("id"))
                    if uid and hasattr(supabase.auth, "admin") and hasattr(supabase.auth.admin, "update_user_by_id"):
                        supabase.auth.admin.update_user_by_id(uid, {"password": input.new_password})
                        updated = True
            except Exception:
                pass
            if not updated:
                try:
                    supabase.auth.update_user({"password": input.new_password})
                except Exception:
                    pass
            resp_update = supabase.table("users").update({"password_hash": new_hash}).eq("email", input.email).execute()
            if not resp_update.data:
                raise HTTPException(status_code=404, detail="Usuário não encontrado")
            try:
                supabase.table("password_resets").delete().eq("email", input.email).execute()
            except Exception:
                pass
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Falha ao atualizar senha: {e}")

        return {"detail": "Senha atualizada com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao redefinir senha: {e}")

@api_router.get("/users", response_model=List[UserOut])
async def list_users():
    require_supabase()
    try:
        res = supabase.table("users").select("id,nome,sobrenome,email,area").execute()
        return [UserOut(**u) for u in res.data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro listando usuários: {e}")

# Prices (leads) endpoints
@api_router.get("/prices", response_model=List[Price])
async def get_prices(current_user: UserOut = Depends(get_current_user)):
    require_supabase()
    try:
        res = supabase.table("prices").select("*").execute()
        items = []
        for p in res.data:
            model = {
                "id": p.get("id") or str(uuid.uuid4()),
                "cliente": p.get("cliente") or "",
                "sku": p.get("sku") or "",
                "pricingId": p.get("pricingId") or p.get("pricingid") or "",
                "precoLiquido": p.get("precoLiquido") or p.get("preco_liquido") or p.get("precoliquido") or 0.0,
                "precoBruto": p.get("precoBruto") or p.get("preco_bruto") or p.get("precobruto") or 0.0,
                "margemBruta": p.get("margemBruta") or p.get("margem_bruta") or p.get("margembruta") or 0.0,
                "volume": p.get("volume") or 0,
                "createdAt": datetime.now(timezone.utc),
                "status": p.get("status") or "em_aberto",
            }
            if isinstance(p.get("createdAt"), str):
                try:
                    model["createdAt"] = datetime.fromisoformat(p["createdAt"]) 
                except Exception:
                    pass
            elif isinstance(p.get("created_at"), str):
                try:
                    model["createdAt"] = datetime.fromisoformat(p["created_at"]) 
                except Exception:
                    pass
            items.append(Price(**model))
        return items
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro buscando preços: {e}")

@api_router.post("/prices", response_model=Price)
async def add_price(input: PriceCreate, current_user: UserOut = Depends(get_current_user)):
    require_supabase()
    item = Price(**input.model_dump())
    doc_snake = {
        "id": item.id,
        "cliente": item.cliente,
        "sku": item.sku,
        "pricingid": item.pricingId,
        "preco_liquido": item.precoLiquido,
        "preco_bruto": item.precoBruto,
        "margem_bruta": item.margemBruta,
        "volume": item.volume,
        "status": item.status,
    }
    doc_flat = {
        "id": item.id,
        "cliente": item.cliente,
        "sku": item.sku,
        "pricingid": item.pricingId,
        "precoliquido": item.precoLiquido,
        "precobruto": item.precoBruto,
        "margembruta": item.margemBruta,
        "volume": item.volume,
        "status": item.status,
    }
    try:
        supabase.table("prices").insert(doc_snake).execute()
        return item
    except Exception as e:
        msg = str(e)
        try:
            supabase.table("prices").insert(doc_flat).execute()
            return item
        except Exception as e2:
            msg2 = str(e2)
            if ("PGRST" in msg2 and "pricingid" in msg2) or ("pricingid" in msg2.lower()):
                try:
                    doc_snake.pop("pricingid", None)
                    doc_flat.pop("pricingid", None)
                    supabase.table("prices").insert(doc_snake).execute()
                    return item
                except Exception as e3:
                    raise HTTPException(status_code=500, detail=f"Erro criando preço: {e3}")
            raise HTTPException(status_code=500, detail=f"Erro criando preço: {e2}")

@api_router.put("/prices/{price_id}", response_model=Price)
async def update_price(price_id: str, input: PriceCreate, current_user: UserOut = Depends(get_current_user)):
    require_supabase()
    try:
        update_snake = {
            "cliente": input.cliente,
            "sku": input.sku,
            "pricingid": input.pricingId,
            "preco_liquido": input.precoLiquido,
            "preco_bruto": input.precoBruto,
            "margem_bruta": input.margemBruta,
            "volume": input.volume,
            "status": input.status,
        }
        update_flat = {
            "cliente": input.cliente,
            "sku": input.sku,
            "pricingid": input.pricingId,
            "precoliquido": input.precoLiquido,
            "precobruto": input.precoBruto,
            "margembruta": input.margemBruta,
            "volume": input.volume,
            "status": input.status,
        }
        res = supabase.table("prices").update(update_snake).eq("id", price_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Preço não encontrado")
        record = res.data[0]
        model = {
            "id": record.get("id"),
            "cliente": record.get("cliente") or "",
            "sku": record.get("sku") or "",
            "pricingId": record.get("pricingId") or record.get("pricingid") or "",
            "precoLiquido": record.get("precoLiquido") or record.get("preco_liquido") or record.get("precoliquido") or 0.0,
            "precoBruto": record.get("precoBruto") or record.get("preco_bruto") or record.get("precobruto") or 0.0,
            "margemBruta": record.get("margemBruta") or record.get("margem_bruta") or record.get("margembruta") or 0.0,
            "volume": record.get("volume") or 0,
            "createdAt": datetime.now(timezone.utc),
            "status": record.get("status") or "em_aberto",
        }
        if isinstance(record.get("createdAt"), str):
            try:
                model["createdAt"] = datetime.fromisoformat(record["createdAt"]) 
            except Exception:
                pass
        elif isinstance(record.get("created_at"), str):
            try:
                model["createdAt"] = datetime.fromisoformat(record["created_at"]) 
            except Exception:
                pass
        return Price(**model)
    except HTTPException:
        raise
    except Exception as e:
        try:
            res = supabase.table("prices").update(update_flat).eq("id", price_id).execute()
            if not res.data:
                raise HTTPException(status_code=404, detail="Preço não encontrado")
            record = res.data[0]
            model = {
                "id": record.get("id"),
                "cliente": record.get("cliente") or "",
                "sku": record.get("sku") or "",
                "pricingId": record.get("pricingId") or record.get("pricingid") or "",
                "precoLiquido": record.get("precoLiquido") or record.get("preco_liquido") or record.get("precoliquido") or 0.0,
                "precoBruto": record.get("precoBruto") or record.get("preco_bruto") or record.get("precobruto") or 0.0,
                "margemBruta": record.get("margemBruta") or record.get("margem_bruta") or record.get("margembruta") or 0.0,
                "volume": record.get("volume") or 0,
                "createdAt": datetime.now(timezone.utc),
                "status": record.get("status") or "em_aberto",
            }
            return Price(**model)
        except Exception as e2:
            msg2 = str(e2)
            if ("PGRST" in msg2 and "pricingid" in msg2) or ("pricingid" in msg2.lower()):
                try:
                    update_snake.pop("pricingid", None)
                    update_flat.pop("pricingid", None)
                    res = supabase.table("prices").update(update_snake).eq("id", price_id).execute()
                    if not res.data:
                        raise HTTPException(status_code=404, detail="Preço não encontrado")
                    record = res.data[0]
                    model = {
                        "id": record.get("id"),
                        "cliente": record.get("cliente") or "",
                        "sku": record.get("sku") or "",
                        "pricingId": record.get("pricingId") or record.get("pricingid") or "",
                        "precoLiquido": record.get("precoLiquido") or record.get("preco_liquido") or record.get("precoliquido") or 0.0,
                        "precoBruto": record.get("precoBruto") or record.get("preco_bruto") or record.get("precobruto") or 0.0,
                        "margemBruta": record.get("margemBruta") or record.get("margem_bruta") or record.get("margembruta") or 0.0,
                        "volume": record.get("volume") or 0,
                        "createdAt": datetime.now(timezone.utc),
                        "status": record.get("status") or "em_aberto",
                    }
                    return Price(**model)
                except Exception as e3:
                    raise HTTPException(status_code=500, detail=f"Erro atualizando preço: {e3}")
            raise HTTPException(status_code=500, detail=f"Erro atualizando preço: {e2}")

@api_router.delete("/prices/{price_id}")
async def delete_price(price_id: str, current_user: UserOut = Depends(get_current_user)):
    require_supabase()
    try:
        res = supabase.table("prices").delete().eq("id", price_id).execute()
        if getattr(res, "count", 0) == 0 and not res.data:
            raise HTTPException(status_code=404, detail="Preço não encontrado")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro removendo preço: {e}")

@app.get("/healthz")
async def healthz():
    return {
        "status": "ok",
        "supabase": bool(supabase),
        "time": datetime.now(timezone.utc).isoformat(),
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=os.environ.get("CORS_ORIGIN_REGEX") or r"https://.*\.vercel\.app$",
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    pass
