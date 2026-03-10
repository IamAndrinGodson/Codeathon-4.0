from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/events", tags=["events"])

class SessionEvent(BaseModel):
    session_id: str
    event_type: str
    severity: str = "info"
    metadata: dict = {}

@router.post("/ingest")
async def ingest_event(event: SessionEvent):
    """
    Ingest a session event for audit trail.
    In production this writes to TimescaleDB via Celery.
    """
    # For now, just acknowledge the event
    return {
        "ingested": True,
        "event_type": event.event_type,
        "session_id": event.session_id,
    }

@router.get("/timeline/{session_id}")
async def get_timeline(session_id: str):
    """Get session event timeline for replay"""
    # Placeholder — in production reads from TimescaleDB
    return {
        "session_id": session_id,
        "events": []
    }
