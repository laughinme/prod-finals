from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr = Field(..., description="User e-mail")
    password: str = Field(..., description="User password")

class UserLogin(BaseModel):
    email: EmailStr = Field(..., description="User e-mail")
    password: str = Field(..., description="User password")
