"""Regression for legitimate retirement without modifying the real Git index."""

import subprocess

from tests.support.inventory import git_source_files


def test_inventory_keeps_current_sources_and_excludes_deletions_and_generated(tmp_path):
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    skill = tmp_path / "skills/document"
    skill.mkdir(parents=True)
    (skill / "SKILL.md").write_bytes(b"kept source\n")
    retired = skill / "retired.py"
    retired.write_bytes(b"retired source\n")
    (tmp_path / ".gitignore").write_text("__pycache__/\n*.pyc\nignored.txt\n")
    subprocess.run(["git", "-C", str(tmp_path), "add", "."], check=True)
    retired.unlink()  # Only this disposable test fixture.
    (skill / "new.md").write_bytes(b"new nonignored source\n")
    (skill / "ignored.txt").write_bytes(b"generated\n")
    (skill / "__pycache__").mkdir()
    (skill / "__pycache__/retired.pyc").write_bytes(b"compiled\n")
    inventory = git_source_files(tmp_path, "skills/document")
    assert inventory == {
        "skills/document/SKILL.md": b"kept source\n",
        "skills/document/new.md": b"new nonignored source\n",
    }
