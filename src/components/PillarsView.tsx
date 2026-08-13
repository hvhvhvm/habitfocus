import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Pillar } from '../types';
import { Plus, Flame, Target, Trash2, ChevronRight, Check, StickyNote, Pin, PinOff, X, Save } from 'lucide-react';

interface Note {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  color?: string;
}

const NOTE_COLORS = [
  { label: 'Sage', value: '#3ECF8E' },
  { label: 'Amber', value: '#F5A623' },
  { label: 'Blue', value: '#6BA6FF' },
  { label: 'Purple', value: '#B98CF0' },
  { label: 'Pink', value: '#E06B9F' },
];

function loadNotes(): Note[] {
  try {
    const saved = localStorage.getItem('lockin_notes');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveNotes(notes: Note[]) {
  localStorage.setItem('lockin_notes', JSON.stringify(notes));
}

export const PillarsView: React.FC = () => {
  const { pillars, tasks, setIsAddPillarOpen, deletePillar, createTask, toggleTask, deleteTask } = useApp();
  const [selectedPillar, setSelectedPillar] = useState<Pillar | null>(null);
  const [newPillarTaskName, setNewPillarTaskName] = useState<string>('');
  const [selectedBlock, setSelectedBlock] = useState<'morning' | 'afternoon' | 'evening' | 'night'>('morning');
  const [isAddingTask, setIsAddingTask] = useState<boolean>(false);

  // Notes state
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteColor, setNoteColor] = useState(NOTE_COLORS[3].value); // purple default
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const noteBodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    saveNotes(notes);
  }, [notes]);

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) return;
    const now = new Date().toISOString();
    const newNote: Note = {
      id: `note_${Date.now()}`,
      title: noteTitle.trim() || 'Untitled',
      body: noteBody.trim(),
      pinned: false,
      createdAt: now,
      updatedAt: now,
      color: noteColor,
    };
    setNotes((prev) => [newNote, ...prev]);
    setNoteTitle('');
    setNoteBody('');
    setNoteColor(NOTE_COLORS[3].value);
    setIsAddingNote(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === editingNote.id ? { ...editingNote, updatedAt: new Date().toISOString() } : n
      )
    );
    setEditingNote(null);
  };

  const togglePin = (id: string) => {
    setNotes((prev) =>
      [...prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n))].sort(
        (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
      )
    );
  };

  const deleteNote = (id: string) => setNotes((prev) => prev.filter((n) => n.id !== id));

  const handleAddPillarTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPillarTaskName.trim() || !selectedPillar) return;
    await createTask({
      pillarId: selectedPillar.id,
      timeBlock: selectedBlock,
      name: newPillarTaskName.trim(),
      points: 15,
      repeatFrequency: 'daily',
    });
    setNewPillarTaskName('');
    setIsAddingTask(false);
  };

  const sortedNotes = [...notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' · ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    );
  };

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="mb-6">
        <div className="font-mono-code text-[11px] tracking-widest uppercase text-[#8A9891] mb-1">
          {pillars.length} Active Pillars
        </div>
        <div className="flex items-center justify-between">
          <h2 className="font-space font-bold text-2xl text-[#F4F6F5]">Core Pillars</h2>
          <button
            onClick={() => setIsAddPillarOpen(true)}
            className="flex items-center gap-1.5 bg-[#3ECF8E] hover:bg-[#32B87C] text-[#0B1510] font-sans font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" /> Add Pillar
          </button>
        </div>
      </div>

      {/* Pillars List */}
      <div className="flex flex-col gap-3 mb-8">
        {pillars.length === 0 ? (
          <div className="bg-[#16201B] border border-[#26332C] rounded-2xl p-8 text-center">
            <p className="font-space font-semibold text-lg text-[#F4F6F5] mb-2">No Pillars Created</p>
            <p className="text-xs text-[#8A9891] mb-4 max-w-xs mx-auto">
              Pillars represent your core life domains (e.g. Physical Mastery, Deep Work, Mindset, Sleep).
            </p>
            <button
              onClick={() => setIsAddPillarOpen(true)}
              className="bg-[#3ECF8E] text-[#0B1510] font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg hover:bg-[#32B87C] cursor-pointer"
            >
              + Create First Pillar
            </button>
          </div>
        ) : (
          pillars.map((pillar) => {
            const pillarTasks = tasks.filter((t) => t.pillarId === pillar.id);
            const completedCount = pillarTasks.filter((t) => t.completed).length;
            const totalCount = pillarTasks.length;
            const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            const radius = 18;
            const circumference = 2 * Math.PI * radius;
            const strokeDashoffset = circumference - (pct / 100) * circumference;

            return (
              <div
                key={pillar.id}
                onClick={() => setSelectedPillar(pillar)}
                className="flex items-center gap-4 bg-[#16201B] hover:bg-[#1D2922] border border-[#26332C] hover:border-[#3ECF8E]/30 rounded-2xl p-4 transition-all cursor-pointer group shadow-sm"
              >
                <div className="relative w-11 h-11 flex-shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
                    <circle cx="22" cy="22" r={radius} fill="none" stroke="#212D26" strokeWidth="4" />
                    <circle
                      cx="22" cy="22" r={radius} fill="none"
                      stroke={pillar.color || '#3ECF8E'} strokeWidth="4"
                      strokeLinecap="round" strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-base">{pillar.icon}</div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-space font-semibold text-base text-[#F4F6F5] truncate">{pillar.name}</div>
                  <div className="font-mono-code text-[11px] text-[#8A9891] flex items-center gap-2 mt-0.5">
                    <span>{completedCount}/{totalCount} tasks completed</span>
                    <span className="text-[#5E6D66]">•</span>
                    <span className="text-[#F5A623] flex items-center gap-0.5">
                      <Flame className="w-3 h-3" /> {pillar.streakDays || 1}d streak
                    </span>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-[#5E6D66] group-hover:text-[#F4F6F5] group-hover:translate-x-0.5 transition-all" />
              </div>
            );
          })
        )}
      </div>

      {/* ─────────────── NOTES SECTION ─────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-mono-code text-[11px] tracking-widest uppercase text-[#8A9891] mb-0.5">
              {notes.length} {notes.length === 1 ? 'Note' : 'Notes'}
            </div>
            <h3 className="font-space font-bold text-xl text-[#F4F6F5] flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-[#B98CF0]" /> Quick Notes
            </h3>
          </div>
          <button
            onClick={() => {
              setIsAddingNote(true);
              setEditingNote(null);
              setTimeout(() => noteBodyRef.current?.focus(), 60);
            }}
            className="flex items-center gap-1.5 bg-[#B98CF0]/15 hover:bg-[#B98CF0]/30 border border-[#B98CF0]/40 hover:border-[#B98CF0]/70 text-[#B98CF0] font-sans font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" /> New Note
          </button>
        </div>

        {/* Add Note Form */}
        {isAddingNote && (
          <form
            onSubmit={handleAddNote}
            className="mb-4 bg-[#16201B] border border-[#B98CF0]/50 rounded-2xl p-4 space-y-3 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-space font-semibold text-[#B98CF0] flex items-center gap-1.5">
                <StickyNote className="w-3.5 h-3.5" /> New Note
              </span>
              <button type="button" onClick={() => setIsAddingNote(false)} className="text-[#8A9891] hover:text-[#F4F6F5] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Title (optional)..."
              className="w-full bg-[#1D2922] border border-[#26332C] rounded-xl px-3 py-2 text-sm text-[#F4F6F5] placeholder-[#5E6D66] focus:outline-none focus:border-[#B98CF0] transition-colors"
            />

            <textarea
              ref={noteBodyRef}
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Write your note here..."
              rows={4}
              required
              className="w-full bg-[#1D2922] border border-[#26332C] rounded-xl px-3 py-2 text-sm text-[#F4F6F5] placeholder-[#5E6D66] focus:outline-none focus:border-[#B98CF0] transition-colors resize-none leading-relaxed"
            />

            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-mono-code text-[#8A9891]">Color:</span>
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setNoteColor(c.value)}
                  title={c.label}
                  className={`w-5 h-5 rounded-full border-2 transition-all cursor-pointer ${
                    noteColor === c.value ? 'border-[#F4F6F5] scale-125' : 'border-transparent opacity-50 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingNote(false)}
                className="flex-1 py-2 rounded-xl text-xs text-[#8A9891] border border-[#26332C] hover:bg-[#1D2922] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#B98CF0] hover:bg-[#A07BE0] text-[#0B1510] transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" /> Save Note
              </button>
            </div>
          </form>
        )}

        {/* Edit Note Form */}
        {editingNote && (
          <form
            onSubmit={handleSaveEdit}
            className="mb-4 bg-[#16201B] border border-[#B98CF0]/50 rounded-2xl p-4 space-y-3 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-space font-semibold text-[#B98CF0]">Edit Note</span>
              <button type="button" onClick={() => setEditingNote(null)} className="text-[#8A9891] hover:text-[#F4F6F5] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={editingNote.title}
              onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
              placeholder="Title..."
              className="w-full bg-[#1D2922] border border-[#26332C] rounded-xl px-3 py-2 text-sm text-[#F4F6F5] focus:outline-none focus:border-[#B98CF0] transition-colors"
            />
            <textarea
              value={editingNote.body}
              onChange={(e) => setEditingNote({ ...editingNote, body: e.target.value })}
              rows={4}
              required
              className="w-full bg-[#1D2922] border border-[#26332C] rounded-xl px-3 py-2 text-sm text-[#F4F6F5] focus:outline-none focus:border-[#B98CF0] transition-colors resize-none leading-relaxed"
            />
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-mono-code text-[#8A9891]">Color:</span>
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setEditingNote({ ...editingNote, color: c.value })}
                  title={c.label}
                  className={`w-5 h-5 rounded-full border-2 transition-all cursor-pointer ${
                    editingNote.color === c.value ? 'border-[#F4F6F5] scale-125' : 'border-transparent opacity-50 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingNote(null)}
                className="flex-1 py-2 rounded-xl text-xs text-[#8A9891] border border-[#26332C] hover:bg-[#1D2922] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#B98CF0] hover:bg-[#A07BE0] text-[#0B1510] cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" /> Save Changes
              </button>
            </div>
          </form>
        )}

        {/* Notes List */}
        {sortedNotes.length === 0 ? (
          <div className="bg-[#16201B] border border-dashed border-[#26332C] rounded-2xl p-6 text-center">
            <div className="text-3xl mb-2">📝</div>
            <p className="text-sm font-space font-semibold text-[#F4F6F5] mb-1">No notes yet</p>
            <p className="text-xs text-[#8A9891]">Tap "New Note" to jot down anything you want to remember.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedNotes.map((note) => (
              <div
                key={note.id}
                className="bg-[#16201B] border border-[#26332C] rounded-2xl p-4 relative group shadow-sm hover:border-[#2E3F36] transition-all"
                style={{ borderLeftColor: note.color || '#B98CF0', borderLeftWidth: '3px' }}
              >
                {note.pinned && (
                  <span className="absolute top-3 right-[4.5rem] text-[10px] font-mono-code text-[#F5A623] bg-[#F5A623]/10 border border-[#F5A623]/30 px-1.5 py-0.5 rounded-full pointer-events-none">
                    📌 Pinned
                  </span>
                )}

                <div className="flex items-start justify-between gap-2 mb-2">
                  <span
                    className="font-space font-semibold text-sm text-[#F4F6F5] cursor-pointer hover:text-[#B98CF0] transition-colors leading-snug"
                    onClick={() => { setEditingNote(note); setIsAddingNote(false); }}
                  >
                    {note.title}
                  </span>

                  <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => togglePin(note.id)}
                      className="p-1.5 text-[#8A9891] hover:text-[#F5A623] transition-colors cursor-pointer rounded-lg hover:bg-[#F5A623]/10"
                      title={note.pinned ? 'Unpin' : 'Pin note'}
                    >
                      {note.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="p-1.5 text-[#8A9891] hover:text-red-400 transition-colors cursor-pointer rounded-lg hover:bg-red-500/10"
                      title="Delete note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p
                  className="text-xs text-[#C8D5CE] leading-relaxed whitespace-pre-wrap cursor-pointer"
                  onClick={() => { setEditingNote(note); setIsAddingNote(false); }}
                >
                  {note.body}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: note.color || '#B98CF0' }} />
                  <span className="font-mono-code text-[10px] text-[#5E6D66]">
                    {note.updatedAt !== note.createdAt ? 'Edited ' : ''}{formatDate(note.updatedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pillar Detail Modal */}
      {selectedPillar && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#16201B] border border-[#26332C] rounded-3xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto no-scrollbar shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-[#26332C] pb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-2 bg-[#1D2922] rounded-2xl border border-[#26332C]">{selectedPillar.icon}</span>
                <div>
                  <h3 className="font-space font-bold text-xl text-[#F4F6F5]">{selectedPillar.name}</h3>
                  <p className="font-mono-code text-xs text-[#8A9891]">{selectedPillar.dailyGoal || 'Daily domain focus'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPillar(null)}
                className="text-[#8A9891] hover:text-[#F4F6F5] font-mono-code text-xs p-1 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-[#1D2922] border border-[#26332C] rounded-2xl p-3.5">
                <span className="font-mono-code text-[10px] text-[#8A9891] uppercase block mb-1">Daily Streak</span>
                <span className="font-space font-bold text-xl text-[#F5A623] flex items-center gap-1">
                  <Flame className="w-4 h-4" /> {selectedPillar.streakDays || 1} Days
                </span>
              </div>
              <div className="bg-[#1D2922] border border-[#26332C] rounded-2xl p-3.5">
                <span className="font-mono-code text-[10px] text-[#8A9891] uppercase block mb-1">Tasks Done</span>
                <span className="font-space font-bold text-xl text-[#3ECF8E] flex items-center gap-1">
                  <Target className="w-4 h-4" />{' '}
                  {tasks.filter((t) => t.pillarId === selectedPillar.id && t.completed).length}/
                  {tasks.filter((t) => t.pillarId === selectedPillar.id).length}
                </span>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-mono-code text-xs text-[#8A9891] uppercase tracking-wider">
                  Associated Tasks ({tasks.filter((t) => t.pillarId === selectedPillar.id).length})
                </h4>
                <button
                  onClick={() => setIsAddingTask(!isAddingTask)}
                  className="font-mono-code text-xs text-[#3ECF8E] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Task
                </button>
              </div>

              {isAddingTask && (
                <form onSubmit={handleAddPillarTask} className="mb-3 bg-[#1D2922] border border-[#26332C] p-3 rounded-xl flex flex-col gap-2">
                  <input
                    type="text"
                    required
                    value={newPillarTaskName}
                    onChange={(e) => setNewPillarTaskName(e.target.value)}
                    placeholder={`New task for ${selectedPillar.name}...`}
                    className="w-full bg-[#16201B] border border-[#26332C] rounded-lg px-3 py-2 text-xs text-[#F4F6F5] focus:outline-none focus:border-[#3ECF8E]"
                    autoFocus
                  />
                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={selectedBlock}
                      onChange={(e) => setSelectedBlock(e.target.value as any)}
                      className="bg-[#16201B] border border-[#26332C] text-[#8A9891] text-xs px-2 py-1 rounded-lg focus:outline-none"
                    >
                      <option value="morning">☀️ Morning</option>
                      <option value="afternoon">✨ Afternoon</option>
                      <option value="evening">🌇 Evening</option>
                      <option value="night">🌙 Night</option>
                    </select>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setIsAddingTask(false)} className="text-xs text-[#8A9891] px-2 py-1">Cancel</button>
                      <button type="submit" className="bg-[#3ECF8E] text-[#0B1510] font-bold text-xs px-3 py-1 rounded-lg cursor-pointer">Save Task</button>
                    </div>
                  </div>
                </form>
              )}

              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                {tasks.filter((t) => t.pillarId === selectedPillar.id).length === 0 ? (
                  <p className="text-xs text-[#8A9891] italic py-2">No tasks assigned to this pillar yet.</p>
                ) : (
                  tasks
                    .filter((t) => t.pillarId === selectedPillar.id)
                    .map((t) => (
                      <div key={t.id} className="flex items-center justify-between bg-[#1D2922] border border-[#26332C] rounded-xl px-3 py-2 text-xs gap-2">
                        <div onClick={() => toggleTask(t.id)} className="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${t.completed ? 'bg-[#3ECF8E] border-[#3ECF8E] text-[#0B1510]' : 'border-[#5E6D66]'}`}>
                            {t.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span className={`truncate ${t.completed ? 'line-through text-[#5E6D66]' : 'text-[#F4F6F5]'}`}>{t.name}</span>
                        </div>
                        <span className="font-mono-code text-[10px] text-[#8A9891] uppercase flex-shrink-0">{t.timeBlock}</span>
                        <button onClick={() => deleteTask(t.id)} className="text-[#5E6D66] hover:text-red-400 p-0.5 cursor-pointer flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-[#26332C] pt-4">
              <button
                onClick={() => { deletePillar(selectedPillar.id); setSelectedPillar(null); }}
                className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 py-2.5 rounded-xl font-sans text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Pillar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
