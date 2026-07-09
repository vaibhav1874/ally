import json
from typing import List, Dict, Any
import ollama
from backend.config import OLLAMA_HOST, OLLAMA_MODEL, OLLAMA_VISION_MODEL, SANDBOX_DIR
from backend.services.memory import (
    save_chat_message, get_chat_history, add_memory, get_memories_context_string
)
from backend.services.vision import capture_screen as sys_capture_screen
from backend.services.system import (
    get_system_stats as sys_get_system_stats,
    list_processes as sys_list_processes,
    safe_list_dir,
    safe_read_file,
    safe_write_file,
    queue_command,
    queue_ui_automation,
    get_active_window_context
)

# Instantiate the local Ollama client
client = ollama.Client(host=OLLAMA_HOST)

# Custom System Prompt for Jarvis/Ally Persona
SYSTEM_INSTRUCTION = """You are Jarvis, a highly advanced, futuristic personal AI companion and desktop intelligence system (reminiscent of the system built by Tony Stark) living on the user's computer.
Your wake phrases are "Hey Jarvis", "Jarvis", "Hey Ally", or "Ally".
Always greet the user with a highly sophisticated, calm, and futuristic tone, for example: "System initialized. Online and ready, sir. How can I assist you?" or similar greetings when prompted.

You have access to tools that let you see and interact with the user's computer:
- `capture_screen`: Takes a screenshot so you can see what the user is working on. Use this when the user asks "what's on my screen?", "explain this", or similar.
- `get_system_stats`: Checks CPU, RAM, Disk, and Operating System stats.
- `list_processes`: Lists top processes running on the machine.
- `list_directory`: Lists files in a folder.
- `read_file`: Reads a text file's contents.
- `write_file`: Writes content to a file.
- `remember_fact`: Remembers a fact about the user (e.g. name, preferences, favorite things).
- `execute_shell_command`: Runs commands on Windows PowerShell/CMD.
- `gui_automation`: Control mouse, keyboard, and click/interact with any application (including third party apps) using PyAutoGUI python code.

CRITICAL INSTRUCTIONS:
1. TOOL CALL REQUIRED: Whenever you tell the user you are queueing, running, or executing a command or GUI script, you MUST immediately call the respective tool in the same response turn. NEVER generate conversational text stating you are doing something without making the actual function call.
2. The tools `execute_shell_command` and `gui_automation` place tasks in the queue for user approval. Explain to the user that they must approve it in their cockpit, but make sure you invoke the tool first.
3. Be respectful, highly analytical, and protect user privacy.
4. You can control 3rd party desktop applications (e.g. Chrome, Notepad, Spotify, VS Code) using python scripts via the `gui_automation` tool. If desktop equivalent apps are open, you can control them.
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
    },
    {
        "type": "function",
        "function": {
            "name": "gui_automation",
            "description": "Queues a PyAutoGUI python script to control the user's mouse and keyboard (e.g. click, type, open 3rd party apps). It is saved and queued for user approval.",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {"type": "string", "description": "The python code using pyautogui to execute (e.g. `pyautogui.click(100, 200)` or `pyautogui.write('hello')`)."},
                    "description": {"type": "string", "description": "Brief description of what the automation action does."}
                },
                "required": ["code"]
            }
        }
    }
]

# Map tool names to python execution definitions
TOOL_RUNNERS = {
    "capture_screen": lambda: json.dumps({"status": "success", "message": "Screenshot captured successfully."}) if sys_capture_screen() else json.dumps({"status": "error", "message": "Failed screenshot."}),
    "get_system_stats": lambda: json.dumps(sys_get_system_stats()),
    "list_processes": lambda: json.dumps(sys_list_processes()),
    "list_directory": lambda dir_path="": json.dumps(safe_list_dir(dir_path)),
    "read_file": lambda file_path: safe_read_file(file_path),
    "write_file": lambda file_path, content: safe_write_file(file_path, content),
    "remember_fact": lambda key, value, category="general": json.dumps({"status": "success"}) if add_memory(key, value, category) else json.dumps({"status": "error"}),
    "execute_shell_command": lambda command, description="": json.dumps({"status": "pending_approval", "task_id": queue_command(command, description), "command": command}),
    "gui_automation": lambda code, description="": json.dumps({"status": "pending_approval", "task_id": queue_ui_automation(code, description), "description": description})
}

# Helper tools specifically wrapped for Gemini API compatibility
def capture_screen() -> str:
    """Takes a screenshot of the main monitor so you can see what is currently open. Returns a status message."""
    return "Screenshot captured successfully." if sys_capture_screen() else "Failed to capture screenshot."

def get_system_stats() -> str:
    """Checks CPU usage, RAM utilization, Disk space, and Operating System specifications. Returns details as JSON string."""
    return json.dumps(sys_get_system_stats())

def list_processes() -> str:
    """Lists the active running processes on the computer sorted by CPU usage. Returns details as JSON string."""
    return json.dumps(sys_list_processes())

def list_directory(dir_path: str = "") -> str:
    """Lists the files and folders inside a given directory path. Returns details as JSON string."""
    return json.dumps(safe_list_dir(dir_path))

def read_file(file_path: str) -> str:
    """Reads text content from a local file. Returns file contents."""
    return safe_read_file(file_path)

def write_file(file_path: str, content: str) -> str:
    """Writes text content to a local file. Returns success status message."""
    return safe_write_file(file_path, content)

def remember_fact(key: str, value: str, category: str = "general") -> str:
    """Saves a long-term memory fact about the user (e.g. preferences, name, schedules). Returns status code."""
    return "success" if add_memory(key, value, category) else "error"

def execute_shell_command(command: str, description: str = "") -> str:
    """Queues a shell command requiring user approval in their cockpit dashboard. Returns task details as JSON string."""
    task_id = queue_command(command, description)
    return json.dumps({"status": "pending_approval", "task_id": task_id, "command": command})

def gui_automation(code: str, description: str = "") -> str:
    """Queues a PyAutoGUI python script to control the user's mouse and keyboard (e.g. click, type, open 3rd party apps). It is saved and queued for user approval. Returns task details as JSON string."""
    task_id = queue_ui_automation(code, description)
    return json.dumps({"status": "pending_approval", "task_id": task_id, "description": description})


def query_ally(
    user_message: str, 
    use_vision: bool = False,
    ollama_host: str = None,
    ollama_model: str = None,
    ollama_vision_model: str = None,
    provider: str = "ollama",
    gemini_api_key: str = None
) -> Dict[str, Any]:
    """
    Routes the message to the selected provider (Ollama or Gemini).
    Handles tool calls and vision capabilities.
    """
    save_chat_message("user", user_message)

    if provider == "gemini":
        import os
        import google.generativeai as genai
        # Prioritize key passed in request, otherwise fall back to environment variable
        api_key = gemini_api_key or os.getenv("GEMINI_API_KEY")
        if not api_key:
            err_msg = "Gemini API key is missing. Please obtain a free API key at https://aistudio.google.com/ and enter it in the Settings tab."
            save_chat_message("assistant", err_msg)
            return {"response": err_msg, "tool_calls": []}
            
        genai.configure(api_key=api_key)
        
        try:
            print("Listing available models for the user's API key...")
            for m in genai.list_models():
                print(f"Available model: {m.name} (Methods: {m.supported_generation_methods})")
        except Exception as list_err:
            print(f"Could not list models: {list_err}")

        try:
            memories_context = get_memories_context_string(user_message)
            window_context = get_active_window_context()
            system_inst = f"{SYSTEM_INSTRUCTION}\n\n{memories_context}\n\n{window_context}"
            
            # Map SQLite history to Gemini format
            history = get_chat_history(limit=12)
            gemini_history = []
            for h in history[:-1]:
                role = 'user' if h['role'] == 'user' else 'model'
                gemini_history.append({'role': role, 'parts': [h['content']]})
                
            # Initialize Gemini model with tools
            model = genai.GenerativeModel(
                model_name="gemini-2.5-flash",
                system_instruction=system_inst,
                 tools=[
                    capture_screen,
                    get_system_stats,
                    list_processes,
                    list_directory,
                    read_file,
                    write_file,
                    remember_fact,
                    execute_shell_command,
                    gui_automation
                ]
            )
            
            chat = model.start_chat(history=gemini_history)
            
            # Check for multimodal visual query
            if use_vision:
                screenshot_path = SANDBOX_DIR / "last_screenshot.jpg"
                if screenshot_path.exists():
                    import PIL.Image
                    print("Triggering Gemini vision analysis using screen grab...")
                    img = PIL.Image.open(screenshot_path)
                    response = chat.send_message([user_message, img])
                else:
                    response = chat.send_message(user_message)
            else:
                response = chat.send_message(user_message)
                
            tool_calls_executed = []
            
            # Manual function call execution loop
            for _ in range(5):
                candidate = response.candidates[0]
                if candidate.content and candidate.content.parts and candidate.content.parts[0].function_call:
                    function_call = candidate.content.parts[0].function_call
                    name = function_call.name
                    args = dict(function_call.args)
                    
                    print(f"Gemini requested function: {name} with arguments {args}")
                    
                    # Map tool name to local function
                    func_map = {
                        "capture_screen": capture_screen,
                        "get_system_stats": get_system_stats,
                        "list_processes": list_processes,
                        "list_directory": list_directory,
                        "read_file": read_file,
                        "write_file": write_file,
                        "remember_fact": remember_fact,
                        "execute_shell_command": execute_shell_command,
                        "gui_automation": gui_automation
                    }
                    
                    if name in func_map:
                        try:
                            # Execute local function
                            tool_result = func_map[name](**args)
                            tool_calls_executed.append({
                                "name": name,
                                "args": args,
                                "result": tool_result
                            })
                            
                            # Send response back to model
                            response = chat.send_message(
                                genai.types.Part.from_function_response(
                                    name=name,
                                    response={'result': tool_result}
                                )
                            )
                        except Exception as err:
                            print(f"Gemini tool execution error: {err}")
                            response = chat.send_message(
                                genai.types.Part.from_function_response(
                                    name=name,
                                    response={'error': str(err)}
                                )
                            )
                    else:
                        print(f"Warning: Gemini requested unknown function {name}")
                        break
                else:
                    # No more function calls
                    break
                    
            # Safely extract text parts from response candidate to prevent ValueError on function call parts
            text_parts = []
            if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
                for p in response.candidates[0].content.parts:
                    try:
                        val = p.text
                        if val:
                            text_parts.append(val)
                    except Exception:
                        pass
            final_text = "\n".join(text_parts) if text_parts else "Action processed successfully."
            
            save_chat_message("assistant", final_text)
            return {"response": final_text, "tool_calls": tool_calls_executed}
            
        except Exception as e:
            print(f"Gemini API call failed: {e}")
            err_msg = f"Failed to connect to Gemini API: {str(e)}"
            save_chat_message("assistant", err_msg)
            return {"response": err_msg, "tool_calls": []}

    # Use dynamic overrides if supplied, otherwise fall back to core configs
    host = ollama_host or OLLAMA_HOST
    model = ollama_model or OLLAMA_MODEL
    vision_model = ollama_vision_model or OLLAMA_VISION_MODEL

    req_client = ollama.Client(host=host)

    try:
        # Load long-term memory records
        memories_context = get_memories_context_string(user_message)
        window_context = get_active_window_context()
        
        # Build system primer & user history context
        messages = [
            {"role": "system", "content": f"{SYSTEM_INSTRUCTION}\n\n{memories_context}\n\n{window_context}"}
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
                print(f"Triggering Ollama vision analysis using model: {vision_model}...")
                vision_messages = [
                    {
                        "role": "user", 
                        "content": f"{SYSTEM_INSTRUCTION}\n\n{memories_context}\n\n{window_context}\nAnalyze this screen grab: {user_message}",
                        "images": [str(screenshot_path)]
                    }
                ]
                response = req_client.chat(model=vision_model, messages=vision_messages)
                final_text = response['message']['content']
                save_chat_message("assistant", final_text)
                return {"response": final_text, "tool_calls": []}

        # Chat with active text model and tool-definitions
        print(f"Interfacing with local Ollama model: {model}...")
        response = req_client.chat(
            model=model,
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
            follow_up_resp = req_client.chat(
                model=model,
                messages=messages
            )
            final_text = follow_up_resp['message']['content']
        else:
            final_text = msg['content']
            
        save_chat_message("assistant", final_text)
        return {"response": final_text, "tool_calls": tool_calls_executed}
        
    except Exception as e:
        print(f"Ollama query failed: {e}")
        error_msg = f"I failed to connect to local Ollama model: {str(e)}. Please check if Ollama is running and model '{model}' is pulled."
        save_chat_message("assistant", error_msg)
        return {"response": error_msg, "tool_calls": []}
