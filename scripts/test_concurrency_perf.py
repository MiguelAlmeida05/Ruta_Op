
import time
import requests
import threading
import sys

def make_heavy_request(base_url):
    start = time.time()
    try:
        # Request validation stats which runs simulations (CPU heavy)
        response = requests.get(f"{base_url}/api/validation/stats")
        duration = time.time() - start
        print(f"Heavy request finished in {duration:.2f}s (Status: {response.status_code})")
    except Exception as e:
        print(f"Heavy request failed: {e}")

def make_light_request(base_url, delay=0.1):
    time.sleep(delay) # Wait a bit to ensure heavy request has started
    start = time.time()
    try:
        response = requests.get(f"{base_url}/health")
        duration = time.time() - start
        print(f"Light request finished in {duration:.2f}s (Status: {response.status_code})")
        return duration
    except Exception as e:
        print(f"Light request failed: {e}")
        return 999

if __name__ == "__main__":
    # Assuming server is running on localhost:8000
    BASE_URL = "http://127.0.0.1:8000"
    
    print("--- Starting Concurrency Test ---")
    print("Triggering heavy request and light request in parallel...")
    
    t1 = threading.Thread(target=make_heavy_request, args=(BASE_URL,))
    t2 = threading.Thread(target=make_light_request, args=(BASE_URL,))
    
    t1.start()
    t2.start()
    
    t1.join()
    t2.join()
    print("--- Test Finished ---")
