import React, { useState, useCallback } from 'react';
import type { PlacedEntry } from '../pages/admin/ScheduleGenerate/types';

interface ScheduleDragDropProps {
    entries: PlacedEntry[];
    onEntriesChange: (entries: PlacedEntry[]) => void;
    dayOrder: string[];
    START_HOUR: number;
    TOTAL_SLOTS: number;
    formatTime: (t: string) => string;
    colorForKey: (key: string) => string;
    viewMode: 'section' | 'teacher' | 'room';
    events: Array<{ entry: PlacedEntry; dayIdx: number; start: number; span: number }>;
}

export const ScheduleDragDrop: React.FC<ScheduleDragDropProps> = ({
    entries,
    onEntriesChange,
    dayOrder,
    START_HOUR,
    TOTAL_SLOTS,
    formatTime,
    colorForKey,
    viewMode,
    events,
}) => {
    const [draggedEntry, setDraggedEntry] = useState<PlacedEntry | null>(null);

    // Handle drag start
    const handleDragStart = useCallback((e: React.DragEvent, entry: PlacedEntry) => {
        setDraggedEntry(entry);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/json', JSON.stringify({
            subjectId: entry.subjectId,
            sectionId: entry.sectionId,
            day: entry.day,
            start: entry.start,
            subjectName: entry.subjectName
        }));
    }, []);

    // Handle drop on a time slot
    const handleDrop = useCallback((e: React.DragEvent, day: string, startTime: string) => {
        e.preventDefault();
        if (!draggedEntry) return;

        // Calculate the duration based on the entry's original duration
        const originalStartMinutes = parseInt(draggedEntry.start.split(':')[0]) * 60 + parseInt(draggedEntry.start.split(':')[1]);
        const originalEndMinutes = parseInt(draggedEntry.end.split(':')[0]) * 60 + parseInt(draggedEntry.end.split(':')[1]);
        const duration = originalEndMinutes - originalStartMinutes;

        const newStartMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
        const newEndMinutes = newStartMinutes + duration;
        
        const newEndTime = formatTime(`${Math.floor(newEndMinutes / 60)}:${newEndMinutes % 60}`);

        // Update the entry
        const entryKey = `${draggedEntry.subjectId}-${draggedEntry.sectionId}-${draggedEntry.day}-${draggedEntry.start}`;
        const updatedEntries = entries.map(entry => {
            const key = `${entry.subjectId}-${entry.sectionId}-${entry.day}-${entry.start}`;
            if (key === entryKey) {
                return {
                    ...entry,
                    day,
                    start: startTime,
                    end: newEndTime,
                };
            }
            return entry;
        });

        onEntriesChange(updatedEntries);
        setDraggedEntry(null);
    }, [draggedEntry, entries, formatTime, onEntriesChange]);

    return (
        <div className="sm-calendar">
            <div
                className="sm-cal-grid"
                style={{ gridTemplateRows: `auto repeat(${TOTAL_SLOTS}, 22px)` }}
            >
                {/* Header row */}
                <div className="sm-cal-head" style={{ gridColumn: 1, gridRow: 1 }} />
                {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d, i) => (
                    <div key={d} className="sm-cal-head" style={{ gridColumn: i + 2, gridRow: 1 }}>{d}</div>
                ))}

                {/* Time labels (every hour) */}
                {Array.from({ length: TOTAL_SLOTS }).map((_, slot) => {
                    const hour = START_HOUR + Math.floor(slot / 2);
                    const isHour = slot % 2 === 0;
                    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
                    return (
                        <div
                            key={`time-${slot}`}
                            className="sm-cal-time"
                            style={{ gridColumn: 1, gridRow: slot + 2 }}
                        >
                            {isHour ? formatTime(timeStr) : ''}
                        </div>
                    );
                })}

                {/* Background grid cells with drop handlers */}
                {Array.from({ length: TOTAL_SLOTS }).flatMap((_, slot) =>
                    dayOrder.map((day, di) => (
                        <div
                            key={`bg-${day}-${slot}`}
                            className="sm-cal-cell sm-cal-slot"
                            style={{ gridColumn: di + 2, gridRow: slot + 2 }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                const startTime = formatTime(`${START_HOUR + Math.floor(slot / 2)}:${(slot % 2) * 30}`);
                                handleDrop(e, day, startTime);
                            }}
                        />
                    ))
                )}

                {/* Events with drag handlers */}
                {events.map(ev => {
                    const getFontSize = () => {
                        if (ev.span <= 1) return '10px';
                        if (ev.span <= 2) return '11px';
                        return '12px';
                    };

                    return (
                        <div
                            key={`${ev.entry.sectionId}-${ev.entry.day}-${ev.entry.start}`}
                            className="sm-cal-cell"
                            draggable
                            onDragStart={(e) => handleDragStart(e, ev.entry)}
                            style={{
                                gridColumn: ev.dayIdx + 2,
                                gridRow: `${ev.start + 2} / span ${ev.span}`,
                                cursor: 'move',
                            }}
                        >
                            <div
                                className={`sm-cal-event ${colorForKey(ev.entry.subjectName || ev.entry.sectionId)}`}
                                title={`${ev.entry.subjectName} · ${formatTime(ev.entry.start)}–${formatTime(ev.entry.end)}`}
                                style={{ fontSize: getFontSize() }}
                            >
                                <div className="sm-cal-event-title" style={{ fontSize: getFontSize(), fontWeight: ev.span <= 1 ? 600 : 500 }}>
                                    {ev.entry.subjectName}
                                </div>
                                {ev.span > 1 && (
                                    <>
                                        <div className="sm-cal-event-sub" style={{ fontSize: getFontSize() }}>
                                            {viewMode !== 'teacher' && ev.entry.teacherName}
                                            {viewMode !== 'room' && ev.entry.roomName}
                                        </div>
                                        <div className="sm-cal-event-time" style={{ fontSize: getFontSize() }}>
                                            {formatTime(ev.entry.start)}–{formatTime(ev.entry.end)}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
