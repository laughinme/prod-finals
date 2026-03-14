from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr = Field(..., description="User e-mail")
    password: str = Field(..., description="User password")
    username: str | None = Field(None, description="User's display name")
    display_name: str | None = Field(None, max_length=80, description="Preferred display name")

class UserLogin(BaseModel):
    email: EmailStr = Field(..., description="User e-mail")
    password: str = Field(..., description="User password")


class DemoLoginRequest(BaseModel):
    demo_user_id: str = Field(..., min_length=1, description="Stable alias of seeded demo user")
