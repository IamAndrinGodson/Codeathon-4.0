from fastapi import Request, HTTPException
import time
from db.redis import get_redis_client

# Simple sliding window rate limiter
async def rate_limit(request: Request):
    client = get_redis_client()
    ip = request.client.host
    endpoint = request.url.path
    
    key = f"rate_limit:{endpoint}:{ip}"
    
    # Allow 100 requests per minute
    limit = 100
    window = 60
    
    current = await client.incr(key)
    if current == 1:
        await client.expire(key, window)
        
    if current > limit:
        raise HTTPException(status_code=429, detail="Too many requests")
