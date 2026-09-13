from __future__ import annotations

import io
import json
import re
import zipfile
from dataclasses import dataclass
from uuid import UUID

from agent_factory_core.identity.authorization import AuthorizedContext, require_workspace_id
from agent_factory_core.shared.errors import ConflictError, NotFoundError

from .use_cases import MCPConnectionUseCases

CLIENT_ENVIRONMENTS = (
    ("vscode", "ide", ".vscode/mcp.json", "json"),
    ("cursor", "ide", ".cursor/mcp.json", "json"),
    ("windsurf", "ide", "~/.codeium/windsurf/mcp_config.json", "json"),
    ("jetbrains", "ide", ".ai/mcp/mcp.json", "json"),
    ("zed", "ide", "settings.json", "json"),
    ("kiro", "ide", ".kiro/settings/mcp.json", "json"),
    ("antigravity", "ide", "~/.gemini/config/mcp_config.json", "json"),
    ("antigravity", "cli", ".agents/mcp_config.json", "json"),
    ("cline", "ide", "Cline MCP settings", "json"),
    ("cline", "cli", "~/.cline/data/settings/cline_mcp_settings.json", "json"),
    ("continue", "ide", ".continue/mcpServers/agent-factory.yaml", "yaml"),
    ("codex", "ide", ".codex/config.toml", "toml"),
    ("codex", "cli", ".codex/config.toml", "toml"),
    ("claude", "cli", ".mcp.json", "json"),
    ("claude", "ide", ".mcp.json", "json"),
    ("gemini", "cli", ".gemini/settings.json", "json"),
    ("opencode", "v1", "opencode.json", "json"),
    ("opencode", "v2", "opencode.json", "json"),
)
CLIENT_DOCS = {
    "vscode": "https://code.visualstudio.com/docs/agent-customization/mcp-servers",
    "cursor": "https://prod.cursor.com/docs/mcp",
    "windsurf": "https://docs.windsurf.com/windsurf/cascade/mcp",
    "jetbrains": "https://www.jetbrains.com/help/ai-assistant/mcp.html",
    "zed": "https://zed.dev/docs/ai/mcp",
    "kiro": "https://kiro.dev/docs/mcp/configuration/",
    "antigravity": "https://www.antigravity.google/docs/mcp",
    "cline": "https://github.com/cline/cline/blob/main/docs/mcp/mcp-overview.mdx",
    "continue": "https://docs.continue.dev/reference",
    "codex": "https://developers.openai.com/codex/mcp/",
    "claude": "https://code.claude.com/docs/en/mcp",
    "gemini": "https://geminicli.com/docs/tools/mcp-server/",
    "opencode": "https://opencode.ai/v2/docs/mcp-servers",
}


@dataclass(frozen=True, slots=True)
class MCPConfigurationBundle:
    filename: str
    body: bytes
    instructions: str


class MCPConfigurationUseCases:
    def __init__(self, connections: MCPConnectionUseCases, public_base_url: str) -> None:
        self.connections = connections
        self.public_base_url = public_base_url.rstrip("/")

    def filename(self, workspace_id: UUID, connection_id: UUID) -> str:
        return f"agent-factory-{workspace_id}-all-clients-{connection_id}.zip"

    def instructions(self, workspace_id: UUID, connection_id: UUID) -> str:
        filename = self.filename(workspace_id, connection_id)
        return (
            f"워크스페이스 루트의 {filename}을 개인 임시 디렉터리에 압축 해제하세요. "
            "기존 MCP 설정을 덮어쓰지 말고 해당 클라이언트 설정과 병합한 뒤, "
            "credentials.json의 인증 값을 각 설정의 환경변수·입력·PASTE_TOKEN_HERE 방식에 "
            "맞게 안전하게 적용하세요. 실제 MCP 도구 목록을 조회해 연결을 확인하고, 완료하면 "
            f"워크스페이스 루트의 {filename}과 압축 해제한 임시 디렉터리를 삭제하세요. "
            "토큰이나 토큰이 들어간 설정을 저장소에 커밋하거나 팀원에게 전달하지 마세요."
        )

    async def describe(self, context: AuthorizedContext, connection_id: UUID) -> dict[str, str]:
        workspace_id = require_workspace_id(context)
        connection = next(
            (row for row in await self.connections.status(context) if row.id == connection_id), None
        )
        if connection is None:
            raise NotFoundError("connection_not_found", "Connection not found")
        if not connection.retrievable:
            raise ConflictError("token_unavailable", "Expired, revoked, or legacy token")
        return {
            "filename": self.filename(workspace_id, connection_id),
            "instructions": self.instructions(workspace_id, connection_id),
        }

    async def bundle(
        self, context: AuthorizedContext, connection_id: UUID
    ) -> MCPConfigurationBundle:
        workspace_id = require_workspace_id(context)
        token = await self.connections.reveal(context, connection_id)
        filename = self.filename(workspace_id, connection_id)
        instructions = self.instructions(workspace_id, connection_id)
        server_url = f"{self.public_base_url}/mcp"
        key = f"agent-factory-{workspace_id}"
        manifest: dict[str, object] = {
            "schema_version": "1",
            "workspace_id": str(workspace_id),
            "connection_id": str(connection_id),
            "server_url": server_url,
            "clients": [],
        }
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(
                "credentials.json",
                json.dumps({"connection_id": str(connection_id), "token": token}, indent=2),
            )
            archive.writestr("README.txt", instructions)
            for client, environment, target, extension in CLIENT_ENVIRONMENTS:
                env_name = "AF_MCP_" + re.sub(r"[^A-Z0-9]", "_", str(workspace_id).upper())
                config = self._config(client, environment, key, server_url, env_name, token)
                path = f"clients/{client}/{environment}/mcp-settings.{extension}"
                archive.writestr(path, config)
                if client == "codex" and environment == "cli":
                    archive.writestr(
                        f"clients/{client}/{environment}/register.sh",
                        "#!/bin/sh\n"
                        f"codex mcp add '{key}' --url '{server_url}' "
                        f"--bearer-token-env-var '{env_name}'\n",
                    )
                manifest["clients"].append(
                    {
                        "client": client,
                        "environment": environment,
                        "target": target,
                        "config": path,
                        "authentication": "credentials.json",
                        "documentation": CLIENT_DOCS[client],
                        "register": f"clients/{client}/{environment}/register.sh"
                        if client == "codex" and environment == "cli"
                        else None,
                    }
                )
            archive.writestr("connection.json", json.dumps(manifest, indent=2, ensure_ascii=False))
        return MCPConfigurationBundle(filename, stream.getvalue(), instructions)

    @staticmethod
    def _config(
        client: str, environment: str, key: str, url: str, env_name: str, token: str
    ) -> str:
        authorization = f"Bearer {token}"
        if client in {"cursor", "windsurf"}:
            authorization = f"Bearer ${{env:{env_name}}}"
        elif client in {"kiro", "claude", "gemini"}:
            authorization = f"Bearer ${{{env_name}}}"
        elif client in {"codex", "opencode"}:
            authorization = f"Bearer {{env:{env_name}}}"
        headers = {"Authorization": authorization}
        if client == "continue":
            return (
                f"name: Agent Factory\nversion: 1.0.0\nschema: v1\nmcpServers:\n"
                f"  - name: {key}\n    type: streamable-http\n    url: {url}\n"
                f"    requestOptions:\n      headers:\n        Authorization: {authorization}\n"
            )
        if client == "codex":
            return f'[mcp_servers."{key}"]\nurl = "{url}"\nbearer_token_env_var = "{env_name}"\n'
        server: dict[str, object] = {"url": url, "headers": headers}
        root = "mcpServers"
        if client in {"windsurf", "antigravity"}:
            server = {"serverUrl": url, "headers": headers}
        elif client == "zed":
            root = "context_servers"
        elif client == "cline":
            server = {"type": "streamableHttp", **server, "disabled": False, "autoApprove": []}
        elif client == "gemini":
            server = {"httpUrl": url, "headers": headers}
        elif client == "opencode":
            server = {"type": "remote", "url": url, "oauth": False, "headers": headers}
            return json.dumps(
                {"mcp": {"servers": {key: server}}}
                if environment == "v2"
                else {"mcp": {key: server}},
                indent=2,
            )
        elif client == "vscode":
            return json.dumps(
                {
                    "servers": {
                        key: {
                            "type": "http",
                            "url": url,
                            "headers": {"Authorization": "Bearer ${input:agentFactoryToken}"},
                        }
                    },
                    "inputs": [
                        {"id": "agentFactoryToken", "type": "promptString", "password": True}
                    ],
                },
                indent=2,
            )
        return json.dumps({root: {key: server}}, indent=2)
