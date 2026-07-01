import json
from typing import List, Dict, Any
import ollama
from backend.config import OLLAMA_HOST, OLLAMA_MODEL, OLLAMA_VISION_MODEL, SANDBOX_DIR
from backend.services.memory import (
    save_chat_message, get_chat_history, add_memory, get_memories_context_string
)
from backend.services.vision import capture_screen
from backend.services.system import (
    get_system_stats, list_processes, safe_list_dir, safe_read_file, safe_write_file, queue_command
)

# Instantiate the local Ollama client
client = ollama.Client(host=OLLAMA_HOST)

# Custom System Prompt for Ally Persona
SYSTEM_INSTRUCTION = """You are Ally, a friendly, calm, intelligent, and highly capable personal AI companion living on the user's computer.
Your wake phrase is "Hey Ally" or "Ally".
Always greet the user naturally and warmly, for example: "Hello! I'm Ally. How can I help you today?" if they say hello or wake you up.
Maintain a helpful, companionable, and futuristic tone.

You have access to tools that let you see and interact with the user's computer:
- `capture_screen`: Takes a screenshot so you can see what the user is working on. Use this when the user asks "what's on my screen?", "explain this", or similar.
- `get_system_stats`: Checks CPU, RAM, Disk, and Operating System stats.
- `list_processes`: Lists top processes running on the machine.
- `list_directory`: Lists files in a folder.
- `read_file`: Reads a text file's contents.
- `write_file`: Writes content to a file.
- `remember_fact`: Remembers a fact about the user (e.g. name, preferences, favorite things).
- `execute_shell_command`: Runs commands on Windows PowerShell/CMD. IMPORTANT: This command is NOT executed immediately; it is placed in an approval queue. Inform the user they need to click 'Approve' in the automation panel to run it.

IMPORTANT SAFETY GUIDELINES:
1. Always tell the user when you are queuing a shell command and explain what it will do.
2. If you write or modify files, let the user know.
3. Be respectful and protect user privacy.
"""

# Tool schemas format for Ollama API
OLLAMA_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "capture_screen",
            "description": "Takes a screenshot of the main monitor so you can see what is currently open.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_system_stats",
            "description": "Checks CPU usage, RAM utilization, Disk space and Operating System specifications.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_processes",
            "description": "Lists the active running processes on the computer sorted by CPU usage.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_directory",
            "description": "Lists the files and folders inside a given directory path.",
            "parameters": {
                "type": "object",
                "properties": {
                    "dir_path": {"type": "string", "description": "Absolute path to folder. Defaults to sandbox folder if empty."}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Reads text content from a local file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Absolute path to file."}
                },
                "required": ["file_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Writes text content to a local file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Absolute path to target file."},
                    "content": {"type": "string", "description": "Text content to save."}
                },
                "required": ["file_path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "remember_fact",
            "description": "Saves a long-term memory fact about the user (e.g. preferences, name, schedules).",
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {"type": "string", "description": "The subject name of the fact (e.g. favorite_color)."},
                    "value": {"type": "string", "description": "The fact details (e.g. blue)."},
                    "category": {"type": "string", "description": "Fact classification (preference, general, project).", "default": "general"}
                },
                "required": ["key", "value"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "execute_shell_command",
            "description": "Queues a shell command requiring user approval in their cockpit dashboard. Returns task details.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "The command string to queue (e.g. ipconfig, git status)."},
                    "description": {"type": "string", "description": "Brief description of what the action accomplishes."}
                },
                "required": ["command"]
            }
        }
    }
]

# Map tool names to python execution definitions
TOOL_RUNNERS = {
    "capture_screen": lambda: json.dumps({"status": "success", "message": "Screenshot captured successfully."}) if capture_screen() else json.dumps({"status": "error", "message": "Failed screenshot."}),
    "get_system_stats": lambda: json.dumps(get_system_stats()),
    "list_processes": lambda: json.dumps(list_processes()),
    "list_directory": lambda dir_path="": json.dumps(safe_list_dir(dir_path)),
    "read_file": lambda file_path: safe_read_file(file_path),
    "write_file": lambda file_path, content: safe_write_file(file_path, content),
    "remember_fact": lambda key, value, category="general": json.dumps({"status": "success"}) if add_memory(key, value, category) else json.dumps({"status": "error"}),
    "execute_shell_command": lambda command, description="": json.dumps({"status": "pending_approval", "task_id": queue_command(command, description), "command": command})
}

def query_ally(user_message: str, use_vision: bool = False) -> Dict[str, Any]:
    """
    Routes the message to local Ollama.
    Handles tool calls returned by Ollama and vision capabilities.
    """
    save_chat_message("user", user_message)

    try:
        # Load long-term memory records
        memories_context = get_memories_context_string(user_message)
        
        # Build system primer & user history context
        messages = [
            {"role": "system", "content": f"{SYSTEM_INSTRUCTION}\n\n{memories_context}"}
        ]
        
        # Pull history from SQLite
        history = get_chat_history(limit=12)
        # Avoid duplicating the very last user message we just saved
        for h in history[:-1]:
            messages.append({"role": h["role"], "content": h["content"]})
            
        messages.append({"role": "user", "content": user_message})

        # Check for Multimodal Vision query
        if use_vision:
            screenshot_path = SANDBOX_DIR / "last_screenshot.jpg"
            if screenshot_path.exists():
                # Multimodal visual generation using vision model
                print(f"Triggering Ollama vision analysis using model: {OLLAMA_VISION_MODEL}...")
                vision_messages = [
                    {
                        "role": "user", 
                        "content": f"{SYSTEM_INSTRUCTION}\n\n{memories_context}\nAnalyze this screen grab: {user_message}",
                        "images": [str(screenshot_path)]
                    }
                ]
                response = client.chat(model=OLLAMA_VISION_MODEL, messages=vision_messages)
                final_text = response['message']['content']
                save_chat_message("assistant", final_text)
                return {"response": final_text, "tool_calls": []}

        # Chat with active text model and tool-definitions
        print(f"Interfacing with local Ollama model: {OLLAMA_MODEL}...")
        response = client.chat(
            model=OLLAMA_MODEL,
            messages=messages,
            tools=OLLAMA_TOOLS
        )
        
        tool_calls_executed = []
        msg = response['message']
        
        # Check for function/tool calls
        if msg.get('tool_calls'):
            messages.append(msg)
            
            for tool_call in msg['tool_calls']:
                func = tool_call['function']
                name = func['name']
                args = func['arguments']
                
                if name in TOOL_RUNNERS:
                    print(f"Ollama requested function: {name} with arguments {args}")
                    try:
                        # Execute python tool locally
                        tool_result = TOOL_RUNNERS[name](**args)
                        tool_calls_executed.append({
                            "name": name,
                            "args": args,
                            "result": tool_result
                        })
                        
                        # Feed the tool return message back to model
                        messages.append({
                            "role": "tool",
                            "name": name,
                            "content": tool_result
                        })
                    except Exception as err:
                        print(f"Tool run exception: {err}")
                        messages.append({
                            "role": "tool",
                            "name": name,
                            "content": json.dumps({"status": "error", "message": str(err)})
                        })
            
            # Request final chat answer incorporating tool outputs
            follow_up_resp = client.chat(
                model=OLLAMA_MODEL,
                messages=messages
            )
            final_text = follow_up_resp['message']['content']
        else:
            final_text = msg['content']
            
        save_chat_message("assistant", final_text)
        return {"response": final_text, "tool_calls": tool_calls_executed}
        
    except Exception as e:
        print(f"Ollama query failed: {e}")
        error_msg = f"I failed to connect to local Ollama model: {str(e)}. Please check if Ollama is running and model '{OLLAMA_MODEL}' is pulled."
        save_chat_message("assistant", error_msg)
        return {"response": error_msg, "tool_calls": []}
