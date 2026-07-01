import unittest
import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.config import DB_PATH
from backend.services.memory import (
    init_db, save_chat_message, get_chat_history, 
    add_memory, search_memories, delete_memory, clear_chat_history
)

class TestMemoryService(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        # Initialize DB in case it doesn't exist
        init_db()
        
    def setUp(self):
        # Clear database records before each test
        clear_chat_history()
        
    def test_chat_history(self):
        # Save messages
        save_chat_message("user", "Hello Ally")
        save_chat_message("assistant", "Hi there!")
        
        # Retrieve messages
        history = get_chat_history(limit=5)
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0]["role"], "user")
        self.assertEqual(history[0]["content"], "Hello Ally")
        self.assertEqual(history[1]["role"], "assistant")
        self.assertEqual(history[1]["content"], "Hi there!")
        
        # Clear chat history
        clear_chat_history()
        history_after = get_chat_history()
        self.assertEqual(len(history_after), 0)

    def test_memory_crud(self):
        # Add memories
        add_memory("username", "Vaibhav", "general")
        add_memory("favorite color", "blue", "preference")
        
        # Search
        results = search_memories("color")
        self.assertTrue(any(r["key"] == "favorite color" and r["value"] == "blue" for r in results))
        
        # Conflict resolution (overwrite key)
        add_memory("favorite color", "purple", "preference")
        results_after = search_memories("favorite color")
        self.assertEqual(results_after[0]["value"], "purple")
        
        # Delete
        memory_id = results_after[0]["id"]
        deleted = delete_memory(memory_id)
        self.assertTrue(deleted)
        
        results_deleted = search_memories("favorite color")
        self.assertEqual(len(results_deleted), 0)

if __name__ == '__main__':
    unittest.main()
