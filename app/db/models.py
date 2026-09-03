"""Complete model import surface used by Alembic autogeneration."""

from app.modules.admin.models import FeatureFlag
from app.modules.agent.models import (
    AgentDefinition,
    AgentDocumentLink,
    AgentRun,
    AgentRunArtifact,
    AgentRunEvent,
    AgentRunToolCall,
    AgentVersion,
)
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
from app.modules.integration.models import (
    IntegrationConnection,
    IntegrationOAuthState,
    IntegrationProvider,
    WebhookDelivery,
    WebhookEndpoint,
)
from app.modules.organization.models import (
    Organization,
    OrganizationMembership,
    Permission,
    Role,
    RolePermission,
)
from app.modules.schedule.models import Job, JobEvent, Schedule
from app.modules.workspace.models import (
    Workspace,
    WorkspaceMembership,
    WorkspaceRepository,
    WorkspaceVisit,
)

__all__ = [
    "AgentDefinition",
    "AgentDocumentLink",
    "AgentRun",
    "AgentRunArtifact",
    "AgentRunEvent",
    "AgentRunToolCall",
    "AgentVersion",
    "ApiToken",
    "AuthFactor",
    "AuthSession",
    "Document",
    "DocumentChunk",
    "DocumentProvenance",
    "DocumentRevision",
    "EmbeddingProfile",
    "ExternalIdentity",
    "FeatureFlag",
    "IntegrationConnection",
    "IntegrationOAuthState",
    "IntegrationProvider",
    "Job",
    "JobEvent",
    "OneTimeToken",
    "Organization",
    "OrganizationMembership",
    "Permission",
    "Role",
    "RolePermission",
    "Schedule",
    "User",
    "UserCredential",
    "WebhookDelivery",
    "WebhookEndpoint",
    "Workspace",
    "WorkspaceMembership",
    "WorkspaceRepository",
    "WorkspaceVisit",
]
