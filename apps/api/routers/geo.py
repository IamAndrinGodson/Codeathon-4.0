from fastapi import APIRouter, Request
from services.geo_service import GeoService
import os

router = APIRouter(prefix="/api/geo", tags=["geo"])

geo_service = GeoService(geoip_db_path=os.getenv("GEOIP2_DB_PATH"))

@router.post("/lookup")
async def geo_lookup(request: Request):
    """Lookup geographic info for an IP address"""
    body = await request.json()
    ip = body.get("ip_address", request.client.host)
    result = geo_service.lookup_ip(ip)
    return result

@router.post("/fence-check")
async def fence_check(request: Request):
    """Check if coordinates are within a geo-fence zone"""
    body = await request.json()
    in_fence = geo_service.is_in_geofence(
        user_lat=body.get("user_lat"),
        user_lon=body.get("user_lon"),
        zone_lat=body.get("zone_lat"),
        zone_lon=body.get("zone_lon"),
        radius_km=body.get("radius_km", 50),
    )
    return {"in_fence": in_fence}
