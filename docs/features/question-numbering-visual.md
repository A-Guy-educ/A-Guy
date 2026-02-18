# Question Numbering Visual Examples

## English Layout (LTR)

### First Question (with bubble)
```
┌────────────────────────────────────────────────────────────────────┐
│ Card Border                                                        │
│                                                                    │
│  ┌───┐                                                            │
│  │ A │  A.1                                                       │
│  └───┘                                                            │
│  ↑                                                                │
│  Bubble (28px, slate-50, border-slate-200)                       │
│                                                                    │
│  Question: What is 2 + 2?                                         │
│                                                                    │
│  ○ 3                                                              │
│  ○ 4                                                              │
│  ○ 5                                                              │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Second Question (no bubble)
```
┌────────────────────────────────────────────────────────────────────┐
│ Card Border                                                        │
│                                                                    │
│  A.2                                                               │
│  ↑                                                                │
│  Plain text label (no bubble)                                     │
│                                                                    │
│  Question: Calculate 5 × 3                                        │
│                                                                    │
│  [________________]                                                │
│                                                                    │
│                                    [Check Answer]                  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Third Question (no bubble)
```
┌────────────────────────────────────────────────────────────────────┐
│ Card Border                                                        │
│                                                                    │
│  A.3                                                               │
│                                                                    │
│  Question: Is the sky blue?                                       │
│                                                                    │
│  [True]  [False]                                                  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## Hebrew Layout (RTL)

### First Question (with bubble, flipped)
```
┌────────────────────────────────────────────────────────────────────┐
│                                                        גבול כרטיס   │
│                                                                    │
│                                                            א.1  ┌───┐│
│                                                                 │ א ││
│                                                                 └───┘│
│                                                                    ↑│
│                                       בועה (28px, slate-50, border)│
│                                                                    │
│                                             ?שאלה: מה זה 2 + 2   │
│                                                                    │
│                                                              3 ○  │
│                                                              4 ○  │
│                                                              5 ○  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Second Question (no bubble)
```
┌────────────────────────────────────────────────────────────────────┐
│                                                        גבול כרטיס   │
│                                                                    │
│                                                               א.2  │
│                                                                ↑   │
│                                           תווית טקסט רגילה (ללא בועה)│
│                                                                    │
│                                          שאלה: חשב 5 × 3          │
│                                                                    │
│                                                 [________________] │
│                                                                    │
│  [בדוק תשובה]                                                     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## Rich Text Blocks (Not Numbered)

```
┌────────────────────────────────────────────────────────────────────┐
│ Card Border (Question 1)                                           │
│                                                                    │
│  ┌───┐                                                            │
│  │ A │  A.1                                                       │
│  └───┘                                                            │
│                                                                    │
│  Question: First question                                         │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ Rich Text Block (NOT A CARD, NO NUMBER)                           │
│                                                                    │
│  This is some explanatory text between questions.                 │
│  It helps provide context but is not a question itself.           │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ Card Border (Question 2)                                           │
│                                                                    │
│  A.2  ← Counter continues, skipped rich text                      │
│                                                                    │
│  Question: Second question                                        │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## Tailwind Classes Breakdown

### Bubble Container
```tsx
className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-50 border border-slate-200 shadow-sm"
```
- `w-7 h-7` → 28px × 28px (perfect circle)
- `rounded-full` → border-radius: 9999px (circular)
- `flex items-center justify-center` → center content
- `bg-slate-50` → very light background (#f8fafc)
- `border border-slate-200` → subtle border (#e2e8f0)
- `shadow-sm` → small shadow for depth

### Label Container
```tsx
className={cn('flex items-center gap-2 mb-4', dir === 'rtl' && 'flex-row-reverse')}
```
- `flex items-center gap-2` → horizontal flex with 8px gap
- `mb-4` → 16px bottom margin
- `flex-row-reverse` → flips order for RTL (bubble on right)

### Label Text
```tsx
className="text-sm font-semibold text-slate-700"
```
- `text-sm` → 14px font size
- `font-semibold` → 600 weight
- `text-slate-700` → dark text (#334155)

## Implementation Notes

1. **Bubble only on first question**: Controlled by `showBubble={questionIndex === 1}`
2. **RTL layout**: Uses `flex-row-reverse` to flip bubble to right side
3. **Section label**: Determined by locale at render time
4. **Counter increment**: Only for `question_select` and `question_free_response`
5. **Reset per exercise**: Counter is local to each ExerciseRenderer instance
