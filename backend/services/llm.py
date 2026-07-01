import json
from typing import List, Dict, Any
import google.generativeai as genai
from google.generativeai.types import Tool
from backend.config import GEMINI_API_KEY
from backend.services.memory import (
    save_chat_message, get_chat_history, add_memory, search_memories, get_memories_context_string
)
from backend.services.vision import capture_screen
from backend.services.system import (
    get_system_stats, list_processes, safe_list_dir, safe_read_file, safe_write_file, queue_command
)

# Configure API Key if available
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Define Ally Persona
SYSTEM_INSTRUCTION = """
You are Ally, a friendly, calm, intelligent, and highly capable personal AI companion living on the user's computer.
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

# --- Tool Implementations map ---

def tool_capture_screen() -> str:
    """Takes a screenshot of the main monitor and returns the status."""
    img_data_url = capture_screen()
    if img_data_url:
        return json.dumps({"status": "success", "message": "Screenshot captured successfully. It has been saved to your environment."})
    return json.dumps({"status": "error", "message": "Failed to capture screenshot."})

def tool_get_system_stats() -> str:
    """Fetches system specs."""
    return json.dumps(get_system_stats())

def tool_list_processes() -> str:
    """Lists running processes."""
    return json.dumps(list_processes())

def tool_list_directory(dir_path: str = "") -> str:
    """Lists files in directory."""
    return json.dumps(safe_list_dir(dir_path))

def tool_read_file(file_path: str) -> str:
    """Reads a file."""
    return safe_read_file(file_path)

def tool_write_file(file_path: str, content: str) -> str:
    """Writes to a file."""
    return safe_write_file(file_path, content)

def tool_remember_fact(key: str, value: str, category: str = "general") -> str:
    """Saves a fact to Ally's SQLite database."""
    success = add_memory(key, value, category)
    if success:
        return json.dumps({"status": "success", "message": f"Remembered: '{key}' is '{value}'."})
    return json.dumps({"status": "error", "message": "Failed to store memory."})

def tool_execute_shell_command(command: str, description: str = "") -> str:
    """Queues a shell command for the user to approve."""
    task_id = queue_command(command, description)
    return json.dumps({
        "status": "pending_approval",
        "task_id": task_id,
        "message": f"Command queued! The user must approve task {task_id} in the automation panel before it runs.",
        "command": command
    })

# Map tool names to actual python functions
TOOL_MAP = {
    "capture_screen": tool_capture_screen,
    "get_system_stats": tool_get_system_stats,
    "list_processes": tool_list_processes,
    "list_directory": tool_list_directory,
    "read_file": tool_read_file,
    "write_file": tool_write_file,
    "remember_fact": tool_remember_fact,
    "execute_shell_command": tool_execute_shell_command
}

# --- Gemini Generation Wrapper ---

def query_ally(user_message: str, use_vision: bool = False) -> Dict[str, Any]:
    """
    Sends the user's message to Gemini, processes any tool calls,
    records the conversation, and returns the final textual response.
    """
    save_chat_message("user", user_message)
    
    if not GEMINI_API_KEY:
        # Offline / Demo Fallback Mode
        reply = "I'm running in offline demo mode. Please configure your GEMINI_API_KEY in the settings to unlock my full capabilities!"
        save_chat_message("assistant", reply)
        return {"response": reply, "tool_calls": []}

    try:
        # 1. Fetch relevant memories to append to context
        memories_context = get_memories_context_string(user_message)
        
        # 2. Reconstruct recent chat history
        history = get_chat_history(limit=15)
        
        # Format history for Gemini SDK
        contents = []
        # Add system instruction + memory context as a primer
        contents.append({"role": "user", "parts": [f"{memories_context}\n\nUser request: {user_message}"]})
        
        # Setup model with tools
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            tools=list(TOOL_MAP.values()),
            system_instruction=SYSTEM_INSTRUCTION
        )
        
        # Run chat or content generation
        # If vision is requested, we can read the last screenshot and send it
        if use_vision:
            from backend.services.vision import get_last_screenshot_bytes
            screen_bytes = get_last_screenshot_bytes()
            if screen_bytes:
                # Wrap it in PIL Image for Gemini SDK
                from PIL import Image
                import io
                img = Image.open(io.BytesIO(screen_bytes))
                # Send vision query
                response = model.generate_content([
                    f"{memories_context}\nAnalyze this screen capture based on the user request.",
                    img,
                    user_message
                ])
                save_chat_message("assistant", response.text)
                return {"response": response.text, "tool_calls": []}

        # Standard conversation loop with manual tool resolving
        response = model.generate_content(contents)
        
        tool_calls_executed = []
        
        # Resolve tool calls
        if response.candidates and response.candidates[0].content.parts:
            parts = response.candidates[0].content.parts
            
            # Check for function calls
            function_calls = [p.function_call for p in parts if p.function_call]
            
            if function_calls:
                # Process the first function call (Gemini usually returns one or multiple)
                for call in function_calls:
                    name = call.name
                    args = dict(call.args)
                    
                    if name in TOOL_MAP:
                        # Execute tool
                        tool_result = TOOL_MAP[name](**args)
                        tool_calls_executed.append({
                            "name": name,
                            "args": args,
                            "result": tool_result
                        })
                        
                        # Feed result back to model to get final reply
                        # Generate content with function response
                        # Create structural conversation response
                        follow_up_prompt = f"Tool '{name}' with arguments {args} returned: {tool_result}.\nConstruct your final response to the user."
                        follow_up_resp = model.generate_content([
                            *contents,
                            f"I executed the tool: {name}. Results are: {tool_result}",
                            follow_up_prompt
                        ])
                        
                        final_text = follow_up_resp.text
                        save_chat_message("assistant", final_text)
                        return {"response": final_text, "tool_calls": tool_calls_executed}
            
        final_text = response.text
        save_chat_message("assistant", final_text)
        return {"response": final_text, "tool_calls": []}
        
    except Exception as e:
        print(f"Error calling LLM: {e}")
        error_msg = f"I'm sorry, I encountered an issue interacting with my AI engine: {str(e)}"
        save_chat_message("assistant", error_msg)
        return {"response": error_msg, "tool_calls": []}
