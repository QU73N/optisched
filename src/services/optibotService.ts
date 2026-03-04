// OptiBot AI Service — Multi-provider AI with Gemini, Groq, and OpenRouter
// Handles all AI interactions with strict guardrails for OptiSched

import { supabase, supabaseAdmin } from '../config/supabase';

// === API Keys ===
const GEMINI_API_KEY = 'AIzaSyD3EnaaPrcEfmYIwNWIHeB-BoXWQlYxvp8';
const GROQ_API_KEY = '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';
const OPENROUTER_API_KEY = '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';

// === API URLs ===
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Gemini model fallback chain
const GEMINI_MODELS = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
];

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
You SHOULD answer questions about: schedules, classes, rooms, teachers, events, announcements, sections, subjects, school activities, upcoming events, exam schedules, conflicts, room availability, teacher workload — basically ANYTHING related to the school and its operations.
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
- 

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
When an admin asks to schedule a class during a time when a custom event exists:
1. Warn them about the event conflict
2. Show the event details (title, date, time)
3. Suggest scheduling around the event
When asked about upcoming events, list them from the context data provided.

## ADMIN ACTION EXECUTION:
When the current user is an ADMIN and they ask you to perform an action (create user, add event, delete event, etc.), you MUST execute it by including an action block.
Do NOT just describe what could be done — actually include the action block to execute it.
IMPORTANT: The action block will be automatically processed and REMOVED from the chat. The user will see a clean success/failure message instead.

To execute an action, include an action block in your response using this EXACT format (NO spaces before the closing $$):

$$ACTION{"action":"ACTION_NAME","params":{...}}$$

You can include MULTIPLE action blocks in ONE response. For example, to create 3 students:
$$ACTION{"action":"create_user","params":{"full_name":"Maria Santos","role":"student"}}$$
$$ACTION{"action":"create_user","params":{"full_name":"Jose Reyes","role":"student"}}$$
$$ACTION{"action":"create_user","params":{"full_name":"Ana Cruz","role":"student"}}$$

You can also create multiple events or schedules the same way — just include multiple $$ACTION blocks.
Example: "Create 3 events" → include 3 separate create_event action blocks with real dates and details.

Available actions (ADMIN ONLY):
- create_user: $$ACTION{
    "action": "create_user",
    "params": {
      "email": "string (optional, usually generated)",
      "password": "string (optional, exact literal password if provided)",
      "full_name": "string (required, First Last)",
      "role": "string (student, teacher, admin)",
      "student_id": "string (optional)",
      "section": "string (optional, exact section name if provided)",
      "program": "string (optional, e.g. STEM, HUMSS, BSIT)",
      "year_level": "number (optional, e.g. 11, 12, 1, 2)"
    }
  }
- delete_user: $$ACTION{"action":"delete_user","params":{"user_email":"user@optisched.sti.edu"}}$$
- create_event: $$ACTION{"action":"create_event","params":{"title":"Science Fair","description":"Annual science fair","event_date":"2026-03-15","start_time":"08:00","end_time":"17:00"}}$$
  IMPORTANT: event_date MUST be a real date like "2026-03-15", NOT "YYYY-MM-DD".
- delete_event: $$ACTION{"action":"delete_event","params":{"event_title":"Science Fair"}}$$
- create_schedule: $$ACTION{"action":"create_schedule","params":{"subject_name":"Math","teacher_name":"John Doe","room_name":"Room 101","section_name":"BSIT-301","day_of_week":"Monday","start_time":"08:00","end_time":"09:30"}}$$
- delete_schedule: $$ACTION{"action":"delete_schedule","params":{"subject_name":"Math","day_of_week":"Monday","start_time":"08:00"}}$$
- create_announcement: $$ACTION{"action":"create_announcement","params":{"title":"Important Notice","content":"Classes are suspended tomorrow.","priority":"urgent"}}$$
  Priority can be: normal, important, urgent
- create_subject: $$ACTION{"action":"create_subject","params":{"name":"Mathematics","code":"MATH101","units":3}}$$
- delete_subject: $$ACTION{"action":"delete_subject","params":{"name":"Mathematics"}}$$
- create_room: $$ACTION{"action":"create_room","params":{"name":"Room 101","type":"lecture","capacity":40,"floor":1}}$$
  Type can be: lecture, laboratory, computer_lab, gymnasium
- delete_room: $$ACTION{"action":"delete_room","params":{"name":"Room 101"}}$$
- create_section: $$ACTION{"action":"create_section","params":{"name":"BSIT-301","year_level":3,"program":"BSIT"}}$$
- delete_section: $$ACTION{"action":"delete_section","params":{"name":"BSIT-301"}}$$
- update_profile: $$ACTION{"action":"update_profile","params":{"user_email":"user@email.com","updates":{"full_name":"...","role":"..."}}}$$

Rules for actions:
- CRITICAL: If asked to create a student account and the user DID NOT specify their program (e.g., STEM), year_level (e.g., 11), or section (e.g., MAWD 12A), DO NOT issue the create_user action. Instead, politely ask the administrator to provide those missing details first.
- When an admin says "create 5 student accounts with random names", generate 5 Filipino names and include 5 separate $$ACTION blocks
- You MUST use REAL dates, REAL times, REAL names — never use placeholders like YYYY-MM-DD
- When asked to delete an event, use the event title from the EVENTS section
- When asked to delete a user, use their email from the REGISTERED USERS section
- When asked to list students/teachers/users, read the REGISTERED USERS section and list ALL of them
- Include a brief description BEFORE the action blocks
- If the user is not an admin, refuse: "Only administrators can perform system actions."

Keep responses concise, professional, and formatted with clear structure using bullet points or numbered lists when applicable.`;

interface GeminiMessage {
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
}

// Fetch relevant context from Supabase for the AI
async function getScheduleContext(): Promise<string> {
    // Use supabaseAdmin to bypass RLS and read all data
    const db = supabaseAdmin || supabase;
    console.log('[OptiBot] getScheduleContext using:', supabaseAdmin ? 'supabaseAdmin (service_role)' : 'supabase (anon)');
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

        // Log any query errors
        if (usersRes.error) console.error('[OptiBot] Users query error:', usersRes.error.message);
        if (schedulesRes.error) console.error('[OptiBot] Schedules query error:', schedulesRes.error.message);
        if (teachersRes.error) console.error('[OptiBot] Teachers query error:', teachersRes.error.message);
        if (eventsRes.error) console.error('[OptiBot] Events query error:', eventsRes.error.message);
        if (subjectsRes.error) console.error('[OptiBot] Subjects query error:', subjectsRes.error.message);
        if (sectionsRes.error) console.error('[OptiBot] Sections query error:', sectionsRes.error.message);

        console.log('[OptiBot] Context data counts — schedules:', schedulesRes.data?.length || 0,
            'teachers:', teachersRes.data?.length || 0, 'rooms:', roomsRes.data?.length || 0,
            'events:', eventsRes.data?.length || 0, 'users:', usersRes.data?.length || 0,
            'subjects:', subjectsRes.data?.length || 0, 'sections:', sectionsRes.data?.length || 0);

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
                const roomStr = e.room ? ` | Room: ${e.room}` : '';
                context += `- [ID: ${e.id}] ${e.event_date}${timeStr}: ${e.title}${roomStr}${e.description ? ' — ' + e.description : ''} [by ${e.creator_name}]\n`;
            }
        } else {
            context += '\n### Events: No upcoming events\n';
        }

        // Include registered users so AI can list them
        if (usersRes.data && usersRes.data.length > 0) {
            const students = usersRes.data.filter((u: any) => u.role === 'student');
            const teacherUsers = usersRes.data.filter((u: any) => u.role === 'teacher');
            const admins = usersRes.data.filter((u: any) => u.role === 'admin');
            const others = usersRes.data.filter((u: any) => !u.role || !['student', 'teacher', 'admin'].includes(u.role));

            context += `\n### REGISTERED USERS (${usersRes.data.length} total):\n`;
            if (admins.length > 0) {
                context += `\n**Admins (${admins.length}):**\n`;
                for (const u of admins) {
                    context += `- ${u.full_name || 'N/A'} | ${u.email || 'N/A'}\n`;
                }
            }
            if (teacherUsers.length > 0) {
                context += `\n**Teachers (${teacherUsers.length}):**\n`;
                for (const u of teacherUsers) {
                    context += `- ${u.full_name || 'N/A'} | ${u.email || 'N/A'}\n`;
                }
            }
            if (students.length > 0) {
                context += `\n**Students (${students.length}):**\n`;
                for (const u of students) {
                    context += `- ${u.full_name || 'N/A'} | ${u.email || 'N/A'}${u.program ? ' | ' + u.program : ''}${u.section ? ' | Sec: ' + u.section : ''}\n`;
                }
            }
            if (others.length > 0) {
                context += `\n**Unassigned Role (${others.length}):**\n`;
                for (const u of others) {
                    context += `- ${u.full_name || 'N/A'} | ${u.email || 'N/A'} | role: ${u.role || 'none'}\n`;
                }
            }
        } else {
            context += '\n### REGISTERED USERS: No users found in database.\n';
            context += `(This may be a permissions issue. Using: ${supabaseAdmin ? 'service_role' : 'anon'})\n`;
        }

        // Include subjects
        if (subjectsRes.data && subjectsRes.data.length > 0) {
            context += `\n### SUBJECTS (${subjectsRes.data.length}):\n`;
            for (const s of subjectsRes.data as any[]) {
                context += `- ${s.name} (${s.code})${s.units ? ' | ' + s.units + ' units' : ''}\n`;
            }
        }

        // Include sections
        if (sectionsRes.data && sectionsRes.data.length > 0) {
            context += `\n### SECTIONS (${sectionsRes.data.length}):\n`;
            for (const s of sectionsRes.data as any[]) {
                context += `- ${s.name}${s.year_level ? ' | Year ' + s.year_level : ''}${s.program ? ' | ' + s.program : ''}\n`;
            }
        }

        // Include recent announcements
        if (announcementsRes.data && announcementsRes.data.length > 0) {
            context += `\n### RECENT ANNOUNCEMENTS (${announcementsRes.data.length}):\n`;
            for (const a of announcementsRes.data as any[]) {
                context += `- [${a.priority || 'normal'}] ${a.title} — ${(a.content || '').substring(0, 80)} (by ${a.author_name || 'Unknown'})\n`;
            }
        }

        return context;
    } catch (error) {
        console.error('[OptiBot] Error fetching context:', error);
        return '\n\n(Could not fetch current schedule data)';
    }
}

// Helper: delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// === Try Groq API (OpenAI-compatible) ===
async function tryGroq(fullSystemPrompt: string, userMessage: string, conversationHistory: GeminiMessage[]): Promise<string | null> {
    try {
        console.log('[OptiBot] Trying Groq (llama-3.3-70b-versatile)...');
        const messages = [
            { role: 'system', content: fullSystemPrompt },
            ...conversationHistory.map(m => ({
                role: m.role === 'model' ? 'assistant' : 'user',
                content: m.parts.map(p => p.text).join(''),
            })),
            { role: 'user', content: userMessage },
        ];

        const response = await fetch(GROQ_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages,
                temperature: 0.7,
                max_tokens: 4096,
            }),
        });

        if (response.ok) {
            const data = await response.json();
            const text = data?.choices?.[0]?.message?.content;
            if (text) {
                console.log('[OptiBot] Success with Groq');
                return text;
            }
        } else {
            const errText = await response.text();
            console.warn(`[OptiBot] Groq error ${response.status}:`, errText.substring(0, 200));
        }
    } catch (err) {
        console.error('[OptiBot] Groq fetch error:', err);
    }
    return null;
}

// === Try OpenRouter API (OpenAI-compatible) ===
async function tryOpenRouter(fullSystemPrompt: string, userMessage: string, conversationHistory: GeminiMessage[]): Promise<string | null> {
    try {
        console.log('[OptiBot] Trying OpenRouter...');
        const messages = [
            { role: 'system', content: fullSystemPrompt },
            ...conversationHistory.map(m => ({
                role: m.role === 'model' ? 'assistant' : 'user',
                content: m.parts.map(p => p.text).join(''),
            })),
            { role: 'user', content: userMessage },
        ];

        const response = await fetch(OPENROUTER_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://optisched.app',
                'X-Title': 'OptiSched AI',
            },
            body: JSON.stringify({
                model: 'meta-llama/llama-3.3-70b-instruct',
                messages,
                temperature: 0.7,
                max_tokens: 1024,
            }),
        });

        if (response.ok) {
            const data = await response.json();
            const text = data?.choices?.[0]?.message?.content;
            if (text) {
                console.log('[OptiBot] Success with OpenRouter');
                return text;
            }
        } else {
            const errText = await response.text();
            console.warn(`[OptiBot] OpenRouter error ${response.status}:`, errText.substring(0, 200));
        }
    } catch (err) {
        console.error('[OptiBot] OpenRouter fetch error:', err);
    }
    return null;
}

// Main function to send a message with multi-provider fallback
// Chain: Gemini models → Groq → OpenRouter
export async function sendToGemini(
    userMessage: string,
    conversationHistory: GeminiMessage[] = [],
    userProfile?: { full_name?: string; role?: string; email?: string; program?: string; section?: string; year_level?: string }
): Promise<string> {
    try {
        // Fetch real schedule context from DB
        const scheduleContext = await getScheduleContext();

        // Build user identity context
        let userContext = '';
        if (userProfile) {
            userContext = `\n\n## CURRENT USER CONTEXT:\nYou are currently talking to:\n- Name: ${userProfile.full_name || 'Unknown'}\n- Role: ${userProfile.role || 'unknown'}\n- Email: ${userProfile.email || 'N/A'}${userProfile.program ? `\n- Program: ${userProfile.program}` : ''}${userProfile.section ? `\n- Section: ${userProfile.section}` : ''}${userProfile.year_level ? `\n- Year Level: ${userProfile.year_level}` : ''}\n${userProfile.role === 'admin' ? '\n ADMIN POWERS ACTIVE: This user is an administrator. When they ask you to create users, manage events, or perform any system operation, you MUST include the $$ACTION{...}$$ block in your response to execute it. Do NOT just explain what could be done — actually do it by outputting the action block.\n' : ''}\nWhen the user asks "who am I" or "what is my name", respond with the above information. When they ask about "my schedule" or "my classes", filter results based on their role and identity. You already know who they are — never ask them who they are.`;
        }

        const fullSystemPrompt = SYSTEM_PROMPT + userContext + scheduleContext;

        // === 1. Try Gemini models first ===
        const contents: GeminiMessage[] = [
            {
                role: 'user',
                parts: [{ text: fullSystemPrompt + '\n\nPlease acknowledge these instructions briefly.' }],
            },
            {
                role: 'model',
                parts: [{ text: `Understood. I am OptiSched AI, ready to help${userProfile?.full_name ? ` ${userProfile.full_name}` : ''}. How can I assist you?` }],
            },
            ...conversationHistory,
            {
                role: 'user',
                parts: [{ text: userMessage }],
            },
        ];

        const requestBody = JSON.stringify({
            contents,
            generationConfig: {
                temperature: 0.7,
                topP: 0.9,
                topK: 40,
                maxOutputTokens: 4096,
            },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            ],
        });

        // Try each Gemini model
        for (let modelIdx = 0; modelIdx < GEMINI_MODELS.length; modelIdx++) {
            const model = GEMINI_MODELS[modelIdx];
            const apiUrl = `${GEMINI_BASE_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`;

            for (let retry = 0; retry <= MAX_RETRIES; retry++) {
                try {
                    console.log(`[OptiBot] Trying ${model} (attempt ${retry + 1})...`);

                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: requestBody,
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (aiResponse) {
                            console.log(`[OptiBot] Success with ${model}`);
                            return await processAIActions(aiResponse, userProfile?.role);
                        }
                        break; // Empty response, try next model
                    }

                    if (response.status === 429) {
                        console.warn(`[OptiBot] Rate limited on ${model}, attempt ${retry + 1}/${MAX_RETRIES + 1}`);
                        if (retry < MAX_RETRIES) {
                            await delay(RETRY_DELAY_MS);
                            continue;
                        }
                        break;
                    }

                    const errorText = await response.text();
                    console.error(`[OptiBot] ${model} error ${response.status}:`, errorText.substring(0, 200));
                    break;

                } catch (fetchError) {
                    console.error(`[OptiBot] Fetch error for ${model}:`, fetchError);
                    break;
                }
            }
        }

        // === 2. Try Groq ===
        const groqResult = await tryGroq(fullSystemPrompt, userMessage, conversationHistory);
        if (groqResult) {
            const processed = await processAIActions(groqResult, userProfile?.role);
            return processed;
        }

        // === 3. Try OpenRouter ===
        const openRouterResult = await tryOpenRouter(fullSystemPrompt, userMessage, conversationHistory);
        if (openRouterResult) {
            const processed = await processAIActions(openRouterResult, userProfile?.role);
            return processed;
        }

        // All providers exhausted
        return 'I\'m temporarily experiencing high demand across all AI services. Please wait a minute and try again.';

    } catch (error) {
        console.error('[OptiBot] Error:', error);
        return 'Sorry, I encountered a connection error. Please check your internet connection and try again.';
    }
}

// === Action Execution System ===

// Helper to generate random digits string
function randomDigits(len: number): string {
    let result = '';
    for (let i = 0; i < len; i++) result += Math.floor(Math.random() * 10).toString();
    return result;
}

// Helper to generate random password (letters + digits)
function randomPassword(len: number): string {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < len; i++) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

async function processAIActions(response: string, userRole?: string): Promise<string> {
    // More robust regex that handles optional whitespace around $$
    const actionRegex = /\$\$ACTION\s*(\{[\s\S]*?\})\s*\$\$/g;
    let processedResponse = response;
    let match;
    const matches: { full: string; json: string }[] = [];

    // Collect all matches first (to avoid regex state issues)
    while ((match = actionRegex.exec(response)) !== null) {
        matches.push({ full: match[0], json: match[1] });
    }

    for (const m of matches) {
        try {
            const actionData = JSON.parse(m.json);
            console.log('[OptiBot] Processing action:', actionData.action, actionData.params);

            if (userRole !== 'admin') {
                processedResponse = processedResponse.replace(m.full, '\nAction blocked — only administrators can perform system actions.\n');
                continue;
            }

            const result = await executeAction(actionData.action, actionData.params);
            console.log('[OptiBot] Action result:', result);
            processedResponse = processedResponse.replace(
                m.full,
                result.success
                    ? `\nSuccess: ${result.message}\n`
                    : `\nFailed: Action failed: ${result.message}\n`
            );
        } catch (err) {
            console.error('[OptiBot] Action parse error:', err, 'Raw JSON:', m.json);
            processedResponse = processedResponse.replace(m.full, '\nError: Could not process action.\n');
        }
    }

    // Clean up any remaining action-like patterns that weren't caught
    processedResponse = processedResponse.replace(/\$\$ACTION\s*\{[\s\S]*?\}\s*\$\$/g, '');

    return processedResponse;
}

async function executeAction(action: string, params: Record<string, any>): Promise<{ success: boolean; message: string }> {
    try {
        switch (action) {
            case 'create_user': {
                let { email, password, full_name, role, student_id, section, program, year_level } = params;
                if (!full_name) {
                    return { success: false, message: 'Missing required field: full_name.' };
                }
                if (!role) role = 'student';

                // Auto-generate email from lastname + 6 digits (matching manual creation format)
                if (!email || email.includes('example') || email === 'AUTO') {
                    const nameParts = full_name.trim().split(' ');
                    const surname = nameParts[nameParts.length - 1]?.toLowerCase() || 'user';
                    // Use last 6 digits of student_id if provided, otherwise random 6 digits
                    const idStr = student_id ? student_id.replace(/\D/g, '').slice(-6) : randomDigits(6);
                    const last6 = idStr.length >= 6 ? idStr : idStr.padStart(6, '0');
                    email = `${surname}.${last6}@optisched.sti.edu`;
                }

                // If admin provided a specific password, USE IT exactly as provided.
                // Otherwise, auto-generate a strong password.
                let assignedPassword = password;
                if (!assignedPassword || assignedPassword === 'AUTO' || assignedPassword === 'temp123' || assignedPassword.includes('example')) {
                    assignedPassword = randomPassword(8);
                }

                // Use supabaseAdmin (service role) if available
                const adminClient = supabaseAdmin || supabase;

                try {
                    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
                        email,
                        password: assignedPassword,
                        email_confirm: true,
                    });

                    if (authError) {
                        console.error('[OptiBot] auth.admin.createUser failed:', authError.message);
                        return { success: false, message: `Could not create auth account: ${authError.message}` };
                    }

                    // Insert the user's profile data
                    const profileData: any = {
                        id: authData.user.id,
                        email,
                        full_name,
                        role,
                    };

                    if (section) profileData.section = section;
                    if (program) profileData.program = program;
                    if (year_level) profileData.year_level = typeof year_level === 'string' ? parseInt(year_level) : year_level;

                    // Use Upsert because a database trigger may have already generated a bare-bones row on Auth creation. 
                    const { error: profileError } = await adminClient.from('profiles').upsert(profileData);

                    if (profileError) {
                        console.error('[OptiBot] Profile insertion failed:', profileError.message);
                        return { success: false, message: `Auth account created but profile failed: ${profileError.message}` };
                    }

                    let successMsg = `User created successfully! Name: ${full_name}, Email: ${email}, Password: ${assignedPassword}`;
                    if (section) successMsg += `, Section: ${section}`;
                    if (program) successMsg += `, Program: ${program}`;
                    if (year_level) successMsg += `, Grade/Year: ${year_level}`;

                    return { success: true, message: successMsg };
                } catch (e: any) {
                    return { success: false, message: `System error creating user: ${e.message}` };
                }
            }

            case 'create_event': {
                const { title, description, event_date, start_time, end_time } = params;
                if (!title || !event_date) {
                    return { success: false, message: 'Missing required fields (title, event_date).' };
                }
                const { error } = await supabase.from('custom_events').insert({
                    title,
                    description: description || null,
                    event_date,
                    start_time: start_time || null,
                    end_time: end_time || null,
                    creator_name: 'OptiBot AI',
                    creator_role: 'admin',
                });
                if (error) {
                    console.error('[OptiBot] create_event error:', error.message);
                    return { success: false, message: error.message };
                }
                return { success: true, message: `Event "${title}" created for ${event_date}${start_time ? ` (${start_time}-${end_time || '?'})` : ''}.` };
            }

            case 'delete_event': {
                // Support both event_id (UUID) and event_title (name lookup)
                const { event_id, event_title } = params;
                const dbClient = supabaseAdmin || supabase;
                let targetId = event_id;

                if (!targetId && event_title) {
                    // Find event by title
                    const { data: found, error: findErr } = await dbClient.from('custom_events')
                        .select('id, title')
                        .ilike('title', `% ${event_title}% `)
                        .limit(1)
                        .single();
                    if (findErr) console.error('[OptiBot] Find event error:', findErr.message);
                    if (found) {
                        targetId = found.id;
                    } else {
                        return { success: false, message: `No event found matching "${event_title}".` };
                    }
                }

                if (!targetId) return { success: false, message: 'Please specify which event to delete by title.' };
                const { error: delErr } = await dbClient.from('custom_events').delete().eq('id', targetId);
                if (delErr) {
                    console.error('[OptiBot] delete_event error:', delErr.message);
                    return { success: false, message: delErr.message };
                }
                return { success: true, message: `Event "${event_title || targetId}" deleted successfully.` };
            }

            case 'delete_user': {
                const { user_email, user_id } = params;
                const dbClient = supabaseAdmin || supabase;

                let targetId = user_id;
                if (!targetId && user_email) {
                    const { data: found } = await dbClient.from('profiles')
                        .select('id')
                        .eq('email', user_email)
                        .single();
                    if (found) targetId = found.id;
                    else return { success: false, message: `No user found with email "${user_email}".` };
                }
                if (!targetId) return { success: false, message: 'Please specify user email to delete.' };

                // Delete profile first, then auth user
                const { error: profileErr } = await dbClient.from('profiles').delete().eq('id', targetId);
                if (profileErr) console.error('[OptiBot] delete profile error:', profileErr.message);

                // Try to delete auth user (requires admin client)
                if (supabaseAdmin) {
                    try {
                        const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(targetId);
                        if (authErr) console.error('[OptiBot] delete auth user error:', authErr.message);
                    } catch (e) {
                        console.error('[OptiBot] delete auth exception:', e);
                    }
                }

                return { success: true, message: `User "${user_email || targetId}" has been deleted.` };
            }

            case 'update_profile': {
                const { user_id, user_email, updates } = params;
                const dbClient = supabaseAdmin || supabase;
                if (!updates) return { success: false, message: 'Missing updates.' };

                let targetId = user_id;
                if (!targetId && user_email) {
                    const { data: found } = await dbClient.from('profiles')
                        .select('id')
                        .eq('email', user_email)
                        .single();
                    if (found) targetId = found.id;
                    else return { success: false, message: `No user found with email "${user_email}".` };
                }

                if (!targetId) return { success: false, message: 'Missing user_id or user_email.' };
                const { error } = await dbClient.from('profiles').update(updates).eq('id', targetId);
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Profile updated for ${user_email || user_id}.` };
            }

            case 'create_schedule': {
                const { subject_name, teacher_name, room_name, section_name, day_of_week, start_time, end_time } = params;
                const dbClient = supabaseAdmin || supabase;

                if (!subject_name || !day_of_week || !start_time || !end_time) {
                    return { success: false, message: 'Missing required fields: subject_name, day_of_week, start_time, end_time.' };
                }

                // Look up IDs by name
                let subject_id = null, teacher_id = null, room_id = null, section_id = null;

                if (subject_name) {
                    const { data: subj } = await dbClient.from('subjects').select('id').ilike('name', `% ${subject_name}% `).limit(1).single();
                    if (subj) subject_id = subj.id;
                    else return { success: false, message: `Subject "${subject_name}" not found.` };
                }
                if (teacher_name) {
                    const { data: tch } = await dbClient.from('profiles').select('id').ilike('full_name', `% ${teacher_name}% `).eq('role', 'teacher').limit(1).single();
                    if (tch) {
                        // Find teacher record linked to this profile
                        const { data: tchRecord } = await dbClient.from('teachers').select('id').eq('profile_id', tch.id).single();
                        if (tchRecord) teacher_id = tchRecord.id;
                    }
                }
                if (room_name) {
                    const { data: rm } = await dbClient.from('rooms').select('id').ilike('name', `% ${room_name}% `).limit(1).single();
                    if (rm) room_id = rm.id;
                }
                if (section_name) {
                    const { data: sec } = await dbClient.from('sections').select('id').ilike('name', `% ${section_name}% `).limit(1).single();
                    if (sec) section_id = sec.id;
                }

                const scheduleData: any = {
                    subject_id,
                    day_of_week,
                    start_time,
                    end_time,
                    status: 'published',
                };
                if (teacher_id) scheduleData.teacher_id = teacher_id;
                if (room_id) scheduleData.room_id = room_id;
                if (section_id) scheduleData.section_id = section_id;

                // === CONFLICT DETECTION ENGINE ===
                // 1. Room conflict: same room, same day, overlapping time
                if (room_id) {
                    const { data: roomConflicts } = await dbClient
                        .from('schedules')
                        .select('*, subject:subjects(name), section:sections(name)')
                        .eq('room_id', room_id)
                        .eq('day_of_week', day_of_week)
                        .eq('status', 'published')
                        .lt('start_time', end_time)
                        .gt('end_time', start_time);
                    if (roomConflicts && roomConflicts.length > 0) {
                        const conflict = roomConflicts[0];
                        const conflictSubject = (conflict.subject as any)?.name || 'Unknown';
                        const conflictSection = (conflict.section as any)?.name || 'Unknown';
                        return {
                            success: false,
                            message: `ROOM CONFLICT DETECTED: Room "${room_name}" is already booked on ${day_of_week} ${conflict.start_time} -${conflict.end_time} for "${conflictSubject}"(${conflictSection}).Please choose a different room or time slot.`
                        };
                    }
                }

                // 2. Teacher conflict: same teacher, same day, overlapping time
                if (teacher_id) {
                    const { data: teacherConflicts } = await dbClient
                        .from('schedules')
                        .select('*, subject:subjects(name), room:rooms(name)')
                        .eq('teacher_id', teacher_id)
                        .eq('day_of_week', day_of_week)
                        .eq('status', 'published')
                        .lt('start_time', end_time)
                        .gt('end_time', start_time);
                    if (teacherConflicts && teacherConflicts.length > 0) {
                        const conflict = teacherConflicts[0];
                        const conflictSubject = (conflict.subject as any)?.name || 'Unknown';
                        const conflictRoom = (conflict.room as any)?.name || 'Unknown';
                        return {
                            success: false,
                            message: `TEACHER CONFLICT DETECTED: "${teacher_name}" is already teaching "${conflictSubject}" in Room "${conflictRoom}" on ${day_of_week} ${conflict.start_time} -${conflict.end_time}. A teacher cannot be in two places at once.Please choose a different time slot.`
                        };
                    }
                }

                const { error: schedErr } = await dbClient.from('schedules').insert(scheduleData);
                if (schedErr) {
                    console.error('[OptiBot] create_schedule error:', schedErr.message);
                    return { success: false, message: schedErr.message };
                }
                return { success: true, message: `Schedule created: ${subject_name} on ${day_of_week} ${start_time} -${end_time}${room_name ? ' in ' + room_name : ''}${teacher_name ? ' with ' + teacher_name : ''}${section_name ? ' for ' + section_name : ''}.` };
            }

            case 'delete_schedule': {
                const { subject_name, day_of_week, start_time, schedule_id } = params;
                const dbClient = supabaseAdmin || supabase;

                if (schedule_id) {
                    const { error } = await dbClient.from('schedules').delete().eq('id', schedule_id);
                    if (error) return { success: false, message: error.message };
                    return { success: true, message: 'Schedule deleted successfully.' };
                }

                if (!subject_name || !day_of_week) {
                    return { success: false, message: 'Please specify subject_name and day_of_week to identify the schedule.' };
                }

                // Find subject ID
                const { data: subj } = await dbClient.from('subjects').select('id').ilike('name', `% ${subject_name}% `).limit(1).single();
                if (!subj) return { success: false, message: `Subject "${subject_name}" not found.` };

                let query = dbClient.from('schedules').delete().eq('subject_id', subj.id).eq('day_of_week', day_of_week);
                if (start_time) query = query.eq('start_time', start_time);

                const { error } = await query;
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Schedule for ${subject_name} on ${day_of_week}${start_time ? ' at ' + start_time : ''} deleted.` };
            }

            case 'create_announcement': {
                const { title, content, priority, target_section } = params;
                const dbClient = supabaseAdmin || supabase;
                if (!title || !content) return { success: false, message: 'Missing title or content.' };

                const insertData: any = {
                    title,
                    content,
                    priority: priority || 'normal',
                    author_name: 'OptiBot AI',
                    author_id: 'ai-system',
                };
                if (target_section) insertData.target_section = target_section;
                const { error } = await dbClient.from('announcements').insert(insertData);
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Announcement "${title}" posted(${priority || 'normal'} priority)${target_section ? ' for ' + target_section : ''}.` };
            }

            case 'create_subject': {
                const { name, code, units } = params;
                const dbClient = supabaseAdmin || supabase;
                if (!name || !code) return { success: false, message: 'Missing name or code.' };

                const { error } = await dbClient.from('subjects').insert({
                    name,
                    code,
                    units: units || null,
                });
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Subject "${name}"(${code}) created.` };
            }

            case 'delete_subject': {
                const { name } = params;
                const dbClient = supabaseAdmin || supabase;
                if (!name) return { success: false, message: 'Missing subject name.' };

                const { error } = await dbClient.from('subjects').delete().ilike('name', `% ${name}% `);
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Subject "${name}" deleted.` };
            }

            case 'create_room': {
                const { name, type, capacity, floor } = params;
                const dbClient = supabaseAdmin || supabase;
                if (!name) return { success: false, message: 'Missing room name.' };

                const { error } = await dbClient.from('rooms').insert({
                    name,
                    type: type || 'lecture',
                    capacity: capacity || 40,
                    floor: floor || 1,
                });
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Room "${name}" created(${type || 'lecture'}, capacity: ${capacity || 40}).` };
            }

            case 'delete_room': {
                const { name } = params;
                const dbClient = supabaseAdmin || supabase;
                if (!name) return { success: false, message: 'Missing room name.' };

                const { error } = await dbClient.from('rooms').delete().ilike('name', `% ${name}% `);
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Room "${name}" deleted.` };
            }

            case 'create_section': {
                const { name, year_level, program } = params;
                const dbClient = supabaseAdmin || supabase;
                if (!name) return { success: false, message: 'Missing section name.' };

                const { error } = await dbClient.from('sections').insert({
                    name,
                    year_level: year_level || null,
                    program: program || null,
                });
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Section "${name}" created${year_level ? ' (Year ' + year_level + ')' : ''}${program ? ' — ' + program : ''}.` };
            }

            case 'delete_section': {
                const { name } = params;
                const dbClient = supabaseAdmin || supabase;
                if (!name) return { success: false, message: 'Missing section name.' };

                const { error } = await dbClient.from('sections').delete().ilike('name', `% ${name}% `);
                if (error) return { success: false, message: error.message };
                return { success: true, message: `Section "${name}" deleted.` };
            }

            default:
                return { success: false, message: `Unknown action: ${action} ` };
        }
    } catch (err: any) {
        console.error('[OptiBot] executeAction error:', err);
        return { success: false, message: err.message || 'An unexpected error occurred.' };
    }
}

export type { GeminiMessage };
