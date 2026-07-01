import unittest
import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.config import SANDBOX_DIR
from backend.services.system import (
    get_system_stats, list_processes, safe_list_dir,
    safe_read_file, safe_write_file, queue_command,
    execute_queued_command, reject_queued_command, PENDING_COMMANDS
)

class TestSystemService(unittest.TestCase):
    
    def test_system_stats(self):
        stats = get_system_stats()
        self.assertIn("os", stats)
        self.assertIn("cpu_percent", stats)
        self.assertIn("ram_used_gb", stats)
        
    def test_list_processes(self):
        procs = list_processes(limit=3)
        self.assertTrue(isinstance(procs, list))
        # Might be empty on highly restricted permissions environments, but usually has processes
        if procs:
            self.assertIn("name", procs[0])
            self.assertIn("pid", procs[0])

    def test_sandbox_file_operations(self):
        test_file = str(SANDBOX_DIR / "unit_test_file.txt")
        test_content = "Hello from unit tests!"
        
        # Write
        write_res = safe_write_file(test_file, test_content)
        self.assertIn("Successfully wrote", write_res)
        
        # Read
        read_res = safe_read_file(test_file)
        self.assertEqual(read_res, test_content)
        
        # Directory list
        dir_list = safe_list_dir()
        self.assertTrue(any(f["name"] == "unit_test_file.txt" for f in dir_list))
        
        # Cleanup
        if os.path.exists(test_file):
            os.remove(test_file)

    def test_command_queue(self):
        # Clean pending list
        PENDING_COMMANDS.clear()
        
        # Queue command
        task_id = queue_command("echo 'hello'", "Test echo command")
        self.assertTrue(task_id in PENDING_COMMANDS)
        self.assertEqual(PENDING_COMMANDS[task_id]["status"], "pending")
        
        # Reject command
        reject_queued_command(task_id)
        self.assertEqual(PENDING_COMMANDS[task_id]["status"], "rejected")
        
        # Queue another and execute
        task_id_2 = queue_command("echo 'hello2'", "Test echo command 2")
        exec_res = execute_queued_command(task_id_2)
        self.assertEqual(PENDING_COMMANDS[task_id_2]["status"], "completed")
        self.assertEqual(exec_res["exit_code"], 0)
        self.assertIn("hello2", exec_res["stdout"])

if __name__ == '__main__':
    unittest.main()
