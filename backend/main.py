import os
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.config import verify_config, GEMINI_API_KEY
from backend.services.llm import query_ally
from backend.services.vision import capture_screen
from backend.services.memory import (
    get_all_memories, add_memory, delete_memory, clear_chat_history, get_chat_history
)
from backend.services.system import (
    get_system_stats, list_processes, get_pending_commands, execute_queued_command, reject_queued_command
)

# Start and verify
verify_config()

app = FastAPI(
    title="Ally API",
    description="Backend API for Ally Personal AI Companion",
    version="1.0.0"
)

# Add CORS Middleware to enable communication with the React frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this. For local dev, allow all.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active WebSocket connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

ws_manager = ConnectionManager()

# --- Request Models ---

class ChatRequest(BaseModel):
    message: str
    use_vision: bool = False

class MemoryCreateRequest(BaseModel):
    key: str
    value: str
    category: str = "general"

# --- Endpoints ---

@app.get("/")
def read_root():
    return {
        "status": "online",
        "companion": "Ally",
        "api_configured": bool(GEMINI_API_KEY)
    }

# Chat Interface
@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    # Run the query
    result = query_ally(request.message, request.use_vision)
    
    # Broadcast an update to frontend to check for new commands if any
    pending = get_pending_commands()
    if pending:
        await ws_manager.broadcast({"event": "pending_commands_update", "count": len(pending)})
        
    return result

@app.get("/api/chat/history")
def chat_history_endpoint():
    return {"history": get_chat_history()}

@app.delete("/api/chat/history")
def clear_chat_history_endpoint():
    clear_chat_history()
    return {"status": "success", "message": "Conversation history cleared."}

# Screen Visuals
@app.get("/api/screen")
def get_screen_thumbnail():
    data_url = capture_screen()
    if not data_url:
        raise HTTPException(status_code=500, detail="Failed to capture screenshot")
    return {"screenshot": data_url}

# Memory Database
@app.get("/api/memory")
def list_memories():
    return {"memories": get_all_memories()}

@app.post("/api/memory")
def create_memory(request: MemoryCreateRequest):
    success = add_memory(request.key, request.value, request.category)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to write memory to database")
    return {"status": "success", "message": "Memory saved successfully"}

@app.delete("/api/memory/{memory_id}")
def remove_memory(memory_id: int):
    success = delete_memory(memory_id)
    if not success:
        raise HTTPException(status_code=404, detail="Memory ID not found")
    return {"status": "success", "message": f"Memory {memory_id} removed"}

# System Control
@app.get("/api/system/stats")
def fetch_system_stats():
    return get_system_stats()

@app.get("/api/system/processes")
def fetch_processes():
    return {"processes": list_processes()}

@app.get("/api/system/pending")
def fetch_pending_commands():
    return {"pending": get_pending_commands()}

@app.post("/api/system/approve/{task_id}")
async def approve_command(task_id: str):
    result = execute_queued_command(task_id)
    # Broadcast status change
    await ws_manager.broadcast({"event": "command_executed", "task_id": task_id, "result": result})
    return {"status": "completed", "result": result}

@app.post("/api/system/reject/{task_id}")
async def reject_command(task_id: str):
    result = reject_queued_command(task_id)
    # Broadcast status change
    await ws_manager.broadcast({"event": "command_rejected", "task_id": task_id})
    return {"status": "rejected", "result": result}

# WebSocket Endpoint for Live Activity
@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Receive text data (optional ping/pong)
            data = await websocket.receive_text()
            await websocket.send_json({"event": "pong", "data": data})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
