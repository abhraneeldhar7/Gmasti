from datetime import datetime

from pydantic import BaseModel


class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str
    plan: str
    joined: datetime
