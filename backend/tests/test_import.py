import sys
import os
sys.path.append(os.getcwd())
try:
    from app.modules.user.models import User
    print("SUCCESS: User imported")
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
