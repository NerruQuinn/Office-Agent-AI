from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import litellm
import json
import os
import io
import sys
import contextlib
import multiprocessing
import uuid
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

from storage import ensure_dirs, read_json, write_json, read_chat_history, write_chat_history, DATA_DIR, append_activity, read_activity_log, read_outputs, write_outputs, append_output
import time
from pathlib import Path
import asyncio
from datetime import timezone

ensure_dirs()

# Migrate old memories
old_memories = Path("memories.json")
if old_memories.exists() and not (DATA_DIR / "memories.json").exists():
    import json
    try:
        old_data = json.loads(old_memories.read_text(encoding="utf-8"))
        write_json("memories.json", old_data)
    except Exception:
        pass

# Startup log is called after log_activity is defined (see bottom of file)

# Ensure default agents exist
if not (DATA_DIR / "agents.json").exists():
    default_agents = [
        {
            "id": 1, "name": "Agent Smith", "role": "Productivity Lead", "status": "online",
            "promptSections": {
                "role": "asisten umum yang membantu berbagai tugas",
                "responsibilities": ["Menjawab pertanyaan user", "Membantu analisis data", "Membuat draft dokumen"],
                "constraints": ["Selalu konfirmasi sebelum edit/hapus file", "Jawab dalam bahasa yang sama dengan user", "Minta klarifikasi jika instruksi ambigu"],
                "outputFormat": "Jawab dengan ringkas dan jelas. Gunakan bullet points untuk list. Sertakan contoh jika diperlukan.",
                "exampleTasks": ["Buat ringkasan dari dokumen ini", "Jelaskan error ini", "Bantu saya draft email"]
            },
            "systemPrompt": "## Role\nKamu adalah Agent Smith, seorang asisten umum yang membantu berbagai tugas di Office Agent AI.\n\n## Responsibilities\n- Menjawab pertanyaan user\n- Membantu analisis data\n- Membuat draft dokumen\n\n## Capabilities\nSkills yang tersedia: File Manager, Code Execution, Search, API Tools\n\n## Constraints\n- Selalu konfirmasi sebelum edit/hapus file\n- Jawab dalam bahasa yang sama dengan user\n- Minta klarifikasi jika instruksi ambigu\n\n## Output Format\nJawab dengan ringkas dan jelas. Gunakan bullet points untuk list. Sertakan contoh jika diperlukan.\n\n## Example Tasks\n- Buat ringkasan dari dokumen ini\n- Jelaskan error ini\n- Bantu saya draft email"
        },
        {
            "id": 2, "name": "Agent Sarah", "role": "System Architect", "status": "away",
            "promptSections": {
                "role": "asisten umum yang membantu berbagai tugas",
                "responsibilities": ["Menjawab pertanyaan user", "Membantu analisis data", "Membuat draft dokumen"],
                "constraints": ["Selalu konfirmasi sebelum edit/hapus file", "Jawab dalam bahasa yang sama dengan user", "Minta klarifikasi jika instruksi ambigu"],
                "outputFormat": "Jawab dengan ringkas dan jelas. Gunakan bullet points untuk list. Sertakan contoh jika diperlukan.",
                "exampleTasks": ["Buat ringkasan dari dokumen ini", "Jelaskan error ini", "Bantu saya draft email"]
            },
            "systemPrompt": "## Role\nKamu adalah Agent Sarah, seorang asisten umum yang membantu berbagai tugas di Office Agent AI.\n\n## Responsibilities\n- Menjawab pertanyaan user\n- Membantu analisis data\n- Membuat draft dokumen\n\n## Capabilities\nSkills yang tersedia: File Manager, Code Execution, Search, API Tools\n\n## Constraints\n- Selalu konfirmasi sebelum edit/hapus file\n- Jawab dalam bahasa yang sama dengan user\n- Minta klarifikasi jika instruksi ambigu\n\n## Output Format\nJawab dengan ringkas dan jelas. Gunakan bullet points untuk list. Sertakan contoh jika diperlukan.\n\n## Example Tasks\n- Buat ringkasan dari dokumen ini\n- Jelaskan error ini\n- Bantu saya draft email"
        },
        {
            "id": 3, "name": "Agent Rex", "role": "Data Analyst", "status": "offline",
            "promptSections": {
                "role": "asisten umum yang membantu berbagai tugas",
                "responsibilities": ["Menjawab pertanyaan user", "Membantu analisis data", "Membuat draft dokumen"],
                "constraints": ["Selalu konfirmasi sebelum edit/hapus file", "Jawab dalam bahasa yang sama dengan user", "Minta klarifikasi jika instruksi ambigu"],
                "outputFormat": "Jawab dengan ringkas dan jelas. Gunakan bullet points untuk list. Sertakan contoh jika diperlukan.",
                "exampleTasks": ["Buat ringkasan dari dokumen ini", "Jelaskan error ini", "Bantu saya draft email"]
            },
            "systemPrompt": "## Role\nKamu adalah Agent Rex, seorang asisten umum yang membantu berbagai tugas di Office Agent AI.\n\n## Responsibilities\n- Menjawab pertanyaan user\n- Membantu analisis data\n- Membuat draft dokumen\n\n## Capabilities\nSkills yang tersedia: File Manager, Code Execution, Search, API Tools\n\n## Constraints\n- Selalu konfirmasi sebelum edit/hapus file\n- Jawab dalam bahasa yang sama dengan user\n- Minta klarifikasi jika instruksi ambigu\n\n## Output Format\nJawab dengan ringkas dan jelas. Gunakan bullet points untuk list. Sertakan contoh jika diperlukan.\n\n## Example Tasks\n- Buat ringkasan dari dokumen ini\n- Jelaskan error ini\n- Bantu saya draft email"
        },
        {
            "id": 4, "name": "Agent Maya", "role": "Security Lead", "status": "alert",
            "promptSections": {
                "role": "asisten umum yang membantu berbagai tugas",
                "responsibilities": ["Menjawab pertanyaan user", "Membantu analisis data", "Membuat draft dokumen"],
                "constraints": ["Selalu konfirmasi sebelum edit/hapus file", "Jawab dalam bahasa yang sama dengan user", "Minta klarifikasi jika instruksi ambigu"],
                "outputFormat": "Jawab dengan ringkas dan jelas. Gunakan bullet points untuk list. Sertakan contoh jika diperlukan.",
                "exampleTasks": ["Buat ringkasan dari dokumen ini", "Jelaskan error ini", "Bantu saya draft email"]
            },
            "systemPrompt": "## Role\nKamu adalah Agent Maya, seorang asisten umum yang membantu berbagai tugas di Office Agent AI.\n\n## Responsibilities\n- Menjawab pertanyaan user\n- Membantu analisis data\n- Membuat draft dokumen\n\n## Capabilities\nSkills yang tersedia: File Manager, Code Execution, Search, API Tools\n\n## Constraints\n- Selalu konfirmasi sebelum edit/hapus file\n- Jawab dalam bahasa yang sama dengan user\n- Minta klarifikasi jika instruksi ambigu\n\n## Output Format\nJawab dengan ringkas dan jelas. Gunakan bullet points untuk list. Sertakan contoh jika diperlukan.\n\n## Example Tasks\n- Buat ringkasan dari dokumen ini\n- Jelaskan error ini\n- Bantu saya draft email"
        }
    ]
    write_json("agents.json", default_agents)



app = FastAPI(title="Office Agent AI Backend")

# --- WebSocket ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_text(json.dumps(message))

manager = ConnectionManager()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---
class ChatRequest(BaseModel):
    message: str
    model: str = "claude-sonnet-4-20250514"
    api_key: Optional[str] = None
    agent_name: str = "Assistant"
    agent_id: str = "global"
    system_prompt: str = "" 
    enabled_skills: list[str] = []

class MemoryCreate(BaseModel):
    title: str
    description: str
    content: str
    tags: list[str]
    agentId: str
    type: str

class MemoryUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[list[str]] = None
    agentId: Optional[str] = None
    type: Optional[str] = None
    isActive: Optional[bool] = None

class MemoryResponse(BaseModel):
    id: str
    title: str
    description: str
    content: str
    tags: list[str]
    agentId: str
    type: str
    size: str
    isActive: bool
    createdAt: str
    updatedAt: str


class ProviderConfig(BaseModel):
    apiKey: str = ""
    model: str = ""
    enabled: bool = False


class ActivityEvent(BaseModel):
    id: str = ""
    type: str
    agentId: str = "system"
    agentName: str = "System"
    action: str
    detail: str = ""
    timestamp: str = ""


class OutputBlock(BaseModel):
    id: str
    type: str
    agentId: str
    agentName: str
    title: str
    content: str
    fileType: str = ""
    status: str
    timestamp: str
    duration: float = 0

class ActivityCreate(BaseModel):
    type: str
    agentId: str = "system"
    agentName: str = "System"
    action: str
    detail: str = ""

class SettingsUpdate(BaseModel):
    providers: dict[str, ProviderConfig] = {}
    activeModel: str = ""
    darkMode: bool = False

class ModelConfig(BaseModel):
    provider: str
    model: str
    api_key: Optional[str] = None

# --- Available Models ---
AVAILABLE_MODELS = [
    { "provider": "Anthropic", "models": ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-haiku-4-5-20251001"] },
    { "provider": "OpenAI", "models": ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"] },
    { "provider": "Ollama (Local)", "models": ["ollama/llama3", "ollama/mistral", "ollama/phi3"] },
    { "provider": "Google", "models": ["gemini/gemini-2.0-flash", "gemini/gemini-1.5-pro"] },
]



def create_output_block(type: str, agent_id: str, agent_name: str, 
                         title: str, content: str, file_type: str = "",
                         status: str = "success", duration: float = 0) -> dict:
    block = {
        "id": str(uuid.uuid4()),
        "type": type,
        "agentId": agent_id,
        "agentName": agent_name,
        "title": title,
        "content": content,
        "fileType": file_type,
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "duration": duration
    }
    append_output(block)
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(manager.broadcast({"type": "output", "data": block}))
    except Exception:
        pass
    return block

def detect_file_type(skill_name: str, content: str) -> str:
    skill_map = {
        "Read CSV": "csv",
        "Edit JSON": "json", 
        "Run Shell": "shell",
        "Read File": "text",
        "Write File": "text",
        "List Directory": "shell"
    }
    if skill_name in skill_map:
        return skill_map[skill_name]
    try:
        import json
        json.loads(content)
        return "json"
    except Exception:
        pass
    if content.strip().startswith("#") or "**" in content:
        return "markdown"
    return "text"

def detect_skill_intent(message: str, enabled_skills: list[str]) -> str | None:
    msg_lower = message.lower()
    
    skill_patterns = {
        "Read File": ["baca file", "read file", "lihat file", "isi file", "tampilkan file"],
        "Write File": ["tulis file", "write file", "buat file", "simpan ke file", "edit file"],
        "Read CSV": ["baca csv", "read csv", "lihat csv", "data csv"],
        "Edit JSON": ["edit json", "ubah json", "tulis json", "update json"],
        "List Directory": ["lihat folder", "list directory", "lihat direktori", "daftar file", "isi folder", "ls"],
        "Run Shell": ["jalankan shell", "run shell", "jalankan command", "eksekusi perintah", "run script"]
    }
    
    for skill_name, patterns in skill_patterns.items():
        if skill_name in enabled_skills:
            if any(pattern in msg_lower for pattern in patterns):
                return skill_name
                
    return None

def log_activity(type: str, agent_id: str, agent_name: str, action: str, detail: str = ""):
    event = {
        "id": str(uuid.uuid4()),
        "type": type,
        "agentId": agent_id,
        "agentName": agent_name,
        "action": action,
        "detail": detail,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    append_activity(event)
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(manager.broadcast({"type": "activity", "data": event}))
    except Exception:
        pass
    return event

# --- Memory Storage Helpers ---




def calculate_size(content: str) -> str:
    size_bytes = len(content.encode('utf-8'))
    size_kb = size_bytes / 1024
    if size_kb < 0.1:
        return f"{size_bytes}B"
    return f"{round(size_kb, 1)}KB"

# --- Routes ---
@app.get("/")
def root():
    return { "status": "Office Agent AI Backend running" }


class SkillExecuteRequest(BaseModel):
    skill_id: int
    skill_name: str
    code: str
    parameters: dict

@app.get("/skills")
def get_skills():
    return {"status": "ok", "message": "Skills backend ready."}

def execute_skill_isolated(code: str, params: dict, result_queue):
    import io
    import sys
    import contextlib
    
    # Basic security filter
    if "os.system" in code or "rm -rf" in code or "subprocess" in code:
        result_queue.put({"success": False, "error": "Code contains forbidden functions."})
        return
        
    try:
        namespace = {}
        # We wrap in contextlib to catch stdout if needed, though mostly we rely on the function return
        stdout = io.StringIO()
        with contextlib.redirect_stdout(stdout):
            exec(code, namespace)
            
            # Find the function to call - assume it's the only defined function or matches a pattern
            import types
            funcs = [v for k, v in namespace.items() if isinstance(v, types.FunctionType)]
            if not funcs:
                result_queue.put({"success": False, "error": "No function defined in skill code."})
                return
                
            func = funcs[0]
            result = func(**params)
            
        result_queue.put({"success": True, "result": result, "stdout": stdout.getvalue()})
    except Exception as e:
        result_queue.put({"success": False, "error": str(e)})

@app.post("/skills/execute")
def execute_skill(req: SkillExecuteRequest):
    start_time = time.time()
    try:
        ctx = multiprocessing.get_context("spawn")
        queue = ctx.Queue()
        p = ctx.Process(target=execute_skill_isolated, args=(req.code, req.parameters, queue))
        p.start()
        p.join(timeout=10)
        duration = round(time.time() - start_time, 2)

        if p.is_alive():
            p.terminate()
            p.join()
            log_activity("skill", "system", "System", f"Skill '{req.skill_name}' timeout", "Execution timed out (10s)")
            create_output_block(
                type="skill",
                agent_id="system",
                agent_name="System",
                title=f"{req.skill_name}",
                content="[ERROR] Execution timed out after 10 seconds.",
                file_type="text",
                status="error",
                duration=duration
            )
            return {"success": False, "error": "Execution timed out (10s limit)."}

        if not queue.empty():
            res = queue.get()
            success = res.get('success', False)
            # Build content: prefer stdout, else result, else error
            output_content = ""
            if res.get("stdout"):
                output_content = res["stdout"]
            elif res.get("result") is not None:
                import json as _json
                try:
                    output_content = _json.dumps(res["result"], indent=2, ensure_ascii=False)
                except Exception:
                    output_content = str(res["result"])
            elif res.get("error"):
                output_content = f"[ERROR] {res['error']}"
            else:
                output_content = str(res)

            file_type = detect_file_type(req.skill_name, output_content)
            log_activity("skill", "system", "System", f"Skill '{req.skill_name}' dieksekusi", f"Status: {'success' if success else 'failed'}")
            create_output_block(
                type="skill",
                agent_id="system",
                agent_name="System",
                title=req.skill_name,
                content=output_content,
                file_type=file_type,
                status="success" if success else "error",
                duration=duration
            )
            return {**res, "data": res}
        else:
            log_activity("skill", "system", "System", f"Skill '{req.skill_name}' dieksekusi", "Status: failed (unknown)")
            create_output_block(
                type="skill",
                agent_id="system",
                agent_name="System",
                title=req.skill_name,
                content="[ERROR] Unknown execution failure.",
                file_type="text",
                status="error",
                duration=duration
            )
            return {"success": False, "error": "Unknown execution failure."}
    except Exception as e:
        duration = round(time.time() - start_time, 2)
        log_activity("skill", "system", "System", f"Skill '{req.skill_name}' error", str(e))
        create_output_block(
            type="skill",
            agent_id="system",
            agent_name="System",
            title=req.skill_name,
            content=f"[ERROR] {str(e)}",
            file_type="text",
            status="error",
            duration=duration
        )
        return {"success": False, "error": str(e)}




@app.get("/outputs")
def get_outputs(limit: int = 50, type: Optional[str] = None, agentId: Optional[str] = None):
    log = read_outputs()
    if type and type != "all":
        log = [l for l in log if l.get("type") == type]
    if agentId and agentId != "all":
        log = [l for l in log if l.get("agentId") == agentId]
    return log[:limit]

@app.delete("/outputs")
def delete_all_outputs():
    write_outputs([])
    return {"success": True}

@app.delete("/outputs/{id}")
def delete_output(id: str):
    log = read_outputs()
    log = [l for l in log if l.get("id") != id]
    write_outputs(log)
    return {"success": True}

@app.get("/activity")
def get_activity(limit: int = 50, type: Optional[str] = None, agentId: Optional[str] = None):
    log = read_activity_log()
    if type and type != "all":
        log = [l for l in log if l.get("type") == type]
    if agentId and agentId != "all":
        log = [l for l in log if l.get("agentId") == agentId]
    return log[:limit]

@app.post("/activity")
def create_activity(req: ActivityCreate):
    return log_activity(req.type, req.agentId, req.agentName, req.action, req.detail)

@app.delete("/activity")
def delete_activity():
    from storage import write_activity_log
    write_activity_log([])
    return {"success": True}

@app.get("/settings")
def get_settings():
    default_settings = {"providers": {}, "activeModel": "", "darkMode": False}
    return read_json("settings.json", default=default_settings)

@app.post("/settings")
def update_settings(req: SettingsUpdate):
    current = read_json("settings.json", default={"providers": {}, "activeModel": "", "darkMode": False})
    # Merge providers
    current["activeModel"] = req.activeModel
    current["darkMode"] = req.darkMode
    for provider, config in req.providers.items():
        if "providers" not in current:
            current["providers"] = {}
        current["providers"][provider] = config.dict()
    write_json("settings.json", current)
    return current

@app.get("/agents")
def get_agents():
    return read_json("agents.json", default=[])

@app.post("/agents")
def create_agent(req: dict):
    agents = read_json("agents.json", default=[])
    agents.append(req)
    write_json("agents.json", agents)
    log_activity("agent", str(req.get("id")), req.get("name"), f"Agent '{req.get('name')}' ditambahkan", f"Role: {req.get('role')}")
    return req

@app.put("/agents/{id}")
def update_agent(id: int, req: dict):
    agents = read_json("agents.json", default=[])
    for i, a in enumerate(agents):
        if str(a.get("id")) == str(id):
            agents[i] = req
            write_json("agents.json", agents)
            log_activity("agent", str(id), req.get("name"), f"Agent '{req.get('name')}' diperbarui", "")
            return req
    return {"error": "Not found"}

@app.delete("/agents/{id}")
def delete_agent(id: int):
    agents = read_json("agents.json", default=[])
    existing = next((a for a in agents if str(a.get("id")) == str(id)), None)
    if existing:
        log_activity("agent", str(id), existing.get("name"), f"Agent '{existing.get('name')}' dihapus", "")
    agents = [a for a in agents if str(a.get("id")) != str(id)]
    write_json("agents.json", agents)
    return {"success": True}

@app.get("/agents/{agent_id}/history")
def get_agent_history(agent_id: str):
    return read_chat_history(agent_id)

@app.delete("/agents/{agent_id}/history")
def clear_agent_history(agent_id: str):
    write_chat_history(agent_id, [])
    return {"success": True}


@app.get("/models")
def get_models():
    return AVAILABLE_MODELS

@app.get("/memories")
def get_memories(agentId: Optional[str] = None, type: Optional[str] = None, isActive: Optional[bool] = None):
    memories = read_json("memories.json")
    if agentId is not None and agentId != "all":
        memories = [m for m in memories if m.get("agentId") == agentId]
    if type is not None and type != "all":
        memories = [m for m in memories if m.get("type") == type]
    if isActive is not None:
        memories = [m for m in memories if m.get("isActive") == isActive]
    return memories

@app.get("/memories/{id}")
def get_memory(id: str):
    memories = read_json("memories.json")
    for m in memories:
        if m.get("id") == id:
            return m
    return {"error": "Not found"}

@app.post("/memories")
def create_memory(req: MemoryCreate):
    memories = read_json("memories.json")
    now = datetime.utcnow().isoformat() + "Z"
    new_memory = {
        "id": str(uuid.uuid4()),
        "title": req.title,
        "description": req.description,
        "content": req.content,
        "tags": req.tags,
        "agentId": req.agentId,
        "type": req.type,
        "size": calculate_size(req.content),
        "isActive": True,
        "createdAt": now,
        "updatedAt": now
    }
    memories.append(new_memory)
    write_json("memories.json", memories)
    log_activity("memory", "system", "System", f"Memory '{req.title}' ditambahkan", f"Type: {req.type}")
    return new_memory

@app.put("/memories/{id}")
def update_memory(id: str, req: MemoryUpdate):
    memories = read_json("memories.json")
    for m in memories:
        if m.get("id") == id:
            update_data = req.dict(exclude_unset=True)
            m.update(update_data)
            if "content" in update_data:
                m["size"] = calculate_size(m["content"])
            m["updatedAt"] = datetime.utcnow().isoformat() + "Z"
            write_json("memories.json", memories)
            return m
    return {"error": "Not found"}

@app.delete("/memories/{id}")
def delete_memory(id: str):
    memories = read_json("memories.json")
    existing = next((m for m in memories if m.get("id") == id), None)
    if existing:
        log_activity("memory", "system", "System", f"Memory '{existing.get('title')}' dihapus", "")
    memories = [m for m in memories if m.get("id") != id]
    write_json("memories.json", memories)
    return {"success": True}

@app.patch("/memories/{id}/toggle")
def toggle_memory(id: str):
    memories = read_json("memories.json")
    for m in memories:
        if m.get("id") == id:
            m["isActive"] = not m.get("isActive", True)
            m["updatedAt"] = datetime.utcnow().isoformat() + "Z"
            write_json("memories.json", memories)
            return m
    return {"error": "Not found"}


class CommandRequest(BaseModel):
    command: str
    args: str = ""
    agent_id: str = "global"
    agent_name: str = "Assistant"
    api_key: str = ""
    model: str = ""

@app.post("/command")
async def handle_command(request: CommandRequest):
    responses = {
        "/gather": "[Mock] Mengumpulkan informasi tentang: " + request.args,
        "/report": "[Mock] Membuat laporan: " + request.args + ". Laporan akan muncul di OUTPUT tab.",
        "/summarize": "[Mock] Meringkas: " + request.args,
        "/search": "[Mock] Mencari: " + request.args + " di knowledge base.",
        "/run": "[Mock] Menjalankan skill: " + request.args,
    }
    response_text = responses.get(request.command, "[Mock] Perintah " + request.command + " dijalankan.")
    log_activity("skill", request.agent_id, request.agent_name, f"Command {request.command} dijalankan", request.args)
    return {"response": response_text, "command": request.command, "status": "success"}

@app.post("/chat")
async def chat(req: ChatRequest):
    try:
        if req.api_key:
            if "claude" in req.model:
                os.environ["ANTHROPIC_API_KEY"] = req.api_key
            elif "gpt" in req.model:
                os.environ["OPENAI_API_KEY"] = req.api_key
            elif "gemini" in req.model:
                os.environ["GEMINI_API_KEY"] = req.api_key

        memories = read_json("memories.json")
        active_memories = [m for m in memories if m.get("isActive") and m.get("agentId") in ("global", req.agent_name)]
        active_memories.sort(key=lambda x: x.get("updatedAt", ""), reverse=True)
        
        priority_map = {"instructions": 0, "context": 1, "docs": 2, "custom": 3}
        active_memories.sort(key=lambda x: priority_map.get(x.get("type", "custom"), 4))
        
        top_memories = active_memories[:5]
        memory_context = ""
        if top_memories:
            memory_context = "\n--- MEMORY CONTEXT ---\n"
            for m in top_memories:
                memory_context += f"[{m.get('title')} - {str(m.get('type')).upper()}]\n{m.get('content')}\n\n"

        history = read_chat_history(req.agent_id)
        recent = history[-20:] if len(history) > 20 else history
        
        messages = []
        if req.system_prompt:
            messages.append({ "role": "system", "content": req.system_prompt + memory_context })
        else:
            messages.append({ "role": "system", "content": f"You are {req.agent_name}, an AI assistant in the Office Agent AI system." + memory_context })
        
        messages.extend(recent)
        messages.append({ "role": "user", "content": req.message })

        detected_skill = detect_skill_intent(req.message, req.enabled_skills)

        response = await litellm.acompletion(
            model=req.model,
            messages=messages,
        )
        
        reply = response.choices[0].message.content
        history.append({"role": "user", "content": req.message})
        history.append({"role": "assistant", "content": reply})
        write_chat_history(req.agent_id, history)
        
        log_activity("chat", req.agent_id, req.agent_name, f"Chat dengan {req.agent_name}", req.message[:80])
        
        return {
            "success": True,
            "response": reply,
            "model": req.model,
            "agent": req.agent_name,
            "skill_detected": detected_skill
        }
    except Exception as e:
        return { "success": False, "error": str(e) }



@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            await manager.broadcast({
                "type": "agent_action",
                "agent": payload.get("agent", "System"),
                "message": payload.get("message", ""),
            })
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.on_event("startup")
async def on_startup():
    log_activity("system", "system", "System", "Office Agent AI started", "Backend online")
