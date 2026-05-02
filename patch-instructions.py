import os

app_path = r'c:\Users\User\Documents\1ST APPS\office-agent-ai\src\App.tsx'
with open(app_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports
content = content.replace(
    '''import { Plus, LayoutDashboard, Bot, Database, Settings, HelpCircle, FileText, Bell, Contrast, Send, Paperclip, Mic, Terminal, X, Edit, Trash2, Zap, Save, BarChart2, Wrench, Folder, Globe, Code2 } from 'lucide-react';''',
    '''import { Plus, LayoutDashboard, Bot, Database, Settings, HelpCircle, FileText, Bell, Contrast, Send, Paperclip, Mic, Terminal, X, Edit, Trash2, Zap, Save, BarChart2, Wrench, Folder, Globe, Code2, Search, Sparkles } from 'lucide-react';'''
)

# 2. Update Agent interface
agent_interface_old = '''interface Agent {
  id: number;
  name: string;
  role: string;
  status: string;
}'''

agent_interface_new = '''export interface PromptSections {
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
}'''

content = content.replace(agent_interface_old, agent_interface_new)

# 3. Add AGENT_TEMPLATES and buildSystemPrompt before App
constants_code = '''
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
  const activeSkills = skills.filter(s => s.isActive).map(s => s.name).join(', ') || 'None';
  return `## Role
Kamu adalah ${agentName}, seorang ${sections.role} di Office Agent AI.

## Responsibilities
${sections.responsibilities.map(r => `- ${r}`).join('\\n')}

## Capabilities
Skills yang tersedia: ${activeSkills}

## Constraints
${sections.constraints.map(c => `- ${c}`).join('\\n')}

## Output Format
${sections.outputFormat}

## Example Tasks
${sections.exampleTasks.map(t => `- ${t}`).join('\\n')}`;
};

'''

content = content.replace("export default function App() {", constants_code + "export default function App() {")

# 4. Update agents initial state
agents_state_old = '''  const [agents, setAgents] = useState<Agent[]>([
    { id: 1, name: 'Agent Smith', role: 'Productivity Lead', status: 'online' },
    { id: 2, name: 'Agent Sarah', role: 'System Architect', status: 'away' },
    { id: 3, name: 'Agent Rex', role: 'Data Analyst', status: 'offline' },
    { id: 4, name: 'Agent Maya', role: 'Security Lead', status: 'alert' },
  ]);'''

agents_state_new = '''  const [agents, setAgents] = useState<Agent[]>([
    { 
      id: 1, name: 'Agent Smith', role: 'Productivity Lead', status: 'online',
      promptSections: AGENT_TEMPLATES[0].sections,
      systemPrompt: buildSystemPrompt(AGENT_TEMPLATES[0].sections, 'Agent Smith', BUILTIN_SKILLS)
    },
    { 
      id: 2, name: 'Agent Sarah', role: 'System Architect', status: 'away',
      promptSections: AGENT_TEMPLATES[0].sections,
      systemPrompt: buildSystemPrompt(AGENT_TEMPLATES[0].sections, 'Agent Sarah', BUILTIN_SKILLS)
    },
    { 
      id: 3, name: 'Agent Rex', role: 'Data Analyst', status: 'offline',
      promptSections: AGENT_TEMPLATES[0].sections,
      systemPrompt: buildSystemPrompt(AGENT_TEMPLATES[0].sections, 'Agent Rex', BUILTIN_SKILLS)
    },
    { 
      id: 4, name: 'Agent Maya', role: 'Security Lead', status: 'alert',
      promptSections: AGENT_TEMPLATES[0].sections,
      systemPrompt: buildSystemPrompt(AGENT_TEMPLATES[0].sections, 'Agent Maya', BUILTIN_SKILLS)
    },
  ]);'''

content = content.replace(agents_state_old, agents_state_new)

# 5. Update NewAgentModal (handleAdd)
new_agent_add_old = '''  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({
      id: Date.now(),
      name,
      role,
      status,
    });
  };'''

new_agent_add_new = '''  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({
      id: Date.now(),
      name,
      role,
      status,
      promptSections: AGENT_TEMPLATES[0].sections,
      systemPrompt: buildSystemPrompt(AGENT_TEMPLATES[0].sections, name, BUILTIN_SKILLS)
    });
  };'''

content = content.replace(new_agent_add_old, new_agent_add_new)

# 6. Replace EditAgentModal with AgentConfigModal
edit_modal_start = content.find("const EditAgentModal =")
edit_modal_end = content.find("};\n\nexport default function App()") + 2

agent_config_modal_code = '''const AgentConfigModal = ({ agent, onClose, onSave, builtinSkills }: { agent: Agent, onClose: () => void, onSave: (agent: Agent) => void, builtinSkills: Skill[] }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'instructions' | 'preview'>('profile');
  
  const [name, setName] = useState(agent.name);
  const [role, setRole] = useState(agent.role);
  const [status, setStatus] = useState(agent.status);
  
  const [sections, setSections] = useState<PromptSections>(agent.promptSections || AGENT_TEMPLATES[0].sections);
  const [rawPromptMode, setRawPromptMode] = useState(false);
  const [rawSystemPrompt, setRawSystemPrompt] = useState(agent.systemPrompt || buildSystemPrompt(sections, name, builtinSkills));

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
    onSave({
      ...agent,
      name,
      role,
      status,
      promptSections: sections,
      systemPrompt: rawSystemPrompt,
    });
  };

  const iconMap: Record<string, React.ElementType> = { Bot, BarChart2, Folder, Search, Code2, Sparkles };

  const renderArrayField = (field: 'responsibilities' | 'constraints' | 'exampleTasks', title: string) => (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</label>
        <button onClick={() => handleArrayAdd(field)} className="text-xs flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:opacity-80">
          <Plus size={12} /> Add
        </button>
      </div>
      <div className="space-y-2">
        {(sections[field] as string[]).map((item, idx) => (
          <div key={idx} className="flex gap-2 items-start">
            <input 
              value={item} 
              onChange={e => handleArrayChange(field, idx, e.target.value)}
              className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
            />
            <button onClick={() => handleArrayRemove(field, idx)} className="mt-2 text-slate-400 hover:text-red-500"><X size={16}/></button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Configure Agent: {name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          {['profile', 'instructions', 'preview'].map(t => (
            <button
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
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Name</label>
                <input value={name} onChange={e => {
                  setName(e.target.value);
                  if(!rawPromptMode) setRawSystemPrompt(buildSystemPrompt(sections, e.target.value, builtinSkills));
                }} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Role</label>
                <input value={role} onChange={e => setRole(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500">
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
                  <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg p-1">
                    <button onClick={() => setRawPromptMode(false)} className={`px-3 py-1 rounded text-xs font-semibold ${!rawPromptMode ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Form Mode</button>
                    <button onClick={() => setRawPromptMode(true)} className={`px-3 py-1 rounded text-xs font-semibold ${rawPromptMode ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Raw Prompt</button>
                  </div>
                </div>

                {!rawPromptMode ? (
                  <div className="space-y-4 pb-10">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Role ("Kamu adalah {name}, seorang...")</label>
                      <input value={sections.role} onChange={e => handleTextChange('role', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500" />
                    </div>
                    {renderArrayField('responsibilities', 'Responsibilities')}
                    {renderArrayField('constraints', 'Constraints')}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Output Format</label>
                      <textarea value={sections.outputFormat} onChange={e => handleTextChange('outputFormat', e.target.value)} rows={3} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500" />
                    </div>
                    {renderArrayField('exampleTasks', 'Example Tasks')}
                  </div>
                ) : (
                  <textarea 
                    value={rawSystemPrompt} 
                    onChange={e => setRawSystemPrompt(e.target.value)}
                    className="w-full h-full min-h-[300px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-4 text-sm font-mono text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="relative bg-slate-900 dark:bg-slate-950 p-6 rounded-xl border border-slate-800 shadow-inner overflow-auto max-h-[400px]">
              <button 
                onClick={() => navigator.clipboard.writeText(rawSystemPrompt)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition-colors"
                title="Copy to Clipboard"
              >
                <FileText size={16} />
              </button>
              <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap">{rawSystemPrompt}</pre>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-2">
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}'''

content = content[:edit_modal_start] + agent_config_modal_code + content[edit_modal_end:]

# Update the rendering in App component
content = content.replace(
'''      {editingAgent && (
        <EditAgentModal 
          agent={editingAgent}
          onClose={() => setEditingAgent(null)}
          onSave={handleUpdateAgent}
        />
      )}''',
'''      {editingAgent && (
        <AgentConfigModal 
          agent={editingAgent}
          onClose={() => setEditingAgent(null)}
          onSave={handleUpdateAgent}
          builtinSkills={skills}
        />
      )}'''
)

# 7. Update onSendMessage to use the correct systemPrompt
send_message_old = '''    const agent_name = agents[0]?.name || "Assistant";

    try {
      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          model: selectedModel,
          api_key: apiKeys[selectedProvider.provider] || '',
          agent_name,
          system_prompt: ''
        })
      });'''

send_message_new = '''    const activeAgent = agents.find(a => a.status === 'online') || agents[0];
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
          system_prompt
        })
      });'''

content = content.replace(send_message_old, send_message_new)

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("done")
