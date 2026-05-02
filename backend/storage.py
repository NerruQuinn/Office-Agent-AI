import json
import os
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
CHAT_DIR = DATA_DIR / "chat_history"

def ensure_dirs():
    DATA_DIR.mkdir(exist_ok=True)
    CHAT_DIR.mkdir(exist_ok=True)

def read_json(filename: str, default=None):
    path = DATA_DIR / filename
    if not path.exists():
        return default if default is not None else []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default if default is not None else []

def write_json(filename: str, data):
    path = DATA_DIR / filename
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

def read_chat_history(agent_id: str) -> list:
    path = CHAT_DIR / f"{agent_id}.json"
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []

def write_chat_history(agent_id: str, history: list):
    path = CHAT_DIR / f"{agent_id}.json"
    path.write_text(json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8")

def read_activity_log() -> list:
    return read_json("activity_log.json", default=[])

def write_activity_log(log: list):
    write_json("activity_log.json", log)

def append_activity(event: dict):
    log = read_activity_log()
    log.insert(0, event)
    if len(log) > 500:
        log = log[:500]
    write_activity_log(log)

def read_outputs() -> list:
    return read_json("outputs.json", default=[])

def write_outputs(outputs: list):
    write_json("outputs.json", outputs)

def append_output(output: dict):
    outputs = read_outputs()
    outputs.insert(0, output)
    if len(outputs) > 100:
        outputs = outputs[:100]
    write_outputs(outputs)


