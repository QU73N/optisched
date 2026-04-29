import React, { useState } from 'react';
import CommunicationHub from '../shared/CommunicationHub';
import TeacherToTeacherChat from './TeacherToTeacherChat';
import { MessageSquare, Users } from 'lucide-react';

const TeacherChatHub: React.FC = () => {
    const [tab, setTab] = useState<'admin' | 'teachers'>('admin');

    return (
        <div className="teacher-chat-hub">
            {/* Tab Switcher */}
            <div className="chat-tabs">
                <button className={`chat-tab ${tab === 'admin' ? 'active' : ''}`} onClick={() => setTab('admin')}>
                    <MessageSquare size={16} /> Admin Chat
                </button>
                <button className={`chat-tab ${tab === 'teachers' ? 'active' : ''}`} onClick={() => setTab('teachers')}>
                    <Users size={16} /> Teachers
                </button>
            </div>

            {/* Content */}
            <div className="chat-tab-content">
                {tab === 'admin' ? <CommunicationHub /> : <TeacherToTeacherChat />}
            </div>

            <style>{`
                .teacher-chat-hub { display: flex; flex-direction: column; height: calc(100vh - 140px); }
                .chat-tabs { display: flex; gap: 0.5rem; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-light); }
                .chat-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.75rem; border-radius: 12px; border: none; background: rgba(30,41,59,0.5); color: var(--text-muted); font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
                .chat-tab.active { background: #6366f1; color: white; }
                .chat-tab:hover:not(.active) { background: rgba(255,255,255,0.05); }
                .chat-tab-content { flex: 1; overflow: auto; }
            `}</style>
        </div>
    );
};

export default TeacherChatHub;
