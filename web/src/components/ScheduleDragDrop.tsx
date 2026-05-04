import React, { useState, useCallback } from 'react';
import type { Room, Teacher, Section } from '../pages/admin/ScheduleGenerate/types';

// Generic entry interface that works with both PlacedEntry and ScheduleRow
interface ScheduleEntry {
    key: string; // Unique identifier (e.g., "subjectId-sectionId-day-start" or database id)
    subjectId: string;
    sectionId: string;
    teacherId: string;
    roomId: string;
    day: string;
    start: string;
    end: string;
    subjectName: string;
    teacherName: string;
    roomName: string;
    sectionName: string;
    subjectCode?: string;
}

interface ScheduleDragDropProps {
    entries: ScheduleEntry[];
    rooms: Room[];
    teachers: Teacher[];
    sections: Section[];
    onUpdate: (entry: ScheduleEntry, newDay?: string, newStartTime?: string, newEndTime?: string) => Promise<void> | void;
    dayOrder: string[];
    START_HOUR: number;
    TOTAL_SLOTS: number;
    formatTime: (t: string) => string;
    colorForKey: (key: string) => string;
    viewMode: 'section' | 'teacher' | 'room';
    events: Array<{ entry: ScheduleEntry; dayIdx: number; start: number; span: number }>;
    canEdit?: boolean;
    onContextMenu?: (e: React.MouseEvent, entry: ScheduleEntry) => void;
}

export const ScheduleDragDrop: React.FC<ScheduleDragDropProps> = ({
    entries,
    rooms,
    teachers,
    sections,
    onUpdate,
    dayOrder,
    START_HOUR,
    TOTAL_SLOTS,
    formatTime,
    colorForKey,
    viewMode,
    events,
    canEdit = true,
    onContextMenu,
}) => {
    const [draggedEntry, setDraggedEntry] = useState<ScheduleEntry | null>(null);
    const [showConflictWarning, setShowConflictWarning] = useState(false);
    const [conflictDetails, setConflictDetails] = useState<{
        conflicts: string[];
        suggestions: { type: 'room' | 'time'; value: string; reason: string }[];
    } | null>(null);
    const [pendingMove, setPendingMove] = useState<{
        entry: ScheduleEntry;
        newDay?: string;
        newStartTime?: string;
        newEndTime?: string;
    } | null>(null);

    // Check for conflicts when moving a schedule entry
    const checkConflicts = useCallback((
        entry: ScheduleEntry,
        newDay?: string,
        newStartTime?: string,
        newEndTime?: string
    ) => {
        const conflicts: string[] = [];
        const checkDay = newDay || entry.day;
        const checkStartTime = newStartTime || entry.start;
        const checkEndTime = newEndTime || entry.end;
        const checkRoomId = entry.roomId;
        const checkTeacherId = entry.teacherId;
        const checkSectionId = entry.sectionId;

        // Create a unique key for the entry to exclude it from conflict checks
        const entryKey = entry.key;

        // Check room conflicts with details
        const roomConflicts = entries.filter(e => 
            e.key !== entryKey &&
            e.day === checkDay &&
            e.roomId === checkRoomId &&
            ((e.start >= checkStartTime && e.start < checkEndTime) ||
             (e.end > checkStartTime && e.end <= checkEndTime) ||
             (e.start <= checkStartTime && e.end >= checkEndTime))
        );
        
        if (roomConflicts.length > 0) {
            const roomName = rooms.find(r => r.id === checkRoomId)?.name || 'Unknown';
            const conflictDetails = roomConflicts.map(c => 
                `${c.subjectName} (${c.sectionName}) at ${formatTime(c.start)}–${formatTime(c.end)}`
            ).join(', ');
            conflicts.push(`Room "${roomName}" is occupied by: ${conflictDetails}`);
        }

        // Check teacher conflicts with details
        const teacherConflicts = entries.filter(e => 
            e.key !== entryKey &&
            e.day === checkDay &&
            e.teacherId === checkTeacherId &&
            ((e.start >= checkStartTime && e.start < checkEndTime) ||
             (e.end > checkStartTime && e.end <= checkEndTime) ||
             (e.start <= checkStartTime && e.end >= checkEndTime))
        );
        
        if (teacherConflicts.length > 0) {
            const teacherName = teachers.find(t => t.id === checkTeacherId)?.full_name || 'Unknown';
            const conflictDetails = teacherConflicts.map(c => 
                `${c.subjectName} in ${c.roomName} at ${formatTime(c.start)}–${formatTime(c.end)}`
            ).join(', ');
            conflicts.push(`Teacher "${teacherName}" is scheduled elsewhere: ${conflictDetails}`);
        }

        // Check section conflicts with details
        const sectionConflicts = entries.filter(e => 
            e.key !== entryKey &&
            e.day === checkDay &&
            e.sectionId === checkSectionId &&
            ((e.start >= checkStartTime && e.start < checkEndTime) ||
             (e.end > checkStartTime && e.end <= checkEndTime) ||
             (e.start <= checkStartTime && e.end >= checkEndTime))
        );
        
        if (sectionConflicts.length > 0) {
            const sectionName = sections.find(s => s.id === checkSectionId)?.name || 'Unknown';
            const conflictDetails = sectionConflicts.map(c => 
                `${c.subjectName} at ${formatTime(c.start)}–${formatTime(c.end)}`
            ).join(', ');
            conflicts.push(`Section "${sectionName}" has another class: ${conflictDetails}`);
        }

        // Check for tight scheduling (less than 10 minutes between classes for same teacher/section)
        const MIN_GAP_MINUTES = 10;
        const checkStartMinutes = parseInt(checkStartTime.split(':')[0]) * 60 + parseInt(checkStartTime.split(':')[1]);
        const checkEndMinutes = parseInt(checkEndTime.split(':')[0]) * 60 + parseInt(checkEndTime.split(':')[1]);

        const teacherTightSchedules = entries.filter(e => 
            e.key !== entryKey &&
            e.day === checkDay &&
            e.teacherId === checkTeacherId
        ).map(e => ({
            entry: e,
            start: parseInt(e.start.split(':')[0]) * 60 + parseInt(e.start.split(':')[1]),
            end: parseInt(e.end.split(':')[0]) * 60 + parseInt(e.end.split(':')[1])
        })).filter(e => 
            Math.abs(e.end - checkStartMinutes) < MIN_GAP_MINUTES ||
            Math.abs(e.start - checkEndMinutes) < MIN_GAP_MINUTES
        );

        if (teacherTightSchedules.length > 0) {
            const teacherName = teachers.find(t => t.id === checkTeacherId)?.full_name || 'Unknown';
            const gapDetails = teacherTightSchedules.map(e => {
                const gap = Math.abs(e.end - checkStartMinutes) < MIN_GAP_MINUTES 
                    ? `${Math.abs(e.end - checkStartMinutes)} min gap before ${e.entry.subjectName}`
                    : `${Math.abs(e.start - checkEndMinutes)} min gap after ${e.entry.subjectName}`;
                return gap;
            }).join(', ');
            conflicts.push(`Teacher "${teacherName}" has tight scheduling: ${gapDetails}`);
        }

        return conflicts;
    }, [entries, rooms, teachers, sections, formatTime]);

    // Generate suggestions for resolving conflicts
    const generateSuggestions = useCallback((
        entry: ScheduleEntry,
        newDay?: string,
        newStartTime?: string
    ) => {
        const suggestions: { type: 'room' | 'time'; value: string; reason: string }[] = [];
        const checkDay = newDay || entry.day;
        const checkStartTime = newStartTime || entry.start;
        const checkEndTime = entry.end;

        // Create a unique key for the entry to exclude it from availability checks
        const entryKey = entry.key;

        // Find available rooms at the same time (prioritize rooms with similar capacity/type)
        const occupiedRoomIds = new Set(
            entries
                .filter(e => 
                    e.key !== entryKey &&
                    e.day === checkDay && 
                    ((e.start >= checkStartTime && e.start < checkEndTime) ||
                     (e.end > checkStartTime && e.end <= checkEndTime) ||
                     (e.start <= checkStartTime && e.end >= checkEndTime)))
                .map(e => e.roomId)
        );

        // Sort rooms by relevance (same building first, then capacity)
        const currentRoom = rooms.find(r => r.id === entry.roomId);
        const sortedRooms = [...rooms].sort((a, b) => {
            // Prioritize rooms in the same building
            if (currentRoom) {
                if (a.building === currentRoom.building && b.building !== currentRoom.building) return -1;
                if (b.building === currentRoom.building && a.building !== currentRoom.building) return 1;
            }
            // Then by capacity similarity
            const aCapDiff = Math.abs((a.capacity || 0) - (currentRoom?.capacity || 0));
            const bCapDiff = Math.abs((b.capacity || 0) - (currentRoom?.capacity || 0));
            return aCapDiff - bCapDiff;
        });

        let roomSuggestions = 0;
        for (const room of sortedRooms) {
            if (!occupiedRoomIds.has(room.id) && roomSuggestions < 3) {
                const buildingInfo = room.building ? ` in ${room.building}` : '';
                const capacityInfo = room.capacity ? ` (cap: ${room.capacity})` : '';
                suggestions.push({
                    type: 'room',
                    value: room.id,
                    reason: `Room "${room.name}"${buildingInfo}${capacityInfo} is available at this time`
                });
                roomSuggestions++;
            }
        }

        // Find available time slots in the same room (prioritize nearby slots)
        const entryRoomId = entry.roomId;
        const originalStartMinutes = parseInt(entry.start.split(':')[0]) * 60 + parseInt(entry.start.split(':')[1]);
        const originalEndMinutes = parseInt(entry.end.split(':')[0]) * 60 + parseInt(entry.end.split(':')[1]);
        const duration = originalEndMinutes - originalStartMinutes;
        
        // Generate time slots and sort by proximity to original time
        const timeSlots: { startTime: string; endTime: string; distance: number }[] = [];
        for (let slot = 0; slot < TOTAL_SLOTS; slot++) {
            const slotStartTime = formatTime(`${START_HOUR + Math.floor(slot / 2)}:${(slot % 2) * 30}`);
            const slotEndTime = formatTime(`${START_HOUR + Math.floor((slot + duration / 30) / 2)}:${((slot + duration / 30) % 2) * 30}`);
            
            if (slotStartTime === checkStartTime) continue; // Skip current time

            const slotStartMinutes = parseInt(slotStartTime.split(':')[0]) * 60 + parseInt(slotStartTime.split(':')[1]);
            const distance = Math.abs(slotStartMinutes - originalStartMinutes);

            const timeConflict = entries.some(e => 
                e.key !== entryKey &&
                e.day === checkDay &&
                e.roomId === entryRoomId &&
                ((e.start >= slotStartTime && e.start < slotEndTime) ||
                 (e.end > slotStartTime && e.end <= slotEndTime) ||
                 (e.start <= slotStartTime && e.end >= slotEndTime))
            );

            if (!timeConflict) {
                timeSlots.push({ startTime: slotStartTime, endTime: slotEndTime, distance });
            }
        }

        // Sort by distance and take closest 3
        timeSlots.sort((a, b) => a.distance - b.distance);
        const closestTimeSlots = timeSlots.slice(0, 3);

        closestTimeSlots.forEach(slot => {
            suggestions.push({
                type: 'time',
                value: `${slot.startTime}–${slot.endTime}`,
                reason: `Time slot ${slot.startTime}–${slot.endTime} is available in room "${rooms.find(r => r.id === entryRoomId)?.name || 'Unknown'}"`
            });
        });

        // Also suggest alternative days if the room is heavily booked
        const dayOccupancy = dayOrder.map(day => ({
            day,
            count: entries.filter(e => e.day === day && e.roomId === entryRoomId).length
        }));
        
        const lessBusyDays = dayOccupancy
            .filter(d => d.day !== checkDay)
            .sort((a, b) => a.count - b.count)
            .slice(0, 2);

        lessBusyDays.forEach(({ day, count }) => {
            const currentCount = entries.filter(e => e.day === checkDay && e.roomId === entryRoomId).length;
            if (count < currentCount) {
                suggestions.push({
                    type: 'time',
                    value: day,
                    reason: `${day} has fewer bookings (${count} vs ${currentCount}) for this room`
                });
            }
        });

        return suggestions.slice(0, 5); // Limit to 5 suggestions
    }, [entries, rooms, formatTime, START_HOUR, TOTAL_SLOTS, dayOrder]);

    // Apply the move to entries
    const applyMove = useCallback((
        entry: ScheduleEntry,
        newDay?: string,
        newStartTime?: string,
        newEndTime?: string
    ) => {
        onUpdate(entry, newDay, newStartTime, newEndTime);
    }, [onUpdate]);

    // Handle drag start
    const handleDragStart = useCallback((e: React.DragEvent, entry: ScheduleEntry) => {
        if (!canEdit) return;
        setDraggedEntry(entry);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/json', JSON.stringify({
            key: entry.key,
            subjectId: entry.subjectId,
            sectionId: entry.sectionId,
            day: entry.day,
            start: entry.start,
            subjectName: entry.subjectName
        }));
    }, [canEdit]);

    // Handle drop on a time slot
    const handleDrop = useCallback((e: React.DragEvent, day: string, startTime: string) => {
        e.preventDefault();
        if (!draggedEntry || !canEdit) return;

        // Calculate the duration based on the entry's original duration
        const originalStartMinutes = parseInt(draggedEntry.start.split(':')[0]) * 60 + parseInt(draggedEntry.start.split(':')[1]);
        const originalEndMinutes = parseInt(draggedEntry.end.split(':')[0]) * 60 + parseInt(draggedEntry.end.split(':')[1]);
        const duration = originalEndMinutes - originalStartMinutes;

        const newStartMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
        const newEndMinutes = newStartMinutes + duration;
        
        const newEndTime = formatTime(`${Math.floor(newEndMinutes / 60)}:${newEndMinutes % 60}`);

        // Check for conflicts
        const conflicts = checkConflicts(draggedEntry, day, startTime, newEndTime);
        
        if (conflicts.length > 0) {
            // Show conflict warning with suggestions
            const suggestions = generateSuggestions(draggedEntry, day, startTime);
            setPendingMove({
                entry: draggedEntry,
                newDay: day,
                newStartTime: startTime,
                newEndTime,
            });
            setConflictDetails({ conflicts, suggestions });
            setShowConflictWarning(true);
        } else {
            // Apply the move without conflicts
            applyMove(draggedEntry, day, startTime, newEndTime);
        }
        
        setDraggedEntry(null);
    }, [draggedEntry, checkConflicts, generateSuggestions, formatTime, applyMove, canEdit]);

    // Confirm the move despite conflicts
    const confirmMove = useCallback(() => {
        if (!pendingMove) return;
        applyMove(
            pendingMove.entry,
            pendingMove.newDay,
            pendingMove.newStartTime,
            pendingMove.newEndTime
        );
        setShowConflictWarning(false);
        setPendingMove(null);
        setConflictDetails(null);
    }, [pendingMove, applyMove]);

    // Cancel the move
    const cancelMove = useCallback(() => {
        setShowConflictWarning(false);
        setPendingMove(null);
        setConflictDetails(null);
        setDraggedEntry(null);
    }, []);

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
                            onDragOver={(e) => canEdit && e.preventDefault()}
                            onDrop={(e) => {
                                if (!canEdit) return;
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
                            draggable={canEdit}
                            onDragStart={(e) => handleDragStart(e, ev.entry)}
                            onContextMenu={onContextMenu ? (e) => onContextMenu(e, ev.entry) : undefined}
                            style={{
                                gridColumn: ev.dayIdx + 2,
                                gridRow: `${ev.start + 2} / span ${ev.span}`,
                                cursor: canEdit ? 'move' : 'default',
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

            {/* Conflict Warning Modal */}
            {showConflictWarning && conflictDetails && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                }}>
                    <div style={{
                        backgroundColor: 'var(--surface-primary)',
                        borderRadius: 8,
                        padding: 24,
                        maxWidth: 500,
                        width: '90%',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                    }}>
                        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
                            Schedule Conflict Detected
                        </h3>
                        
                        <div style={{ marginBottom: 16 }}>
                            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                Moving this class would create the following conflicts:
                            </p>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {conflictDetails.conflicts.map((conflict, i) => (
                                    <li key={i} style={{ 
                                        fontSize: 13, 
                                        color: 'var(--text-error)', 
                                        marginBottom: 4,
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                    }}>
                                        <span style={{ marginRight: 8 }}>⚠</span>
                                        <span>{conflict}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {conflictDetails.suggestions.length > 0 && (
                            <div style={{ marginBottom: 20 }}>
                                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                    Suggested alternatives:
                                </p>
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {conflictDetails.suggestions.map((suggestion, i) => (
                                        <li key={i} style={{ 
                                            fontSize: 13, 
                                            color: 'var(--text-primary)', 
                                            marginBottom: 4,
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                        }}>
                                            <span style={{ marginRight: 8, color: 'var(--text-success)' }}>✓</span>
                                            <span>{suggestion.reason}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button
                                onClick={cancelMove}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 6,
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--surface-primary)',
                                    color: 'var(--text-primary)',
                                    fontSize: 14,
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmMove}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 6,
                                    border: 'none',
                                    backgroundColor: 'var(--color-primary)',
                                    color: 'white',
                                    fontSize: 14,
                                    cursor: 'pointer',
                                }}
                            >
                                Move Anyway
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
