import subprocess
import platform
import sys
import time
import logging
import ctypes
from ctypes import wintypes

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# API Windows directe
user32 = ctypes.windll.user32
user32.FindWindowW.argtypes = [wintypes.LPCWSTR, wintypes.LPCWSTR]
user32.FindWindowW.restype = wintypes.HWND
user32.SetForegroundWindow.argtypes = [wintypes.HWND]
user32.SetForegroundWindow.restype = wintypes.BOOL
user32.ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
user32.ShowWindow.restype = wintypes.BOOL

def focus_window(title: str) -> bool:
    """Bring the window with the given title to the foreground."""
    start_time = time.perf_counter()
    
    try:
        logger.info(f"Attempting to focus window: '{title}'")
        
        # Recherche par titre de fenêtre
        hwnd = user32.FindWindowW(None, title)
        if hwnd == 0:
            duration = time.perf_counter() - start_time
            logger.warning(f"❌ Window '{title}' not found in {duration:.3f}s")
            return False
        
        # Restaurer la fenêtre si elle est minimisée
        user32.ShowWindow(hwnd, 9)  # SW_RESTORE = 9
        
        # Mettre au premier plan
        success = bool(user32.SetForegroundWindow(hwnd))
        
        duration = time.perf_counter() - start_time
        
        if success:
            logger.info(f"✅ Successfully focused window '{title}' in {duration:.3f}s")
        else:
            logger.warning(f"❌ Failed to focus window '{title}' in {duration:.3f}s")
        
        return success
        
    except Exception as exc:
        duration = time.perf_counter() - start_time
        logger.error(f"❌ Error focusing window '{title}': {exc} (duration: {duration:.3f}s)")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1:
        result = focus_window(sys.argv[1])
        sys.exit(0 if result else 1)
    else:
        logger.error("❌ No window title provided")
        sys.exit(1)
