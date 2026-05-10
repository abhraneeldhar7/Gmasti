from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str
    plan: str
    joined: datetime
    razorpay_subscription_id: Optional[str] = None
    razorpay_current_period_end: Optional[datetime] = None
    razorpay_cancel_at_period_end: bool = False
