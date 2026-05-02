import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, LayoutDashboard, Bot, Database, Settings, HelpCircle, FileText, Bell, Send, Paperclip, Mic, Terminal, X, Edit, Trash2, Zap, Save, BarChart2, Folder, Code2, Search, Sparkles, BookOpen, Wrench, AlertCircle, Activity, CheckSquare, Copy, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PhaserGame from './game/PhaserGame';

type Tab = 'Activity' | 'Output' | 'Chat';
type Page = 'dashboard' | 'agents' | 'skills' | 'memory' | 'settings';


export interface Memory {
  id: string
  title: string
  description: string
  content: string
  tags: string[]
  agentId: string
  type: 'context' | 'docs' | 'instructions' | 'custom'
  size: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type WsStatus = 'connected' | 'disconnected' | 'connecting';

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  agentId?: string;
  agentName?: string;
  content: string;
  timestamp: string;
  status: 'sending' | 'success' | 'error';
  type: 'chat' | 'command' | 'system_info';
}

export interface CommandDefinition {
  command: string;
  description: string;
  usage: string;
  requiresConfirm: boolean;
  targetable: boolean;
}

export interface ConfirmationState {
  show: boolean;
  title: string;
  description: string;
  agentName: string;
  agentId: string;
  payload: { message: string; command?: string; args?: string; };
}

export interface ParsedInput {
  raw: string;
  targetAgent: Agent | null;
  command: CommandDefinition | null;
  args: string;
  isCommand: boolean;
  requiresConfirm: boolean;
  confirmTitle: string;
  confirmDescription: string;
}

export const COMMANDS: CommandDefinition[] = [
  { command: '/gather', description: 'Kumpulkan info dari memory & knowledge base', usage: '/gather [topik]', requiresConfirm: true, targetable: true },
  { command: '/report', description: 'Generate laporan dari data yang tersedia', usage: '/report [judul laporan]', requiresConfirm: true, targetable: true },
  { command: '/summarize', description: 'Ringkas file atau dokumen', usage: '/summarize [nama file atau topik]', requiresConfirm: true, targetable: true },
  { command: '/search', description: 'Cari di memory & knowledge base', usage: '/search [kata kunci]', requiresConfirm: false, targetable: true },
  { command: '/run', description: 'Eksekusi skill tertentu', usage: '/run [nama skill] [parameter]', requiresConfirm: true, targetable: true },
  { command: '/clear', description: 'Hapus riwayat chat', usage: '/clear', requiresConfirm: false, targetable: false },
  { command: '/status', description: 'Tampilkan status semua agent', usage: '/status', requiresConfirm: false, targetable: false },
  { command: '/help', description: 'Tampilkan daftar semua perintah', usage: '/help', requiresConfirm: false, targetable: false },
];

export function parseInput(input: string, agents: Agent[]): ParsedInput {
  let remaining = input.trim();
  let targetAgent: Agent | null = null;
  let command: CommandDefinition | null = null;

  const mentionMatch = remaining.match(/^@(\S+)\s*/);
  if (mentionMatch) {
    const query = mentionMatch[1].toLowerCase();
    targetAgent = agents.find(a => a.name.toLowerCase().includes(query)) || null;
    remaining = remaining.slice(mentionMatch[0].length);
  }

  const cmdMatch = remaining.match(/^(\/\w+)\s*/);
  if (cmdMatch) {
    command = COMMANDS.find(c => c.command === cmdMatch[1]) || null;
    remaining = remaining.slice(cmdMatch[0].length);
  }

  const args = remaining.trim();
  const isCommand = command !== null;
  const requiresConfirm = (command?.requiresConfirm ?? false) || (targetAgent !== null && !isCommand);

  const agentLabel = targetAgent?.name || 'Agent';
  const confirmTitle = targetAgent ? `Konfirmasi Perintah ke ${agentLabel}` : 'Konfirmasi Perintah';
  const confirmDescription = isCommand
    ? `${agentLabel} akan menjalankan ${command!.command}${args ? ` dengan parameter: "${args}"` : ''}.`
    : `${agentLabel} akan memproses: "${input}"`;

  return { raw: input, targetAgent, command, args, isCommand, requiresConfirm, confirmTitle, confirmDescription };
}


export interface OutputBlock {
  id: string;
  type: 'skill' | 'task' | 'file_preview' | 'report' | string;
  agentId: string;
  agentName: string;
  title: string;
  content: string;
  fileType: 'text' | 'csv' | 'json' | 'markdown' | 'shell' | '' | string;
  status: 'success' | 'error' | 'running' | string;
  timestamp: string;
  duration: number;
}

export interface ActivityEvent {
  id: string;
  type: 'chat' | 'memory' | 'agent' | 'skill' | 'system';
  agentId: string;
  agentName: string;
  action: string;
  detail: string;
  timestamp: string;
}

export function useWebSocket(url: string, onMessage: (data: any) => void) {
  const [wsStatus, setWsStatus] = useState<WsStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    setWsStatus('connecting');
    const ws = new WebSocket(url);

    ws.onopen = () => setWsStatus('connected');
    ws.onclose = () => {
      setWsStatus('disconnected');
      setTimeout(connect, 3000);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (err) {
        console.error("Failed to parse WS message", err);
      }
    };

    wsRef.current = ws;
  }, [url, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((agent: string, message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ agent, message }));
    }
  }, []);

  return { wsStatus, sendMessage };
}


export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'file';
  description: string;
  required: boolean;
}

export interface Skill {
  id: number;
  name: string;
  description: string;
  category: 'file' | 'data' | 'shell' | 'web' | 'custom';
  iconName: string;
  isBuiltin: boolean;
  isActive: boolean;
  code: string;
  parameters: SkillParameter[];
}

export const BUILTIN_SKILLS: Skill[] = [
  {
    id: 1, name: 'Read File', description: 'Baca konten file dari sistem',
    category: 'file', iconName: 'FileText', isBuiltin: true, isActive: true,
    code: 'def read_file(path: str):\n    with open(path, "r") as f:\n        return f.read()',
    parameters: [{ name: 'path', type: 'string', description: 'Path file', required: true }]
  },
  {
    id: 2, name: 'Write File', description: 'Tulis konten ke file',
    category: 'file', iconName: 'Save', isBuiltin: true, isActive: true,
    code: 'def write_file(path: str, content: str):\n    with open(path, "w") as f:\n        f.write(content)',
    parameters: [
      { name: 'path', type: 'string', description: 'Path file', required: true },
      { name: 'content', type: 'string', description: 'Konten', required: true }
    ]
  },
  {
    id: 3, name: 'Read CSV', description: 'Baca dan parse file CSV',
    category: 'data', iconName: 'BarChart2', isBuiltin: true, isActive: true,
    code: 'import pandas as pd\ndef read_csv(path: str):\n    df = pd.read_csv(path)\n    return df.to_json()',
    parameters: [{ name: 'path', type: 'string', description: 'Path CSV', required: true }]
  },
  {
    id: 4, name: 'Edit JSON', description: 'Baca, edit, dan simpan file JSON',
    category: 'data', iconName: 'Wrench', isBuiltin: true, isActive: true,
    code: 'import json\ndef edit_json(path: str, key: str, value: str):\n    with open(path) as f:\n        data = json.load(f)\n    data[key] = value\n    with open(path, "w") as f:\n        json.dump(data, f)',
    parameters: [
      { name: 'path', type: 'string', description: 'Path JSON', required: true },
      { name: 'key', type: 'string', description: 'Key yang diedit', required: true },
      { name: 'value', type: 'string', description: 'Value baru', required: true }
    ]
  },
  {
    id: 5, name: 'Run Shell', description: 'Eksekusi shell command',
    category: 'shell', iconName: 'Terminal', isBuiltin: true, isActive: true,
    code: 'import subprocess\ndef run_shell(command: str):\n    result = subprocess.run(command, shell=True, capture_output=True, text=True)\n    return result.stdout',
    parameters: [{ name: 'command', type: 'string', description: 'Shell command', required: true }]
  },
  {
    id: 6, name: 'List Directory', description: 'List semua file dalam folder',
    category: 'file', iconName: 'Folder', isBuiltin: true, isActive: true,
    code: 'import os\ndef list_directory(path: str):\n    return os.listdir(path)',
    parameters: [{ name: 'path', type: 'string', description: 'Path folder', required: true }]
  },
];

export interface PromptSections {
  role: string;
  responsibilities: string[];
  constraints: string[];
  outputFormat: string;
  exampleTasks: string[];
}

export interface Agent {
  id: number;
  name: string;
  role: string;
  status: string;
  systemPrompt: string;
  promptSections: PromptSections;
  enabledSkills: string[];
}

const AgentAvatar = ({ name, size = 'md' }: { name: string, size?: 'sm' | 'md' | 'lg' }) => {
  const colors = ['bg-indigo-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-pink-500', 'bg-teal-500'];
  const colorIndex = name.charCodeAt(0) % colors.length;
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-16 h-16 text-xl' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sizeClass} ${colors[colorIndex]} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
};

interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
  agents: Agent[];
  onNewAgent: () => void;
}

const Sidebar = ({ activePage, setActivePage, agents, onNewAgent }: SidebarProps) => {
  return (
    <aside className="fixed left-0 top-0 w-[260px] h-full bg-slate-50 dark:bg-black border-r border-slate-200 dark:border-slate-700 flex flex-col z-20">
      <div className="p-4 mb-2 flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white">
          <Bot size={18} />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none">Office Agent AI</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">Enterprise Suite</div>
        </div>
      </div>

      <div className="px-3 mb-6">
        <button type="button" onClick={onNewAgent} className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-1.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-all active:scale-[0.98]">
          <Plus size={14} />
          <span>New Agent</span>
        </button>
      </div>

      <nav className="flex-1 px-2 space-y-0.5">
        {[
          { icon: <LayoutDashboard size={18} />, label: 'Dashboard', id: 'dashboard' },
          { icon: <Bot size={18} />, label: 'Agents', id: 'agents' },
          { icon: <Zap size={18} />, label: 'Skills', id: 'skills' },
          { icon: <Database size={18} />, label: 'Memory', id: 'memory' },
          { icon: <Settings size={18} />, label: 'Settings', id: 'settings' },
        ].map(({ icon, label, id }) => {
          const active = activePage === id;
          return (
            <div key={id} onClick={() => setActivePage(id as Page)} className={`px-3 py-1.5 flex items-center gap-2 cursor-pointer rounded transition-colors ${active ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 border-l-2 border-indigo-600' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}>
              {icon}
              <span className="text-[13px] font-medium">{label}</span>
            </div>
          );
        })}

        <div className="mt-8 mb-2 px-3 text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">Live Staff</div>
        <div className="space-y-1">
          {agents.map((s) => (
            <div key={s.id} className="group px-3 py-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 flex items-center gap-3">
              <div className="relative">
                <AgentAvatar name={s.name} size="sm" />
                <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-slate-50 dark:border-slate-900 rounded-full ${s.status === 'online' ? 'bg-emerald-500' : s.status === 'away' ? 'bg-amber-500' : s.status === 'alert' ? 'bg-red-500' : 'bg-slate-300'}`} />
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="text-xs font-semibold truncate text-slate-900 dark:text-slate-100">{s.name}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{s.role}</div>
              </div>
            </div>
          ))}
          <div onClick={onNewAgent} className="px-3 py-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 opacity-50 flex items-center gap-3 cursor-pointer hover:opacity-100 transition-opacity">
            <div className="w-8 h-8 rounded-full border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-300 dark:text-slate-500">
              <Plus size={14} />
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500">+ Add Agent</div>
          </div>
        </div>
      </nav>

      <div className="mt-auto p-4 border-t border-slate-200 dark:border-slate-700">
        <div className="px-3 py-1.5 text-slate-600 dark:text-slate-300 flex items-center gap-2 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded text-xs font-medium">
          <HelpCircle size={16} /><span>Support</span>
        </div>
        <div className="px-3 py-1.5 text-slate-600 dark:text-slate-300 flex items-center gap-2 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded text-xs font-medium">
          <FileText size={16} /><span>Docs</span>
        </div>
      </div>
    </aside>
  );
};

interface RightPanelProps {
  chatMessages: ChatMessage[];
  agents: Agent[];
  isLoading: boolean;
  onSendMessage: (msg: string) => void;
  onClearHistory: () => void;
  activityLogs: ActivityEvent[];
  loadingLog: boolean;
  filterType: string;
  setFilterType: (type: string) => void;
  onClearActivityLog: () => void;
  outputs: OutputBlock[];
  loadingOutputs: boolean;
  expandedOutputs: Set<string>;
  toggleExpandOutput: (id: string) => void;
  onClearOutputs: () => void;
  onDeleteOutput: (id: string) => void;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}


const getRelativeTime = (isoString: string) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} menit lalu`;
  
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();
  
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return timeStr;
  if (isYesterday) return `Kemarin ${timeStr}`;
  
  const day = date.getDate();
  const month = date.toLocaleString('id-ID', { month: 'short' });
  return `${day} ${month} ${timeStr}`;
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'chat': return 'bg-blue-500';
    case 'memory': return 'bg-purple-500';
    case 'agent': return 'bg-green-500';
    case 'skill': return 'bg-amber-500';
    default: return 'bg-slate-500';
  }
};

const RightPanel = ({ chatMessages, isLoading, onSendMessage, activityLogs, onClearHistory, loadingLog, filterType, setFilterType, outputs, loadingOutputs, expandedOutputs, toggleExpandOutput, onClearOutputs, onDeleteOutput, activeTab, setActiveTab, agents }: RightPanelProps) => {
  const [inputValue, setInputValue] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteType, setAutocompleteType] = useState<'agent' | 'command' | null>(null);
  const [autocompleteFilter, setAutocompleteFilter] = useState('');
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const activityTopRef = useRef<HTMLDivElement>(null);
  const outputTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'Chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (activeTab === 'Activity') {
      activityTopRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (activeTab === 'Output') {
      outputTopRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activityLogs, outputs, isLoading, activeTab]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 100)}px`;
    }
  }, [inputValue]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && confirmation) {
        setConfirmation(null);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [confirmation]);

  const renderJson = (jsonStr: string) => {
    try {
      const obj = JSON.parse(jsonStr);
      const pretty = JSON.stringify(obj, null, 2);
      const lines = pretty.split('\n').map((line) => {
        let out = line
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        out = out.replace(/^(\s*)("(?:[^"\\]|\\.)*")(\s*:)/,
          '$1<span class="text-blue-400">$2</span>$3');
        out = out.replace(/:\s*("(?:[^"\\]|\\.)*")/,
          (m, v) => m.replace(v, `<span class="text-green-400">${v}</span>`));
        out = out.replace(/:\s*(true|false)\b/,
          (m, v) => m.replace(v, `<span class="text-purple-400">${v}</span>`));
        out = out.replace(/:\s*(null)\b/,
          (m, v) => m.replace(v, `<span class="text-gray-400">${v}</span>`));
        out = out.replace(/:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/,
          (m, v) => m.replace(v, `<span class="text-yellow-400">${v}</span>`));
        return out;
      });
      const html = lines.join('\n');
      return <pre className="font-mono text-xs bg-slate-900 text-slate-300 p-3 rounded overflow-auto max-h-64 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: html }} />;
    } catch {
      return <pre className="font-mono text-xs bg-slate-900 text-green-400 p-3 rounded overflow-auto max-h-64 whitespace-pre-wrap">{jsonStr}</pre>;
    }
  };

  const renderCsv = (csvStr: string) => {
    const lines = csvStr.split('\n').filter(l => l.trim() !== '');
    if (lines.length === 0) return <div>Empty CSV</div>;
    const header = lines[0].split(',');
    const rows = lines.slice(1, 11).map(l => l.split(','));
    const remaining = lines.length - 11;
    return (
      <div className="overflow-x-auto max-h-64 rounded border border-slate-700">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="text-xs uppercase bg-slate-700 text-slate-200">
            <tr>{header.map((h, i) => <th key={i} className="px-3 py-2">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="bg-slate-800 border-b border-slate-700 hover:bg-slate-700">
                {row.map((cell, j) => <td key={j} className="px-3 py-2">{cell}</td>)}
              </tr>
            ))}
            {remaining > 0 && (
              <tr className="bg-slate-800"><td colSpan={header.length} className="px-3 py-2 text-center text-slate-500 italic">... {remaining} baris lainnya</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderMarkdown = (mdStr: string) => {
    const lines = mdStr.split('\n').map((line, i) => {
      let l = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      if (l.startsWith('# ')) return <h1 key={i} className="text-lg font-bold mt-2" dangerouslySetInnerHTML={{__html: l.substring(2)}} />;
      if (l.startsWith('## ')) return <h2 key={i} className="text-md font-bold mt-2" dangerouslySetInnerHTML={{__html: l.substring(3)}} />;
      if (l.startsWith('- ')) return <li key={i} className="ml-4 list-disc" dangerouslySetInnerHTML={{__html: l.substring(2)}} />;
      return <div key={i} dangerouslySetInnerHTML={{__html: l || '&nbsp;'}} />;
    });
    return <div className="text-sm text-slate-300 space-y-1 p-2">{lines}</div>;
  };

  const executeCommand = async (command: string, args: string, agentName: string, agentId: string) => {
    try {
      await fetch('http://localhost:8000/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          args,
          agent_name: agentName,
          agent_id: agentId,
          api_key: '', 
          model: ''
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const processMessage = (command?: string, args?: string, agentName?: string, agentId?: string, raw?: string) => {
    if (command) {
      executeCommand(command, args || '', agentName || '', agentId || '');
      onSendMessage(raw || inputValue);
    } else {
      onSendMessage(raw || inputValue);
    }
    setInputValue('');
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const parsed = parseInput(inputValue, agents);
    if (parsed.requiresConfirm) {
      setConfirmation({
        show: true,
        title: parsed.confirmTitle,
        description: parsed.confirmDescription,
        agentName: parsed.targetAgent?.name || 'System',
        agentId: parsed.targetAgent?.id.toString() || 'system',
        payload: {
          message: inputValue,
          command: parsed.command?.command,
          args: parsed.args
        }
      });
      return;
    }

    processMessage(parsed.command?.command, parsed.args, parsed.targetAgent?.name || 'System', parsed.targetAgent?.id.toString() || 'system', inputValue);
  };

  const handleAutocompleteSelect = (selected: Agent | CommandDefinition) => {
    let newVal = inputValue;
    if (autocompleteType === 'agent') {
      newVal = inputValue.replace(/@\w*$/, `@${(selected as Agent).name} `);
    } else {
      newVal = inputValue.replace(/^\/\w*$/, `${(selected as CommandDefinition).command} `);
    }
    setInputValue(newVal);
    setShowAutocomplete(false);
    textareaRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputValue(val);
    
    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    const commandMatch = textBeforeCursor.match(/^\/(\w*)$/);

    if (mentionMatch) {
      setShowAutocomplete(true);
      setAutocompleteType('agent');
      setAutocompleteFilter(mentionMatch[1]);
      setAutocompleteIndex(0);
    } else if (commandMatch) {
      setShowAutocomplete(true);
      setAutocompleteType('command');
      setAutocompleteFilter(commandMatch[1]);
      setAutocompleteIndex(0);
    } else {
      setShowAutocomplete(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAutocomplete) {
      const list = autocompleteType === 'agent' 
        ? agents.filter(a => a.name.toLowerCase().includes(autocompleteFilter.toLowerCase()))
        : COMMANDS.filter(c => c.command.includes(autocompleteFilter.toLowerCase()));
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocompleteIndex((prev) => (prev + 1) % list.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocompleteIndex((prev) => (prev - 1 + list.length) % list.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (list.length > 0) {
          handleAutocompleteSelect(list[autocompleteIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        setShowAutocomplete(false);
        return;
      }
    }

    if (e.key === 'Enter') {
      if (e.shiftKey) {
        return;
      } else if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        handleSend();
      } else {
        e.preventDefault();
        handleSend();
      }
    }
  };

  const renderAutocomplete = () => {
    if (!showAutocomplete) return null;
    const list = autocompleteType === 'agent' 
      ? agents.filter(a => a.name.toLowerCase().includes(autocompleteFilter.toLowerCase()))
      : COMMANDS.filter(c => c.command.includes(autocompleteFilter.toLowerCase()));

    if (list.length === 0) return null;

    return (
      <div className="absolute bottom-[calc(100%+8px)] left-0 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-40 overflow-hidden">
        <div className="py-1 max-h-48 overflow-y-auto">
          {list.map((item, idx) => {
            const isSelected = idx === autocompleteIndex;
            if (autocompleteType === 'agent') {
              const agent = item as Agent;
              return (
                <div key={agent.id} className={`px-3 py-2 cursor-pointer flex items-center gap-2 ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                  onMouseEnter={() => setAutocompleteIndex(idx)}
                  onClick={() => handleAutocompleteSelect(item)}>
                  <AgentAvatar name={agent.name} size="sm" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{agent.name}</span>
                    <span className="text-[10px] text-slate-500">{agent.role}</span>
                  </div>
                </div>
              );
            } else {
              const cmd = item as CommandDefinition;
              return (
                <div key={cmd.command} className={`px-3 py-2 cursor-pointer flex flex-col ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                  onMouseEnter={() => setAutocompleteIndex(idx)}
                  onClick={() => handleAutocompleteSelect(item)}>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{cmd.command}</span>
                  <span className="text-[10px] text-slate-500">{cmd.description}</span>
                </div>
              );
            }
          })}
        </div>
      </div>
    );
  };

  return (
    <aside className="fixed right-0 top-0 w-[320px] h-full bg-white dark:bg-black border-l border-slate-200 dark:border-slate-700 flex flex-col z-20">
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        {(['Activity', 'Output', 'Chat'] as Tab[]).map((tab) => (
          <button type="button" key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-wider transition-colors ${activeTab === tab ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            {tab === 'Activity' ? 'Activity Log' : tab}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'Activity' && (
          <div className="flex flex-col h-full">
            <div className="flex flex-wrap gap-1.5 mb-4 items-center justify-between">
              <div className="flex flex-wrap gap-1.5">
                {['all', 'chat', 'memory', 'agent', 'skill', 'system'].map(t => (
                  <button type="button" key={t} onClick={(e) => { e.stopPropagation(); setFilterType(t); }} className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-medium transition-colors ${filterType === t ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-zinc-900 dark:text-slate-400 dark:hover:bg-slate-700'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 pb-10">
              <div ref={activityTopRef} />
              {loadingLog ? (
                <div className="space-y-6 pl-6 relative border-l border-slate-100 dark:border-slate-800">
                  {[1,2,3].map(i => (
                    <div key={i} className="relative animate-pulse">
                      <span className="absolute -left-[29px] top-1 w-2 h-2 rounded-full bg-slate-200 dark:bg-zinc-800 border-2 border-white dark:border-slate-900" />
                      <div className="h-3 w-16 bg-slate-200 dark:bg-zinc-800 rounded mb-2"></div>
                      <div className="h-4 w-3/4 bg-slate-200 dark:bg-zinc-800 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 opacity-30">
                  <Activity size={32} className="text-slate-400 mb-2" />
                  <span className="text-xs text-slate-500">Belum ada aktivitas</span>
                </div>
              ) : (
                <div className="relative border-l border-slate-100 dark:border-slate-800 space-y-6 pl-6">
                  {activityLogs.filter(a => filterType === 'all' || a.type === filterType).map((item) => (
                    <div key={item.id} className="relative">
                      <span className={`absolute -left-[29px] top-1 w-2 h-2 rounded-full ${getTypeColor(item.type)} border-2 border-white dark:border-slate-900`} />
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{item.type}</span>
                        <span className="text-[10px] text-slate-400">&bull;</span>
                        <span className="text-[10px] text-slate-400 font-medium">{getRelativeTime(item.timestamp)}</span>
                      </div>
                      <div className="text-[13px] text-slate-700 dark:text-slate-300 font-medium">{item.action}</div>
                      {item.detail && <div className="text-[12px] mt-1 text-slate-500 dark:text-slate-400 opacity-80 leading-snug">{item.detail}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'Output' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Output</span>
                {outputs.length > 0 && <span className="text-[10px] bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">{outputs.length}</span>}
              </div>
              <button type="button" onClick={(e) => { e.stopPropagation(); onClearOutputs(); }} className="text-[10px] flex items-center gap-1 text-rose-500 hover:text-rose-600 transition-colors font-medium">
                <Trash2 size={10} /> Clear All
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 pb-10 space-y-4">
              <div ref={outputTopRef} />
              {loadingOutputs ? (
                <div className="animate-pulse space-y-4">
                  {[1,2].map(i => <div key={i} className="h-20 bg-slate-100 dark:bg-zinc-900 rounded-lg"></div>)}
                </div>
              ) : outputs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 opacity-30 mt-10">
                  <Terminal size={48} className="text-slate-400 mb-4" />
                  <span className="text-sm text-slate-500 font-medium">Belum ada output</span>
                  <span className="text-xs text-slate-400 mt-1 text-center">Eksekusi skill atau jalankan task<br/>untuk melihat hasilnya</span>
                </div>
              ) : (
                outputs.map(out => {
                  const isExpanded = expandedOutputs.has(out.id);
                  let StatusIcon = CheckSquare;
                  if (out.type === 'skill') StatusIcon = Wrench;
                  else if (out.type === 'report') StatusIcon = BarChart2;
                  else if (out.type === 'file_preview') StatusIcon = FileText;

                  return (
                    <div key={out.id} className="bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm">
                      <div 
                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        onClick={() => toggleExpandOutput(out.id)}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <StatusIcon size={14} className="text-slate-400 shrink-0" />
                          <div className="flex flex-col truncate">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{out.title}</span>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                              <span className="font-medium text-slate-600 dark:text-slate-400">{out.agentName}</span>
                              <span>&bull;</span>
                              <span>{getRelativeTime(out.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          {out.duration > 0 && <span className="text-[10px] text-slate-400 font-mono">{out.duration}s</span>}
                          {out.status === 'success' && <span className="w-2 h-2 rounded-full bg-emerald-500" title="Success" />}
                          {out.status === 'error' && <span className="w-2 h-2 rounded-full bg-rose-500" title="Error" />}
                          {out.status === 'running' && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Running..." />}
                          <button type="button" className="text-slate-400 hover:text-slate-600">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-3 pt-0 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-black/50 relative group">
                          <div className="absolute right-4 top-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(out.content); }} className="p-1 text-slate-400 hover:text-white bg-slate-800 rounded" title="Copy">
                              <Copy size={12} />
                            </button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); onDeleteOutput(out.id); }} className="p-1 text-rose-400 hover:text-white bg-slate-800 rounded" title="Delete">
                              <X size={12} />
                            </button>
                          </div>
                          <div className="mt-2">
                            {out.fileType === 'json' ? renderJson(out.content) :
                             out.fileType === 'csv' ? renderCsv(out.content) :
                             out.fileType === 'markdown' ? renderMarkdown(out.content) :
                             <pre className="font-mono text-[11px] bg-slate-900 text-green-400 p-3 rounded overflow-auto max-h-64 whitespace-pre-wrap">{out.content}</pre>
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'Chat' && (
          <div className="space-y-4 flex flex-col h-full relative">
            <div className="flex justify-end mb-2 sticky top-0 z-10 bg-white/80 dark:bg-black/80 py-1 backdrop-blur-sm">
              <button type="button" onClick={(e) => { e.stopPropagation(); onClearHistory(); }} className="text-xs flex items-center gap-1 text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded transition-colors font-medium border border-rose-100 dark:border-rose-900/30">
                <Trash2 size={12} /> Clear History
              </button>
            </div>
            {chatMessages.map(msg => (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.role === 'agent' && <span className="text-[10px] text-slate-400 font-bold mb-1 ml-1">{msg.agentName}</span>}
                <div className={`px-3 py-2 rounded-2xl max-w-[85%] text-[13px] ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 rounded-bl-none'}`}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-slate-400 mt-1">{msg.timestamp}</span>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start">
                <div className="px-3 py-2 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 rounded-bl-none flex gap-1">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>
      <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-zinc-900/50 flex flex-col gap-3 relative">
        {confirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmation(null)}>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-5">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
                  <AlertCircle size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">{confirmation.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{confirmation.description}</p>
              </div>
              <div className="bg-slate-50 dark:bg-black/50 p-4 border-t border-slate-100 dark:border-slate-700 flex gap-3">
                <button type="button" className="flex-1 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" onClick={() => setConfirmation(null)}>
                  Batal (Esc)
                </button>
                <button type="button" className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm" onClick={() => {
                  processMessage(confirmation.payload.command, confirmation.payload.args, confirmation.agentName, confirmation.agentId, confirmation.payload.message);
                  setConfirmation(null);
                }}>
                  Konfirmasi
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Quick Commands</div>
          <div className="flex items-center bg-slate-900 rounded-lg p-2 border border-slate-800">
            <Terminal size={14} className="text-slate-500 mr-2" />
            <input className="w-full bg-transparent text-slate-200 font-mono text-[11px] outline-none placeholder:text-slate-600" placeholder="Type /command (e.g. /gather, /report)" />
          </div>
        </div>
        
        <div className="relative">
          {renderAutocomplete()}
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Chat with Staff</div>
          <div className="flex items-end gap-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-600 rounded-xl p-2.5 shadow-sm">
            <textarea
              ref={textareaRef}
              className="flex-1 bg-transparent text-[13px] outline-none resize-none min-h-[40px] placeholder:text-slate-400 text-slate-900 dark:text-slate-100 leading-relaxed overflow-y-auto"
              style={{ maxHeight: '100px' }}
              placeholder="Ketik pesan atau /help untuk daftar perintah..."
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
            />
            <button type="button" onClick={handleSend} className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 active:scale-95 flex-shrink-0">
              <Send size={14} />
            </button>
          </div>
          <div className="flex justify-between items-center px-1 mt-2">
            <div className="flex gap-3">
              <Paperclip size={14} className="text-slate-400 cursor-pointer" />
              <Mic size={14} className="text-slate-400 cursor-pointer" />
            </div>
            <div className="text-[10px] text-slate-400">Cmd/Ctrl+Enter to send</div>
          </div>
        </div>
      </div>
    </aside>
  );
};


const MainCanvas = ({ isDark }: { isDark: boolean }) => (
  <div className="relative flex-1 overflow-hidden bg-slate-50 dark:bg-black rounded-xl">
    <InteractiveGridPattern
      isDark={isDark}
      width={40}
      height={40}
      className="z-0"
    />
    <div className="relative z-10 w-full h-full">
      <PhaserGame />
    </div>
  </div>
);

const AgentsView = ({ agents, onRemove, onEdit }: { agents: Agent[], onRemove: (id: number) => void, onEdit: (agent: Agent) => void }) => (
  <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-black">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {agents.map(agent => (
        <div key={agent.id} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 flex flex-col items-center text-center">
          <div className="relative mb-3">
            <AgentAvatar name={agent.name} size="lg" />
            <div className={`absolute bottom-0 right-0 w-4 h-4 border-2 border-white dark:border-slate-800 rounded-full ${agent.status === 'online' ? 'bg-emerald-500' : agent.status === 'away' ? 'bg-amber-500' : agent.status === 'alert' ? 'bg-red-500' : 'bg-slate-300'}`} />
          </div>
          <div className="font-bold text-slate-900 dark:text-slate-100 mb-1">{agent.name}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-4">{agent.role}</div>
          <div className="flex gap-2 w-full mt-auto">
            <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(agent); }} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <Edit size={14} /> Edit
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(agent.id); }} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 rounded-lg text-xs font-medium text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const MemoryView = ({ agents }: { agents: Agent[] }) => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAgent, setFilterAgent] = useState<string>('all');

  const fetchMemories = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (filterAgent !== 'all') query.append('agentId', filterAgent);
      if (filterType !== 'all') query.append('type', filterType);
      
      const res = await fetch(`http://localhost:8000/memories?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMemories(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, [filterAgent, filterType]);

  const createMemory = async (data: any) => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:8000/memories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      if (res.ok) fetchMemories();
      setShowAddModal(false);
    } finally {
      setLoading(false);
    }
  };

  const updateMemory = async (id: string, data: any) => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:8000/memories/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      if (res.ok) fetchMemories();
      setEditingMemory(null);
    } finally {
      setLoading(false);
    }
  };

  const deleteMemory = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:8000/memories/${id}`, { method: 'DELETE' });
      if (res.ok) fetchMemories();
      setDeleteConfirm(null);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleMemory = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:8000/memories/${id}/toggle`, { method: 'PATCH' });
      if (res.ok) fetchMemories();
    } catch (err) {
      console.error(err);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'context': return <Database size={20} />;
      case 'docs': return <FileText size={20} />;
      case 'instructions': return <BookOpen size={20} />;
      case 'custom': return <Wrench size={20} />;
      default: return <Database size={20} />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'context': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
      case 'docs': return 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'instructions': return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400';
      case 'custom': return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400';
      default: return 'text-slate-600 bg-slate-100 dark:bg-zinc-900 dark:text-slate-400';
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-black relative">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Memory & Knowledge Base</h2>
          <div className="flex gap-2">
            {['all', 'context', 'docs', 'instructions', 'custom'].map(t => (
              <button type="button" key={t} onClick={(e) => { e.stopPropagation(); setFilterType(t); }} className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${filterType === t ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-zinc-900 dark:text-slate-400 dark:hover:bg-slate-700'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 items-start">
          <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 outline-none">
            <option value="all">All Agents</option>
            <option value="global">Global</option>
            {agents.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
          <button type="button" onClick={() => setShowAddModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2">
            <Plus size={16} /> Add Memory
          </button>
        </div>
      </div>

      {memories.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center h-[60%] opacity-60">
          <Database size={64} className="text-slate-300 dark:text-slate-700 mb-4" />
          <p className="text-lg font-bold text-slate-500 dark:text-slate-400">Belum ada memory</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mb-6 capitalize">{filterType !== 'all' ? `Type: ${filterType}` : 'Coba tambahkan memory baru.'}</p>
          <button type="button" onClick={() => setShowAddModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2">
            <Plus size={16} /> Tambah Memory Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {memories.map((item) => (
            <div key={item.id} className={`bg-white dark:bg-zinc-900 rounded-xl border p-4 shadow-sm flex flex-col items-start transition-all duration-200 hover:shadow-md ${!item.isActive ? 'opacity-50 border-slate-200 dark:border-slate-700' : 'border-slate-100 dark:border-slate-700'} ${deleteConfirm === item.id ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : ''}`}>
              {deleteConfirm === item.id ? (
                <div className="flex flex-col items-center justify-center w-full h-full min-h-[160px]">
                  <AlertCircle size={32} className="text-red-500 mb-2" />
                  <p className="font-bold text-red-700 dark:text-red-400 mb-4">Hapus memory ini?</p>
                  <div className="flex gap-2 w-full">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }} className="flex-1 py-1.5 rounded-lg bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">Batal</button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); deleteMemory(item.id); }} className="flex-1 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors">Ya, Hapus</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start w-full mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getTypeColor(item.type)}`}>
                      {getTypeIcon(item.type)}
                    </div>
                    <div className="flex gap-2 items-center">
                      {!item.isActive && <span className="text-[10px] font-bold bg-slate-200 dark:bg-zinc-800 text-slate-500 px-1.5 py-0.5 rounded">INACTIVE</span>}
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${getTypeColor(item.type)}`}>{item.type}</span>
                    </div>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1 line-clamp-1" title={item.title}>{item.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2 min-h-[40px] flex-1">{item.description}</p>
                  <div className="flex flex-wrap gap-2 mb-4 w-full">
                    {item.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 text-[10px] font-medium rounded-md">{tag}</span>
                    ))}
                    {item.tags.length > 3 && (
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 text-[10px] font-medium rounded-md">+{item.tags.length - 3}</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center w-full pt-3 border-t border-slate-100 dark:border-slate-700 mt-auto">
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{item.size} • {item.agentId}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={(e) => { e.stopPropagation(); toggleMemory(item.id); }} className={`p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors ${item.isActive ? 'text-indigo-500' : ''}`} title="Toggle Status">
                        <Zap size={14} />
                      </button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setEditingMemory(item); }} className="p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors" title="Edit">
                        <Edit size={14} />
                      </button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(item.id); }} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {(showAddModal || editingMemory) && (
        <MemoryModal 
          agents={agents}
          initialData={editingMemory}
          onClose={() => { setShowAddModal(false); setEditingMemory(null); }}
          onSave={editingMemory ? (data) => updateMemory(editingMemory.id, data) : createMemory}
        />
      )}
    </div>
  );
};

const MemoryModal = ({ agents, initialData, onClose, onSave }: { agents: Agent[], initialData?: Memory | null, onClose: () => void, onSave: (data: any) => void }) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [type, setType] = useState<Memory['type']>(initialData?.type || 'context');
  const [agentId, setAgentId] = useState(initialData?.agentId || 'global');
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [isActive, setIsActive] = useState(initialData?.isActive !== undefined ? initialData.isActive : true);
  const [content, setContent] = useState(initialData?.content || '');

  const calcSize = (text: string) => {
    const bytes = new Blob([text]).size;
    if (bytes < 102) return `${bytes}B`;
    return `${(bytes / 1024).toFixed(1)}KB`;
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = tagInput.trim();
      if (val && !tags.includes(val)) setTags([...tags, val]);
      setTagInput('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-4xl flex max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Left Col - Fields */}
        <div className="w-1/2 p-6 overflow-y-auto border-r border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6">{initialData ? 'Edit Memory' : 'Add Memory'}</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:bg-zinc-800 dark:text-slate-100" placeholder="e.g. Server Logs" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 resize-none h-16 dark:bg-zinc-800 dark:text-slate-100" placeholder="Description..." />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Type</label>
                <select value={type} onChange={e => setType(e.target.value as any)} className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:bg-zinc-800 dark:text-slate-100">
                  <option value="context">Context</option>
                  <option value="docs">Docs</option>
                  <option value="instructions">Instructions</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Agent Scope</label>
                <select value={agentId} onChange={e => setAgentId(e.target.value)} className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:bg-zinc-800 dark:text-slate-100">
                  <option value="global">Global</option>
                  {agents.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Tags (Press Enter to add)</label>
              <div className="p-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-zinc-800 focus-within:border-indigo-500 flex flex-wrap gap-2">
                {tags.map((tag, idx) => (
                  <span key={idx} className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded text-xs font-semibold">
                    {tag}
                    <X size={12} className="cursor-pointer hover:text-indigo-800 dark:hover:text-indigo-200" onClick={(e) => { e.stopPropagation(); setTags(tags.filter((_, i) => i !== idx)); }} />
                  </span>
                ))}
                <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} className="flex-1 min-w-[80px] bg-transparent text-sm outline-none text-slate-900 dark:text-slate-100" placeholder="Add tag..." />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <button type="button" onClick={(e) => { e.stopPropagation(); setIsActive(!isActive); }} className={`w-10 h-6 rounded-full relative transition-colors ${isActive ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-600'}`}>
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform duration-200 ${isActive ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Is Active</span>
            </div>

          </div>
        </div>

        {/* Right Col - Content Editor */}
        <div className="w-1/2 flex flex-col p-6 bg-slate-50 dark:bg-black/50">
          <div className="flex justify-between items-center mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Memory Content</label>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <X size={20} />
            </button>
          </div>
          <textarea 
            value={content} 
            onChange={e => setContent(e.target.value)} 
            className="flex-1 w-full bg-slate-900 text-green-400 border border-slate-700 rounded-xl p-4 text-sm font-mono outline-none focus:border-indigo-500 resize-none"
            placeholder="Masukkan konten memory... Ini yang akan diinjeksi ke system prompt agent."
          />
          <div className="flex justify-between items-center mt-4">
            <div className="text-xs font-mono text-slate-400 dark:text-slate-500">Size: {calcSize(content)}</div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
              <button type="button" onClick={() => onSave({ title, description, type, agentId, tags, isActive, content })} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-50" disabled={!title.trim() || !content.trim()}>
                <Save size={16} /> Save Memory
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
const SkillIcon = ({ iconName, category }: { iconName: string, category: string }) => {
  const iconMap: Record<string, React.ElementType> = { FileText, Save, BarChart2, Terminal, Folder, Plus, Code2, Search, Sparkles };
  const Icon = iconMap[iconName] || Code2;
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'file': return 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400';
      case 'data': return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400';
      case 'shell': return 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400';
      case 'web': return 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400';
      case 'custom': return 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400';
      default: return 'bg-slate-100 text-slate-600 dark:bg-zinc-900 dark:text-slate-400';
    }
  };
  return (
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getCategoryColor(category)} flex-shrink-0`}>
      <Icon size={22} />
    </div>
  );
};

const TopNav = ({ wsStatus, isDark, onToggleDarkMode }: { wsStatus: WsStatus, isDark: boolean, onToggleDarkMode: () => void }) => {
  const statusColor = wsStatus === 'connected' ? 'bg-emerald-500' : wsStatus === 'connecting' ? 'bg-amber-500' : 'bg-red-400';
  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-black flex-shrink-0">
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className={`w-2 h-2 rounded-full ${statusColor} inline-block`} />
        <span className="font-medium capitalize">{wsStatus}</span>
      </div>
      <div className="flex items-center gap-4">
        <button type="button" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <Bell size={18} />
        </button>
        <AnimatedThemeToggler isDark={isDark} onToggle={onToggleDarkMode} />
      </div>
    </header>
  );
};

const SkillEditorModal = ({ skill, onClose, onSave }: { skill?: Skill | null, onClose: () => void, onSave: (s: Skill) => void }) => {
  const [name, setName] = useState(skill?.name || '');
  const [description, setDescription] = useState(skill?.description || '');
  const [category, setCategory] = useState<Skill['category']>(skill?.category || 'custom');
  const [iconName, setIconName] = useState(skill?.iconName || 'Code2');
  const [code, setCode] = useState(skill?.code || 'def my_skill(input: str):\n    # Write your Python code here\n    return input');
  const [parameters, setParameters] = useState<SkillParameter[]>(skill?.parameters || []);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: skill?.id || Date.now(),
      name, description, category, iconName,
      isBuiltin: skill?.isBuiltin || false,
      isActive: skill?.isActive !== undefined ? skill.isActive : true,
      code, parameters,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{skill ? 'Edit Skill' : 'New Skill'}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X size={20} /></button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500" placeholder="My Skill" />
            </div>
            <div className="w-48">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Icon</label>
              <div className="flex gap-2 items-center">
                <SkillIcon iconName={iconName} category={category} />
                <select value={iconName} onChange={e => setIconName(e.target.value)} className="flex-1 bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500">
                  <option value="FileText">FileText</option>
                  <option value="Save">Save</option>
                  <option value="BarChart2">BarChart</option>
                  <option value="Wrench">Wrench</option>
                  <option value="Terminal">Terminal</option>
                  <option value="Folder">Folder</option>
                  <option value="Globe">Globe</option>
                  <option value="Code2">Code2</option>
                  <option value="Plus">Plus</option>
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500" placeholder="What does this skill do?" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value as Skill['category'])} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500">
              <option value="file">File</option>
              <option value="data">Data</option>
              <option value="shell">Shell</option>
              <option value="web">Web</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Python Code</label>
            <textarea value={code} onChange={e => setCode(e.target.value)} rows={10} className="w-full font-mono bg-slate-900 text-green-400 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Parameters</label>
              <button type="button" onClick={() => setParameters([...parameters, { name: '', type: 'string', description: '', required: true }])} className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1"><Plus size={12} /> Add</button>
            </div>
            {parameters.map((p, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center">
                <input value={p.name} onChange={e => { const arr = [...parameters]; arr[idx] = { ...arr[idx], name: e.target.value }; setParameters(arr); }} placeholder="name" className="flex-1 bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 outline-none" />
                <select value={p.type} onChange={e => { const arr = [...parameters]; arr[idx] = { ...arr[idx], type: e.target.value as any }; setParameters(arr); }} className="w-24 bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 outline-none">
                  <option value="string">string</option><option value="number">number</option><option value="boolean">boolean</option><option value="file">file</option>
                </select>
                <input value={p.description} onChange={e => { const arr = [...parameters]; arr[idx] = { ...arr[idx], description: e.target.value }; setParameters(arr); }} placeholder="description" className="flex-1 bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 outline-none" />
                <button type="button" onClick={() => setParameters(parameters.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-500"><X size={16} /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-zinc-900/50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
          <button type="button" onClick={handleSave} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm">Save Skill</button>
        </div>
      </div>
    </div>
  );
};

const SkillsView = ({ skills, onAdd, onRemove, onToggle, onEdit }: { skills: Skill[], onAdd: (s: Skill) => void, onRemove: (id: number) => void, onToggle: (id: number) => void, onEdit: (s: Skill) => void }) => {
  const [filter, setFilter] = useState<'all' | Skill['category']>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

  const categories: Array<'all' | Skill['category']> = ['all', 'file', 'data', 'shell', 'web', 'custom'];
  const filtered = filter === 'all' ? skills : skills.filter(s => s.category === filter);

  const handleExport = () => {
    const json = JSON.stringify(skills.filter(s => !s.isBuiltin), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'skills.skill'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const imported = JSON.parse(ev.target?.result as string) as Skill[];
        imported.forEach(s => onAdd({ ...s, id: Date.now() + Math.random() * 1000 | 0, isBuiltin: false }));
      } catch { }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-black">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Skills</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{skills.filter(s => s.isActive).length} active · {skills.length} total</p>
        </div>
        <div className="flex gap-2">
          <label className="px-3 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors flex items-center gap-2">
            <FileText size={14} /> Import
            <input type="file" accept=".skill,.json" className="hidden" onChange={handleImport} />
          </label>
          <button type="button" onClick={handleExport} className="px-3 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors flex items-center gap-2">
            <Save size={14} /> Export
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); setEditingSkill(null); setShowEditor(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2">
            <Plus size={16} /> New Skill
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {categories.map(c => (
          <button type="button" key={c} onClick={(e) => { e.stopPropagation(); setFilter(c); }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${filter === c ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(skill => (
          <div key={skill.id} className={`bg-white dark:bg-zinc-900 rounded-xl border p-4 shadow-sm flex flex-col transition-all ${skill.isActive ? 'border-slate-100 dark:border-slate-700' : 'border-slate-200 dark:border-slate-700 opacity-60'}`}>
            <div className="mb-4">
              <SkillIcon iconName={skill.iconName} category={skill.category} />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
              {skill.name}
              {skill.isBuiltin && <span className="text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-semibold">BUILT-IN</span>}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 flex-1 mb-4">{skill.description}</p>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${skill.isActive ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}>
                {skill.isActive ? 'Active' : 'Inactive'}
              </span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(skill.id); }} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors" title="Toggle">
                  <Zap size={15} />
                </button>
                {!skill.isBuiltin && (
                  <>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setEditingSkill(skill); setShowEditor(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                      <Edit size={15} />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(skill.id); }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showEditor && (
        <SkillEditorModal
          skill={editingSkill}
          onClose={() => { setShowEditor(false); setEditingSkill(null); }}
          onSave={(s) => {
            if (editingSkill) { onEdit(s); } else { onAdd(s); }
            setShowEditor(false);
            setEditingSkill(null);
          }}
        />
      )}
    </div>
  );
};

const AI_PROVIDERS = [
  {
    provider: "Anthropic",
    keyPlaceholder: "sk-ant-...",
    models: ["claude-opus-4-20250514", "claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022", "claude-haiku-4-5-20251001"]
  },
  {
    provider: "OpenAI",
    keyPlaceholder: "sk-...",
    models: ["gpt-5", "gpt-4.5-preview", "gpt-4o", "gpt-4o-mini", "o3-mini"]
  },
  {
    provider: "Google Gemini",
    keyPlaceholder: "AIza...",
    models: ["gemini/gemini-2.5-pro", "gemini/gemini-2.5-flash", "gemini/gemini-2.0-flash"]
  },
  {
    provider: "DeepSeek",
    keyPlaceholder: "sk-...",
    models: ["deepseek/deepseek-chat", "deepseek/deepseek-reasoner", "deepseek/deepseek-coder"]
  },
  {
    provider: "Ollama (Local)",
    keyPlaceholder: "No API key needed",
    models: ["ollama/llama3.3", "ollama/qwen2.5:72b", "ollama/qwen2.5:7b", "ollama/qwen2.5-coder", "ollama/phi4", "ollama/mistral-large"]
  },
  {
    provider: "OpenRouter",
    keyPlaceholder: "sk-or-...",
    models: ["openrouter/anthropic/claude-sonnet-4", "openrouter/openai/gpt-4o", "openrouter/meta-llama/llama-4", "openrouter/x-ai/grok-4", "openrouter/mistralai/pixtral-large", "openrouter/tiiuae/falcon-3"]
  },
  {
    provider: "Mistral AI",
    keyPlaceholder: "...",
    models: ["mistral/mistral-large-2", "mistral/mistral-small-3"]
  },
  {
    provider: "Moonshot AI",
    keyPlaceholder: "sk-...",
    models: ["moonshot/kimi-k2.5"]
  },
  {
    provider: "Alibaba Cloud",
    keyPlaceholder: "sk-...",
    models: ["qwen/qwen-max", "qwen/qwen-plus"]
  },
  {
    provider: "Zhipu AI",
    keyPlaceholder: "...",
    models: ["zhipu/glm-5"]
  },
];

interface SettingsViewProps {
  selectedProvider: typeof AI_PROVIDERS[0];
  setSelectedProvider: (p: typeof AI_PROVIDERS[0]) => void;
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  apiKeys: Record<string, string>;
  setApiKeys: (keys: Record<string, string>) => void;
  savedStatus: boolean;
  setSavedStatus: (s: boolean) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

const SettingsView = ({ selectedProvider, setSelectedProvider, selectedModel, setSelectedModel, apiKeys, setApiKeys, savedStatus, setSavedStatus, darkMode, onToggleDarkMode }: SettingsViewProps) => {

  const handleSave = async () => {
    try {
      const providersData: any = {};
      Object.keys(apiKeys).forEach(p => {
        providersData[p] = { apiKey: apiKeys[p], model: '', enabled: true };
      });
      await fetch('http://localhost:8000/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providers: providersData,
          activeModel: selectedModel,
          darkMode: darkMode
        })
      });
      setSavedStatus(true);
      setTimeout(() => setSavedStatus(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-black">
      <div className="max-w-xl mx-auto space-y-6 pt-6">

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">API Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Provider</label>
              <select
                value={selectedProvider.provider}
                onChange={e => {
                  const p = AI_PROVIDERS.find(x => x.provider === e.target.value)!;
                  setSelectedProvider(p);
                  setSelectedModel(p.models[0]);
                }}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white dark:bg-zinc-800 dark:text-slate-100"
              >
                {AI_PROVIDERS.map(p => <option key={p.provider} value={p.provider}>{p.provider}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Model</label>
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white dark:bg-zinc-800 dark:text-slate-100"
              >
                {selectedProvider.models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">API Key</label>
              <input
                type="password"
                placeholder={selectedProvider.keyPlaceholder}
                disabled={selectedProvider.provider === "Ollama (Local)"}
                value={apiKeys[selectedProvider.provider] || ''}
                onChange={e => setApiKeys({ ...apiKeys, [selectedProvider.provider]: e.target.value })}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:bg-zinc-800 dark:text-slate-100"
              />
            </div>
            <div className="flex items-center gap-4 pt-2">
              <button type="button" onClick={handleSave} className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">Save</button>
              {savedStatus && <span className="text-sm font-medium text-emerald-600 animate-pulse">Saved!</span>}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Keys are stored locally and never sent to our servers.
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Appearance</h3>
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">Dark Mode</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Toggle dark theme for the interface</div>
            </div>
            <AnimatedThemeToggler isDark={darkMode} onToggle={onToggleDarkMode} />
          </div>
        </div>

      </div>
    </div>
  );
};

export const AGENT_TEMPLATES = [
  {
    id: 'general',
    label: 'General Assistant',
    icon: 'Bot',
    description: 'Agent serba bisa untuk tugas umum',
    sections: {
      role: 'asisten umum yang membantu berbagai tugas',
      responsibilities: ['Menjawab pertanyaan user', 'Membantu analisis data', 'Membuat draft dokumen'],
      constraints: ['Selalu konfirmasi sebelum edit/hapus file', 'Jawab dalam bahasa yang sama dengan user', 'Minta klarifikasi jika instruksi ambigu'],
      outputFormat: 'Jawab dengan ringkas dan jelas. Gunakan bullet points untuk list. Sertakan contoh jika diperlukan.',
      exampleTasks: ['Buat ringkasan dari dokumen ini', 'Jelaskan error ini', 'Bantu saya draft email']
    }
  },
  {
    id: 'data_analyst',
    label: 'Data Analyst',
    icon: 'BarChart2',
    description: 'Spesialis analisis data dan visualisasi',
    sections: {
      role: 'analis data yang ahli dalam mengolah dan menginterpretasi data',
      responsibilities: ['Membaca dan menganalisis file CSV/Excel', 'Menemukan pola dan insight dari data', 'Membuat summary statistik', 'Memberikan rekomendasi berdasarkan data'],
      constraints: ['Selalu tampilkan sample data sebelum analisis', 'Sebutkan asumsi yang digunakan', 'Jangan hapus data original'],
      outputFormat: 'Mulai dengan summary eksekutif 2-3 kalimat. Lanjut dengan temuan detail. Akhiri dengan rekomendasi actionable.',
      exampleTasks: ['Analisis sales.csv dan temukan trend', 'Bandingkan performa bulan ini vs bulan lalu', 'Buat statistik deskriptif dari dataset']
    }
  },
  {
    id: 'file_manager',
    label: 'File Manager',
    icon: 'Folder',
    description: 'Manajemen file dan direktori',
    sections: {
      role: 'manajer file yang bertanggung jawab atas operasi file system',
      responsibilities: ['Membaca dan menulis file', 'Mengorganisir struktur direktori', 'Mencari file berdasarkan kriteria', 'Backup dan archiving'],
      constraints: ['WAJIB konfirmasi sebelum hapus file apapun', 'Buat backup sebelum edit file penting', 'Laporkan setiap operasi yang dilakukan'],
      outputFormat: 'Laporkan setiap aksi: [AKSI] path/file → status. Tampilkan tree struktur jika relevan.',
      exampleTasks: ['List semua file .py di folder ini', 'Pindahkan semua log lama ke folder archive', 'Cari file yang mengandung kata "error"']
    }
  },
  {
    id: 'researcher',
    label: 'Researcher',
    icon: 'Search',
    description: 'Riset mendalam dan fact-checking',
    sections: {
      role: 'peneliti yang teliti dan kritis dalam mencari informasi',
      responsibilities: ['Melakukan riset mendalam tentang topik', 'Memverifikasi fakta', 'Menyusun laporan riset terstruktur', 'Memberikan referensi dan sumber'],
      constraints: ['Bedakan antara fakta dan opini', 'Sebutkan ketidakpastian secara eksplisit', 'Jangan membuat data fiktif'],
      outputFormat: 'Format: ## Temuan Utama → ## Detail → ## Sumber. Gunakan confidence level (Tinggi/Sedang/Rendah) untuk tiap klaim.',
      exampleTasks: ['Riset tentang teknologi X', 'Bandingkan tools A vs B vs C', 'Buat laporan kompetitor']
    }
  },
  {
    id: 'code_reviewer',
    label: 'Code Reviewer',
    icon: 'Code2',
    description: 'Review kode dan debugging',
    sections: {
      role: 'software engineer senior yang melakukan code review dan debugging',
      responsibilities: ['Review kode untuk bug dan best practices', 'Suggest refactoring', 'Debugging error', 'Dokumentasi kode'],
      constraints: ['Jelaskan alasan setiap saran', 'Prioritaskan security issues', 'Pertimbangkan performance impact'],
      outputFormat: '## Issues (Critical/Major/Minor) → ## Suggestions → ## Fixed Code. Rate overall code quality 1-10.',
      exampleTasks: ['Review file main.py ini', 'Debug kenapa fungsi ini error', 'Refactor kode ini supaya lebih clean']
    }
  },
  {
    id: 'custom',
    label: 'Custom',
    icon: 'Sparkles',
    description: 'Buat instruksi dari nol',
    sections: {
      role: '',
      responsibilities: [],
      constraints: [],
      outputFormat: '',
      exampleTasks: []
    }
  }
];

export const buildSystemPrompt = (sections: PromptSections, agentName: string, skills: Skill[]): string => {
  const activeSkills = skills.filter(s => s.isActive).map(s => s.name).join(', ')
  
  return `Kamu adalah ${agentName}, ${sections.role}.

## TANGGUNG JAWAB
${sections.responsibilities.map(r => `- ${r}`).join('\n')}

## BATASAN
${sections.constraints.map(c => `- ${c}`).join('\n')}

## FORMAT OUTPUT
${sections.outputFormat}

## CONTOH TUGAS
${sections.exampleTasks.map(t => `- ${t}`).join('\n')}

## SKILLS TERSEDIA
${activeSkills || 'Tidak ada skill aktif'}

Selalu bertindak sesuai peran dan batasan yang ditetapkan.`
};

const NewAgentModal = ({ onClose, onAdd }: { onClose: () => void, onAdd: (agent: any) => void }) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('online');

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({
      id: Date.now(),
      name,
      role,
      status,
      promptSections: AGENT_TEMPLATES[0].sections,
      systemPrompt: buildSystemPrompt(AGENT_TEMPLATES[0].sections, name, BUILTIN_SKILLS)
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-[420px] p-6 relative" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          <X size={20} />
        </button>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6">Add New Agent</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Agent Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:bg-zinc-800 dark:text-slate-100" placeholder="e.g. Agent John" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Role</label>
            <input value={role} onChange={e => setRole(e.target.value)} className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:bg-zinc-800 dark:text-slate-100" placeholder="e.g. Researcher" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white dark:bg-zinc-800 dark:text-slate-100">
              <option value="online">Online</option>
              <option value="away">Away</option>
              <option value="busy">Busy</option>
              <option value="offline">Offline</option>
              <option value="alert">Alert</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancel</button>
          <button type="button" onClick={handleAdd} className="flex-1 py-2 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">Add Agent</button>
        </div>
      </div>
    </div>
  );
};

const AgentConfigModal = ({ agent, onClose, onSave, builtinSkills, showToast }: { agent: Agent, onClose: () => void, onSave: (agent: Agent) => void, builtinSkills: Skill[], showToast: (msg: string, type?: 'success'|'error') => void }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'instructions' | 'preview'>('profile');

  const [name, setName] = useState(agent.name);
  const [role, setRole] = useState(agent.role);
  const [status, setStatus] = useState(agent.status);

  const [sections, setSections] = useState<PromptSections>(agent.promptSections || AGENT_TEMPLATES[0].sections);
  const [rawPromptMode, setRawPromptMode] = useState(false);
  const [isRawEdited, setIsRawEdited] = useState(false);
  const [rawSystemPrompt, setRawSystemPrompt] = useState(agent.systemPrompt || buildSystemPrompt(sections, name, builtinSkills));
  const [agentSkills, setAgentSkills] = useState<string[]>(agent.enabledSkills || []);
  const [skillSearch, setSkillSearch] = useState('');

  const filteredSkills = builtinSkills.filter(skill =>
    skill.name.toLowerCase().includes(skillSearch.toLowerCase()) ||
    skill.category.toLowerCase().includes(skillSearch.toLowerCase())
  );

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const applyTemplate = (tpl: typeof AGENT_TEMPLATES[0]) => {
    setSelectedTemplate(tpl.id);
    setSections(tpl.sections);
    const newPrompt = buildSystemPrompt(tpl.sections, name, builtinSkills);
    setRawSystemPrompt(newPrompt);
  };

  const handleArrayChange = (field: keyof PromptSections, index: number, value: string) => {
    const newArr = [...sections[field] as string[]];
    newArr[index] = value;
    const newSec = { ...sections, [field]: newArr };
    setSections(newSec);
    if (!rawPromptMode) setRawSystemPrompt(buildSystemPrompt(newSec, name, builtinSkills));
  };

  const handleArrayAdd = (field: keyof PromptSections) => {
    const newSec = { ...sections, [field]: [...(sections[field] as string[]), ''] };
    setSections(newSec);
    if (!rawPromptMode) setRawSystemPrompt(buildSystemPrompt(newSec, name, builtinSkills));
  };

  const handleArrayRemove = (field: keyof PromptSections, index: number) => {
    const newArr = (sections[field] as string[]).filter((_, i) => i !== index);
    const newSec = { ...sections, [field]: newArr };
    setSections(newSec);
    if (!rawPromptMode) setRawSystemPrompt(buildSystemPrompt(newSec, name, builtinSkills));
  };

  const handleTextChange = (field: keyof PromptSections, value: string) => {
    const newSec = { ...sections, [field]: value };
    setSections(newSec);
    if (!rawPromptMode) setRawSystemPrompt(buildSystemPrompt(newSec, name, builtinSkills));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const finalSystemPrompt = isRawEdited ? rawSystemPrompt : buildSystemPrompt(sections, name, builtinSkills);
    onSave({
      ...agent,
      name,
      role,
      status,
      promptSections: sections,
      systemPrompt: finalSystemPrompt,
      enabledSkills: agentSkills
    });
  };

  const iconMap: Record<string, React.ElementType> = { Bot, BarChart2, Folder, Search, Code2, Sparkles };

  const renderArrayField = (field: 'responsibilities' | 'constraints' | 'exampleTasks', title: string) => (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</label>
        <button type="button" onClick={() => handleArrayAdd(field)} className="text-xs flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:opacity-80">
          <Plus size={12} /> Add
        </button>
      </div>
      <div className="space-y-2">
        {(sections[field] as string[]).map((item, idx) => (
          <div key={idx} className="flex gap-2 items-start">
            <input
              value={item}
              onChange={e => handleArrayChange(field, idx, e.target.value)}
              className="flex-1 bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
            />
            <button type="button" onClick={() => handleArrayRemove(field, idx)} className="mt-2 text-slate-400 hover:text-red-500"><X size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Configure Agent: {name}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-slate-200 dark:border-slate-700">
          {['profile', 'instructions', 'preview'].map(t => (
            <button type="button"
              key={t}
              onClick={() => setActiveTab(t as any)}
              className={`flex-1 py-3 text-sm font-semibold capitalize ${activeTab === t ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {activeTab === 'profile' && (
            <div className="space-y-4 max-w-md mx-auto">
              <div className="flex justify-center mb-6">
                <AgentAvatar name={name || 'A'} size="lg" />
              </div>
              {/* SKILLS YANG DIAKTIFKAN */}
              <div className="mt-4">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Skills yang Diaktifkan
                </label>
                
                {/* Search box */}
                <div className="relative mt-2">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari skill..."
                    value={skillSearch}
                    onChange={e => setSkillSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 
                               rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 
                               focus:ring-indigo-500"
                  />
                </div>

                {/* Skill list */}
                <div className="mt-2 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredSkills.length === 0 ? (
                      <div className="py-6 text-center text-sm text-slate-400">
                        Tidak ada skill ditemukan
                      </div>
                    ) : (
                      filteredSkills.map(skill => {
                        const isEnabled = agentSkills.includes(skill.name)
                        const categoryColors: Record<string, string> = {
                          file: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
                          data: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                          shell: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                          web: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
                          custom: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                        }
                        
                        return (
                          <div
                            key={skill.name}
                            onClick={() => {
                              setAgentSkills(prev =>
                                isEnabled
                                  ? prev.filter(s => s !== skill.name)
                                  : [...prev, skill.name]
                              );
                              if (!rawPromptMode && !isRawEdited) setRawSystemPrompt(buildSystemPrompt(sections, name, builtinSkills));
                            }}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors
                              ${isEnabled 
                                ? 'bg-indigo-50 dark:bg-indigo-900/20' 
                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                              }`}
                          >
                            {/* Checkbox visual */}
                            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors
                              ${isEnabled 
                                ? 'bg-indigo-600 border-indigo-600' 
                                : 'border-slate-300 dark:border-slate-600'
                              }`}>
                              {isEnabled && <Check size={10} className="text-white" />}
                            </div>
                            
                            {/* Skill name */}
                            <span className="text-sm flex-1 text-slate-700 dark:text-slate-200">
                              {skill.name}
                            </span>
                            
                            {/* Category badge */}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0
                              ${categoryColors[skill.category] || categoryColors.custom}`}>
                              {skill.category}
                            </span>
                          </div>
                        )
                      })
                    )}
                  </div>
                  
                  {/* Footer counter */}
                  <div className="px-3 py-2 bg-slate-50 dark:bg-zinc-900/50 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {agentSkills.length} dari {builtinSkills.length} skill aktif
                    </span>
                    <div className="flex gap-2">
                      <button type="button"
                        onClick={() => {
                          setAgentSkills(builtinSkills.map(s => s.name));
                          if (!rawPromptMode && !isRawEdited) setRawSystemPrompt(buildSystemPrompt(sections, name, builtinSkills));
                        }}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-slate-300">|</span>
                      <button type="button"
                        onClick={() => {
                          setAgentSkills([]);
                          if (!rawPromptMode && !isRawEdited) setRawSystemPrompt(buildSystemPrompt(sections, name, builtinSkills));
                        }}
                        className="text-xs text-slate-500 hover:underline"
                      >
                        Hapus Semua
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Name</label>
                <input value={name} onChange={e => {
                  setName(e.target.value);
                  if (!rawPromptMode) setRawSystemPrompt(buildSystemPrompt(sections, e.target.value, builtinSkills));
                }} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Role</label>
                <input value={role} onChange={e => setRole(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500">
                  <option value="online">Online</option>
                  <option value="away">Away</option>
                  <option value="alert">Alert</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'instructions' && (
            <div className="flex gap-6 h-full min-h-[400px]">
              <div className="w-1/3 border-r border-slate-200 dark:border-slate-700 pr-6 overflow-y-auto">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Templates</label>
                <div className="grid grid-cols-1 gap-3">
                  {AGENT_TEMPLATES.map(tpl => {
                    const TplIcon = iconMap[tpl.icon] || Bot;
                    const isSelected = selectedTemplate === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => applyTemplate(tpl)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <TplIcon size={16} className={isSelected ? 'text-indigo-600' : 'text-slate-500 dark:text-slate-400'} />
                          <span className="font-semibold text-sm text-slate-900 dark:text-white">{tpl.label}</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{tpl.description}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="w-2/3 pl-2 overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Editor</label>
                  <div className="flex bg-slate-100 dark:bg-black rounded-lg p-1">
                    <button type="button" onClick={() => setRawPromptMode(false)} className={`px-3 py-1 rounded text-xs font-semibold ${!rawPromptMode ? 'bg-white dark:bg-zinc-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Form Mode</button>
                    <button type="button" onClick={() => setRawPromptMode(true)} className={`px-3 py-1 rounded text-xs font-semibold ${rawPromptMode ? 'bg-white dark:bg-zinc-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Raw Prompt</button>
                  </div>
                </div>

                {!rawPromptMode ? (
                  <div className="space-y-4 pb-10">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Role ("Kamu adalah {name}, seorang...")</label>
                      <input value={sections.role} onChange={e => handleTextChange('role', e.target.value)} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500" />
                    </div>
                    {renderArrayField('responsibilities', 'Responsibilities')}
                    {renderArrayField('constraints', 'Constraints')}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Output Format</label>
                      <textarea value={sections.outputFormat} onChange={e => handleTextChange('outputFormat', e.target.value)} rows={3} className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500" />
                    </div>
                    {renderArrayField('exampleTasks', 'Example Tasks')}
                  </div>
                ) : (
                  <textarea
                    value={rawSystemPrompt}
                    onChange={e => {
                      setRawSystemPrompt(e.target.value);
                      setIsRawEdited(true);
                    }}
                    className="w-full h-full min-h-[300px] bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-4 text-sm font-mono text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="relative bg-slate-900 dark:bg-slate-950 p-6 rounded-xl border border-slate-800 shadow-inner overflow-auto max-h-[400px]">
              <button type="button"
                onClick={() => {
                  navigator.clipboard.writeText(rawSystemPrompt);
                  showToast('Prompt berhasil disalin!');
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition-colors"
                title="Copy to Clipboard"
              >
                <FileText size={16} />
              </button>
              <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap">{rawSystemPrompt}</pre>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-zinc-900/50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
          <button type="button" onClick={handleSave} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-2">
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function AnimatedThemeToggler({ isDark, onToggle }: { isDark: boolean, onToggle: () => void }) {
  return (
    <button type="button"
      onClick={onToggle}
      className="relative w-14 h-7 rounded-full p-1 transition-colors duration-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      style={{ backgroundColor: isDark ? '#4f46e5' : '#e2e8f0' }}
    >
      <motion.div
        className="w-5 h-5 rounded-full flex items-center justify-center shadow-md"
        animate={{ 
          x: isDark ? 28 : 0,
          backgroundColor: isDark ? '#1e1b4b' : '#ffffff'
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      >
        <AnimatePresence mode="wait">
          {isDark ? (
            <motion.svg
              key="moon"
              initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2 }}
              width="12" height="12" viewBox="0 0 24 24" 
              fill="#818cf8"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </motion.svg>
          ) : (
            <motion.svg
              key="sun"
              initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2 }}
              width="12" height="12" viewBox="0 0 24 24"
              fill="#f59e0b" stroke="#f59e0b" strokeWidth="2"
            >
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.div>
    </button>
  )
}

function InteractiveGridPattern({
  width = 40,
  height = 40,
  className = '',
  isDark = false,
}: {
  width?: number
  height?: number
  className?: string
  isDark?: boolean
}) {
  const [hoveredCell, setHoveredCell] = useState<[number, number] | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const cols = Math.ceil(window.innerWidth / width) + 1
  const rows = Math.ceil(600 / height) + 1

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.floor((e.clientX - rect.left) / width)
    const y = Math.floor((e.clientY - rect.top) / height)
    setHoveredCell([x, y])
  }

  const handleMouseLeave = () => setHoveredCell(null)

  const isNear = (col: number, row: number) => {
    if (!hoveredCell) return false
    const [hx, hy] = hoveredCell
    return Math.abs(col - hx) <= 1 && Math.abs(row - hy) <= 1
  }

  const isExact = (col: number, row: number) => {
    if (!hoveredCell) return false
    return hoveredCell[0] === col && hoveredCell[1] === row
  }

  // Colors adaptive dark/light
  const strokeColor = isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.12)'
  const hoverColor = isDark ? 'rgba(99,102,241,0.35)' : 'rgba(99,102,241,0.25)'
  const activeColor = isDark ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.45)'

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`absolute inset-0 overflow-hidden ${className}`}
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width={width} height={height} patternUnits="userSpaceOnUse">
            <path
              d={`M ${width} 0 L 0 0 0 ${height}`}
              fill="none"
              stroke={strokeColor}
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        {Array.from({ length: rows }).map((_, row) =>
          Array.from({ length: cols }).map((_, col) => {
            const near = isNear(col, row)
            const exact = isExact(col, row)
            if (!near && !exact) return null
            return (
              <rect
                key={`${col}-${row}`}
                x={col * width}
                y={row * height}
                width={width}
                height={height}
                fill={exact ? activeColor : hoverColor}
                className="transition-all duration-150"
              />
            )
          })
        )}
      </svg>
      {/* Radial gradient mask overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse 80% 60% at 50% 50%, transparent 40%, rgba(15,23,42,0.8) 100%)'
            : 'radial-gradient(ellipse 80% 60% at 50% 50%, transparent 40%, rgba(248,250,252,0.8) 100%)'
        }}
      />
    </div>
  )
}

export default function App() {
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [showNewAgentModal, setShowNewAgentModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);

  const showToast = (message: string, type: 'success'|'error' = 'success') => {
    setToast({message, type});
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchActivityLog();
    fetchOutputs();
    // Initial fetch for settings and agents
    fetch('http://localhost:8000/settings')
      .then(r => r.json())
      .then(data => {
        // if (data.darkMode !== undefined) setDarkMode(data.darkMode);
        if (data.providers) {
          const keys: Record<string, string> = {};
          Object.keys(data.providers).forEach(p => keys[p] = data.providers[p].apiKey);
          setApiKeys(keys);
        }
        if (data.activeModel) {
          for (const p of AI_PROVIDERS) {
            if (p.models.includes(data.activeModel)) {
              setSelectedProvider(p);
              setSelectedModel(data.activeModel);
              break;
            }
          }
        }
      })
      .catch(err => console.error("Failed to load settings:", err));
      
    fetch('http://localhost:8000/agents')
      .then(r => r.json())
      .then(data => {
        if (data && data.length > 0) {
          setAgents(data);
        }
      })
      .catch(err => console.error("Failed to load agents:", err));
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const [agents, setAgents] = useState<Agent[]>([
    {
      id: 1, name: 'Agent Smith', role: 'Productivity Lead', status: 'online',
      promptSections: AGENT_TEMPLATES[0].sections,
      systemPrompt: buildSystemPrompt(AGENT_TEMPLATES[0].sections, 'Agent Smith', BUILTIN_SKILLS),
      enabledSkills: BUILTIN_SKILLS.map(s => s.name)
    },
    {
      id: 2, name: 'Agent Sarah', role: 'System Architect', status: 'away',
      promptSections: AGENT_TEMPLATES[0].sections,
      systemPrompt: buildSystemPrompt(AGENT_TEMPLATES[0].sections, 'Agent Sarah', BUILTIN_SKILLS),
      enabledSkills: BUILTIN_SKILLS.map(s => s.name)
    },
    {
      id: 3, name: 'Agent Rex', role: 'Data Analyst', status: 'offline',
      promptSections: AGENT_TEMPLATES[0].sections,
      systemPrompt: buildSystemPrompt(AGENT_TEMPLATES[0].sections, 'Agent Rex', BUILTIN_SKILLS),
      enabledSkills: BUILTIN_SKILLS.map(s => s.name)
    },
    {
      id: 4, name: 'Agent Maya', role: 'Security Lead', status: 'alert',
      promptSections: AGENT_TEMPLATES[0].sections,
      systemPrompt: buildSystemPrompt(AGENT_TEMPLATES[0].sections, 'Agent Maya', BUILTIN_SKILLS),
      enabledSkills: BUILTIN_SKILLS.map(s => s.name)
    },
  ]);

  const [selectedProvider, setSelectedProvider] = useState(AI_PROVIDERS[0]);
  const [selectedModel, setSelectedModel] = useState(AI_PROVIDERS[0].models[0]);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [savedStatus, setSavedStatus] = useState(false);

  const [skills, setSkills] = useState<Skill[]>(BUILTIN_SKILLS);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<Tab>('Activity');
  const [activityLogs, setActivityLogs] = useState<ActivityEvent[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [loadingLog, setLoadingLog] = useState(false);

  const [outputs, setOutputs] = useState<OutputBlock[]>([]);
  const [loadingOutputs, setLoadingOutputs] = useState(false);
  const [expandedOutputs, setExpandedOutputs] = useState<Set<string>>(new Set());

  const fetchOutputs = async () => {
    setLoadingOutputs(true);
    try {
      const res = await fetch('http://localhost:8000/outputs?limit=50');
      const data = await res.json();
      setOutputs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOutputs(false);
    }
  };

  const toggleExpandOutput = (id: string) => {
    setExpandedOutputs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleClearOutputs = async () => {
    try {
      await fetch('http://localhost:8000/outputs', { method: 'DELETE' });
      setOutputs([]);
    } catch (err) {
      console.error("Failed to clear outputs:", err);
    }
  };

  const handleDeleteOutput = async (id: string) => {
    try {
      await fetch(`http://localhost:8000/outputs/${id}`, { method: 'DELETE' });
      setOutputs(prev => prev.filter(o => o.id !== id));
    } catch (err) {
      console.error("Failed to delete output:", err);
    }
  };

  const fetchActivityLog = async () => {
    setLoadingLog(true);
    try {
      const res = await fetch('http://localhost:8000/activity?limit=100');
      const data = await res.json();
      setActivityLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLog(false);
    }
  };

  const handleClearActivityLog = async () => {
    try {
      await fetch('http://localhost:8000/activity', { method: 'DELETE' });
      setActivityLogs([]);
    } catch (err) {
      console.error("Failed to clear activity log:", err);
    }
  };

  const handleWsMessage = useCallback((data: any) => {
    if (data.type === 'activity') {
      setActivityLogs(prev => [data.data, ...prev].slice(0, 200));
    } else if (data.type === 'output') {
      setOutputs(prev => [data.data, ...prev].slice(0, 100));
      // Auto expand newly arrived output
      setExpandedOutputs(prev => new Set(prev).add(data.data.id));
      // Auto switch to OUTPUT tab
      setActiveRightTab('Output');
    } else if (data.type === 'agent_action') {
      // Legacy fallback
    }
  }, []);

  const { wsStatus, sendMessage: wsSendMessage } = useWebSocket('ws://localhost:8000/ws', handleWsMessage);

  const activeAgent = agents.find(a => a.status === 'online') || agents[0];
  const activeAgentId = activeAgent?.id ? String(activeAgent.id) : "global";

  useEffect(() => {
    if (!activeAgentId) return;
    setIsLoading(true);
    fetch(`http://localhost:8000/agents/${activeAgentId}/history`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const loadedMsgs: ChatMessage[] = data.map((item: any, idx: number) => ({
            id: `hist-${Date.now()}-${idx}`,
            role: item.role === 'user' ? 'user' : 'agent',
            agentName: item.role === 'agent' ? activeAgent?.name : undefined,
            content: item.content,
            timestamp: '',
            status: 'success',
            type: 'chat'
          }));
          setChatMessages(loadedMsgs);
        } else {
          setChatMessages([]);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setIsLoading(false));
  }, [activeAgentId, activeAgent?.name]);

  const handleClearHistory = async () => {
    if (!activeAgentId) return;
    try {
      await fetch(`http://localhost:8000/agents/${activeAgentId}/history`, { method: 'DELETE' });
      setChatMessages([]);
    } catch (err) {
      console.error("Failed to clear history:", err);
    }
  };

  const onSendMessage = async (message: string) => {
    if (!message.trim()) return;

    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp,
      status: 'success',
      type: 'chat'
    };

    setChatMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    const agent_name = activeAgent?.name || "Assistant";
    const system_prompt = activeAgent?.systemPrompt || '';

    try {
      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          model: selectedModel,
          api_key: apiKeys[selectedProvider.provider] || '',
          agent_name,
          agent_id: activeAgentId,
          system_prompt,
          enabled_skills: activeAgent?.enabledSkills || []
        })
      });

      if (!res.ok) throw new Error('Network error');

      const data = await res.json();

      const agentMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        agentName: data.agent || agent_name,
        content: data.response || "No response",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'success',
        type: 'chat'
      };

      setChatMessages(prev => [...prev, agentMsg]);
      
      if (data.skill_detected) {
        setChatMessages(prev => [...prev, {
          id: (Date.now() + 2).toString(),
          role: 'agent',
          agentName: 'System',
          content: `💡 Skill terdeteksi: ${data.skill_detected}. Ketik "/run ${data.skill_detected}" untuk mengeksekusi.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'success',
          type: 'system_info'
        }]);
      }

      wsSendMessage(agent_name, message);
    } catch (err) {
      setChatMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        agentName: 'System',
        content: 'Backend tidak terhubung. Jalankan py -3.12 run.py',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'error',
        type: 'system_info'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAgent = async (newAgent: Agent) => {
    try {
      const res = await fetch('http://localhost:8000/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgent)
      });
      const added = await res.json();
      setAgents([...agents, added]);
      setShowNewAgentModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveAgent = async (id: number) => {
    try {
      await fetch(`http://localhost:8000/agents/${id}`, { method: 'DELETE' });
      setAgents(agents.filter(a => a.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateAgent = async (updatedAgent: Agent) => {
    try {
      const res = await fetch(`http://localhost:8000/agents/${updatedAgent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedAgent)
      });
      if (!res.ok) throw new Error('Gagal update agent');
      setAgents(agents.map(a => a.id === updatedAgent.id ? updatedAgent : a));
      setEditingAgent(null);
      showToast('Agent berhasil disimpan');
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan agent', 'error');
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-black transition-colors duration-200">
      <Sidebar activePage={activePage} setActivePage={setActivePage} agents={agents} onNewAgent={() => setShowNewAgentModal(true)} />

      <main className="flex-1 flex flex-col ml-[260px] mr-[320px] h-full relative z-10 bg-white dark:bg-black">
        <TopNav wsStatus={wsStatus} isDark={darkMode} onToggleDarkMode={() => setDarkMode(prev => !prev)} />
        {activePage === 'dashboard' && <MainCanvas isDark={darkMode} />}
        {activePage === 'agents' && <AgentsView agents={agents} onRemove={handleRemoveAgent} onEdit={setEditingAgent} />}
        {activePage === 'skills' && (
          <SkillsView
            skills={skills}
            onAdd={(skill) => setSkills([...skills, skill])}
            onRemove={(id) => setSkills(skills.filter(s => s.id !== id))}
            onToggle={(id) => setSkills(skills.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s))}
            onEdit={(updated) => setSkills(skills.map(s => s.id === updated.id ? updated : s))}
          />
        )}
        {activePage === 'memory' && <MemoryView agents={agents} />}
        {activePage === 'settings' && (
          <SettingsView
            selectedProvider={selectedProvider}
            setSelectedProvider={setSelectedProvider}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            apiKeys={apiKeys}
            setApiKeys={setApiKeys}
            savedStatus={savedStatus}
            setSavedStatus={setSavedStatus}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode(prev => !prev)}
          />
        )}
      </main>

      <RightPanel
        chatMessages={chatMessages}
        agents={agents}
        isLoading={isLoading}
        onSendMessage={onSendMessage}
        activityLogs={activityLogs}
        onClearHistory={handleClearHistory}
        loadingLog={loadingLog}
        filterType={filterType}
        setFilterType={setFilterType}
        onClearActivityLog={handleClearActivityLog}
        outputs={outputs}
        loadingOutputs={loadingOutputs}
        expandedOutputs={expandedOutputs}
        toggleExpandOutput={toggleExpandOutput}
        onClearOutputs={handleClearOutputs}
        onDeleteOutput={handleDeleteOutput}
        activeTab={activeRightTab}
        setActiveTab={setActiveRightTab}
      />

      {showNewAgentModal && (
        <NewAgentModal
          onClose={() => setShowNewAgentModal(false)}
          onAdd={handleAddAgent}
        />
      )}

      {editingAgent && (
        <AgentConfigModal
          agent={editingAgent}
          onClose={() => setEditingAgent(null)}
          onSave={handleUpdateAgent}
          builtinSkills={skills}
          showToast={showToast}
        />
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-sm font-semibold z-[100] transition-all ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
