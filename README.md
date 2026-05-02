<div align="center">
  
# 🏢 Office Agent AI

**Desktop AI Agent Manager** powered by Multi-Agent System and 2.5D Isometric Visualization.

[![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tauri](https://img.shields.io/badge/Tauri-24C8DB?style=flat&logo=tauri&logoColor=white)](https://tauri.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

**Office Agent AI** is a next-generation desktop application designed to orchestrate and manage autonomous AI agents. Built with a sleek interface, real-time WebSocket communication, and an interactive 2.5D isometric virtual office representation, it brings your AI workforce to life.

<br/>

## 📸 Overview

> *Screenshot placeholder: Dashboard & Isometric Office view goes here.*
>
> *(Replace this block with an actual screenshot or GIF demonstrating the 2.5D grid and chat interface)*

<br/>

## ✨ Features

- 🕵️ **Multi-Agent Orchestration**: Manage multiple distinct AI agents, each with customizable roles, templates, and personalities.
- 🎮 **2.5D Isometric Virtual Office**: Visually monitor agent activities and placements in an interactive isometric canvas powered by Phaser.js.
- ⚡ **Real-Time Execution**: Instantaneous synchronization and command execution via highly optimized WebSocket connections.
- 🛠️ **Skill Execution Engine**: Equip agents with diverse capabilities and let them autonomously execute tasks using built-in skills.
- 🧠 **Persistent Memory & Knowledge Base**: Retain conversation context and build a dynamic knowledge graph for long-term agent retention.
- 🔌 **Universal LLM Support**: Native support for OpenAI, Gemini, OpenRouter, and more, seamlessly integrated via LiteLLM.

<br/>

## 💻 Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend UI** | React + Vite | High-performance user interface |
| **Styling** | Tailwind CSS v4 + Framer Motion | Modern, utility-first styling with fluid animations |
| **Canvas & Rendering** | Phaser.js | 2.5D isometric grid and entity rendering |
| **Desktop App** | Tauri v2 | Lightweight, native desktop application shell |
| **Backend API** | FastAPI (Python 3.12) | Lightning-fast async API and WebSocket server |
| **AI Integration** | LiteLLM | Unified interface for multiple LLM providers |

<br/>

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or higher recommended)
- **Python 3.12**
- **Rust** (Required for compiling Tauri v2)

### 1. Clone the Repository

```bash
git clone https://github.com/NerruQuinn/Office-Agent-AI.git
cd Office-Agent-AI
```

### 2. Backend Setup

Initialize the Python environment and run the backend server.

```bash
cd backend
# Install required packages (ensure you use Python 3.12)
py -3.12 -m pip install -r requirements.txt --break-system-packages

# Start the FastAPI & WebSocket server
py -3.12 run.py
```
*The backend will be available at `http://localhost:8000`*

### 3. Frontend & Desktop App Setup

Open a new terminal window at the project root to run the frontend.

```bash
# Install Node.js dependencies
npm install

# Option A: Run as a Web App
npm run dev

# Option B: Run as a Native Desktop App (Tauri)
npm run tauri dev
```

<br/>

## 📁 Project Structure

```text
office-agent-ai/
├── backend/                  # Python FastAPI Backend
│   ├── main.py               # Core API & WebSocket logic
│   ├── storage.py            # Local JSON data management
│   ├── run.py                # Backend server entry point
│   └── data/                 # Persistent storage (Agents, Memories, Settings)
├── src/                      # React Frontend Source
│   ├── App.tsx               # Main application component & layout
│   ├── index.css             # Tailwind CSS & custom styles
│   └── game/                 # Phaser.js Isometric implementation
│       ├── OfficeScene.ts    # 2.5D game scene logic
│       └── PhaserGame.tsx    # React wrapper for canvas
├── src-tauri/                # Rust Native Desktop configuration
└── package.json              # Node.js scripts & dependencies
```

<br/>

## 🗺️ Roadmap

- [ ] **"Click-to-Place" Agent Initialization**: Spawn new agents directly on the isometric grid.
- [ ] **Advanced Skill Crafting**: UI for creating custom Python-based skills dynamically.
- [ ] **Agent-to-Agent Collaboration**: Enable agents to delegate tasks and communicate directly with each other.
- [ ] **Analytics Dashboard**: Comprehensive metrics on token usage, execution time, and task success rates.
- [ ] **Custom Office Themes**: Unlockable aesthetics and environments for the isometric office.

<br/>

## 🤝 Contributing

We welcome contributions! Whether you're fixing bugs, improving documentation, or proposing new features, please feel free to open an Issue or submit a Pull Request. 

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
