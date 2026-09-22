"""Verify release archives retain runnable scripts and reproducible modes."""
import contextlib
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import package


class PackageTests(unittest.TestCase):
    def test_executable_bits_survive_packaging(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            skill = root / "skills" / "fixture"
            skill.mkdir(parents=True)
            (skill / "SKILL.md").write_text(
                "---\nname: fixture\ndescription: Packaging fixture\n---\nInstructions\n"
            )
            script = skill / "run.sh"
            script.write_bytes(b"#!/bin/sh\nprintf 'skill ran\\n'\n")
            script.chmod(0o750)

            def build(destination):
                with patch.object(package, "ROOT", root), patch(
                    "sys.argv", ["package.py", "--output", str(destination)]
                ), contextlib.redirect_stdout(io.StringIO()):
                    package.main()
                return destination / "fixture.zip"

            first = build(root / "first")
            second = build(root / "second")
            self.assertEqual(first.read_bytes(), second.read_bytes())
            with zipfile.ZipFile(first) as archive:
                info = archive.getinfo("run.sh")
                self.assertEqual(info.create_system, 3)
                self.assertEqual((info.external_attr >> 16) & 0o111, 0o110)
                self.assertEqual((info.external_attr >> 16) & 0o7022, 0)
                self.assertEqual(archive.read("run.sh"), script.read_bytes())
                self.assertEqual(
                    (archive.getinfo("SKILL.md").external_attr >> 16) & 0o111, 0
                )

            script.chmod(0o644)
            third = build(root / "third")
            self.assertNotEqual(first.read_bytes(), third.read_bytes())
            with zipfile.ZipFile(third) as archive:
                self.assertEqual(
                    (archive.getinfo("run.sh").external_attr >> 16) & 0o111, 0
                )


if __name__ == "__main__":
    unittest.main()
