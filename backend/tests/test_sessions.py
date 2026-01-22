import unittest
import threading
import time
import sys
import os

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.simulation.engine import SimulationSessionManager, MarkovChain, SimulationState

class TestSimulationSessions(unittest.TestCase):
    def setUp(self):
        self.manager = SimulationSessionManager()

    def test_session_creation(self):
        session_id = self.manager.create_session()
        self.assertIsNotNone(session_id)
        session = self.manager.get_session(session_id)
        self.assertIsInstance(session, MarkovChain)
        self.assertEqual(session.get_state(), SimulationState.NORMAL)

    def test_session_isolation(self):
        # Create two sessions
        id1 = self.manager.create_session()
        id2 = self.manager.create_session()
        
        s1 = self.manager.get_session(id1)
        s2 = self.manager.get_session(id2)
        
        # Verify they are different objects
        self.assertNotEqual(id(s1), id(s2))
        
        # Modify state of s1 manually for testing
        s1.current_state = SimulationState.TRAFFIC
        
        # Verify s2 is still NORMAL
        self.assertEqual(s2.get_state(), SimulationState.NORMAL)
        self.assertEqual(s1.get_state(), SimulationState.TRAFFIC)

    def test_concurrent_access(self):
        # Function to create sessions in a thread
        def create_sessions(manager, count, results):
            for _ in range(count):
                sid = manager.create_session()
                results.append(sid)
                
        threads = []
        results1 = []
        results2 = []
        
        t1 = threading.Thread(target=create_sessions, args=(self.manager, 100, results1))
        t2 = threading.Thread(target=create_sessions, args=(self.manager, 100, results2))
        
        t1.start()
        t2.start()
        t1.join()
        t2.join()
        
        # Verify total sessions created
        self.assertEqual(len(results1), 100)
        self.assertEqual(len(results2), 100)
        
        # Verify all IDs are unique
        all_ids = set(results1 + results2)
        self.assertEqual(len(all_ids), 200)

    def test_persistence_capability(self):
        sid = self.manager.create_session()
        session = self.manager.get_session(sid)
        session.current_state = SimulationState.RAIN
        
        # Export
        data = self.manager.export_session(sid)
        self.assertEqual(data["current_state"], "Lluvia")
        
        # Import to new session
        sid2 = "restored_session"
        self.manager.import_session(sid2, data)
        session2 = self.manager.get_session(sid2)
        
        self.assertEqual(session2.get_state(), SimulationState.RAIN)

if __name__ == '__main__':
    unittest.main()
