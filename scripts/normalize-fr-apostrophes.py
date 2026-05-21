#!/usr/bin/env python3
"""Normalize in-word straight apostrophes to typographic ones in messages/fr.json.

Run from the project root: `python3 scripts/normalize-fr-apostrophes.py`.

The CI lint (npm run lint:i18n) enforces the same rule and fails on any
straight apostrophe between two letters in a FR value.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FR_PATH = ROOT / "messages" / "fr.json"

IN_WORD_APOSTROPHE = re.compile(r"([a-zà-ÿA-ZÀ-Ÿ])'([a-zà-ÿA-ZÀ-Ÿ])")


def main() -> int:
    raw = FR_PATH.read_text(encoding="utf-8")
    data = json.loads(raw)
    changed = 0
    for key, value in data.items():
        if isinstance(value, str):
            new = IN_WORD_APOSTROPHE.sub(r"\1’\2", value)
            if new != value:
                data[key] = new
                changed += 1
    FR_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Updated {changed} keys in {FR_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
