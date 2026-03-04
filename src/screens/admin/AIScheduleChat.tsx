import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useRef, useMemo } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    TextInput, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useSchedules, useRooms, useTeachers, useSubjects, useSections } from '../../hooks/useSupabase';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';
import { sendToGemini, GeminiMessage } from '../../services/optibotService';
import { AnimatedPressable } from '../../components/AnimatedPressable';

interface ChatMessage {
    id: string;
    role: 'user' | 'ai';
    text: string;
    timestamp: Date;
}

const AI_SUGGESTIONS = [
    '🔍 Detect schedule conflicts',
    '🔄 Fix schedule automatically',
    '📊 Analyze room utilization',
    '⚖️ Check teacher workload balance',
    '📅 Show my schedule',
    '📋 Show unassigned subjects',
];

const AIScheduleChat: React.FC = () => {
    const { schedules, refetch: refetchSchedules } = useSchedules({ status: 'published' });
    const { rooms } = useRooms();
    const { teachers } = useTeachers();
    const { subjects } = useSubjects();
    const { sections } = useSections();
    const { profile } = useAuth();
    const scrollRef = useRef<ScrollView>(null);

    const userName = profile?.full_name?.split(' ')[0] || 'Admin';
    const userRole = profile?.role || 'admin';

    // Markdown renderer for AI messages
    const renderMarkdown = (text: string) => {
        const lines = text.split('\n');
        return lines.map((line, lineIdx) => {
            if (line.startsWith('### ')) return <Text key={lineIdx} style={{ fontSize: 14, fontWeight: '700', color: '#c4b5fd', marginTop: 8, marginBottom: 4 }}>{line.slice(4)}{'\n'}</Text>;
            if (line.startsWith('## ')) return <Text key={lineIdx} style={{ fontSize: 15, fontWeight: '700', color: '#a78bfa', marginTop: 8, marginBottom: 4 }}>{line.slice(3)}{'\n'}</Text>;
            if (line.startsWith('# ')) return <Text key={lineIdx} style={{ fontSize: 16, fontWeight: '700', color: '#818cf8', marginTop: 8, marginBottom: 4 }}>{line.slice(2)}{'\n'}</Text>;
            if (line.match(/^[\s]*[-•*]\s/)) {
                const content = line.replace(/^[\s]*[-•*]\s/, '');
                return <Text key={lineIdx} style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 21 }}>  •  {renderInline(content)}{'\n'}</Text>;
            }
            return <Text key={lineIdx} style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 21 }}>{renderInline(line)}{lineIdx < lines.length - 1 ? '\n' : ''}</Text>;
        });
    };

    const renderInline = (text: string): (string | React.ReactElement)[] => {
        const parts: (string | React.ReactElement)[] = [];
        const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
        let lastIndex = 0; let match; let key = 0;
        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
            if (match[2]) parts.push(<Text key={key++} style={{ fontWeight: '700', color: '#c4b5fd' }}>{match[2]}</Text>);
            else if (match[3]) parts.push(<Text key={key++} style={{ fontStyle: 'italic', color: '#93c5fd' }}>{match[3]}</Text>);
            else if (match[4]) parts.push(<Text key={key++} style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', backgroundColor: 'rgba(99,102,241,0.15)', color: '#a5b4fc', fontSize: 13 }}>{match[4]}</Text>);
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < text.length) parts.push(text.slice(lastIndex));
        return parts.length > 0 ? parts : [text];
    };

    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: '0', role: 'ai', timestamp: new Date(),
            text: `Hi ${userName}! I'm your AI Schedule Assistant. I know you're logged in as **${profile?.full_name || 'User'}** (${userRole}).\n\nI can help you:\n• Detect conflicts\n• Analyze room usage\n• Check teacher loads\n• Show your schedule\n• Suggest improvements\n\nWhat would you like to do?`
        },
    ]);
    const [input, setInput] = useState('');
    const [processing, setProcessing] = useState(false);
    const [pendingPlan, setPendingPlan] = useState<{ type: string; actions: any[] } | null>(null);
    const conversationHistoryRef = useRef<GeminiMessage[]>([]);

    const addMessage = (role: 'user' | 'ai', text: string) => {
        setMessages(prev => [...prev, { id: String(Date.now()), role, text, timestamp: new Date() }]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    };

    // Helper to check if two time ranges overlap
    const timesOverlap = (start1: string | null, end1: string | null, start2: string | null, end2: string | null): boolean => {
        if (!start1 || !end1 || !start2 || !end2) return false;

        const s1 = new Date(`2000-01-01T${start1}`);
        const e1 = new Date(`2000-01-01T${end1}`);
        const s2 = new Date(`2000-01-01T${start2}`);
        const e2 = new Date(`2000-01-01T${end2}`);

        return (s1 < e2 && s2 < e1);
    };

    // Helper to format time
    const formatTime = (timeString: string | null) => {
        if (!timeString) return 'N/A';
        const [hours, minutes] = timeString.split(':');
        const date = new Date();
        date.setHours(parseInt(hours, 10));
        date.setMinutes(parseInt(minutes, 10));
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    // Analytics helpers
    const detectConflicts = () => {
        const conflicts: string[] = [];

        // Room double-bookings (using time overlap)
        const dayRoomGroups = new Map<string, typeof schedules>();
        schedules.forEach(s => {
            const key = `${s.room_id}-${s.day_of_week}`;
            if (!dayRoomGroups.has(key)) dayRoomGroups.set(key, []);
            dayRoomGroups.get(key)!.push(s);
        });
        dayRoomGroups.forEach((group) => {
            for (let i = 0; i < group.length; i++) {
                for (let j = i + 1; j < group.length; j++) {
                    if (timesOverlap(group[i].start_time, group[i].end_time, group[j].start_time, group[j].end_time)) {
                        const roomName = group[i].room?.name || 'Unknown';
                        conflicts.push(`\uD83D\uDEA8 Room \"${roomName}\" double-booked on ${group[i].day_of_week}: ${group[i].subject?.name} (${formatTime(group[i].start_time)}) & ${group[j].subject?.name} (${formatTime(group[j].start_time)})`);
                    }
                }
            }
        });

        // Teacher overlaps
        const teacherMap = new Map<string, typeof schedules>();
        schedules.forEach(s => {
            if (!s.teacher_id) return;
            const key = `${s.teacher_id}-${s.day_of_week}`;
            if (!teacherMap.has(key)) teacherMap.set(key, []);
            teacherMap.get(key)!.push(s);
        });
        teacherMap.forEach((group) => {
            for (let i = 0; i < group.length; i++) {
                for (let j = i + 1; j < group.length; j++) {
                    if (timesOverlap(group[i].start_time, group[i].end_time, group[j].start_time, group[j].end_time)) {
                        const name = group[i].teacher?.profile?.full_name || 'Teacher';
                        conflicts.push(`\u26A0\uFE0F \"${name}\" has overlapping schedule on ${group[i].day_of_week}: ${group[i].subject?.name} vs ${group[j].subject?.name}`);
                    }
                }
            }
        });

        if (conflicts.length === 0) return '\u2705 **No conflicts detected!** All schedules are clean.';
        return `Found **${conflicts.length}** conflict(s):\n\n${conflicts.join('\n\n')}`;
    };

    const analyzeRoomUtilization = () => {
        if (rooms.length === 0) return 'No rooms found in the database. Add rooms first via Data Management.';

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const totalSlots = rooms.length * days.length * 10; // ~10 slots per day
        const usedSlots = schedules.length;
        const utilization = totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;

        const roomUsage = new Map<string, number>();
        rooms.forEach(r => roomUsage.set(r.id, 0));
        schedules.forEach(s => {
            if (s.room_id) roomUsage.set(s.room_id, (roomUsage.get(s.room_id) || 0) + 1);
        });

        const sorted = rooms.map(r => ({ name: r.name, count: roomUsage.get(r.id) || 0, capacity: r.capacity }))
            .sort((a, b) => b.count - a.count);

        const top3 = sorted.slice(0, 3).map(r => `  • ${r.name}: ${r.count} classes (cap: ${r.capacity})`).join('\n');
        const unused = sorted.filter(r => r.count === 0).map(r => r.name);

        let result = `**Room Utilization Report**\n\nOverall: ${utilization}% utilized\nTotal Rooms: ${rooms.length}\nTotal Scheduled Classes: ${usedSlots}\n\n**Most Used Rooms:**\n${top3}`;

        if (unused.length > 0) {
            result += `\n\n**Unused Rooms (${unused.length}):**\n  ${unused.join(', ')}`;
            result += `\n\n*Consider assigning classes to unused rooms to balance the load.*`;
        }
        return result;
    };

    const analyzeTeacherLoad = () => {
        if (teachers.length === 0) return 'No teachers found in the database.';

        const teacherClasses = new Map<string, number>();
        teachers.forEach(t => teacherClasses.set(t.id, 0));
        schedules.forEach(s => {
            if (s.teacher_id) teacherClasses.set(s.teacher_id, (teacherClasses.get(s.teacher_id) || 0) + 1);
        });

        const stats = teachers.map(t => ({
            name: t.profile?.full_name || 'Unknown',
            classes: teacherClasses.get(t.id) || 0,
            load: t.current_load_percentage,
            maxHours: t.max_hours,
            type: t.employment_type
        })).sort((a, b) => b.load - a.load);

        const overloaded = stats.filter(t => t.load > 100);
        const underloaded = stats.filter(t => t.classes === 0);

        let result = `**Teacher Workload Analysis**\n\nTotal Teachers: ${teachers.length}\nAvg Load: ${Math.round(stats.reduce((s, t) => s + t.load, 0) / stats.length)}%\n`;

        if (overloaded.length > 0) {
            result += `\n**Overloaded (${overloaded.length}):**\n${overloaded.map(t => `  • ${t.name}: ${t.load}% (${t.classes} classes, max ${t.maxHours}h)`).join('\n')}`;
        }
        if (underloaded.length > 0) {
            result += `\n\n**No Classes Assigned (${underloaded.length}):**\n  ${underloaded.map(t => t.name).join(', ')}`;
        }

        const balanced = stats.filter(t => t.load >= 50 && t.load <= 100);
        result += `\n\n**Balanced (${balanced.length}):** ${balanced.map(t => t.name).join(', ') || 'None'}`;

        if (overloaded.length > 0) {
            result += `\n\n*Suggestion: Redistribute classes from overloaded teachers to those with no assignments.*`;
        }
        return result;
    };

    const suggestOptimizations = () => {
        const suggestions: string[] = [];

        // Check for gaps in schedules
        const teacherDays = new Map<string, Map<string, string[]>>();
        schedules.forEach(s => {
            if (!s.teacher_id) return;
            const tName = s.teacher?.profile?.full_name || s.teacher_id;
            if (!teacherDays.has(tName)) teacherDays.set(tName, new Map());
            const dayMap = teacherDays.get(tName)!;
            if (!dayMap.has(s.day_of_week)) dayMap.set(s.day_of_week, []);
            dayMap.get(s.day_of_week)!.push(s.start_time || '');
        });

        // Check room capacity vs section size
        schedules.forEach(s => {
            if (s.room && s.section) {
                const cap = s.room.capacity || 0;
                const size = s.section.student_count || 0;
                if (size > cap && cap > 0) {
                    suggestions.push(`"${s.subject?.name}" has ${size} students but room "${s.room.name}" only fits ${cap}. Move to a larger room.`);
                }
            }
        });

        // Check unassigned
        const assignedSubjectIds = new Set(schedules.map(s => s.subject_id));
        const unassigned = subjects.filter(s => !assignedSubjectIds.has(s.id));
        if (unassigned.length > 0) {
            suggestions.push(`${unassigned.length} subject(s) have no schedule: ${unassigned.map(s => s.name).join(', ')}`);
        }

        // Check empty days
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const dayLoads = days.map(d => ({ day: d, count: schedules.filter(s => s.day_of_week === d).length }));
        const maxDay = dayLoads.reduce((a, b) => a.count > b.count ? a : b);
        const minDay = dayLoads.reduce((a, b) => a.count < b.count ? a : b);
        if (maxDay.count > 0 && minDay.count >= 0 && maxDay.count > minDay.count * 2) {
            suggestions.push(`Unbalanced days: ${maxDay.day} has ${maxDay.count} classes vs ${minDay.day} has ${minDay.count}. Consider redistributing.`);
        }

        if (suggestions.length === 0) {
            return '**Schedule looks well-optimized!** No major improvements needed.\n\nYour current setup has good room utilization, balanced loads, and no capacity issues.';
        }
        return `**Optimization Suggestions** (${suggestions.length}):\n\n${suggestions.join('\n\n')}`;
    };

    const getMySchedule = () => {
        if (userRole === 'admin') {
            return `You're logged in as **Admin (${profile?.full_name})**.\n\nAdmins don't have teaching schedules. But I can show you:\n\u2022 "Summary" \u2014 Schedule overview\n\u2022 "Check teacher workload" \u2014 Faculty analysis\n\u2022 "Detect conflicts" \u2014 Find issues`;
        }

        const myName = profile?.full_name || '';
        const mySchedules = schedules.filter(s => {
            const teacherName = s.teacher?.profile?.full_name || '';
            return teacherName.toLowerCase() === myName.toLowerCase() ||
                teacherName.toLowerCase().includes(myName.split(' ')[0].toLowerCase());
        });

        if (mySchedules.length === 0) {
            return `No classes found for **${myName}**.\n\nThis could mean:\n\u2022 You haven't been assigned classes yet\n\u2022 Your name in the schedule differs from your profile\n\u2022 Classes are in draft status`;
        }

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        let result = `**Your Schedule, ${userName}** (${mySchedules.length} classes)\n`;
        days.forEach(day => {
            const dayClasses = mySchedules.filter(s => s.day_of_week === day)
                .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
            if (dayClasses.length > 0) {
                result += `\n**${day}:**\n`;
                dayClasses.forEach(s => {
                    result += `  • ${formatTime(s.start_time)} - ${formatTime(s.end_time)} | ${s.subject?.name || 'Subject'} | ${s.room?.name || 'TBA'} | ${s.section?.name || ''}\n`;
                });
            }
        });
        return result;
    };

    const showUnassigned = () => {
        const assignedSubjectIds = new Set(schedules.map(s => s.subject_id));
        const unassigned = subjects.filter(s => !assignedSubjectIds.has(s.id));

        if (unassigned.length === 0) {
            return 'All subjects have been assigned to the schedule!';
        }
        return `**Unassigned Subjects (${unassigned.length}):**\n\n${unassigned.map(s => `  \u2022 ${s.code} \u2014 ${s.name} (${s.units} units, ${s.program} Year ${s.year_level})`).join('\n')}\n\n*Go to the Schedule tab to assign these subjects to time slots, rooms, and teachers.*`;
    };

    const generateFixPlan = () => {
        const actions: any[] = [];
        const planLines: string[] = [];

        // Find room conflicts (using time overlap)
        const dayRoomGroups = new Map<string, any[]>();
        schedules.forEach(s => {
            const key = `${s.room_id}-${s.day_of_week}`;
            if (!dayRoomGroups.has(key)) dayRoomGroups.set(key, []);
            dayRoomGroups.get(key)!.push(s);
        });
        dayRoomGroups.forEach((group) => {
            for (let i = 0; i < group.length; i++) {
                for (let j = i + 1; j < group.length; j++) {
                    if (timesOverlap(group[i].start_time, group[i].end_time, group[j].start_time, group[j].end_time)) {
                        const conflict = group[j];
                        const availableRoom = rooms.find(r => {
                            const used = schedules.some(s => s.room_id === r.id && s.day_of_week === conflict.day_of_week && timesOverlap(s.start_time, s.end_time, conflict.start_time, conflict.end_time));
                            return !used && r.id !== conflict.room_id;
                        });
                        if (availableRoom) {
                            actions.push({ type: 'move_room', scheduleId: conflict.id, fromRoom: conflict.room?.name, toRoom: availableRoom.name, toRoomId: availableRoom.id, day: conflict.day_of_week, time: conflict.start_time, subject: conflict.subject?.name });
                            planLines.push(`Move **"${conflict.subject?.name}"** from "${conflict.room?.name}" -> "${availableRoom.name}" (${conflict.day_of_week} at ${formatTime(conflict.start_time)})`);
                        }
                    }
                }
            }
        });

        // Find unassigned subjects and auto-assign
        const assignedSubjectIds = new Set(schedules.map(s => s.subject_id));
        const unassigned = subjects.filter(s => !assignedSubjectIds.has(s.id));
        const availableDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const timeSlots = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

        unassigned.slice(0, 5).forEach((subj, i) => {
            const day = availableDays[i % availableDays.length];
            const time = timeSlots[i % timeSlots.length];
            const freeRoom = rooms.find(r => !schedules.some(s => s.room_id === r.id && s.day_of_week === day && s.start_time === time));
            const freeTeacher = teachers.find(t => !schedules.some(s => s.teacher_id === t.id && s.day_of_week === day && s.start_time === time));
            if (freeRoom && freeTeacher) {
                actions.push({ type: 'create_schedule', subjectId: subj.id, subjectName: subj.name, roomId: freeRoom.id, roomName: freeRoom.name, teacherId: freeTeacher.id, teacherName: freeTeacher.profile?.full_name || 'Teacher', day, startTime: time, endTime: timeSlots[(i % timeSlots.length) + 1] || '17:00' });
                planLines.push(`Schedule **"${subj.name}"** -> ${freeRoom.name}, ${freeTeacher.profile?.full_name || 'Teacher'} (${day} ${formatTime(time)})`);
            }
        });

        if (actions.length === 0) {
            return { text: '**No fixes needed!** Your schedule looks clean — no conflicts or unassigned subjects found.', actions: [] };
        }

        const planText = `**AI Schedule Fix Plan**\n\nI analyzed your data and found **${actions.length}** action(s) to take:\n\n${planLines.join('\n\n')}\n\n**Do you want me to execute these changes?** Reply **"Yes"** to confirm or **"No"** to cancel.`;
        return { text: planText, actions };
    };

    const executePlan = async (actions: any[]) => {
        let completed = 0;
        for (const action of actions) {
            try {
                if (action.type === 'move_room') {
                    await supabase.from('schedules').update({ room_id: action.toRoomId }).eq('id', action.scheduleId);
                    completed++;
                } else if (action.type === 'create_schedule') {
                    await supabase.from('schedules').insert({
                        subject_id: action.subjectId,
                        room_id: action.roomId,
                        teacher_id: action.teacherId,
                        day_of_week: action.day,
                        start_time: action.startTime,
                        end_time: action.endTime,
                        status: 'published'
                    });
                    completed++;
                }
            } catch { /* skip failed actions */ }
        }

        // Also resolve any matching conflicts in the DB
        try {
            const { data: openConflicts } = await supabase
                .from('conflicts')
                .select('id')
                .eq('status', 'detected');
            if (openConflicts && openConflicts.length > 0 && profile?.id) {
                for (const c of openConflicts) {
                    await supabase.from('conflicts').update({
                        status: 'resolved',
                        resolved_by: profile.id,
                        resolved_at: new Date().toISOString(),
                    }).eq('id', c.id);
                }
            }
        } catch { /* conflicts table may not exist */ }

        refetchSchedules();
        return `Success: **Done!** Successfully executed **${completed}/${actions.length}** changes.\n\nThe schedule has been updated and conflicts have been resolved. You can verify by asking me to "detect conflicts" or "show summary".`;
    };

    const handleSend = async (text?: string) => {
        const msg = (text || input).trim();
        if (!msg || processing) return;

        addMessage('user', msg);
        setInput('');
        setProcessing(true);

        // Simulated AI processing delay
        await new Promise(r => setTimeout(r, 600));

        const lower = msg.toLowerCase();
        let response = '';

        // Handle pending plan confirmation
        if (pendingPlan) {
            if (lower === 'yes' || lower === 'confirm' || lower === 'approve' || lower === 'do it' || lower === 'go ahead') {
                addMessage('ai', 'Processing: Executing plan... Please wait.');
                response = await executePlan(pendingPlan.actions);
                setPendingPlan(null);
            } else if (lower === 'no' || lower === 'cancel' || lower === 'stop' || lower === 'nevermind') {
                response = 'Cancelled: Plan cancelled. No changes were made. Let me know if you need anything else!';
                setPendingPlan(null);
            } else {
                response = 'I have a pending plan. Please reply **"Yes"** to execute the changes or **"No"** to cancel.';
            }
            addMessage('ai', response);
            setProcessing(false);
            return;
        }

        // Admin action keywords — always pass to AI for $$ACTION execution
        const isAdminAction = lower.includes('create account') || lower.includes('create user') || lower.includes('make account') ||
            lower.includes('make user') || lower.includes('add user') || lower.includes('add account') ||
            lower.includes('new user') || lower.includes('new account') || lower.includes('register') ||
            lower.includes('create event') || lower.includes('add event') || lower.includes('delete event') ||
            lower.includes('update profile') || lower.includes('change role') || lower.includes('create an');

        if (isAdminAction) {
            // Pass directly to AI for action execution
        } else if (lower.includes('conflict') || lower.includes('detect') || lower.includes('clash')) {
            response = detectConflicts();
        } else if (lower.includes('room') && (lower.includes('util') || lower.includes('usage') || lower.includes('analyz'))) {
            response = analyzeRoomUtilization();
        } else if ((lower.includes('teacher') || lower.includes('workload') || lower.includes('faculty')) && (lower.includes('load') || lower.includes('balanc') || lower.includes('check') || lower.includes('analyz'))) {
            response = analyzeTeacherLoad();
        } else if (lower.includes('optim') || lower.includes('suggest') || lower.includes('improve') || lower.includes('better')) {
            response = suggestOptimizations();
        } else if (lower.includes('unassigned') || lower.includes('missing') || lower.includes('without')) {
            response = showUnassigned();
        } else if (lower.includes('summary') || lower.includes('overview') || lower.includes('status')) {
            response = `**Schedule Overview**\n\n• Total Schedules: ${schedules.length}\n• Rooms: ${rooms.length}\n• Teachers: ${teachers.length}\n• Subjects: ${subjects.length}\n• Sections: ${sections.length}\n\nPublished schedules across the week. Ask me to analyze any area in detail!`;
        } else if (lower.includes('who am i') || lower.includes('who i am') || lower.includes('my name') || lower.includes('my account') || lower.includes('my profile')) {
            response = `You are **${profile?.full_name || 'Unknown'}**\n\n• Role: ${userRole}\n• Email: ${profile?.email || 'N/A'}${profile?.program ? `\n• Program: ${profile.program}` : ''}${profile?.section ? `\n• Section: ${profile.section}` : ''}\n\nI have full access to all schedule data to help you!`;
        } else if (lower.includes('my schedule') || lower.includes('my class') || lower.includes('my timetable') || lower.includes('schedule today') || lower.includes('classes today')) {
            response = getMySchedule();
        } else if ((lower.includes('fix') || lower.includes('auto') || lower.includes('resolve')) && (lower.includes('schedule') || lower.includes('conflict'))) {
            const plan = generateFixPlan();
            if (plan.actions.length > 0) {
                setPendingPlan({ type: 'fix', actions: plan.actions });
            }
            response = plan.text;
        } else if (lower.includes('upcoming') || lower.includes('next class') || lower.includes('tomorrow') || lower.includes('today') || lower.includes('schedule for') || lower.includes('this week')) {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const today = days[new Date().getDay()];
            const todaySchedules = schedules.filter(s => s.day_of_week === today)
                .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
            if (todaySchedules.length === 0) {
                response = `**No classes scheduled for today (${today}).**\n\nTry asking about a specific day or "show summary" for the full overview.`;
            } else {
                response = `**Today's Classes (${today}) \u2014 ${todaySchedules.length} sessions:**\n\n${todaySchedules.map(s => `  • ${formatTime(s.start_time)} - ${formatTime(s.end_time)} | ${s.subject?.name || 'Subject'} | ${s.room?.name || 'TBA'} | ${s.teacher?.profile?.full_name || 'Teacher'} | ${s.section?.name || ''}`).join('\n')}`;
            }
        }

        // Fallback: Use Gemini AI with full schedule context for admin actions or unmatched queries
        if (!response) {
            try {
                conversationHistoryRef.current.push({ role: 'user', parts: [{ text: msg }] });
                response = await sendToGemini(
                    msg,
                    conversationHistoryRef.current,
                    { full_name: profile?.full_name, role: userRole, email: profile?.email }
                );
                conversationHistoryRef.current.push({ role: 'model', parts: [{ text: response }] });
            } catch {
                response = `I can help you with:\n\n• **"Detect conflicts"** — Find room clashes and teacher overlaps\n• **"Analyze room utilization"** — See which rooms are over/under-used\n• **"Check teacher workload"** — Review load balance across faculty\n• **"Create accounts"** — Create student/teacher accounts\n• **"List students"** — Show all registered students\n• **"Add event"** — Create a school event\n• **"Add schedule"** — Create a class schedule\n\nOr ask me anything about school operations!`;
            }
        }

        addMessage('ai', response);
        setProcessing(false);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(99,102,241,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                        <MaterialIcons name="smart-toy" size={20} color="#818cf8" />
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>AI Schedule Assistant</Text>
                        <Text style={{ fontSize: 11, color: Colors.slate500 }}>{schedules.length} schedules loaded</Text>
                    </View>
                </View>
                <AnimatedPressable onPress={() => {
                    refetchSchedules();
                    addMessage('ai', 'Data refreshed! I now have the latest schedule information.');
                }}>
                    <MaterialIcons name="refresh" size={24} color={Colors.slate400} />
                </AnimatedPressable>
            </View>

            <ScrollView ref={scrollRef} style={styles.chatArea} contentContainerStyle={{ paddingVertical: 12 }}
                showsVerticalScrollIndicator={false} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
                {messages.map(msg => (
                    <View key={msg.id} style={[styles.msgRow, msg.role === 'user' && { justifyContent: 'flex-end' }]}>
                        {msg.role === 'ai' && (
                            <View style={styles.aiBubbleIcon}>
                                <MaterialIcons name="smart-toy" size={16} color="#818cf8" />
                            </View>
                        )}
                        <View style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                            {msg.role === 'ai' ? (
                                <Text style={styles.bubbleText}>{renderMarkdown(msg.text)}</Text>
                            ) : (
                                <Text style={[styles.bubbleText, { color: Colors.white }]}>{msg.text}</Text>
                            )}
                            <Text style={styles.bubbleTime}>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                        </View>
                    </View>
                ))}
                {processing && (
                    <View style={styles.msgRow}>
                        <View style={styles.aiBubbleIcon}>
                            <MaterialIcons name="smart-toy" size={16} color="#818cf8" />
                        </View>
                        <View style={[styles.bubble, styles.aiBubble]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <ActivityIndicator size="small" color="#818cf8" />
                                <Text style={{ color: Colors.slate400, fontSize: 13 }}>Analyzing schedules...</Text>
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Suggestions */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={{ maxHeight: 44, paddingHorizontal: 12 }} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
                {AI_SUGGESTIONS.map((s, i) => (
                    <AnimatedPressable key={i} style={styles.sugChip} onPress={() => handleSend(s.replace(/^[^\s]+\s/, ''))}>
                        <Text style={styles.sugText}>{s}</Text>
                    </AnimatedPressable>
                ))}
            </ScrollView>

            {/* Input */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.input}
                        value={input} onChangeText={setInput}
                        placeholder="Ask about schedules..." placeholderTextColor="#6b7280"
                        onSubmitEditing={() => handleSend()}
                        editable={!processing}
                    />
                    <AnimatedPressable
                        style={[styles.sendBtn, (!input.trim() || processing) && { opacity: 0.4 }]}
                        onPress={() => handleSend()} disabled={!input.trim() || processing}
                    >
                        <MaterialIcons name="send" size={20} color={Colors.white} />
                    </AnimatedPressable>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

function formatTime(time: string | null): string {
    if (!time) return '--';
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

function timesOverlap(s1: string | null, e1: string | null, s2: string | null, e2: string | null): boolean {
    if (!s1 || !e1 || !s2 || !e2) return false;
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    return toMin(s1) < toMin(e2) && toMin(s2) < toMin(e1);
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b'
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimaryDark },
    chatArea: { flex: 1, paddingHorizontal: 12 },
    msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, gap: 8 },
    aiBubbleIcon: {
        width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(99,102,241,0.12)',
        justifyContent: 'center', alignItems: 'center', marginBottom: 2
    },
    bubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
    userBubble: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
    aiBubble: { backgroundColor: '#1e293b', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#334155' },
    bubbleText: { fontSize: 14, lineHeight: 21, color: Colors.slate300 },
    bubbleTime: { fontSize: 10, color: Colors.slate600, marginTop: 4, textAlign: 'right' },
    sugChip: {
        backgroundColor: '#1e293b', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
        borderWidth: 1, borderColor: '#334155'
    },
    sugText: { fontSize: 12, color: Colors.slate300, fontWeight: '500' },
    inputRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#1e293b'
    },
    input: {
        flex: 1, backgroundColor: '#1e293b', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12,
        color: Colors.white, fontSize: 14, borderWidth: 1, borderColor: '#334155'
    },
    sendBtn: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary,
        justifyContent: 'center', alignItems: 'center'
    }
});

export default AIScheduleChat;
