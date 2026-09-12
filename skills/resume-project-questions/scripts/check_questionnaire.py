#!/usr/bin/env python3
"""Validate the four-level question outline, not factual grounding or XMind rendering."""

import argparse
import re
from pathlib import Path


def check(text, expected=None):
    errors, groups = [], []
    project = None
    group = None
    root_seen = False
    views = []
    seen_projects = set()
    fence = None
    in_answer = False
    previous_paragraph = False
    for number, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if fence:
            # A closing fence cannot have an info string after the marker.
            if re.fullmatch(r" {0,3}" + re.escape(fence[0]) + "{" + str(len(fence)) + r",}[ \t]*", line):
                fence = None
            previous_paragraph = False
            continue
        fence_match = re.match(r"^ {0,3}(`{3,}|~{3,})(.*)$", line)
        if fence_match and fence_match.group(1)[0] == "`" and "`" in fence_match.group(2):
            fence_match = None
        if fence_match:
            fence = fence_match.group(1)
            if not in_answer:
                errors.append(f"line {number}: code fence outside an answer")
            previous_paragraph = False
            continue
        if previous_paragraph and re.fullmatch(r" {0,3}(?:=+|-+)[ \t]*", line):
            errors.append(f"line {number}: Setext headings are not allowed in the four-level outline")
            previous_paragraph = False
            continue
        match = re.match(r"^ {0,3}(#{1,6})(?:[ \t]+(.*?)|[ \t]*)$", line)
        if not match:
            if stripped and not in_answer:
                errors.append(f"line {number}: unexpected text outside an answer")
            previous_paragraph = bool(stripped) and not line.startswith(("    ", "\t")) and not re.match(r"^ {0,3}(?:>|[-+*] |\d+[.)] )", line)
            continue
        previous_paragraph = False
        level = len(match.group(1))
        title = re.sub(r"[ \t]+#+[ \t]*$", "", match.group(2) or "").strip()
        in_answer = False
        if not title:
            errors.append(f"line {number}: empty heading")
            continue
        if level == 1:
            if root_seen or title != "项目面试问题清单" or project:
                errors.append(f"line {number}: expected one root titled 项目面试问题清单")
            root_seen = True
        elif level == 2:
            if not root_seen:
                errors.append(f"line {number}: missing root")
            if project and views != ["业务视角", "技术视角"]:
                errors.append(f"{project}: expected business then technical view")
            if title in seen_projects:
                errors.append(f"line {number}: duplicate project {title}")
            seen_projects.add(title)
            project, group, views = title, None, []
        elif level == 3:
            if not project:
                errors.append(f"line {number}: view without project")
            views.append(title)
            group = {"project": project, "view": title, "questions": []}
            groups.append(group)
        elif level == 4:
            if group is None:
                errors.append(f"line {number}: question without view")
            else:
                normalized = re.sub(r"\s+", "", title)
                if normalized in group["questions"]:
                    errors.append(f"line {number}: duplicate question")
                group["questions"].append(normalized)
            in_answer = True
        else:
            errors.append(f"line {number}: heading deeper than four levels")
    if not root_seen or not project:
        errors.append("missing root or projects")
    if project and views != ["业务视角", "技术视角"]:
        errors.append(f"{project}: expected business then technical view")
    if fence:
        errors.append("unclosed code fence")
    for item in groups:
        count = len(item["questions"])
        if count == 0 or (expected is not None and count != expected):
            errors.append(f"{item['project']}/{item['view']}: unexpected count {count}")
    return errors, groups


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path)
    parser.add_argument("--expected-per-view", type=int)
    args = parser.parse_args()
    if args.expected_per_view is not None and args.expected_per_view < 1:
        parser.error("--expected-per-view must be positive")
    errors, groups = check(args.path.read_text(encoding="utf-8"), args.expected_per_view)
    for item in groups:
        print(f"{item['project']} / {item['view']}: {len(item['questions'])} questions")
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        raise SystemExit(1)
    print("OK: four-level outline validated; factual grounding requires separate review")


if __name__ == "__main__":
    main()
