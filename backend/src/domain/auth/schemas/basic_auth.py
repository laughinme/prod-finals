from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr = Field(..., description="User e-mail")
    password: str = Field(..., description="User password")
    username: str | None = Field(None, description="User's display name")

class UserLogin(BaseModel):
    email: EmailStr = Field(..., description="User e-mail")
    password: str = Field(..., description="User password")
