"""Permission catalog shared by authorization, role editing and token scopes."""

from dataclasses import dataclass


@dataclass(frozen=True)
class PermissionDefinition:
    key: str
    label: str
    scope: str
    resource: str

    @property
    def resource_label(self) -> str:
        return RESOURCE_ACTIONS[self.resource][0]

    @property
    def description(self) -> str:
        boundary = "이 조직" if self.scope == "organization" else "역할이 배정된 작업공간"
        return f"{boundary}에서 {self.label} 작업을 허용합니다. " + PERMISSION_NOTES.get(
            self.key, "다른 행동의 권한은 별도로 선택합니다."
        )

    @property
    def available(self) -> bool:
        return self.key != "test.execute"


# A scope describes the resource boundary; an action never implies another action.
RESOURCE_ACTIONS = {
    "organization": ("조직", "organization", "read update transfer delete"),
    "member": ("구성원", "organization", "read invite cancel_invite update_role suspend remove"),
    "team": ("팀", "organization", "read create update delete manage_members"),
    "role": ("역할", "organization", "read create update delete assign"),
    "workspace": ("작업공간", "workspace", "read create update delete manage_members"),
    "repository": ("저장소", "workspace", "read create delete"),
    "document": ("문서", "workspace", "read create update delete import export"),
    "agent": ("에이전트", "workspace", "read create update delete execute stop report"),
    "schedule": ("일정", "workspace", "read create update delete toggle"),
    "job": ("작업 실행", "workspace", "read create cancel retry"),
    "integration": ("외부 연결", "workspace", "read create update delete use"),
    "token": ("토큰", "workspace", "read create revoke"),
    "audit": ("로그", "workspace", "read export"),
    "test": ("테스트", "workspace", "read execute"),
    "planning": ("계획", "workspace", "read create update delete import"),
}
ACTION_LABELS = {
    "read": "조회",
    "create": "생성",
    "update": "수정",
    "delete": "삭제",
    "transfer": "소유권 이전",
    "invite": "초대",
    "cancel_invite": "초대 취소",
    "update_role": "역할 변경",
    "suspend": "활동 정지·복구",
    "remove": "제거",
    "manage_members": "참여자 관리",
    "assign": "역할 부여",
    "import": "가져오기",
    "export": "내보내기",
    "execute": "실행",
    "stop": "중지",
    "report": "보고",
    "toggle": "활성화·비활성화",
    "cancel": "취소",
    "retry": "재시도",
    "use": "사용",
    "revoke": "폐기",
}
PERMISSION_NOTES = {
    "organization.transfer": "소유자만 활성 구성원에게 이전할 수 있습니다.",
    "organization.delete": "소유자 전용입니다. 삭제하면 소속 작업공간 접근도 차단됩니다.",
    "member.update_role": "역할 부여 권한도 필요하며 보유 권한을 넘겨 위임할 수 없습니다.",
    "member.suspend": "정지하면 팀·직접 배정을 통한 모든 작업공간 접근이 차단됩니다.",
    "member.remove": "직접 작업공간 배정과 팀 소속을 해제합니다. 복귀하려면 다시 초대해야 합니다.",
    "role.assign": "조직 역할 변경에는 구성원 역할 변경 권한도 필요합니다.",
    "workspace.create": "조직에 새 작업공간을 만들며 생성자가 해당 공간의 소유자가 됩니다.",
    "workspace.manage_members": "직접 배정·해제를 허용하며 마지막 소유자를 제거할 수 없습니다.",
    "team.manage_members": "팀을 통해 부여될 각 작업공간 권한도 위임할 수 있어야 합니다.",
    "schedule.create": "에이전트 일정에는 실행 권한, 수집 일정에는 외부 연결 사용·문서 가져오기 권한도 필요합니다.",
    "schedule.update": "실행할 작업의 권한도 검사합니다. 변경자는 이후 일정의 실행 주체가 됩니다.",
    "schedule.toggle": "활성화에는 실행할 작업의 권한도 필요합니다. 비활성화에는 이 권한만 필요합니다.",
    "integration.use": "문서 수집에는 문서 가져오기 권한도 필요합니다.",
    "token.create": "자신이 가진 작업공간 권한 이내에서 토큰을 발급합니다.",
    "audit.export": "최신 변경 이력 최대 200건을 JSON으로 내려받습니다.",
    "test.execute": "실행 엔진이 준비되지 않아 현재 부여할 수 없습니다.",
}
CATALOG = {
    f"{resource}.{action}": PermissionDefinition(
        f"{resource}.{action}",
        f"{label} {ACTION_LABELS[action]}",
        "organization" if resource == "workspace" and action == "create" else scope,
        resource,
    )
    for resource, (label, scope, actions) in RESOURCE_ACTIONS.items()
    for action in actions.split()
}
ORGANIZATION_PERMISSIONS = frozenset(k for k, p in CATALOG.items() if p.scope == "organization")
WORKSPACE_PERMISSIONS = frozenset(k for k, p in CATALOG.items() if p.scope == "workspace")
# Legacy grants are expanded during migration, never offered in custom roles.
LEGACY_EXPANSIONS = {
    "organization.manage": ORGANIZATION_PERMISSIONS
    - {"organization.transfer", "organization.delete"},
    "workspace.manage": WORKSPACE_PERMISSIONS - {"organization.transfer"},
    "document.manage": frozenset(k for k in CATALOG if k.startswith("document.")),
    "integration.manage": frozenset(k for k in CATALOG if k.startswith("integration.")),
}
DEFAULT_ORGANIZATION_MEMBER = frozenset(
    {"organization.read", "member.read", "team.read", "role.read"}
)
DEFAULT_WORKSPACE_MEMBER = frozenset(
    {
        "workspace.read",
        "repository.read",
        "document.read",
        "document.create",
        "document.update",
        "document.import",
        "document.export",
        "agent.read",
        "agent.execute",
        "agent.stop",
        "agent.report",
        "schedule.read",
        "job.read",
        "job.create",
        "job.cancel",
        "job.retry",
        "integration.read",
        "integration.use",
        "token.read",
        "token.create",
        "token.revoke",
        "planning.read",
        "planning.create",
        "planning.update",
        "planning.import",
        "test.read",
    }
)
DEFAULT_WORKSPACE_VIEWER = frozenset(
    {
        "workspace.read",
        "repository.read",
        "document.read",
        "agent.read",
        "schedule.read",
        "job.read",
        "planning.read",
        "test.read",
    }
)


def validate_permissions(scope: str, permissions: list[str]) -> frozenset[str]:
    from app.common.errors import ApplicationError

    keys = frozenset(permissions)
    if scope not in {"organization", "workspace"} or any(
        key not in CATALOG or CATALOG[key].scope != scope or not CATALOG[key].available
        for key in keys
    ):
        raise ApplicationError("invalid_role_permissions", "역할 범위에 맞는 권한을 선택하세요.")
    if keys & {"organization.transfer", "organization.delete"}:
        raise ApplicationError(
            "owner_permission_reserved", "소유권 이전·조직 삭제는 소유자 전용입니다."
        )
    return keys


TOKEN_ALIASES = {
    "document:write": frozenset(
        k for k in WORKSPACE_PERMISSIONS if k.startswith("document.") and k != "document.read"
    ),
    "integration:manage": frozenset(
        k for k in WORKSPACE_PERMISSIONS if k.startswith("integration.") and k != "integration.read"
    ),
    "schedule:write": frozenset(
        k
        for k in WORKSPACE_PERMISSIONS
        if k.startswith(("planning.", "schedule.", "job.")) and not k.endswith(".read")
    ),
    "schedule:read": frozenset({"schedule.read", "planning.read", "job.read"}),
    "logs:read": frozenset({"audit.read"}),
    "tests:read": frozenset({"test.read"}),
}


def token_permissions(scopes: list[str]) -> frozenset[str]:
    result = set()
    for scope in scopes:
        key = scope.replace(":", ".")
        if key in WORKSPACE_PERMISSIONS:
            result.add(key)
        result.update(TOKEN_ALIASES.get(scope, ()))
    return frozenset(result)
