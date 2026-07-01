import base64
import io
import time
from pathlib import Path
from PIL import Image, ImageGrab
from backend.config import SANDBOX_DIR

def capture_screen(quality: int = 70, max_width: int = 1280) -> str:
    """
    Captures the primary monitor screenshot, resizes it to match max_width 
    while preserving aspect ratio, compresses it to JPEG, and returns a Base64 data URL.
    """
    try:
        # Capture full screen
        screenshot = ImageGrab.grab()
        
        # Resize to save bandwidth / token limit
        width, height = screenshot.size
        if width > max_width:
            ratio = max_width / float(width)
            new_height = int(float(height) * float(ratio))
            # Use Resampling.LANCZOS if available, else standard ANTIALIAS or fallback
            try:
                resample_method = Image.Resampling.LANCZOS
            except AttributeError:
                resample_method = Image.LANCZOS # For older Pillow versions
            screenshot = screenshot.resize((max_width, new_height), resample_method)
            
        # Save to memory stream
        buffer = io.BytesIO()
        screenshot.save(buffer, format="JPEG", quality=quality)
        img_bytes = buffer.getvalue()
        
        # Encode as base64
        base64_str = base64.b64encode(img_bytes).decode("utf-8")
        
        # Save screenshot locally in sandbox for record/debug
        debug_file_path = SANDBOX_DIR / "last_screenshot.jpg"
        with open(debug_file_path, "wb") as f:
            f.write(img_bytes)
            
        return f"data:image/jpeg;base64,{base64_str}"
    except Exception as e:
        print(f"Error capturing screen: {e}")
        return ""

def get_last_screenshot_bytes() -> bytes:
    """Reads the raw bytes of the last captured screenshot if it exists."""
    debug_file_path = SANDBOX_DIR / "last_screenshot.jpg"
    if debug_file_path.exists():
        with open(debug_file_path, "rb") as f:
            return f.read()
    return b""
