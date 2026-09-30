try:
    from pythonjsonlogger import jsonlogger
    print("SUCCESS: jsonlogger imported")
except ImportError as e:
    print(f"ERROR: {e}")
except Exception as e:
    print(f"ERROR: {e}")
