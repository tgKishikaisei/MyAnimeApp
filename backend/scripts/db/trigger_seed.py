import requests
import sys

try:
    response = requests.post("http://localhost:8001/api/v1/seed/")
    if response.status_code == 200 or response.status_code == 201:
        print("Success:", response.json())
    else:
        print(f"Failed with {response.status_code}")
        print(response.text)
except Exception as e:
    print(f"Error: {e}")
