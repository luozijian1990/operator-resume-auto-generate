"""Check outline failures that would break the question hierarchy."""

import runpy
import unittest
from pathlib import Path


check = runpy.run_path(str(Path(__file__).resolve().parents[1] / "scripts/check_questionnaire.py"))["check"]
VALID = """# 项目面试问题清单

## 发布改造

### 业务视角

#### 解决什么问题？

回答：减少人工检查。

### 技术视角

#### 如何检查？

回答：
"""


class OutlineTests(unittest.TestCase):
    def test_answer_body_and_code_are_not_nodes(self):
        text = VALID + "\n```shell\n# this is a comment\necho ok\n```\n"
        self.assertFalse(check(text, 1)[0])

    def test_rejects_extra_metadata_node(self):
        self.assertTrue(check(VALID + "\n## 来源\n原简历\n", 1)[0])

    def test_rejects_fifth_level_answer(self):
        self.assertTrue(check(VALID + "\n##### 回答\n", 1)[0])

    def test_rejects_indented_fifth_level(self):
        self.assertTrue(check(VALID + "\n  ##### 回答\n", 1)[0])

    def test_rejects_setext_heading_in_answer(self):
        for underline in ["---", "==="]:
            self.assertTrue(check(VALID + "\n额外层级\n" + underline + "\n", 1)[0])

    def test_accepts_commonmark_atx_variants(self):
        text = "\n".join("  " + line + " ##" if line.startswith("#") else line for line in VALID.splitlines())
        self.assertFalse(check(text, 1)[0])

    def test_fence_with_info_does_not_close_code(self):
        text = VALID + "\n```text\n```not-a-closing-fence\n##### code, not a heading\n```\n"
        self.assertFalse(check(text, 1)[0])

    def test_accepts_thematic_break_after_blank_line(self):
        self.assertFalse(check(VALID + "\n---\n", 1)[0])

    def test_rejects_wrong_view_order(self):
        text = VALID.replace("业务视角", "TEMP").replace("技术视角", "业务视角").replace("TEMP", "技术视角")
        self.assertTrue(check(text, 1)[0])

    def test_rejects_duplicate_question(self):
        self.assertTrue(check(VALID + "\n#### 如何检查？\n", None)[0])

    def test_rejects_incorrect_count(self):
        self.assertTrue(check(VALID, 15)[0])

    def test_rejects_empty_and_missing_root(self):
        self.assertTrue(check("")[0])
        self.assertTrue(check(VALID.replace("# 项目面试问题清单\n", ""))[0])


if __name__ == "__main__":
    unittest.main()
