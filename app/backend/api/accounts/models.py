from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from api.database import Base, pg_enum


class UserRole(StrEnum):
    OWNER = "owner"  # Proprietário
    MAINTENANCE = "maintenance"  # Empresa de manutenção
    URBAN_PLANNING = "urban_planning"  # Urbanismo
    MUNICIPAL_MANAGER = "municipal_manager"  # Gestor municipal
    INSPECTION = "inspection"  # Empresa de inspeção


class OwnerType(StrEnum):
    CONDOMINIUM = "condominium"  # Condomínio
    INDIVIDUAL = "individual"  # Pessoa singular
    COMPANY = "company"  # Pessoa coletiva


class Owner(Base):
    __tablename__ = "owners"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Filled in when the elevator is registered; the permit does not ask for it.
    type: Mapped[OwnerType | None] = mapped_column(pg_enum(OwnerType, "owner_type"))
    name: Mapped[str] = mapped_column(String)
    nif: Mapped[str] = mapped_column(String, unique=True)
    email: Mapped[str] = mapped_column(String)
    phone: Mapped[str | None] = mapped_column(String)


class MaintenanceCompany(Base):
    __tablename__ = "maintenance_companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String)
    nif: Mapped[str | None] = mapped_column(String, unique=True)
    email: Mapped[str | None] = mapped_column(String)
    phone: Mapped[str | None] = mapped_column(String)


class InspectionCompany(Base):
    """Company under contract with the CMA; it handles every request received meanwhile."""

    __tablename__ = "inspection_companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String)
    nif: Mapped[str | None] = mapped_column(String, unique=True)
    email: Mapped[str | None] = mapped_column(String)
    phone: Mapped[str | None] = mapped_column(String)
    contract_start: Mapped[date]
    contract_end: Mapped[date | None]


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[str] = mapped_column(String, unique=True)  # Id in Authentik
    name: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String, unique=True)
    role: Mapped[UserRole] = mapped_column(pg_enum(UserRole, "user_role"))

    # Only the one that matches the role is filled in.
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("owners.id"))
    maintenance_company_id: Mapped[int | None] = mapped_column(
        ForeignKey("maintenance_companies.id")
    )
    inspection_company_id: Mapped[int | None] = mapped_column(ForeignKey("inspection_companies.id"))

    created_at: Mapped[datetime | None] = mapped_column(server_default=func.now())
