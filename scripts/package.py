#!/usr/bin/env python3
"""Validate portable skills and optionally build deterministic per-skill ZIPs."""
import argparse
import re
import zipfile
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
NAME = re.compile(r"[a-z0-9-]{1,64}")


def skill_files(directory):
    if directory.is_symlink():
        raise ValueError(f"{directory}: skill directory must not be a symlink")
    paths = sorted(directory.rglob("*"))
    files = []
    size = 0
    if len(paths) > 2000:
        raise ValueError(f"{directory}: exceeds 2,000 entries")
    for path in paths:
        if path.is_symlink() or not (path.is_dir() or path.is_file()):
            raise ValueError(f"{path}: only ordinary directories and files are supported")
        if path.is_file():
            if path.name == ".installation.json" or ".git" in path.parts:
                raise ValueError(f"{path}: reserved installation file")
            if "\\" in path.relative_to(directory).as_posix():
                raise ValueError(f"{path}: backslashes are not supported in resource names")
            data = path.read_bytes()
            size += len(data)
            mode = 0o644 | (path.stat().st_mode & 0o111)
            files.append((path.relative_to(directory).as_posix(), data, mode))
    if size > 25 * 1024 * 1024:
        raise ValueError(f"{directory}: exceeds 25 MiB expanded")
    content = (directory / "SKILL.md").read_text(encoding="utf-8")
    if not content.startswith("---\n") or "\n---\n" not in content[4:]:
        raise ValueError(f"{directory}: missing YAML frontmatter")
    header, body = content[4:].split("\n---\n", 1)
    meta = yaml.safe_load(header)
    if not isinstance(meta, dict):
        raise ValueError(f"{directory}: frontmatter must be a mapping")
    name, description = meta.get("name"), meta.get("description")
    if not isinstance(name, str) or not NAME.fullmatch(name) or name != directory.name:
        raise ValueError(f"{directory}: name must match directory and naming rules")
    if not isinstance(description, str) or not description.strip() or not body.strip():
        raise ValueError(f"{directory}: description and instructions are required")
    metadata = meta.get("metadata") or {}
    if not isinstance(metadata, dict) or any(str(key).startswith("mutiro.") for key in metadata):
        raise ValueError(f"{directory}: Mutiro activation rules belong in the runtime")
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="Write one ZIP per skill to this directory")
    args = parser.parse_args()
    directories = sorted((ROOT / "skills").iterdir())
    if not directories:
        parser.error("No skills to publish")
    validated = []
    for directory in directories:
        if not directory.is_dir():
            parser.error(f"Unexpected entry in skills/: {directory}")
        validated.append((directory, skill_files(directory)))
    if args.output:
        args.output.mkdir(parents=True, exist_ok=True)
        for directory, files in validated:
            archive = args.output / f"{directory.name}.zip"
            with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as output:
                for name, data, mode in files:
                    entry = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
                    entry.compress_type = zipfile.ZIP_DEFLATED
                    entry.create_system = 3  # Unix permission bits, independent of the build host.
                    entry.external_attr = (0o100000 | mode) << 16
                    output.writestr(entry, data)
            if archive.stat().st_size > 5 * 1024 * 1024:
                archive.unlink()
                raise ValueError(f"{directory}: exceeds 5 MiB compressed")
    print(f"Validated {len(validated)} skills" + (f"; packaged in {args.output}" if args.output else ""))


if __name__ == "__main__":
    main()
