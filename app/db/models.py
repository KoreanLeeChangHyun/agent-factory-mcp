"""Complete model import surface used by Alembic autogeneration."""

from app.modules.auth.models import (
    ApiToken,
    AuthFactor,
    AuthSession,
    ExternalIdentity,
    OneTimeToken,
    UserCredential,
)
from app.modules.document.models import (
    Document,
    DocumentChunk,
    DocumentProvenance,
    DocumentRevision,
    EmbeddingProfile,
)
from app.modules.identity.models import User
from app.modules.organization.models import (
    Organization,
    OrganizationMembership,
    Permission,
    Role,
    RolePermission,
)
from app.modules.workspace.models import (
    Workspace,
    WorkspaceMembership,
    WorkspaceRepository,
    WorkspaceVisit,
)

__all__ = [
    "ApiToken",
    "AuthFactor",
    "AuthSession",
    "Document",
    "DocumentChunk",
    "DocumentProvenance",
    "DocumentRevision",
    "EmbeddingProfile",
    "ExternalIdentity",
    "OneTimeToken",
    "Organization",
    "OrganizationMembership",
    "Permission",
    "Role",
    "RolePermission",
    "User",
    "UserCredential",
    "Workspace",
    "WorkspaceMembership",
    "WorkspaceRepository",
    "WorkspaceVisit",
]
