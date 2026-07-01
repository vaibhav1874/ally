import sqlite3
import datetime
from pathlib import Path
import re
from typing import List, Dict, Any
from backend.config import DB_PATH

def get_db_connection():
    """Establishes connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes schema tables if they do not exist."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create conversations table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create memories table (facts about the user or tasks)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT DEFAULT 'general',
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(category, key)
        )
    """)
    
    conn.commit()
    conn.close()

# Initialize DB on import
init_db()

# --- Chat History Functions ---

def save_chat_message(role: str, content: str):
    """Saves a message to the conversation history."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO conversations (role, content) VALUES (?, ?)",
        (role, content)
    )
    conn.commit()
    conn.close()

def get_chat_history(limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieves recent conversation messages."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT role, content, timestamp FROM conversations ORDER BY id DESC LIMIT ?",
        (limit,)
    )
    rows = cursor.fetchall()
    conn.close()
    
    # Return in chronological order
    messages = []
    for r in reversed(rows):
        messages.append({
            "role": r["role"],
            "content": r["content"],
            "timestamp": r["timestamp"]
        })
    return messages

def clear_chat_history():
    """Clears all conversations."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM conversations")
    conn.commit()
    conn.close()

# --- Memory Functions ---

def add_memory(key: str, value: str, category: str = "general") -> bool:
    """Adds or updates a long-term memory fact."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.datetime.now().isoformat()
    try:
        # Try to insert; on conflict, update the value and timestamp
        cursor.execute("""
            INSERT INTO memories (category, key, value, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(category, key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
        """, (category, key.strip().lower(), value.strip(), now, now))
        conn.commit()
        success = True
    except Exception as e:
        print(f"Error saving memory: {e}")
        success = False
    finally:
        conn.close()
    return success

def get_all_memories() -> List[Dict[str, Any]]:
    """Retrieves all stored memories."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, category, key, value, created_at FROM memories ORDER BY category, key")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_memory(memory_id: int) -> bool:
    """Deletes a memory by ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
    conn.commit()
    rows_affected = cursor.rowcount
    conn.close()
    return rows_affected > 0

def search_memories(query: str) -> List[Dict[str, Any]]:
    """Searches memories using simple keyword matches."""
    # Split query into words to build simple OR search
    words = [w.strip().lower() for w in re.split(r'\W+', query) if w.strip()]
    if not words:
        return get_all_memories()
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Construct query: look for matches in key or value
    sql = "SELECT id, category, key, value, created_at FROM memories WHERE "
    conditions = []
    params = []
    
    for word in words:
        conditions.append("(key LIKE ? OR value LIKE ?)")
        params.extend([f"%{word}%", f"%{word}%"])
        
    sql += " OR ".join(conditions)
    cursor.execute(sql, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(r) for r in rows]

def get_memories_context_string(query: str) -> str:
    """Retrieves relevant memories and formats them as a context block for the LLM."""
    memories = search_memories(query)
    if not memories:
        # If specific search is empty, get general profile memories
        memories = get_all_memories()[:20]
        
    if not memories:
        return "No specific long-term memories found."
        
    context = "Ally's Long-Term Memory (Learned facts & context):\n"
    for m in memories:
        context += f"- [{m['category']}] {m['key']}: {m['value']}\n"
    return context
