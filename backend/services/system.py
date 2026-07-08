import os
import subprocess
import psutil
import platform
import uuid
from typing import Dict, List, Any
from backend.config import SANDBOX_DIR

# In-memory queue to track shell commands requiring user confirmation
PENDING_COMMANDS: Dict[str, Dict[str, Any]] = {}

def get_system_stats() -> Dict[str, Any]:
    """Retrieves current CPU, RAM, Disk, and Platform specifications."""
    try:
        cpu_percent = psutil.cpu_percent(interval=0.1)
        ram = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        return {
            "os": platform.system(),
            "os_release": platform.release(),
            "cpu_percent": cpu_percent,
            "ram_used_gb": round(ram.used / (1024 ** 3), 2),
            "ram_total_gb": round(ram.total / (1024 ** 3), 2),
            "ram_percent": ram.percent,
            "disk_used_gb": round(disk.used / (1024 ** 3), 2),
            "disk_total_gb": round(disk.total / (1024 ** 3), 2),
            "disk_percent": disk.percent
        }
    except Exception as e:
        print(f"Error fetching system stats: {e}")
        return {"error": str(e)}

def list_processes(limit: int = 15) -> List[Dict[str, Any]]:
    """Lists the top CPU-consuming active processes."""
    processes = []
    try:
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
            try:
                processes.append(proc.info)
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        
        # Sort by CPU usage descending
        processes = sorted(processes, key=lambda x: x.get('cpu_percent') or 0, reverse=True)
        return processes[:limit]
    except Exception as e:
        print(f"Error listing processes: {e}")
        return []

# --- Safe File Operations ---

def safe_list_dir(dir_path: str = "") -> List[Dict[str, Any]]:
    """Lists directory contents. Defaults to sandbox folder if empty."""
    target_path = Path(dir_path) if dir_path else SANDBOX_DIR
    if not target_path.exists():
        return [{"error": "Directory does not exist"}]
        
    items = []
    try:
        for entry in os.scandir(target_path):
            stat = entry.stat()
            items.append({
                "name": entry.name,
                "is_dir": entry.is_dir(),
                "path": str(entry.path),
                "size": stat.st_size,
                "modified": stat.st_mtime
            })
        return items
    except Exception as e:
        return [{"error": str(e)}]

def safe_read_file(file_path: str) -> str:
    """Reads a file's content. Ensures basic security checks."""
    try:
        path = Path(file_path)
        # Avoid accessing system files like hosts, registry, etc., unless requested.
        # But we let the user access files they specify.
        if not path.is_file():
            return f"Error: {file_path} is not a file."
            
        # Limit size read to 500KB to prevent memory issues
        if path.stat().st_size > 500 * 1024:
            return "Error: File is too large to read (max 500KB)."
            
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {str(e)}"

def safe_write_file(file_path: str, content: str) -> str:
    """Writes text content to a file."""
    try:
        path = Path(file_path)
        # Make parent directories if they don't exist
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Successfully wrote to {file_path} ({len(content)} bytes)."
    except Exception as e:
        return f"Error writing file: {str(e)}"

# --- Shell Automation & Approval System ---

def queue_command(command: str, description: str = "", code: str = None) -> str:
    """Queues a shell command requiring user approval and returns a unique task ID."""
    task_id = str(uuid.uuid4())
    PENDING_COMMANDS[task_id] = {
        "id": task_id,
        "command": command,
        "description": description or f"Execute: {command}",
        "status": "pending"
    }
    if code is not None:
        PENDING_COMMANDS[task_id]["code"] = code
    return task_id

def execute_queued_command(task_id: str) -> Dict[str, Any]:
    """Executes a previously queued command after user approval."""
    if task_id not in PENDING_COMMANDS:
        return {"error": "Task ID not found in queue."}
        
    task = PENDING_COMMANDS[task_id]
    if task["status"] != "pending":
        return {"error": f"Command already executed or rejected. Status: {task['status']}"}
        
    command = task["command"]
    task["status"] = "executing"
    
    try:
        # Run using default system shell
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30 # 30 seconds limit
        )
        
        task["status"] = "completed"
        task["stdout"] = result.stdout
        task["stderr"] = result.stderr
        task["exit_code"] = result.returncode
        
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode
        }
    except subprocess.TimeoutExpired:
        task["status"] = "timeout"
        return {"error": "Command execution timed out after 30 seconds."}
    except Exception as e:
        task["status"] = "failed"
        task["error"] = str(e)
        return {"error": str(e)}

def reject_queued_command(task_id: str) -> Dict[str, Any]:
    """Rejects/denies command execution."""
    if task_id not in PENDING_COMMANDS:
        return {"error": "Task ID not found."}
    PENDING_COMMANDS[task_id]["status"] = "rejected"
    return {"status": "rejected"}

def get_pending_commands() -> List[Dict[str, Any]]:
    """Returns all currently pending commands."""
    return [c for c in PENDING_COMMANDS.values() if c["status"] == "pending"]

def queue_ui_automation(code: str, description: str = "") -> str:
    """
    Saves a generated PyAutoGUI script into sandbox/ui_auto.py and queues a command 
    requiring user approval to run it. Returns the task ID.
    """
    from pathlib import Path
    script_path = SANDBOX_DIR / "ui_auto.py"
    
    # Prepend safety failsafes for PyAutoGUI (so moving cursor to screen corners aborts automation)
    formatted_code = (
        "import pyautogui\n"
        "import time\n"
        "pyautogui.FAILSAFE = True\n"
        "pyautogui.PAUSE = 0.5\n\n"
        f"{code}\n"
    )
    
    try:
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(formatted_code)
    except Exception as e:
        print(f"Error writing UI automation script: {e}")
        
    command = "..\\venv\\Scripts\\python sandbox\\ui_auto.py"
    task_id = queue_command(command, description or "Run GUI Automation Action", code=code)
    return task_id
