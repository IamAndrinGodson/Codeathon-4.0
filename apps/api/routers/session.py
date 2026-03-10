from fastapi import APIRouter, Depends, HTTPException, Request
from services.risk_engine import calculate_adapted_timeout, RiskContext
from db.redis import get_redis
from middleware.auth import verify_jwt
from typing import Dict, Any

# Mock functions for the router since full tasks/celery logic isn't written yet
async def log_session_event(session_id: str, event_type: str, severity: str, metadata: dict = None):
    pass
async def broadcast_tab_event(session_id: str, tab_id: str, event_type: str):
    pass

router = APIRouter(prefix="/api/session", tags=["session"])

def build_risk_context(session_data: bytes, request: Request) -> Dict[str, Any]:
    import json
    data = json.loads(session_data)
    return {
        "user_id": data.get("user_id", "local_dev"),
        "session_id": data.get("session_id", "local_sess"),
        "biometric_score": int(data.get("biometric_score", 100)),
        "device_trust_score": int(data.get("device_score", 50)),
        "is_geo_anomaly": data.get("is_geo_anomaly", False),
        "is_trusted_device": True,
        "is_off_hours": False,
        "max_active_txn_amount": 0,
        "failed_totp_last_hour": 0,
        "is_in_geo_fence": True
    }

@router.post("/heartbeat")
async def session_heartbeat(
    request: Request,
    session_payload: dict = Depends(verify_jwt),
    redis = Depends(get_redis)
):
    """
    Called every 15s by the frontend to:
    1. Confirm session is still valid
    2. Receive updated adapted_timeout
    3. Receive step_up_required flag
    """
    session_id = session_payload["session_id"]
    
    session_data = await redis.get(f"session:{session_id}")
    if not session_data:
        raise HTTPException(status_code=401, detail="Session expired")
    
    ctx = RiskContext(**build_risk_context(session_data, request))
    result = calculate_adapted_timeout(ctx)
    
    await redis.expire(f"session:{session_id}", result.adapted_timeout)
    
    return {
        "valid": True,
        "adapted_timeout": result.adapted_timeout,
        "risk_level": result.risk_level,
        "step_up_required": result.requires_step_up,
        "active_factors": result.active_factors
    }


@router.post("/extend")
async def extend_session(
    session_payload: dict = Depends(verify_jwt),
    redis = Depends(get_redis)
):
    """User explicitly extends session — resets activity timer"""
    session_id = session_payload["session_id"]
    await redis.set(f"last_activity:{session_id}", "now", ex=3600)
    await log_session_event(session_id, "SESSION_EXTENDED", "info")
    return {"extended": True, "message": "Session extended successfully"}


@router.delete("/tab/{tab_id}")
async def kill_tab(
    tab_id: str,
    session_payload: dict = Depends(verify_jwt),
    redis = Depends(get_redis)
):
    """Kill a specific tab from the session graph"""
    session_id = session_payload["session_id"]
    await redis.hdel(f"tabs:{session_id}", tab_id)
    await broadcast_tab_event(session_id, tab_id, "TAB_KILLED")
    await log_session_event(session_id, "TAB_KILLED", "warn", {"tab_id": tab_id})
    return {"killed": True, "tab_id": tab_id}


from pydantic import BaseModel
class BiometricPayload(BaseModel):
    composite_score: int

@router.post("/biometrics")
async def update_biometric_score(
    payload: BiometricPayload,
    session_payload: dict = Depends(verify_jwt),
    redis = Depends(get_redis)
):
    """Receive biometric trust score from Web Worker every 10s"""
    session_id = session_payload["session_id"]
    score = payload.composite_score
    await redis.hset(f"session:{session_id}", "biometric_score", score)
    if score < 40:
        await log_session_event(session_id, "BIOMETRIC_DROP", "high", {"score": score})
        return {"score": score, "action": "STEP_UP_AUTH_REQUIRED"}
    return {"score": score, "action": "OK"}
