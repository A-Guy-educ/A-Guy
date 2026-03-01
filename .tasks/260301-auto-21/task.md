# Task

## Issue Title

[2603--auto-XX] Adaptive Practice Schedule — Implementation Task
Execution Contract (Routing Guard)
- Intent: IMPLEMENTATION (not spec-only).
- Expected `task_type`: `implement_feature`.
- Expected pipeline: `spec_execute_verify` (full fix with code changes).
- Deliverable: merged code changes + tests, not planning docs only.
- This task requires production code changes in the listed files.
- Do NOT classify as `spec_only`.
- Pipeline must execute implementation stages and produce code + tests.
 1) Executive Summary
This task fixes critical bugs and missing functionality in the Adaptive Practice Schedule.
Current problem:
- Schedule is static/identical across days.
- Plan generation is automatic/incorrect on mount.
Target behavior:
- Plan is generated only on explicit user action.
- Plan is dynamic by exam proximity + topic mastery.
- Each day shows specific topics and concrete practice actions.
- Day completion can be marked and persisted.
Design mandate:
- Mirror `test plan.html` visual style.
- Tailwind CSS, Assistant font, RTL, Lucide icons.
- Same spacing/cards/vibe.
---
 2) Identified Bugs & Required Fixes
 BUG A — Missing Manual Trigger
Issue:
- Plan generates automatically (or incorrectly) on mount.
Required fix:
- Add explicit CTA button:
  - HE: `צור תוכנית לימודים`
  - EN: `Generate Example Plan`
- Do NOT compute or persist schedule on mount or field changes.
- Compute + persist only when user clicks Generate.
- Before generation, show empty state:
  - HE: `מוכנים לצאת לדרך?`
 BUG B — Static Schedule Logic
Issue:
- Daily activities are repetitive/static and ignore timeline urgency.
Required fix:
- Implement adaptive timeline scaling.
- Activity mix must change as exam approaches.
---
 3) Functional Requirements (Logic Engine)
 A) Adaptive Timeline Scaling
Scheduler must assign daily strategy by `daysUntilExam`:
| Timeframe | Strategy | Primary Focus | Activity Mix |
|---|---|---|---|
| 1–2 days | Survival Mode | Knowledge Maintenance | Maintain Strong + 1 quick pass on Weak, no full simulations |
| 3–5 days | High Intensity | Exam Readiness | Full simulations + mistake analysis + weak drills |
| 6–7 days | Balanced | Mastery & Polish | Mix of drills, hybrid simulations, targeted reinforcement |
| 8+ days | Mastery Cycle | Foundation Building | Days 8+ = intensive weak-topic drills, final 1–7 days follow standard countdown logic |
 B) Fallback + Topic Selection
- Assign specific topics each day from user topics inventory.
- Weak-focus fallback:
  1. Weak
  2. if empty → Medium
  3. if empty → Strong
- Rotation rule:
  - Round-robin in selected category.
  - Do not repeat a topic until peers in same category are covered.
 C) Scope & Timeline
- Show up to last 7 days before exam.
- Must clearly differ between near exam and longer horizon.
- `daysUntilExam = 1` must be warm-up oriented, not full study day.
---
 4) UI & Interaction Updates
 Visual Identity (RTL)
- Font: Assistant (300–800).
- RTL everywhere.
- Vertical timeline + rounded cards (`rounded-2xl`) + shadows.
- Mastery colors:
  - Weak: `red-500`
  - Medium: `orange-400`
  - Strong: `emerald-500`
- Palette: Slate/Indigo, matching demo vibe.
 Progress Tracking
- Add completion toggle (checkmark) per day card.
- Persist completion to existing `UserProgress` collection (do not create new collection unless strictly required).
- Completed day visual:
  - `opacity-50` and/or `בוצע` badge.
- Completion survives page refresh.
---
 5) Technical Implementation Notes
 Files to Modify
- `src/lib/study-plan/engine.ts`
  - adaptive scaling
  - fallback selection
  - round-robin topic rotation
  - per-day activity generation
- `src/app/(frontend)/study-plan/_components/useStudyPlan.ts`
  - `hasGenerated`/manual trigger flow
  - generate + persist behavior
  - load persisted plan + completion
  - regenerate overwrite semantics
- `src/app/(frontend)/study-plan/_components/DayCard.tsx`
  - completion toggle UI
  - completed state visuals
  - render concrete tasks from engine output
 Date Handling
- Use **date-fns only** for day calculations (timezone/DST safe).
 Parser Hygiene (important)
- Keep this task as one clean block.
- Do not duplicate sections.
- Do not include broken/truncated lines.
---
 6) Acceptance Criteria
- [ ] Plan generation happens only on Generate button click.
- [ ] Clear behavioral difference between 2-day and 10-day scenarios.
- [ ] Each day shows specific topics + concrete activity tasks.
- [ ] Completion state persists after refresh.
- [ ] UI is RTL and matches the intended visual style.
- [ ] `daysUntilExam = 1` yields warm-up style day (not full study day).
---
 7) Definition of Done
PR includes:
- Working adaptive engine implementation.
- Explicit generate trigger + correct empty state.
- Completion persistence via existing progress model.
- Tests for core engine behavior (minimum):
  - 2-day scenario
  - 5-day scenario
  - 7+/10-day scenario
  - varying topic mastery mixes
- Type/lint/tests pass.


Follow the exact design and plan like it is planned here (logic wise):


<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>בונה תוכנית לימודים - 7 ימי מיקוד</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Assistant', sans-serif;
        }
        .custom-scrollbar::-webkit-scrollbar {
            width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: #f1f1f1;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 10px;
        }
        .animate-pulse-slow {
            animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
    </style>
</head>
<body class="bg-slate-50 min-h-screen p-4 md:p-8">

    <div class="max-w-5xl mx-auto">
        <!-- Header -->
        <header class="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-8 relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 class="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
                        <i data-lucide="zap" class="text-amber-500 fill-amber-500 w-8 h-8"></i>
                        תוכנית 7 ימי המיקוד
                    </h1>
                    <p class="text-slate-500 mt-1 italic">השבוע הקריטי ביותר להצלחה בבחינה</p>
                </div>
                <div id="exam-date-badge" class="hidden bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl border border-indigo-100 flex items-center gap-2">
                    <i data-lucide="calendar" class="w-4 h-4"></i>
                    <span class="font-bold" id="selected-date-display"></span>
                </div>
            </div>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            <!-- Sidebar Controls -->
            <div class="lg:col-span-1 space-y-6">
                <!-- Date Selector -->
                <section class="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <h2 class="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                        <i data-lucide="calendar" class="w-5 h-5 text-indigo-500"></i>
                        מתי הבחינה?
                    </h2>
                    <input 
                        type="date" 
                        id="test-date-input"
                        class="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-slate-50"
                    />
                </section>

                <!-- Topics Manager -->
                <section class="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <h2 class="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                        <i data-lucide="book-open" class="w-5 h-5 text-indigo-500"></i>
                        נושאים למיקוד
                    </h2>
                    <div id="topics-list" class="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                        <!-- Topics will be injected here -->
                    </div>
                    <div class="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                        <input 
                            type="text" 
                            id="new-topic-input"
                            placeholder="הוסף נושא..."
                            class="flex-1 p-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
                        />
                        <button 
                            onclick="addTopic()"
                            class="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-shadow shadow-md"
                        >
                            +
                        </button>
                    </div>
                </section>
            </div>

            <!-- Schedule View -->
            <div class="lg:col-span-2">
                <div id="empty-state" class="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-16 text-center">
                    <div class="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i data-lucide="clock" class="w-10 h-10 text-indigo-400"></i>
                    </div>
                    <h3 class="text-2xl font-bold text-slate-800">מוכנים לצאת לדרך?</h3>
                    <p class="text-slate-500 mt-3 max-w-sm mx-auto">הזן את תאריך הבחינה ונייצר עבורך תוכנית אימונים אינטנסיבית ל-7 הימים האחרונים.</p>
                </div>

                <div id="schedule-container" class="hidden space-y-6">
                    <h2 class="text-xl font-black text-slate-800 flex items-center gap-2">
                        לו״ז 7 ימי המיקוד
                        <span class="text-sm font-normal text-slate-400">(הספירה לאחור)</span>
                    </h2>
                    <div id="days-list" class="grid grid-cols-1 gap-4">
                        <!-- Days will be injected here -->
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // State Management
        let testDate = '';
        let topics = [
            { id: 1, name: 'חקירת פולינום', level: 'good' },
            { id: 2, name: 'טריגונומטריה', level: 'medium' },
            { id: 3, name: 'הסתברות', level: 'bad' }
        ];

        // UI Selectors
        const dateInput = document.getElementById('test-date-input');
        const topicsList = document.getElementById('topics-list');
        const newTopicInput = document.getElementById('new-topic-input');
        const emptyState = document.getElementById('empty-state');
        const scheduleContainer = document.getElementById('schedule-container');
        const daysList = document.getElementById('days-list');
        const badge = document.getElementById('exam-date-badge');
        const selectedDateDisplay = document.getElementById('selected-date-display');

        // Initialize Lucide Icons
        function refreshIcons() {
            lucide.createIcons();
        }

        // Render Topics
        function renderTopics() {
            topicsList.innerHTML = topics.map(topic => `
                <div class="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 group">
                    <div class="flex justify-between items-center">
                        <span class="font-semibold text-slate-700">${topic.name}</span>
                        <button onclick="removeTopic(${topic.id})" class="text-slate-300 hover:text-red-500 transition-colors">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                    <div class="flex gap-1">
                        ${['bad', 'medium', 'good'].map(lvl => `
                            <button
                                onclick="updateLevel(${topic.id}, '${lvl}')"
                                class="flex-1 text-[10px] py-1.5 rounded-lg font-bold transition-all ${
                                    topic.level === lvl 
                                        ? (lvl === 'bad' ? 'bg-red-500 text-white shadow-sm shadow-red-200' : lvl === 'medium' ? 'bg-orange-400 text-white shadow-sm shadow-orange-200' : 'bg-emerald-500 text-white shadow-sm shadow-emerald-200')
                                        : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-100'
                                }"
                            >
                                ${lvl === 'bad' ? 'חלש' : lvl === 'medium' ? 'בינוני' : 'שולט'}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `).join('');
            refreshIcons();
            generatePlan();
        }

        // Topic Actions
        function addTopic() {
            const val = newTopicInput.value.trim();
            if (!val) return;
            topics.push({ id: Date.now(), name: val, level: 'medium' });
            newTopicInput.value = '';
            renderTopics();
        }

        function removeTopic(id) {
            topics = topics.filter(t => t.id !== id);
            renderTopics();
        }

        function updateLevel(id, newLevel) {
            topics = topics.map(t => t.id === id ? { ...t, level: newLevel } : t);
            renderTopics();
        }

        // Logic to generate the 7-day plan
        function generatePlan() {
            if (!testDate) {
                emptyState.classList.remove('hidden');
                scheduleContainer.classList.add('hidden');
                badge.classList.add('hidden');
                return;
            }

            emptyState.classList.add('hidden');
            scheduleContainer.classList.remove('hidden');
            badge.classList.remove('hidden');
            selectedDateDisplay.innerText = new Date(testDate).toLocaleDateString('he-IL');

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const target = new Date(testDate);
            target.setHours(0, 0, 0, 0);

            const diffTime = target - today;
            const totalDaysAvailable = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (totalDaysAvailable <= 0) {
                daysList.innerHTML = `<div class="p-8 text-center bg-red-50 text-red-600 rounded-2xl border border-red-100">תאריך הבחינה חייב להיות בעתיד</div>`;
                return;
            }

            const planDaysCount = Math.min(7, totalDaysAvailable);
            const plan = [];
            
            // Priority Sort (weakest first)
            const sortedTopics = [...topics].sort((a, b) => {
                const order = { bad: 0, medium: 1, good: 2 };
                return order[a.level] - order[b.level];
            });

            const startDate = new Date(target);
            startDate.setDate(target.getDate() - planDaysCount);

            for (let i = 0; i < planDaysCount; i++) {
                const currentDay = new Date(startDate);
                currentDay.setDate(startDate.getDate() + i);
                if (currentDay < today) continue;

                let dayType = 'study';
                let tasks = [];
                const daysUntilTest = Math.ceil((target - currentDay) / (1000 * 60 * 60 * 24));

                if (daysUntilTest === 1) {
                    dayType = 'review';
                    tasks = ['חזרה גנרלית על דגשים', 'מעבר על נוסחאות ומנוחה'];
                } else if (daysUntilTest === 2) {
                    dayType = 'simulation';
                    tasks = ['סימולציית בחינה מלאה', 'תחקור מעמיק של טעויות'];
                } else {
                    const idx1 = (i * 2) % sortedTopics.length;
                    const idx2 = (i * 2 + 1) % sortedTopics.length;
                    tasks = [
                        `למידה: ${sortedTopics[idx1]?.name || 'חזרה חופשית'}`,
                        `תרגול: ${sortedTopics[idx2]?.name || 'חזרה חופשית'}`
                    ];
                }
                
                plan.push({ date: currentDay, tasks, type: dayType });
            }

            renderPlan(plan, target);
        }

        function renderPlan(plan, targetDate) {
            let html = plan.map(day => `
                <div class="group relative overflow-hidden rounded-2xl border flex flex-col md:flex-row transition-all hover:shadow-md ${
                    day.type === 'simulation' ? 'bg-purple-50 border-purple-200 shadow-sm' : 
                    day.type === 'review' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'
                }">
                    <div class="p-4 md:w-32 flex flex-col items-center justify-center text-center border-l border-slate-100 ${
                        day.type === 'simulation' ? 'bg-purple-100/50' : 
                        day.type === 'review' ? 'bg-amber-100/50' : 'bg-slate-50/50'
                    }">
                        <p class="text-[10px] font-bold text-slate-400 uppercase">
                            ${day.date.toLocaleDateString('he-IL', { weekday: 'short' })}
                        </p>
                        <p class="text-2xl font-black text-slate-800">${day.date.getDate()}</p>
                        <p class="text-[10px] font-medium text-slate-500">${day.date.toLocaleDateString('he-IL', { month: 'short' })}</p>
                    </div>
                    <div class="p-5 flex-1">
                        <div class="flex justify-between items-start mb-3">
                            <h4 class="font-bold px-3 py-1 rounded-full text-xs ${
                                day.type === 'simulation' ? 'bg-purple-600 text-white animate-pulse-slow' : 
                                day.type === 'review' ? 'bg-amber-500 text-white' : 'bg-indigo-100 text-indigo-700'
                            }">
                                ${day.type === 'simulation' ? 'סימולציית אמת' : day.type === 'review' ? 'חזרה אחרונה' : 'מיקוד למידה'}
                            </h4>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                            ${day.tasks.map(task => `
                                <div class="flex items-center gap-3 text-sm text-slate-700 bg-white/80 p-3 rounded-xl border border-slate-100 shadow-sm">
                                    <div class="w-2 h-2 rounded-full shrink-0 ${day.type === 'simulation' ? 'bg-purple-500' : 'bg-indigo-400'}"></div>
                                    ${task}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `).join('');

            // Final Exam Card
            html += `
                <div class="bg-slate-900 text-white rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-800">
                    <div class="flex items-center gap-4">
                        <div class="bg-emerald-500 p-3 rounded-2xl shadow-lg shadow-emerald-500/20">
                            <i data-lucide="check-circle" class="w-8 h-8 text-white"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-black">יום המבחן הגדול</h3>
                            <p class="text-slate-400 text-sm">אתה מוכן. כל הנושאים בכיס שלך!</p>
                        </div>
                    </div>
                    <div class="bg-slate-800 px-6 py-3 rounded-2xl border border-slate-700 text-center min-w-[140px]">
                        <span class="block text-xs text-slate-500 mb-1 font-semibold uppercase tracking-widest">יום ה-ח'</span>
                        <span class="text-xl font-bold text-emerald-400">${targetDate.toLocaleDateString('he-IL')}</span>
                    </div>
                </div>
            `;

            daysList.innerHTML = html;
            refreshIcons();
        }

        // Event Listeners
        dateInput.addEventListener('change', (e) => {
            testDate = e.target.value;
            generatePlan();
        });

        newTopicInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTopic();
        });

        // Initial Boot
        document.addEventListener('DOMContentLoaded', () => {
            renderTopics();
            refreshIcons();
        });

    </script>
</body>
</html>
