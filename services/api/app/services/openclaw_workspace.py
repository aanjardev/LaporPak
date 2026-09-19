"""OpenClaw workspace management service for multi-desa support.

This service manages OpenClaw workspace configurations per village,
enabling AI personality customization and memory isolation.
"""

import json
from pathlib import Path
from uuid import UUID

from app.core.config import settings


class OpenClawWorkspaceService:
    """Service for managing OpenClaw workspaces per village."""

    def __init__(self, base_path: str | None = None):
        """Initialize the service.

        Args:
            base_path: Base path for OpenClaw workspaces. Defaults to config value.
        """
        self.base_path = Path(base_path or getattr(settings, 'openclaw_workspaces_path', 'openclaw/workspaces'))

    def get_workspace_path(self, village_id: UUID) -> Path:
        """Get the workspace path for a village.

        Args:
            village_id: The village UUID.

        Returns:
            Path to the village's OpenClaw workspace.
        """
        return self.base_path / str(village_id)

    def ensure_workspace_exists(self, village_id: UUID) -> Path:
        """Ensure a workspace directory exists for a village.

        Args:
            village_id: The village UUID.

        Returns:
            Path to the village's OpenClaw workspace.
        """
        workspace_path = self.get_workspace_path(village_id)
        workspace_path.mkdir(parents=True, exist_ok=True)
        return workspace_path

    def create_identity_file(
        self,
        village_id: UUID,
        name: str = "LaporPak",
        emoji: str = "📋",
        vibe: str = "Tegas dan membantu",
    ) -> Path:
        """Create or update the IDENTITY.md file for a village.

        Args:
            village_id: The village UUID.
            name: AI assistant name.
            emoji: AI assistant emoji.
            vibe: AI assistant vibe description.

        Returns:
            Path to the IDENTITY.md file.
        """
        workspace = self.ensure_workspace_exists(village_id)
        identity_path = workspace / "IDENTITY.md"

        content = f"""# IDENTITY.md - Who Am I?

- **Name:** {name}
- **Creature:** Asisten layanan publik desa
- **Vibe:** {vibe}
- **Emoji:** {emoji}
- **Avatar:**

---

This isn't just metadata. It's the start of figuring out who you are.
"""
        identity_path.write_text(content, encoding="utf-8")
        return identity_path

    def create_soul_file(
        self,
        village_id: UUID,
        tone: str = "santai dan familiar seperti tetangga",
        welcome_message: str = "Selamat datang! Saya siap membantu Anda.",
        custom_greetings: list[str] | None = None,
    ) -> Path:
        """Create or update the SOUL.md file for a village.

        Args:
            village_id: The village UUID.
            tone: Tone of voice description.
            welcome_message: Default welcome message.
            custom_greetings: List of custom greeting words.

        Returns:
            Path to the SOUL.md file.
        """
        workspace = self.ensure_workspace_exists(village_id)
        soul_path = workspace / "SOUL.md"
        greetings = custom_greetings or ["Halo", "Hai", "Assalamualaikum"]

        content = f"""# SOUL.md - Who You Are

_You're not a chatbot. You're becoming someone._

## Core Truths

**Be genuinely helpful, not performatively helpful.** Skip the "Great question!" and "I'd be happy to help!" — just help.

**Have opinions.** Disagree, prefer things, find stuff amusing or boring. No personality is just a search engine with extra steps.

**Be resourceful before asking.** Read the file, check the context, search for it. Come back with answers, not questions.

**Earn trust through competence.** Be careful with external actions (emails, tweets, anything public). Be bold with internal ones (reading, organizing, learning).

**Remember you're a guest.** You have access to someone's life — messages, files, calendar, maybe their home. Treat it with respect.

## Boundaries

- Private things stay private. Period.
- When in doubt, ask before acting externally.
- Never send half-baked replies to messaging surfaces.
- You're not the user's voice — be careful in group chats.

## Vibe

{tone}

## Greetings

Use these greetings naturally: {', '.join(greetings)}

## Welcome

Default welcome message: "{welcome_message}"

## Continuity

Each session, you wake up fresh. These files _are_ your memory. Read them. Update them. They're how you persist.

If you change this file, tell the user — it's your soul, and they should know.
"""
        soul_path.write_text(content, encoding="utf-8")
        return soul_path

    def create_openclaw_config(
        self,
        village_id: UUID,
        api_url: str | None = None,
        api_key: str | None = None,
    ) -> Path:
        """Create or update the openclaw.json config file for a village.

        Args:
            village_id: The village UUID.
            api_url: OpenClaw API URL.
            api_key: OpenClaw API key.

        Returns:
            Path to the openclaw.json file.
        """
        workspace = self.ensure_workspace_exists(village_id)
        config_path = workspace / "openclaw.json"

        config = {
            "workspace": str(workspace.absolute()),
            "api_url": api_url or settings.openclaw_api_url or "",
            "channels": {
                "whatsapp": {
                    "enabled": True,
                    "village_id": str(village_id),
                }
            },
            "memory": {
                "enabled": True,
                "storage": "filesystem",
                "path": str(workspace / "memory"),
            },
        }

        if api_key:
            config["api_key"] = api_key

        config_path.write_text(json.dumps(config, indent=2), encoding="utf-8")
        return config_path

    def create_workspace_from_village_config(
        self,
        village_id: UUID,
        village_config: dict,
    ) -> dict:
        """Create a complete workspace from village configuration.

        Args:
            village_id: The village UUID.
            village_config: Village configuration dict containing AI settings.

        Returns:
            Dict with created file paths.
        """
        metadata = village_config.get("metadata", {})
        ai_personality = metadata.get("ai_personality", {})

        created = {}

        # Create IDENTITY.md
        identity_path = self.create_identity_file(
            village_id=village_id,
            name=ai_personality.get("name", "LaporPak"),
            emoji=ai_personality.get("emoji", "📋"),
            vibe=ai_personality.get("vibe", "Tegas dan membantu"),
        )
        created["identity"] = str(identity_path)

        # Create SOUL.md
        soul_path = self.create_soul_file(
            village_id=village_id,
            tone=ai_personality.get("tone", "santai dan familiar seperti tetangga"),
            welcome_message=ai_personality.get(
                "welcome_message",
                "Selamat datang! Saya siap membantu Anda."
            ),
            custom_greetings=ai_personality.get(
                "custom_greetings",
                ["Halo", "Hai", "Assalamualaikum"]
            ),
        )
        created["soul"] = str(soul_path)

        # Create openclaw.json
        config_path = self.create_openclaw_config(village_id)
        created["config"] = str(config_path)

        # Create memory directory
        memory_path = self.get_workspace_path(village_id) / "memory"
        memory_path.mkdir(parents=True, exist_ok=True)
        created["memory"] = str(memory_path)

        return created

    def get_workspace_config(self, village_id: UUID) -> dict | None:
        """Get the OpenClaw configuration for a village.

        Args:
            village_id: The village UUID.

        Returns:
            Configuration dict or None if not found.
        """
        config_path = self.get_workspace_path(village_id) / "openclaw.json"
        if not config_path.exists():
            return None

        return json.loads(config_path.read_text(encoding="utf-8"))

    def get_identity_content(self, village_id: UUID) -> str | None:
        """Get the IDENTITY.md content for a village.

        Args:
            village_id: The village UUID.

        Returns:
            IDENTITY.md content or None if not found.
        """
        identity_path = self.get_workspace_path(village_id) / "IDENTITY.md"
        if not identity_path.exists():
            return None

        return identity_path.read_text(encoding="utf-8")

    def get_soul_content(self, village_id: UUID) -> str | None:
        """Get the SOUL.md content for a village.

        Args:
            village_id: The village UUID.

        Returns:
            SOUL.md content or None if not found.
        """
        soul_path = self.get_workspace_path(village_id) / "SOUL.md"
        if not soul_path.exists():
            return None

        return soul_path.read_text(encoding="utf-8")

    def workspace_exists(self, village_id: UUID) -> bool:
        """Check if a workspace exists for a village.

        Args:
            village_id: The village UUID.

        Returns:
            True if workspace exists.
        """
        config_path = self.get_workspace_path(village_id) / "openclaw.json"
        return config_path.exists()

    def delete_workspace(self, village_id: UUID) -> bool:
        """Delete a workspace for a village.

        Args:
            village_id: The village UUID.

        Returns:
            True if deleted, False if not found.
        """
        import shutil
        workspace_path = self.get_workspace_path(village_id)
        if not workspace_path.exists():
            return False

        shutil.rmtree(workspace_path)
        return True

    def list_workspaces(self) -> list[dict]:
        """List all existing workspaces.

        Returns:
            List of workspace info dicts.
        """
        if not self.base_path.exists():
            return []

        workspaces = []
        for village_dir in self.base_path.iterdir():
            if village_dir.is_dir():
                config_path = village_dir / "openclaw.json"
                if config_path.exists():
                    try:
                        config = json.loads(config_path.read_text(encoding="utf-8"))
                        workspaces.append({
                            "village_id": village_dir.name,
                            "workspace_path": str(village_dir),
                            "config": config,
                        })
                    except json.JSONDecodeError:
                        workspaces.append({
                            "village_id": village_dir.name,
                            "workspace_path": str(village_dir),
                            "config": None,
                        })

        return workspaces


# Singleton instance
_openclaw_workspace_service: OpenClawWorkspaceService | None = None


def get_openclaw_workspace_service() -> OpenClawWorkspaceService:
    """Get the singleton OpenClawWorkspaceService instance."""
    global _openclaw_workspace_service
    if _openclaw_workspace_service is None:
        _openclaw_workspace_service = OpenClawWorkspaceService()
    return _openclaw_workspace_service
