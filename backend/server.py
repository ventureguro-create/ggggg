"""
Python FastAPI Proxy Server
Proxies API requests to Node.js backend on port 8003
"""
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import httpx
import os

app = FastAPI(title="Telegram Discovery API Proxy")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NODE_BACKEND_URL = os.environ.get("NODE_BACKEND_URL", "http://localhost:8003")

# MongoDB connection for direct Python access if needed
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "telegram_dev")

@app.get("/api/health")
async def health():
    """Health check endpoint"""
    return {"ok": True, "service": "proxy", "nodeBackend": NODE_BACKEND_URL}

@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_api(request: Request, path: str):
    """Proxy all /api/* requests to Node.js backend"""
    url = f"{NODE_BACKEND_URL}/api/{path}"
    
    # Build query string
    if request.query_params:
        url += f"?{request.query_params}"
    
    # Get headers (exclude host)
    headers = dict(request.headers)
    headers.pop("host", None)
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Get body if present
            body = await request.body()
            
            response = await client.request(
                method=request.method,
                url=url,
                headers=headers,
                content=body if body else None,
            )
            
            # Return response
            return JSONResponse(
                content=response.json() if response.headers.get("content-type", "").startswith("application/json") else {"raw": response.text},
                status_code=response.status_code,
                headers={"X-Proxied-From": "python-proxy"}
            )
    except httpx.ConnectError:
        return JSONResponse(
            content={"ok": False, "error": "Node.js backend not available", "url": url},
            status_code=503
        )
    except Exception as e:
        return JSONResponse(
            content={"ok": False, "error": str(e)},
            status_code=500
        )

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Connections Module Proxy",
        "status": "running",
        "nodeBackend": NODE_BACKEND_URL,
        "endpoints": {
            "health": "/api/health",
            "connections": "/api/connections/*"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
