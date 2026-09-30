from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class CommentBase(BaseModel):
    target_type: str
    target_id: int
    content: str
    
class CommentCreate(CommentBase):
    pass
    
class CommentResponse(CommentBase):
    id: int
    user_id: int
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class CommentWithUser(CommentResponse):
    username: str
    avatar_url: Optional[str] = None
