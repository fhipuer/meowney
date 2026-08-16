"""Create a consistent online SQLite backup."""
import argparse
import sqlite3
from datetime import datetime
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--source", type=Path, default=Path("data/meowney.db"))
parser.add_argument("--destination", type=Path, default=Path("backups") / f"meowney-{datetime.now():%Y%m%d-%H%M%S}.db")
args = parser.parse_args()
args.destination.parent.mkdir(parents=True, exist_ok=True)
with sqlite3.connect(args.source) as source, sqlite3.connect(args.destination) as destination:
    source.backup(destination)
print(args.destination)
