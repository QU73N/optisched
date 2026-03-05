// OptiBot AI Service (Web) - Mirror of mobile optibotService.ts
// Multi-provider AI with Gemini, Groq, and OpenRouter + full database context + action execution

import { supabase, supabaseAdmin } from '../lib/supabase';

// === API Keys ===
const GEMINI_API_KEY = 'AIzaSyD3EnaaPrcEfmYIwNWIHeB-BoXWQlYxvp8';
const GROQ_API_KEY = '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';
const OPENROUTER_API_KEY = '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';

// === API URLs ===
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

const GEMINI_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5000;

const SYSTEM_PROMPT = `You are OptiSched AI, the dedicated scheduling and operations engine for STI College Meycauayan.

Your primary objective is to manage timetables, resolve scheduling conflicts, and provide operational data for administrators, faculty, and students.

## STRICT RULES (GUARDRAILS):

### 1. No Academic Assistance
If a user asks you to solve an assignment, write an essay, answer a quiz question, do homework, or any academic work, politely refuse.
Response: "I'm focused on scheduling and school operations. For academic help, please reach out to your instructor."

### 2. No Personal Advice
You must NOT give medical, legal, or financial advice.

### 3. Stay School-Related
You SHOULD answer questions about: schedules, classes, rooms, teachers, events, announcements, sections, subjects, school activities, upcoming events, exam schedules, conflicts, room availability, teacher workload - basically ANYTHING related to the school and its operations.
ONLY refuse clearly unrelated questions like "write me a poem", "what is the capital of France", or general trivia that has nothing to do with the school.
Do NOT be overly restrictive. If the question could reasonably be about school operations, answer it helpfully.

### 4. Professional Tone
Maintain a professional but friendly tone. Be helpful and informative.

### 5. Language Support
You can respond in both **English** and **Tagalog (Filipino)**.
- If the user writes in Tagalog, respond in Tagalog.
- If the user writes in Taglish (mix of Tagalog and English), respond in Taglish.
- If the user writes in English, respond in English.
- Always match the user's language naturally.

## SCHEDULING CONSTRAINTS:

### Hard Constraints:
- Zero-Overlap Rule: NEVER suggest a schedule where a Teacher, Room, or Section is in two places at the same time.
- Capacity Compliance: NEVER assign a Section to a Room if student count exceeds room capacity.
- Subject-Room Match: Ensure specialized subjects (Computer Lab, Science Lab) are assigned only to properly equipped rooms.

### Soft Objectives (Optimization):
- Minimize idle gaps between classes for students and faculty.
- Respect teacher "Blackout Dates" and preferred shifts.

### Conflict Validation:
Before answering any scheduling question, always prioritize checking for double-booked rooms or teachers.
When the admin wants to assign a room that is already booked for the same time slot, IMMEDIATELY flag the conflict and suggest alternative rooms or time slots.

## ROOM CONFLICT DETECTION:
When you detect a potential room scheduling conflict:
1. Clearly state which room is double-booked and for which time slots
2. List ALL schedules that occupy that room on the same day
3. Suggest the best available alternative rooms (check capacity and type)
4. If no alternative room is available, suggest alternative time slots

## CURRENT DATABASE CONTEXT:
You have access to the following data tables: schedules, teachers, rooms, subjects, sections, conflicts, teacher_preferences, custom_events.
When users ask about schedules, rooms, or teachers, provide data-informed responses based on the context provided.

## CUSTOM EVENTS AWARENESS:
The system has custom events created by teachers and admins. These events occupy time slots and should be treated as scheduling considerations.

## ADMIN ACTION EXECUTION:
When the current user is an ADMIN and they ask you to perform an action (create user, add event, delete event, etc.), you MUST execute it by including an action block.
Do NOT just describe what could be done - actually include the action block to execute it.

To execute an action, include an action block in your response using this EXACT format:
$$ACTION{"action":"ACTION_NAME","params":{...}}$$

Available actions (ADMIN ONLY):
- create_user: $$ACTION{"action":"create_user","params":{"full_name":"string","role":"student|teacher|admin","email":"optional","password":"optional","section":"optional","program":"optional","year_level":"optional"}}$$
- delete_user: $$ACTION{"action":"delete_user","params":{"user_email":"user@optisched.sti.edu"}}$$
- create_event: $$ACTION{"action":"create_event","params":{"title":"Event Name","description":"optional","event_date":"2026-03-15","start_time":"08:00","end_time":"17:00"}}$$
- delete_event: $$ACTION{"action":"delete_event","params":{"event_title":"Event Name"}}$$
- create_schedule: $$ACTION{"action":"create_schedule","params":{"subject_name":"Math","teacher_name":"John Doe","room_name":"Room 101","section_name":"BSIT-301","day_of_week":"Monday","start_time":"08:00","end_time":"09:30"}}$$
- delete_schedule: $$ACTION{"action":"delete_schedule","params":{"subject_name":"Math","day_of_week":"Monday","start_time":"08:00"}}$$
- create_announcement: $$ACTION{"action":"create_announcement","params":{"title":"Notice","content":"Classes suspended.","priority":"normal|important|urgent"}}$$
- create_subject: $$ACTION{"action":"create_subject","params":{"name":"Mathematics","code":"MATH101","units":3}}$$
- delete_subject: $$ACTION{"action":"delete_subject","params":{"name":"Mathematics"}}$$
- create_room: $$ACTION{"action":"create_room","params":{"name":"Room 101","type":"lecture|laboratory|computer_lab|gymnasium","capacity":40,"floor":1}}$$
- delete_room: $$ACTION{"action":"delete_room","params":{"name":"Room 101"}}$$
- create_section: $$ACTION{"action":"create_section","params":{"name":"BSIT-301","year_level":3,"program":"BSIT"}}$$
- delete_section: $$ACTION{"action":"delete_section","params":{"name":"BSIT-301"}}$$
- update_profile: $$ACTION{"action":"update_profile","params":{"user_email":"user@email.com","updates":{"full_name":"...","role":"..."}}}$$

Rules for actions:
- CRITICAL: If asked to create a student account and the user DID NOT specify their program, year_level, or section, DO NOT issue the create_user action. Instead, ask for those details first.
- You MUST use REAL dates, REAL times, REAL names - never use placeholders like YYYY-MM-DD
- If the user is not an admin, refuse: "Only administrators can perform system actions."

Keep responses concise, professional, and formatted with clear structure using bullet points or numbered lists when applicable.`;

export interface GeminiMessage {
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
}

// Fetch relevant context from Supabase for the AI
async function getScheduleContext(): Promise<string> {
    const db = supabaseAdmin || supabase;
    try {
        const [schedulesRes, teachersRes, roomsRes, conflictsRes, eventsRes, usersRes, subjectsRes, sectionsRes, announcementsRes] = await Promise.all([
            db.from('schedules').select('*, subject:subjects(name, code), teacher:teachers(profile:profiles(full_name)), room:rooms(name, capacity), section:sections(name)').eq('status', 'published').limit(50),
            db.from('teachers').select('*, profile:profiles(full_name)').eq('is_active', true),
            db.from('rooms').select('*'),
            db.from('conflicts').select('*').eq('is_resolved', false),
            db.from('custom_events').select('*').gte('event_date', new Date().toISOString().split('T')[0]).order('event_date', { ascending: true }).limit(20),
            db.from('profiles').select('id, email, full_name, role, program, section, year_level').order('created_at', { ascending: false }).limit(200),
            db.from('subjects').select('*'),
            db.from('sections').select('*'),
            db.from('announcements').select('*').order('created_at', { ascending: false }).limit(10),
        ]);

        let context = '\n\n## CURRENT SCHEDULE DATA:\n';

        if (schedulesRes.data && schedulesRes.data.length > 0) {
            context += '\n### Active Schedules:\n';
            for (const s of schedulesRes.data) {
                const subjectName = (s.subject as Record<string, string>)?.name || 'Unknown';
                const teacherName = ((s.teacher as Record<string, Record<string, string>>)?.profile as Record<string, string>)?.full_name || 'TBA';
                const roomName = (s.room as Record<string, string>)?.name || 'TBA';
                const sectionName = (s.section as Record<string, string>)?.name || '';
                context += `- ${s.day_of_week} ${s.start_time}-${s.end_time}: ${subjectName} | ${teacherName} | ${roomName} | ${sectionName}\n`;
            }
        }

        if (teachersRes.data && teachersRes.data.length > 0) {
            context += '\n### Active Teachers:\n';
            for (const t of teachersRes.data) {
                const name = (t.profile as Record<string, string>)?.full_name || 'Unknown';
                context += `- ${name} (${t.department}, ${t.employment_type}, load: ${t.current_load_percentage}%)\n`;
            }
        }

        if (roomsRes.data && roomsRes.data.length > 0) {
            context += '\n### Available Rooms:\n';
            for (const r of roomsRes.data) {
                context += `- ${r.name} (${r.type}, capacity: ${r.capacity}, floor: ${r.floor})\n`;
            }
        }

        if (conflictsRes.data && conflictsRes.data.length > 0) {
            context += `\n### Unresolved Conflicts: ${conflictsRes.data.length}\n`;
            for (const c of conflictsRes.data) {
                context += `- ${c.type}: ${c.description}\n`;
            }
        } else {
            context += '\n### Conflicts: None detected\n';
        }

        if (eventsRes.data && eventsRes.data.length > 0) {
            context += '\n### Upcoming Custom Events:\n';
            for (const e of eventsRes.data) {
                const timeStr = e.start_time && e.end_time ? ` (${e.start_time}-${e.end_time})` : '';
                context += `- [ID: ${e.id}] ${e.event_date}${timeStr}: ${e.title}${e.description ? ' - ' + e.description : ''}\n`;
            }
        } else {
            context += '\n### Events: No upcoming events\n';
        }

        if (usersRes.data && usersRes.data.length > 0) {
            const students = usersRes.data.filter((u: any) => u.role === 'student');
            const teacherUsers = usersRes.data.filter((u: any) => u.role === 'teacher');
            const admins = usersRes.data.filter((u: any) => u.role === 'admin');

            context += `\n### REGISTERED USERS (${usersRes.data.length} total):\n`;
            if (admins.length > 0) {
                context += `\n**Admins (${admins.length}):**\n`;
                for (const u of admins) context += `- ${u.full_name || 'N/A'} | ${u.email || 'N/A'}\n`;
            }
            if (teacherUsers.length > 0) {
                context += `\n**Teachers (${teacherUsers.length}):**\n`;
                for (const u of teacherUsers) context += `- ${u.full_name || 'N/A'} | ${u.email || 'N/A'}\n`;
            }
            if (students.length > 0) {
                context += `\n**Students (${students.length}):**\n`;
                for (const u of students) context += `- ${u.full_name || 'N/A'} | ${u.email || 'N/A'}${u.program ? ' | ' + u.program : ''}${u.section ? ' | Sec: ' + u.section : ''}\n`;
            }
        }

        if (subjectsRes.data && subjectsRes.data.length > 0) {
            context += `\n### SUBJECTS (${subjectsRes.data.length}):\n`;
            for (const s of subjectsRes.data as any[]) context += `- ${s.name} (${s.code})${s.units ? ' | ' + s.units + ' units' : ''}\n`;
        }

        if (sectionsRes.data && sectionsRes.data.length > 0) {
            context += `\n### SECTIONS (${sectionsRes.data.length}):\n`;
            for (const s of sectionsRes.data as any[]) context += `- ${s.name}${s.year_level ? ' | Year ' + s.year_level : ''}${s.program ? ' | ' + s.program : ''}\n`;
        }

        if (announcementsRes.data && announcementsRes.data.length > 0) {
            context += `\n### RECENT ANNOUNCEMENTS (${announcementsRes.data.length}):\n`;
            for (const a of announcementsRes.data as any[]) context += `- [${a.priority || 'normal'}] ${a.title} - ${(a.content || '').substring(0, 80)}\n`;
        }

        return context;
    } catch (error) {
        console.error('[OptiBot] Error fetching context:', error);
        return '\n\n(Could not fetch current schedule data)';
    }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// === Try Groq API ===
async function tryGroq(fullSystemPrompt: string, userMessage: string, conversationHistory: GeminiMessage[]): Promise<string | null> {
    try {
        const messages = [
            { role: 'system', content: fullSystemPrompt },
            ...conversationHistory.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.parts[0].text })),
            { role: 'user', content: userMessage },
        ];
        const res = await fetch(GROQ_BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, temperature: 0.7, max_tokens: 4096 }),
        });
        if (res.ok) {
            const data = await res.json();
            return data?.choices?.[0]?.message?.content || null;
        }
    } catch { /* fallthrough */ }
    return null;
}

// === Try OpenRouter API ===
async function tryOpenRouter(fullSystemPrompt: string, userMessage: string, conversationHistory: GeminiMessage[]): Promise<string | null> {
    try {
        const messages = [
            { role: 'system', content: fullSystemPrompt },
            ...conversationHistory.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.parts[0].text })),
            { role: 'user', content: userMessage },
        ];
        const res = await fetch(OPENROUTER_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'OptiSched AI',
            },
            body: JSON.stringify({ model: 'meta-llama/llama-3.3-70b-instruct', messages, temperature: 0.7, max_tokens: 1024 }),
        });
        if (res.ok) {
            const data = await res.json();
            return data?.choices?.[0]?.message?.content || null;
        }
    } catch { /* fallthrough */ }
    return null;
}

// Main function - chain: Gemini → Groq → OpenRouter
export async function sendToOptiBot(
    userMessage: string,
    conversationHistory: GeminiMessage[] = [],
    userProfile?: { full_name?: string; role?: string; email?: string }
): Promise<string> {
    try {
        const scheduleContext = await getScheduleContext();

        let userContext = '';
        if (userProfile) {
            userContext = `\n\n## CURRENT USER CONTEXT:\n- Name: ${userProfile.full_name || 'Unknown'}\n- Role: ${userProfile.role || 'unknown'}\n- Email: ${userProfile.email || 'N/A'}\n${userProfile.role === 'admin' ? '\nADMIN POWERS ACTIVE: When they ask to create users, manage events, or perform system operations, include $$ACTION{...}$$ blocks.\n' : ''}`;
        }

        const fullSystemPrompt = SYSTEM_PROMPT + userContext + scheduleContext;

        // 1. Try Gemini models
        const contents: GeminiMessage[] = [
            { role: 'user', parts: [{ text: fullSystemPrompt + '\n\nPlease acknowledge briefly.' }] },
            { role: 'model', parts: [{ text: `Understood. I am OptiSched AI, ready to help${userProfile?.full_name ? ` ${userProfile.full_name}` : ''}.` }] },
            ...conversationHistory,
            { role: 'user', parts: [{ text: userMessage }] },
        ];

        const requestBody = JSON.stringify({
            contents,
            generationConfig: { temperature: 0.7, topP: 0.9, topK: 40, maxOutputTokens: 4096 },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            ],
        });

        for (const model of GEMINI_MODELS) {
            const apiUrl = `${GEMINI_BASE_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`;
            for (let retry = 0; retry <= MAX_RETRIES; retry++) {
                try {
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: requestBody,
                    });
                    if (response.ok) {
                        const data = await response.json();
                        const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (aiResponse) return await processAIActions(aiResponse, userProfile?.role);
                        break;
                    }
                    if (response.status === 429 && retry < MAX_RETRIES) {
                        await delay(RETRY_DELAY_MS);
                        continue;
                    }
                    break;
                } catch { break; }
            }
        }

        // 2. Try Groq
        const groqResult = await tryGroq(fullSystemPrompt, userMessage, conversationHistory);
        if (groqResult) return await processAIActions(groqResult, userProfile?.role);

        // 3. Try OpenRouter
        const openRouterResult = await tryOpenRouter(fullSystemPrompt, userMessage, conversationHistory);
        if (openRouterResult) return await processAIActions(openRouterResult, userProfile?.role);

        return 'I\'m temporarily experiencing high demand across all AI services. Please wait a minute and try again.';
    } catch (error) {
        console.error('[OptiBot] Error:', error);
        return 'Sorry, I encountered a connection error. Please check your internet connection and try again.';
    }
}

// === Action Execution System ===

function randomDigits(len: number): string {
    let result = '';
    for (let i = 0; i < len; i++) result += Math.floor(Math.random() * 10).toString();
    return result;
}

function randomPassword(len: number): string {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < len; i++) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

async function processAIActions(response: string, userRole?: string): Promise<string> {
    const actionRegex = /\$\$ACTION\s*(\{[\s\S]*?\})\s*\$\$/g;
    let processedResponse = response;
    let match;
    const matches: { full: string; json: string }[] = [];

    while ((match = actionRegex.exec(response)) !== null) {
        matches.push({ full: match[0], json: match[1] });
    }

    for (const m of matches) {
        try {
            const actionData = JSON.parse(m.json);
            console.log('[OptiBot] Processing action:', actionData.action, actionData.params);

            if (userRole !== 'admin') {
                processedResponse = processedResponse.replace(m.full, '\nAction blocked - only administrators can perform system actions.\n');
                continue;
            }

            const result = await executeAction(actionData.action, actionData.params);
            console.log('[OptiBot] Action result:', result);
            processedResponse = processedResponse.replace(
                m.full,
                result.success ? `\n✅ ${result.message}\n` : `\n❌ ${result.message}\n`
            );
        } catch (err) {
            console.error('[OptiBot] Action parse error:', err);
            processedResponse = processedResponse.replace(m.full, '\nError: Could not process action.\n');
        }
    }

    processedResponse = processedResponse.replace(/\$\$ACTION\s*\{[\s\S]*?\}\s*\$\$/g, '');
    return processedResponse;
}

async function executeAction(action: string, params: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const dbClient = supabaseAdmin || supabase;
    try {
        switch (action) {
            case 'create_user': {
                let { email, password, full_name, role, section, program, year_level } = params;
                if (!full_name) return { success: false, message: 'Missing required field: full_name.' };
                if (!role) role = 'student';

                if (!email || email.includes('example') || email === 'AUTO') {
                    const nameParts = full_name.trim().split(' ');
                    const surname = nameParts[nameParts.length - 1]?.toLowerCase() || 'user';
                    const digits = randomDigits(6);
                    email = `${surname}.${digits}@optisched.sti.edu`;
                }

                let assignedPassword = password;
                if (!assignedPassword || assignedPassword === 'AUTO' || assignedPassword.includes('example')) {
                    assignedPassword = randomPassword(8);
                }

                const adminClient = supabaseAdmin || supabase;
                const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
                    email, password: assignedPassword, email_confirm: true,
                });
                if (authError) return { success: false, message: `Could not create auth account: ${authError.message}` };

                const profileData: any = { id: authData.user.id, email, full_name, role };
                if (section) profileData.section = section;
                if (program) profileData.program = program;
                if (year_level) profileData.year_level = typeof year_level === 'string' ? parseInt(year_level) : year_level;

                const { error: profileError } = await adminClient.from('profiles').upsert(profileData);
                if (profileError) return { success: false, message: `Auth created but profile failed: ${profileError.message}` };

                return { success: true, message: `User created! Name: ${full_name}, Email: ${email}, Password: ${assignedPassword}` };
            }

            case 'create_event': {
                const { title, description, event_date, start_time, end_time } = params;
                if (!title || !event_date) return { success: false, message: 'Missing required fields (title, event_date).' };
                const { error } = await supabase.from('custom_events').insert({
                    title, description: description || null, event_date,
                    start_time: start_time || null, end_time: end_time || null,
                    creator_name: 'OptiBot AI', creator_role: 'admin',
                });
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Event "${title}" created for ${event_date}.` };
            }

            case 'delete_event': {
                const { event_title } = params;
                if (!event_title) return { success: false, message: 'Please specify event title.' };
                const { data: found } = await dbClient.from('custom_events').select('id').ilike('title', `%${event_title}%`).limit(1).single();
                if (!found) return { success: false, message: `No event found matching "${event_title}".` };
                const { error } = await dbClient.from('custom_events').delete().eq('id', found.id);
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Event "${event_title}" deleted.` };
            }

            case 'delete_user': {
                const { user_email } = params;
                if (!user_email) return { success: false, message: 'Please specify user email.' };
                const { data: found } = await dbClient.from('profiles').select('id').eq('email', user_email).single();
                if (!found) return { success: false, message: `No user found with email "${user_email}".` };
                await dbClient.from('profiles').delete().eq('id', found.id);
                if (supabaseAdmin) {
                    try { await supabaseAdmin.auth.admin.deleteUser(found.id); } catch { }
                }
                return { success: true, message: `User "${user_email}" deleted.` };
            }

            case 'create_schedule': {
                const { subject_name, teacher_name, room_name, section_name, day_of_week, start_time, end_time } = params;
                if (!subject_name || !day_of_week || !start_time || !end_time) {
                    return { success: false, message: 'Missing required fields: subject_name, day_of_week, start_time, end_time.' };
                }
                let subject_id = null, teacher_id = null, room_id = null, section_id = null;
                if (subject_name) {
                    const { data } = await dbClient.from('subjects').select('id').ilike('name', `%${subject_name}%`).limit(1).single();
                    if (data) subject_id = data.id; else return { success: false, message: `Subject "${subject_name}" not found.` };
                }
                if (teacher_name) {
                    const { data } = await dbClient.from('profiles').select('id').ilike('full_name', `%${teacher_name}%`).eq('role', 'teacher').limit(1).single();
                    if (data) {
                        const { data: tchRecord } = await dbClient.from('teachers').select('id').eq('profile_id', data.id).single();
                        if (tchRecord) teacher_id = tchRecord.id;
                    }
                }
                if (room_name) {
                    const { data } = await dbClient.from('rooms').select('id').ilike('name', `%${room_name}%`).limit(1).single();
                    if (data) room_id = data.id;
                }
                if (section_name) {
                    const { data } = await dbClient.from('sections').select('id').ilike('name', `%${section_name}%`).limit(1).single();
                    if (data) section_id = data.id;
                }

                // Conflict detection
                if (room_id) {
                    const { data: conflicts } = await dbClient.from('schedules').select('*, subject:subjects(name)').eq('room_id', room_id).eq('day_of_week', day_of_week).eq('status', 'published').lt('start_time', end_time).gt('end_time', start_time);
                    if (conflicts && conflicts.length > 0) {
                        return { success: false, message: `ROOM CONFLICT: Room "${room_name}" already booked on ${day_of_week} ${conflicts[0].start_time}-${conflicts[0].end_time}.` };
                    }
                }
                if (teacher_id) {
                    const { data: conflicts } = await dbClient.from('schedules').select('*, subject:subjects(name)').eq('teacher_id', teacher_id).eq('day_of_week', day_of_week).eq('status', 'published').lt('start_time', end_time).gt('end_time', start_time);
                    if (conflicts && conflicts.length > 0) {
                        return { success: false, message: `TEACHER CONFLICT: "${teacher_name}" already teaching on ${day_of_week} ${conflicts[0].start_time}-${conflicts[0].end_time}.` };
                    }
                }

                const scheduleData: any = { subject_id, day_of_week, start_time, end_time, status: 'published' };
                if (teacher_id) scheduleData.teacher_id = teacher_id;
                if (room_id) scheduleData.room_id = room_id;
                if (section_id) scheduleData.section_id = section_id;

                const { error } = await dbClient.from('schedules').insert(scheduleData);
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Schedule created: ${subject_name} on ${day_of_week} ${start_time}-${end_time}.` };
            }

            case 'delete_schedule': {
                const { subject_name, day_of_week, start_time, schedule_id } = params;
                if (schedule_id) {
                    const { error } = await dbClient.from('schedules').delete().eq('id', schedule_id);
                    if (error) return { success: false, message: error.message };
                    return { success: true, message: 'Schedule deleted.' };
                }
                if (!subject_name || !day_of_week) return { success: false, message: 'Specify subject_name and day_of_week.' };
                const { data: subj } = await dbClient.from('subjects').select('id').ilike('name', `%${subject_name}%`).limit(1).single();
                if (!subj) return { success: false, message: `Subject "${subject_name}" not found.` };
                let query = dbClient.from('schedules').delete().eq('subject_id', subj.id).eq('day_of_week', day_of_week);
                if (start_time) query = query.eq('start_time', start_time);
                const { error } = await query;
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Schedule for ${subject_name} on ${day_of_week} deleted.` };
            }

            case 'create_announcement': {
                const { title, content, priority } = params;
                if (!title || !content) return { success: false, message: 'Missing title or content.' };
                const { error } = await dbClient.from('announcements').insert({
                    title, content, priority: priority || 'normal', author_name: 'OptiBot AI', author_id: 'ai-system',
                });
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Announcement "${title}" posted.` };
            }

            case 'create_subject': {
                const { name, code, units } = params;
                if (!name || !code) return { success: false, message: 'Missing name or code.' };
                const { error } = await dbClient.from('subjects').insert({ name, code, units: units || null });
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Subject "${name}" (${code}) created.` };
            }

            case 'delete_subject': {
                const { name } = params;
                if (!name) return { success: false, message: 'Missing subject name.' };
                const { error } = await dbClient.from('subjects').delete().ilike('name', `%${name}%`);
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Subject "${name}" deleted.` };
            }

            case 'create_room': {
                const { name, type, capacity, floor } = params;
                if (!name) return { success: false, message: 'Missing room name.' };
                const { error } = await dbClient.from('rooms').insert({ name, type: type || 'lecture', capacity: capacity || 40, floor: floor || 1 });
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Room "${name}" created.` };
            }

            case 'delete_room': {
                const { name } = params;
                if (!name) return { success: false, message: 'Missing room name.' };
                const { error } = await dbClient.from('rooms').delete().ilike('name', `%${name}%`);
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Room "${name}" deleted.` };
            }

            case 'create_section': {
                const { name, year_level, program } = params;
                if (!name) return { success: false, message: 'Missing section name.' };
                const { error } = await dbClient.from('sections').insert({ name, year_level: year_level || null, program: program || null });
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Section "${name}" created.` };
            }

            case 'delete_section': {
                const { name } = params;
                if (!name) return { success: false, message: 'Missing section name.' };
                const { error } = await dbClient.from('sections').delete().ilike('name', `%${name}%`);
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Section "${name}" deleted.` };
            }

            case 'update_profile': {
                const { user_email, updates } = params;
                if (!updates || !user_email) return { success: false, message: 'Missing user_email or updates.' };
                const { data: found } = await dbClient.from('profiles').select('id').eq('email', user_email).single();
                if (!found) return { success: false, message: `No user found with email "${user_email}".` };
                const { error } = await dbClient.from('profiles').update(updates).eq('id', found.id);
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Profile updated for ${user_email}.` };
            }

            default:
                return { success: false, message: `Unknown action: ${action}` };
        }
    } catch (err: any) {
        console.error('[OptiBot] executeAction error:', err);
        return { success: false, message: err.message || 'An unexpected error occurred.' };
    }
}
