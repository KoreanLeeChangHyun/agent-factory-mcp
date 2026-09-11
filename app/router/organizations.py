"""Authenticated organization management HTTP API."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.infrastructure.email import EmailSender
from app.modules.auth.dependencies import get_current_principal, get_email_sender, require_csrf
from app.modules.auth.service import Principal
from app.modules.organization.command_service import OrganizationCommandService
from app.modules.organization.invitation_service import OrganizationInvitationService
from app.modules.organization.models import MembershipStatus
from app.modules.organization.permissions import CATALOG
from app.modules.organization.schemas import (
    InvitationAccept,
    InvitationCreate,
    MemberUpdate,
    OrganizationCreate,
    OrganizationUpdate,
    OwnershipTransfer,
    RoleAssignment,
    RoleWrite,
    TeamWrite,
)

router = APIRouter(prefix="/api/organizations", tags=["organizations"])
Session = Annotated[AsyncSession, Depends(get_session)]
Caller = Annotated[Principal, Depends(get_current_principal)]
Sender = Annotated[EmailSender, Depends(get_email_sender)]


def organization_service(organization_id: UUID, session: Session, principal: Caller):
    return OrganizationCommandService(session, principal, organization_id)


Service = Annotated[OrganizationCommandService, Depends(organization_service)]


@router.post("", status_code=201, dependencies=[Depends(require_csrf)])
async def create_organization(payload: OrganizationCreate, session: Session, principal: Caller):
    organization = await OrganizationCommandService.create(
        session,
        principal,
        payload.name,
        payload.slug,
    )
    return {"id": organization.id, "name": organization.name, "slug": organization.slug}


@router.get("/{organization_id}")
async def get_organization(service: Service):
    return await service.overview()


@router.patch("/{organization_id}", dependencies=[Depends(require_csrf)])
async def update_organization(payload: OrganizationUpdate, service: Service):
    await service.update(payload.name, payload.slug, payload.revision)
    return {"ok": True}


@router.post("/{organization_id}/transfer", dependencies=[Depends(require_csrf)])
async def transfer_ownership(payload: OwnershipTransfer, service: Service):
    await service.transfer(payload.user_id)
    return {"ok": True}


@router.get("/{organization_id}/members")
async def list_members(
    service: Service,
    search: Annotated[str, Query(max_length=200)] = "",
    status: MembershipStatus | None = None,
):
    return await service.members(search, status)


@router.get("/{organization_id}/members/{user_id}")
async def member_detail(user_id: UUID, service: Service):
    return await service.detail(user_id)


@router.patch("/{organization_id}/members/{user_id}", dependencies=[Depends(require_csrf)])
async def update_member(user_id: UUID, payload: MemberUpdate, service: Service):
    await service.update_member(user_id, payload)
    return {"ok": True}


@router.get("/{organization_id}/permission-catalog")
async def permission_catalog(service: Service):
    await service.require("role.read")
    return [
        {
            "key": p.key,
            "label": p.label,
            "scope": p.scope,
            "resource": p.resource,
            "resource_label": p.resource_label,
            "description": p.description,
            "owner_only": p.key in {"organization.transfer", "organization.delete"},
            "available": p.available,
        }
        for p in CATALOG.values()
    ]


@router.get("/{organization_id}/roles")
async def list_roles(service: Service):
    return await service.roles()


@router.post("/{organization_id}/roles", status_code=201, dependencies=[Depends(require_csrf)])
async def create_role(payload: RoleWrite, service: Service):
    role_id = await service.write_role(payload)
    return {"id": role_id}


@router.put("/{organization_id}/roles/{role_id}", dependencies=[Depends(require_csrf)])
async def update_role(role_id: UUID, payload: RoleWrite, service: Service):
    await service.write_role(payload, role_id)
    return {"ok": True}


@router.delete("/{organization_id}/roles/{role_id}", dependencies=[Depends(require_csrf)])
async def delete_role(role_id: UUID, service: Service):
    await service.delete_role(role_id)
    return {"ok": True}


@router.get("/{organization_id}/workspace-options")
async def workspace_options(service: Service):
    return await service.workspace_options()


@router.put(
    "/{organization_id}/assignments/{workspace_id}/members/{user_id}",
    dependencies=[Depends(require_csrf)],
)
async def assign_member(
    workspace_id: UUID, user_id: UUID, payload: RoleAssignment, service: Service
):
    await service.set_workspace_member(workspace_id, user_id, payload.role_id)
    return {"ok": True}


@router.delete(
    "/{organization_id}/assignments/{workspace_id}/members/{user_id}",
    dependencies=[Depends(require_csrf)],
)
async def unassign_member(workspace_id: UUID, user_id: UUID, service: Service):
    await service.set_workspace_member(workspace_id, user_id, None)
    return {"ok": True}


@router.get("/{organization_id}/teams")
async def list_teams(service: Service):
    return await service.teams()


@router.post("/{organization_id}/teams", status_code=201, dependencies=[Depends(require_csrf)])
async def create_team(payload: TeamWrite, service: Service):
    team_id = await service.write_team(payload)
    return {"id": team_id}


@router.put("/{organization_id}/teams/{team_id}", dependencies=[Depends(require_csrf)])
async def update_team(team_id: UUID, payload: TeamWrite, service: Service):
    await service.write_team(payload, team_id)
    return {"ok": True}


@router.delete("/{organization_id}/teams/{team_id}", dependencies=[Depends(require_csrf)])
async def delete_team(team_id: UUID, service: Service):
    await service.delete_team(team_id)
    return {"ok": True}


@router.put(
    "/{organization_id}/teams/{team_id}/members/{user_id}", dependencies=[Depends(require_csrf)]
)
async def add_team_member(team_id: UUID, user_id: UUID, service: Service):
    await service.set_team_member(team_id, user_id)
    return {"ok": True}


@router.delete(
    "/{organization_id}/teams/{team_id}/members/{user_id}", dependencies=[Depends(require_csrf)]
)
async def remove_team_member(team_id: UUID, user_id: UUID, service: Service):
    await service.set_team_member(team_id, user_id, remove=True)
    return {"ok": True}


@router.put(
    "/{organization_id}/teams/{team_id}/workspaces/{workspace_id}",
    dependencies=[Depends(require_csrf)],
)
async def assign_team(team_id: UUID, workspace_id: UUID, payload: RoleAssignment, service: Service):
    await service.set_team_workspace(team_id, workspace_id, payload.role_id)
    return {"ok": True}


@router.delete(
    "/{organization_id}/teams/{team_id}/workspaces/{workspace_id}",
    dependencies=[Depends(require_csrf)],
)
async def unassign_team(team_id: UUID, workspace_id: UUID, service: Service):
    await service.set_team_workspace(team_id, workspace_id, None)
    return {"ok": True}


@router.get("/{organization_id}/invitations")
async def list_invitations(service: Service):
    return await service.invitations()


@router.post(
    "/{organization_id}/invitations", status_code=201, dependencies=[Depends(require_csrf)]
)
async def create_invitation(payload: InvitationCreate, service: Service, sender: Sender):
    delivery = await OrganizationInvitationService(service, sender).create(payload)
    return {
        "id": delivery.id,
        "email": delivery.email,
        "expires_at": delivery.expires_at,
    }


@router.post(
    "/{organization_id}/invitations/{invitation_id}/resend", dependencies=[Depends(require_csrf)]
)
async def resend_invitation(invitation_id: UUID, service: Service, sender: Sender):
    delivery = await OrganizationInvitationService(service, sender).resend(invitation_id)
    return {
        "id": delivery.id,
        "email": delivery.email,
        "expires_at": delivery.expires_at,
    }


@router.delete(
    "/{organization_id}/invitations/{invitation_id}", dependencies=[Depends(require_csrf)]
)
async def cancel_invitation(invitation_id: UUID, service: Service):
    await service.cancel_invitation(invitation_id)
    return {"ok": True}


@router.post("/{organization_id}/accept-invitation", dependencies=[Depends(require_csrf)])
async def accept_invitation(payload: InvitationAccept, service: Service):
    await service.accept_invitation(payload.token)
    return {"organization_id": service.organization_id}


@router.get("/{organization_id}/events")
async def organization_events(service: Service):
    return await service.events()


@router.delete("/{organization_id}", dependencies=[Depends(require_csrf)])
async def delete_organization(service: Service):
    await service.delete_organization()
    return {"ok": True}
