import React, { useState } from 'react';
import { Bot, Send, X, Sparkles, MessageCircle } from 'lucide-react';
import { Character, WorldLocation } from '../types/rpg';
import { talkToMiki } from '../services/mikiApi';

interface CompanionModalProps {
  character: Character;
  worldLocation: WorldLocation;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'miki' | 'player';
  text: string;
  time: string;
}

export const CompanionModal: React.FC<CompanionModalProps> = ({
  character,
  worldLocation,
  onClose
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'miki',
      text: `Hey ${character.name}! I'm watching your back here in ${worldLocation.name}. Need tactical advice, lore on this region, or want to plan our next move?`,
      time: 'Just now'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'player',
      text: inputText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const reply = await talkToMiki(userMsg.text, character, worldLocation);
      const mikiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'miki',
        text: reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, mikiMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'miki',
        text: `I'm with you, ${character.name}! Keep your sword sharp and your wits sharper.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    'What monsters lurk in this area?',
    'What should my character build focus on next?',
    'Tell me an ancient tale about this realm',
    'Do you have any tactical combat tips?'
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-amber-500/40 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/60">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Bot className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-bold text-amber-300 text-base flex items-center gap-1.5">
                MIKI Companion Dialogue
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-700 px-1.5 py-0.2 rounded-full font-mono">
                  Online
                </span>
              </h2>
              <p className="text-xs text-stone-400">Tactical guidance, realm secrets, and companion banter</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Body */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 max-h-96">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-3 rounded-xl border text-xs sm:text-sm leading-relaxed max-w-[85%] ${
                msg.sender === 'player'
                  ? 'ml-auto bg-amber-950/30 border-amber-800/60 text-stone-100'
                  : 'mr-auto bg-stone-950 border-stone-800 text-stone-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1 text-[10px] font-mono text-stone-400">
                <span className={msg.sender === 'player' ? 'text-amber-400 font-bold' : 'text-amber-300 font-bold'}>
                  {msg.sender === 'player' ? character.name : 'MIKI'}
                </span>
                <span>{msg.time}</span>
              </div>
              <p>{msg.text}</p>
            </div>
          ))}

          {isLoading && (
            <div className="mr-auto p-3 rounded-xl bg-stone-950 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 animate-pulse">
              <Bot className="w-4 h-4 animate-spin" />
              <span>MIKI is thinking...</span>
            </div>
          )}
        </div>

        {/* Quick prompt suggestions */}
        <div className="px-4 py-2 bg-stone-950/40 border-t border-stone-800/80 flex items-center gap-1.5 overflow-x-auto text-[11px]">
          {quickPrompts.map((q, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInputText(q);
              }}
              className="bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-amber-300 px-2.5 py-1 rounded-full whitespace-nowrap transition cursor-pointer border border-stone-700"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3 bg-stone-950 border-t border-stone-800 flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask MIKI for tactical advice or talk..."
            disabled={isLoading}
            className="flex-1 bg-stone-900 border border-stone-700 focus:border-amber-500 rounded-xl px-3 py-2 text-xs sm:text-sm text-stone-100 placeholder:text-stone-400 outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 text-stone-950 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
