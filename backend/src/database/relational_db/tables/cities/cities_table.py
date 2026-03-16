from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from ..table_base import Base


class City(Base):
    __tablename__ = "cities"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
