// OptiBot AI Service (Web) - Mirror of mobile optibotService.ts
// Multi-provider AI with Gemini, Groq, and OpenRouter + full database context + action execution

import { supabase } from '../lib/supabase';
import { ADMIN_ROLES } from '../types/database';

// Set to true to test permission checking without executing actions
const DEBUG_MODE = false;

// === Type Definitions ===
interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    role: 'student' | 'teacher' | 'admin' | 'power_admin' | 'system_admin' | 'schedule_admin' | 'schedule_manager';
    program?: string;
    section?: string;
    year_level?: number;
}

interface Subject {
    id: string;
    name: string;
    code: string;
    units?: number;
}

interface Section {
    id: string;
    name: string;
    year_level?: number;
    program?: string;
}

interface Announcement {
    id: string;
    title: string;
    content: string;
    priority?: string;
}

// === API Keys (read from .env - never commit keys to source) ===
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';

console.log('[OptiBot] API Keys status:', {
    gemini: !!GEMINI_API_KEY,
    groq: !!GROQ_API_KEY,
    groqLength: GROQ_API_KEY?.length,
    openrouter: !!OPENROUTER_API_KEY
});

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
Do NOT use emojis or emoticons in your responses - keep formatting clean and text-based.
Use bullet points, numbered lists, and clear section headers instead of decorative characters.

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
- update_profile: $$ACTION{"action":"update_profile","params":{"user_email":"user@email.com","updates":{"full_name":"...","role":"...","email":"new@email.com"}}}$$

Rules for actions:
- CRITICAL: If asked to create a student account and the user DID NOT specify their program, year_level, or section, DO NOT issue the create_user action. Instead, ask for those details first.
- You MUST use REAL dates, REAL times, REAL names - never use placeholders like YYYY-MM-DD
- If the user is not an admin, refuse: "Only administrators can perform system actions."
- CRITICAL: Email addresses MUST always contain "@". Example: "lastname@meycauayan.sti.edu.ph" NOT "lastname.meycauayan.sti.edu.ph". Double-check every email you generate.

## DATA VALIDATION AND COMPLETENESS CHECKING:

Before executing ANY create action (create_user, create_room, create_subject, create_section, create_schedule, etc.), you MUST:

### 1. Verify Required Fields
Check that ALL required fields are provided. If any required field is missing, ask for it BEFORE executing the action:

**create_user REQUIRED fields:**
- full_name (required)
- role (required: student, teacher, admin, power_admin, system_admin, schedule_admin, schedule_manager)
- email (required, must contain "@")
- For students: program, year_level, section (ALL required)
- For teachers: department (required)

**create_room REQUIRED fields:**
- name (required)
- building (required)
- floor (required, must be a positive integer)
- type (required: common or special)
- capacity (required, must be a positive integer)

**create_subject REQUIRED fields:**
- name (required)
- code (required, unique)
- units (required, must be a positive integer)
- type (required: common or special)
- program (required)
- year_level (required, must be a positive integer)

**create_section REQUIRED fields:**
- name (required, unique)
- program (required)
- year_level (required, must be a positive integer)
- student_count (required, must be a positive integer)

**create_schedule REQUIRED fields:**
- subject_name (required, must exist in database)
- teacher_name (required, must exist in database)
- room_name (required, must exist in database)
- section_name (required, must exist in database)
- day_of_week (required: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday)
- start_time (required, format: HH:MM)
- end_time (required, format: HH:MM, must be after start_time)

### 2. Cross-Reference with Existing Data
Before creating any entity, check the existing database context to:
- Verify that the name/code doesn't already exist (for rooms, subjects, sections)
- Check if referenced entities exist (e.g., when creating a schedule, verify the subject, teacher, room, and section all exist)
- Look for potential duplicates or similar names that might indicate typos

### 3. Identify Potential Issues
If you notice any of the following, ask clarifying questions:
- Typos in names (e.g., "Mathmatics" instead of "Mathematics")
- Inconsistent formatting (e.g., room names that don't follow the pattern)
- Unusual values (e.g., capacity of 1 or 1000, year_level of 20)
- Missing logical connections (e.g., creating a schedule for a section that doesn't exist)

### 4. Ask Clarifying Questions ONLY When Needed
Do NOT be overly cautious. Only ask questions when:
- A REQUIRED field is missing
- You detect a clear error or inconsistency
- The information provided is ambiguous
- You need to prevent a duplicate or conflict

If all required fields are present and the information appears valid, proceed with the action without unnecessary questions.

### 5. How to Ask for Missing Information
When asking for missing information:
- Be specific about what's missing
- Provide examples if helpful
- Explain why the information is needed
- Use the same language as the user (English/Tagalog/Taglish)

Example response: "I need a bit more information to create this room. You've provided the name, building, type, and capacity, but I also need to know which floor this room is on. What floor is Room 201 located on?"

Keep responses concise, professional, and formatted with clear structure using bullet points or numbered lists when applicable.`;

export interface GeminiMessage {
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
}

// Fetch relevant context from Supabase for the AI
async function getScheduleContext(): Promise<string> {
    const db = supabase;
    try {
        const [schedulesRes, teachersRes, roomsRes, conflictsRes, eventsRes, usersRes, subjectsRes, sectionsRes, announcementsRes] = await Promise.all([
            db.from('schedules').select('*, subject:subjects(name, code), teacher:teachers(profile_id:profiles(full_name)), room:rooms(name, capacity), section:sections(name)').eq('status', 'published').neq('status', 'archived').eq('is_active', true).limit(20),
            db.from('teachers').select('*, profile_id:profiles(full_name)').eq('is_active', true).limit(30),
            db.from('rooms').select('*').limit(30),
            db.from('conflicts').select('*').eq('is_resolved', false).limit(10),
            db.from('custom_events').select('*').gte('event_date', new Date().toISOString().split('T')[0]).order('event_date', { ascending: true }).limit(5),
            db.from('profiles').select('id, email, full_name, role, program, section, year_level').order('created_at', { ascending: false }).limit(50),
            db.from('subjects').select('*').limit(30),
            db.from('sections').select('*').limit(30),
            db.from('announcements').select('*').order('created_at', { ascending: false }).limit(5),
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
            const students = usersRes.data.filter((u: UserProfile) => u.role === 'student');
            const teacherUsers = usersRes.data.filter((u: UserProfile) => u.role === 'teacher');
            const admins = usersRes.data.filter((u: UserProfile) => u.role === 'admin');

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
            for (const s of subjectsRes.data as Subject[]) context += `- ${s.name} (${s.code})${s.units ? ' | ' + s.units + ' units' : ''}\n`;
        }

        if (sectionsRes.data && sectionsRes.data.length > 0) {
            context += `\n### SECTIONS (${sectionsRes.data.length}):\n`;
            for (const s of sectionsRes.data as Section[]) context += `- ${s.name}${s.year_level ? ' | Year ' + s.year_level : ''}${s.program ? ' | ' + s.program : ''}\n`;
        }

        if (announcementsRes.data && announcementsRes.data.length > 0) {
            context += `\n### RECENT ANNOUNCEMENTS (${announcementsRes.data.length}):\n`;
            for (const a of announcementsRes.data as Announcement[]) context += `- [${a.priority || 'normal'}] ${a.title} - ${(a.content || '').substring(0, 80)}\n`;
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
    console.log('[OptiBot] Groq API Key configured:', !!GROQ_API_KEY);
    console.log('[OptiBot] Groq API Key length:', GROQ_API_KEY?.length);
    if (!GROQ_API_KEY || GROQ_API_KEY.includes('YOUR_GROQ_API_KEY')) {
        console.log('[OptiBot] Groq API key not configured, skipping');
        return null;
    }
    try {
        const messages = [
            { role: 'system', content: fullSystemPrompt },
            ...conversationHistory.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.parts[0].text })),
            { role: 'user', content: userMessage },
        ];
        console.log('[OptiBot] Calling Groq API...');
        const res = await fetch(GROQ_BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, temperature: 0.7, max_tokens: 2048 }),
        });
        console.log('[OptiBot] Groq response status:', res.status, res.statusText);
        if (res.ok) {
            const data = await res.json();
            console.log('[OptiBot] Groq response data:', data);
            return data?.choices?.[0]?.message?.content || null;
        } else {
            const errorText = await res.text();
            console.error('[OptiBot] Groq API error:', res.status, res.statusText, errorText);
        }
    } catch (error) {
        console.error('[OptiBot] Groq fetch error:', error);
    }
    return null;
}

// === Try OpenRouter API ===
async function tryOpenRouter(fullSystemPrompt: string, userMessage: string, conversationHistory: GeminiMessage[]): Promise<string | null> {
    if (!OPENROUTER_API_KEY) {
        console.log('[OptiBot] OpenRouter API key not configured, skipping');
        return null;
    }
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
        } else {
            console.error('[OptiBot] OpenRouter API error:', res.status, res.statusText);
        }
    } catch (error) {
        console.error('[OptiBot] OpenRouter fetch error:', error);
    }
    return null;
}

// Main function - chain: Gemini → Groq → OpenRouter
export async function sendToOptiBot(
    userMessage: string,
    conversationHistory: GeminiMessage[] = [],
    userProfile?: { full_name?: string; role?: string; email?: string; roles?: string[] }
): Promise<string> {
    console.log('[OptiBot DEBUG] DEBUG_MODE:', DEBUG_MODE);
    try {
        const scheduleContext = await getScheduleContext();

        const isAdmin = userProfile?.roles?.some(r => ADMIN_ROLES.includes(r as 'admin' | 'power_admin' | 'system_admin' | 'schedule_admin' | 'schedule_manager')) || false;

        let userContext = '';
        if (userProfile) {
            userContext = `\n\n## CURRENT USER CONTEXT:\n- Name: ${userProfile.full_name || 'Unknown'}\n- Role: ${userProfile.role || 'unknown'}\n- Roles: ${userProfile.roles?.join(', ') || 'none'}\n- Email: ${userProfile.email || 'N/A'}\n${isAdmin ? '\nADMIN POWERS ACTIVE: When they ask to create users, manage events, or perform system operations, include $$ACTION{...}$$ blocks.\n' : ''}`;
        }

        const fullSystemPrompt = SYSTEM_PROMPT + userContext + scheduleContext;

        // 1. Try Gemini models
        if (!GEMINI_API_KEY) {
            console.log('[OptiBot] Gemini API key not configured, skipping to fallback providers');
        } else {
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
                            if (aiResponse) return await processAIActions(aiResponse, userProfile?.roles);
                            break;
                        } else {
                            console.error(`[OptiBot] Gemini API error (${model}):`, response.status, response.statusText);
                        }
                        if (response.status === 429 && retry < MAX_RETRIES) {
                            console.log(`[OptiBot] Rate limited on ${model}, retrying in ${RETRY_DELAY_MS}ms...`);
                            await delay(RETRY_DELAY_MS);
                            continue;
                        }
                        break;
                    } catch (error) {
                        console.error(`[OptiBot] Gemini fetch error (${model}):`, error);
                        break;
                    }
                }
            }
        }

        // 2. Try Groq
        console.log('[OptiBot] Trying Groq...');
        const groqResult = await tryGroq(fullSystemPrompt, userMessage, conversationHistory);
        if (groqResult) return await processAIActions(groqResult, userProfile?.roles);

        // 3. Try OpenRouter
        console.log('[OptiBot] Trying OpenRouter...');
        const openRouterResult = await tryOpenRouter(fullSystemPrompt, userMessage, conversationHistory);
        if (openRouterResult) return await processAIActions(openRouterResult, userProfile?.roles);

        console.error('[OptiBot] All AI providers failed');
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

async function processAIActions(response: string, userRoles?: string[]): Promise<string> {
    const actionRegex = /\$\$ACTION\s*(\{[\s\S]*?\})\s*\$\$/g;
    let processedResponse = response;
    let match;
    const matches: { full: string; json: string }[] = [];

    while ((match = actionRegex.exec(response)) !== null) {
        matches.push({ full: match[0], json: match[1] });
    }

    const isAdmin = userRoles?.some(r => ADMIN_ROLES.includes(r as 'admin' | 'power_admin' | 'system_admin' | 'schedule_admin' | 'schedule_manager')) || false;

    // Debug: Log permission check
    console.log('[OptiBot DEBUG] Permission Check:', {
        userRoles: userRoles || 'none',
        isAdmin,
        adminRoles: ADMIN_ROLES,
        actionCount: matches.length,
    });

    for (const m of matches) {
        try {
            const actionData = JSON.parse(m.json);
            console.log('[OptiBot] Processing action:', actionData.action, actionData.params);

            if (!isAdmin) {
                console.log('[OptiBot DEBUG] Action BLOCKED - User is not an admin');
                processedResponse = processedResponse.replace(m.full, '\nAction blocked - only administrators can perform system actions.\n');
                continue;
            }

            console.log('[OptiBot DEBUG] Action ALLOWED - User has admin permissions');

            if (DEBUG_MODE) {
                console.log('[OptiBot DEBUG] DEBUG_MODE is ON - Skipping action execution');
                processedResponse = processedResponse.replace(
                    m.full,
                    `\n[DEBUG] Action would be executed: ${actionData.action} with params: ${JSON.stringify(actionData.params)}\n`
                );
            } else {
                const result = await executeAction(actionData.action, actionData.params);
                console.log('[OptiBot] Action result:', result);
                processedResponse = processedResponse.replace(
                    m.full,
                    result.success ? `\n✅ ${result.message}\n` : `\n❌ ${result.message}\n`
                );
            }
        } catch (err) {
            console.error('[OptiBot] Action parse error:', err);
            processedResponse = processedResponse.replace(m.full, '\nError: Could not process action.\n');
        }
    }

    processedResponse = processedResponse.replace(/\$\$ACTION\s*\{[\s\S]*?\}\s*\$\$/g, '');
    return processedResponse;
}

interface ActionParams {
    [key: string]: unknown;
}

async function executeAction(action: string, params: ActionParams): Promise<{ success: boolean; message: string }> {
    const dbClient = supabase;
    try {
        switch (action) {
            case 'create_user': {
                let { email, password, role } = params;
                const { full_name, section, program, year_level } = params;
                if (!full_name || typeof full_name !== 'string') return { success: false, message: 'Missing required field: full_name.' };
                if (!role) role = 'student';

                if (!email || typeof email !== 'string' || email.includes('example') || email === 'AUTO') {
                    const nameParts = full_name.trim().split(' ');
                    const surname = nameParts[nameParts.length - 1]?.toLowerCase() || 'user';
                    const digits = randomDigits(6);
                    email = `${surname}.${digits}@optisched.sti.edu`;
                }

                const assignedPassword = password && typeof password === 'string' ? password : undefined;
                if (!assignedPassword || assignedPassword === 'AUTO' || assignedPassword.includes('example')) {
                    password = randomPassword(8);
                }

                // NOTE: auth.admin.createUser requires service role - move to Edge Function
                // Using client-side signUp for now (requires RLS policies)
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: email as string, password: (password || assignedPassword) as string,
                    options: { data: { role, full_name } },
                });
                if (authError) return { success: false, message: `Could not create auth account: ${authError.message}` };
                if (!authData.user) return { success: false, message: 'Auth user creation failed.' };

                const profileData: Record<string, unknown> = { id: authData.user.id, email, full_name, role };
                if (section) profileData.section = section;
                if (program) profileData.program = program;
                if (year_level) profileData.year_level = typeof year_level === 'string' ? parseInt(year_level) : year_level;

                const { error: profileError } = await dbClient.from('profiles').upsert(profileData);
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
                const { data: found } = await dbClient.from('custom_events').select('id').ilike('title', `%${event_title}%`).limit(1).maybeSingle();
                if (!found) return { success: false, message: `No event found matching "${event_title}".` };
                const { error } = await dbClient.from('custom_events').delete().eq('id', found.id);
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Event "${event_title}" deleted.` };
            }

            case 'delete_user': {
                const { user_email } = params;
                if (!user_email) return { success: false, message: 'Please specify user email.' };
                const { data: found } = await dbClient.from('profiles').select('id').eq('email', user_email).maybeSingle();
                if (!found) return { success: false, message: `No user found with email "${user_email}".` };
                await dbClient.from('profiles').delete().eq('id', found.id);
                // NOTE: auth.admin.deleteUser requires service role - move to Edge Function
                // For now, only delete profile (auth user remains orphaned)
                return { success: true, message: `User "${user_email}" deleted (profile only).` };
            }

            case 'create_schedule': {
                const { subject_name, teacher_name, room_name, section_name, day_of_week, start_time, end_time } = params;
                if (!subject_name || !day_of_week || !start_time || !end_time) {
                    return { success: false, message: 'Missing required fields: subject_name, day_of_week, start_time, end_time.' };
                }
                let subject_id = null, teacher_id = null, room_id = null, section_id = null;
                if (subject_name) {
                    const { data } = await dbClient.from('subjects').select('id').ilike('name', `%${subject_name}%`).limit(1).maybeSingle();
                    if (data) subject_id = data.id; else return { success: false, message: `Subject "${subject_name}" not found.` };
                }
                if (teacher_name) {
                    const { data } = await dbClient.from('profiles').select('id').ilike('full_name', `%${teacher_name}%`).eq('role', 'teacher').limit(1).maybeSingle();
                    if (data) {
                        const { data: tchRecord } = await dbClient.from('teachers').select('id').eq('profile_id', data.id).maybeSingle();
                        if (tchRecord) teacher_id = tchRecord.id;
                    }
                }
                if (room_name) {
                    const { data } = await dbClient.from('rooms').select('id').ilike('name', `%${room_name}%`).limit(1).maybeSingle();
                    if (data) room_id = data.id;
                }
                if (section_name) {
                    const { data } = await dbClient.from('sections').select('id').ilike('name', `%${section_name}%`).limit(1).maybeSingle();
                    if (data) section_id = data.id;
                }

                // Conflict detection
                if (room_id) {
                    const { data: conflicts } = await dbClient.from('schedules').select('*, subject:subjects(name)').eq('room_id', room_id).eq('day_of_week', day_of_week).eq('status', 'published').neq('status', 'archived').eq('is_active', true).lt('start_time', end_time).gt('end_time', start_time);
                    if (conflicts && conflicts.length > 0) {
                        return { success: false, message: `Room conflict: ${room_name} has ${conflicts.length} existing class(es) during ${start_time}-${end_time} on ${day_of_week}.` };
                    }
                }
                if (teacher_id) {
                    const { data: teacherConflicts } = await dbClient.from('schedules').select('*, subject:subjects(name)').eq('teacher_id', teacher_id).eq('day_of_week', day_of_week).eq('status', 'published').neq('status', 'archived').eq('is_active', true).lt('start_time', end_time).gt('end_time', start_time);
                    if (teacherConflicts && teacherConflicts.length > 0) {
                        return { success: false, message: `TEACHER CONFLICT: "${teacher_name}" already teaching on ${day_of_week} ${teacherConflicts[0].start_time}-${teacherConflicts[0].end_time}.` };
                    }
                }

                const scheduleData: Record<string, unknown> = { subject_id, day_of_week, start_time, end_time, status: 'published' };
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
                const { data: subj } = await dbClient.from('subjects').select('id').ilike('name', `%${subject_name}%`).limit(1).maybeSingle();
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
                const { data: found } = await dbClient.from('profiles').select('id').eq('email', user_email as string).maybeSingle();
                if (!found) return { success: false, message: `No user found with email "${user_email}".` };

                // If email is being changed, update Supabase Auth first
                const updatesRecord = updates as Record<string, unknown>;
                const newEmail = updatesRecord.email && typeof updatesRecord.email === 'string' ? updatesRecord.email : undefined;
                if (newEmail && newEmail !== user_email) {
                    // Validate email format
                    if (!newEmail.includes('@') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
                        return { success: false, message: `Invalid email format: "${newEmail}". Email must contain "@" (e.g. user@domain.com).` };
                    }
                    // NOTE: auth.admin.updateUserById requires service role - move to Edge Function
                    // Email changes require service role, skip for now
                    return { success: false, message: 'Email changes require server-side implementation (Edge Function).' };
                }

                const { error } = await dbClient.from('profiles').update(updatesRecord).eq('id', found.id);
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Profile updated for ${user_email}.${newEmail ? ` Email changed to ${newEmail} - user can now log in with the new email.` : ''}` };
            }

            default:
                return { success: false, message: `Unknown action: ${action}` };
        }
    } catch (err: unknown) {
        console.error('[OptiBot] executeAction error:', err);
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
        return { success: false, message: errorMessage };
    }
}
