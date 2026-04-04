"""Quick syntax validation script for all modified files."""
import ast
import sys

files = [
    r"app\services\scraper\base.py",
    r"app\services\scraper\cagdas.py",
    r"app\services\scraper\bizimyaka.py",
    r"app\services\scraper\ozgur.py",
    r"app\services\scraper\ses.py",
    r"app\services\scraper\yenikocaeli.py",
    r"app\services\duplicate.py",
    r"app\services\geocoder.py",
    r"app\routers\scraper.py",
    r"app\config.py",
]

errors = []
for f in files:
    try:
        with open(f, "r", encoding="utf-8") as fh:
            ast.parse(fh.read())
        print(f"OK: {f}")
    except SyntaxError as e:
        print(f"FAIL: {f} -> {e}")
        errors.append(f)

if errors:
    print(f"\n{len(errors)} file(s) have syntax errors!")
    sys.exit(1)
else:
    print(f"\nAll {len(files)} files passed syntax check!")
