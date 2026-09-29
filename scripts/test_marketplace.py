"""Verify the Claude Code plugin marketplace points at real skills."""
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parent.parent
MARKETPLACE = ROOT / ".claude-plugin" / "marketplace.json"


class MarketplaceTests(unittest.TestCase):
    def setUp(self):
        self.marketplace = json.loads(MARKETPLACE.read_text())

    def test_plugins_list_existing_skills(self):
        for plugin in self.marketplace["plugins"]:
            self.assertEqual(plugin["source"], "./", plugin["name"])
            self.assertTrue(plugin["skills"], plugin["name"])
            for path in plugin["skills"]:
                self.assertTrue((ROOT / path / "SKILL.md").is_file(), f"{plugin['name']}: {path} has no SKILL.md")

    def test_plugins_carry_a_release_version(self):
        # Installed plugins update only when this changes; the release
        # workflow requires it to match the tag being published.
        for plugin in self.marketplace["plugins"]:
            self.assertRegex(plugin["version"], r"^\d+\.\d+\.\d+$", plugin["name"])


if __name__ == "__main__":
    unittest.main()
