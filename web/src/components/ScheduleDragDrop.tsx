import React, { useState, useCallback } from 'react';
import type { Room, Section } from '../pages/admin/ScheduleGenerate/types';
import type { SubjectType, RoomType } from '../types/database';

export interface ScheduleEntry {
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
    // Hard constraint fields
    subjectType?: SubjectType;
    roomType?: RoomType;
    sectionSize?: number | null;
    capacity?: number | null;
    compatibleRoomIds?: string[];
    compatibleSubjectIds?: string[];
}

interface ScheduleDragDropProps {
    entries: ScheduleEntry[];
    rooms: Room[];
    teachers: { id: string; full_name: string; department: string; is_active: boolean }[];
    sections: Section[];
    onUpdate: (updatedEntry: ScheduleEntry) => Promise<void> | void;
    dayOrder: string[];
    START_HOUR: number;
    TOTAL_SLOTS: number;
    formatTime: (t: string) => string;
    colorForKey: (key: string) => string;
    viewMode: 'section' | 'teacher' | 'room';
    events: Array<{ entry: ScheduleEntry; dayIdx: number; start: number; span: number }>;
    canEdit?: boolean;
    onContextMenu?: (e: React.MouseEvent, entry: ScheduleEntry) => void;
    timeFormat?: '12h' | '24h';
}

// Helper function to format teacher name (last name only, with initial if duplicate last names)
const formatTeacherName = (teacherName: string, allTeachers: { id: string; full_name: string; department: string; is_active: boolean }[]): string => {
    if (!teacherName) return '';
    
    // Common suffixes to skip when extracting last name
    const suffixes = ['Jr.', 'Sr.', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', '1st', '2nd', '3rd', '4th', '5th'];
    
    // Extract last name (skip common suffixes)
    const parts = teacherName.trim().split(/\s+/);
    let lastNameIndex = parts.length - 1;
    
    // Skip suffixes at the end
    while (lastNameIndex > 0 && suffixes.includes(parts[lastNameIndex])) {
        lastNameIndex--;
    }
    
    const lastName = parts[lastNameIndex];
    
    // Check if there are multiple teachers with the same last name
    const sameLastNameCount = allTeachers.filter(t => {
        const tParts = (t.full_name || '').trim().split(/\s+/);
        let tLastNameIndex = tParts.length - 1;
        
        // Skip suffixes for comparison
        while (tLastNameIndex > 0 && suffixes.includes(tParts[tLastNameIndex])) {
            tLastNameIndex--;
        }
        
        const tLastName = tParts[tLastNameIndex];
        return tLastName.toLowerCase() === lastName.toLowerCase();
    }).length;
    
    // If multiple teachers with same last name, add initial
    if (sameLastNameCount > 1 && parts.length > 1) {
        const initial = parts[0][0];
        return `${lastName}, ${initial}.`;
    }
    
    return lastName;
};

// Helper function to format time based on timeFormat preference
const formatTimeDisplay = (time: string, timeFormat: '12h' | '24h' = '24h'): string => {
    const [hours, minutes] = time.split(':').map(Number);
    if (timeFormat === '12h') {
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12; // Convert 0 to 12
        const displayMinutes = minutes.toString().padStart(2, '0');
        return `${displayHours}:${displayMinutes} ${period}`;
    }
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

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
    timeFormat = '24h',
}) => {
    const [draggedEntry, setDraggedEntry] = useState<ScheduleEntry | null>(null);
    const [showCustomizationModal, setShowCustomizationModal] = useState(false);
    const [showConflictWarning, setShowConflictWarning] = useState(false);
    const [conflictDetails, setConflictDetails] = useState<{ conflicts: string[], suggestions: { type: 'room' | 'time'; value: string; reason: string }[] } | null>(null);
    const [pendingMove, setPendingMove] = useState<{
        entry: ScheduleEntry;
        newDay: string;
        newStartTime: string;
        newEndTime: string;
        customRoomId: string;
        customSectionId: string;
        customTeacherId: string;
    } | null>(null);
    const [selectedCustomRoom, setSelectedCustomRoom] = useState<string>('');
    const [selectedCustomSection, setSelectedCustomSection] = useState<string>('');
    const [selectedCustomTeacher, setSelectedCustomTeacher] = useState<string>('');
    const [hoveredSlot, setHoveredSlot] = useState<{
        day: string;
        slot: number;
        span: number;
    } | null>(null);

    // Check for conflicts when moving a schedule entry
    const checkConflicts = useCallback((
        entry: ScheduleEntry,
        newDay?: string,
        newStartTime?: string,
        newEndTime?: string,
        customRoomId?: string,
        customSectionId?: string,
        customTeacherId?: string
    ) => {
        const conflicts: string[] = [];
        const checkDay = newDay || entry.day;
        const checkStartTime = newStartTime || entry.start;
        const checkEndTime = newEndTime || entry.end;
        const checkRoomId = customRoomId || entry.roomId;
        const checkTeacherId = customTeacherId || entry.teacherId;
        const checkSectionId = customSectionId || entry.sectionId;

        // Skip conflict check if moving to the exact same position
        if (checkDay === entry.day && checkStartTime === entry.start && checkEndTime === entry.end && 
            checkRoomId === entry.roomId && checkSectionId === entry.sectionId && checkTeacherId === entry.teacherId) {
            return conflicts;
        }

        // Create a unique key for the entry to exclude it from conflict checks
        const entryKey = entry.key;

        // ============================================================================
        // HARD CONSTRAINT: Subject-Room Compatibility
        // ============================================================================
        // Special subjects can only be assigned to special rooms (or compatible rooms)
        // Common rooms should not be used for special subjects
        const checkRoom = rooms.find(r => r.id === checkRoomId);
        if (entry.subjectType === 'special' && checkRoom) {
            const isSpecialRoom = checkRoom.type === 'special';
            const isCompatibleRoom = entry.compatibleRoomIds?.includes(checkRoomId);
            
            if (!isSpecialRoom && !isCompatibleRoom) {
                conflicts.push(`Subject "${entry.subjectName}" is a special subject and requires a special room or compatible room. Room "${checkRoom.name}" is a common room.`);
            }
        }

        // Special rooms should be reserved for special subjects (soft constraint, but warn)
        if (checkRoom?.type === 'special' && entry.subjectType === 'common') {
            const isCompatibleSubject = checkRoom.compatible_subject_ids?.includes(entry.subjectId);
            
            if (!isCompatibleSubject) {
                conflicts.push(`Room "${checkRoom.name}" is a special room reserved for special subjects. Subject "${entry.subjectName}" is a common subject.`);
            }
        }

        // ============================================================================
        // HARD CONSTRAINT: Room Capacity
        // ============================================================================
        // Room capacity must always be greater than or equal to section size
        if (entry.sectionSize && checkRoom?.capacity) {
            if (checkRoom.capacity < entry.sectionSize) {
                conflicts.push(`Room "${checkRoom.name}" has capacity ${checkRoom.capacity}, but section "${entry.sectionName}" has ${entry.sectionSize} students. Room is too small.`);
            }
        }

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

        // Check for tight scheduling (less than 0 minutes between classes for same teacher/section)
        // 0 min gap is acceptable, so we only warn for negative gaps (impossible overlaps)
        const MIN_GAP_MINUTES = 0;
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
            const slotStartTime = formatTime(`${START_HOUR + Math.floor(slot / 2)}:${((slot % 2) * 30).toString().padStart(2, '0')}`);
            const slotEndTime = formatTime(`${START_HOUR + Math.floor((slot + duration / 30) / 2)}:${(((slot + duration / 30) % 2) * 30).toString().padStart(2, '0')}`);
            
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
        newEndTime?: string,
        customRoomId?: string,
        customSectionId?: string,
        customTeacherId?: string
    ) => {
        // Find custom room, section, and teacher objects if provided
        const customRoom = customRoomId ? rooms.find(r => r.id === customRoomId) : null;
        const customSection = customSectionId ? sections.find(s => s.id === customSectionId) : null;
        const customTeacher = customTeacherId ? teachers.find(t => t.id === customTeacherId) : null;

        // Create updated entry with custom room/section/teacher if provided
        const updatedEntry: ScheduleEntry = {
            ...entry,
            ...(newDay && { day: newDay }),
            ...(newStartTime && { start: newStartTime }),
            ...(newEndTime && { end: newEndTime }),
            ...(customRoomId && { 
                roomId: customRoomId, 
                roomName: customRoom?.name || entry.roomName,
                roomType: customRoom?.type as 'common' | 'special' | undefined,
                capacity: customRoom?.capacity,
                compatibleSubjectIds: customRoom?.compatible_subject_ids,
            }),
            ...(customSectionId && { 
                sectionId: customSectionId, 
                sectionName: customSection?.name || entry.sectionName,
                sectionSize: customSection?.student_count,
            }),
            ...(customTeacherId && {
                teacherId: customTeacherId,
                teacherName: customTeacher?.full_name || entry.teacherName,
            }),
        };
        
        // Call onUpdate to persist the change
        onUpdate(updatedEntry);
    }, [onUpdate, rooms, sections, teachers]);

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

    // Handle drag end to clean up state
    const handleDragEnd = useCallback(() => {
        setDraggedEntry(null);
        setHoveredSlot(null);
    }, []);

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
        
        // Validate that the new time slot is within bounds
        const maxEndMinutes = (START_HOUR + TOTAL_SLOTS / 2) * 60;
        if (newEndMinutes > maxEndMinutes) {
            // Prevent drop if the slot is outside the valid time range
            setDraggedEntry(null);
            setHoveredSlot(null);
            return;
        }
        
        const newEndTime = formatTime(`${Math.floor(newEndMinutes / 60)}:${(newEndMinutes % 60).toString().padStart(2, '0')}`);

        // Show customization modal first
        setPendingMove({
            entry: draggedEntry,
            newDay: day,
            newStartTime: startTime,
            newEndTime,
            customRoomId: draggedEntry.roomId,
            customSectionId: draggedEntry.sectionId,
            customTeacherId: draggedEntry.teacherId,
        });
        setSelectedCustomRoom(draggedEntry.roomId || rooms[0]?.id || '');
        setSelectedCustomSection(draggedEntry.sectionId || sections[0]?.id || '');
        setSelectedCustomTeacher(draggedEntry.teacherId || teachers[0]?.id || '');
        setShowCustomizationModal(true);
        
        setDraggedEntry(null);
    }, [draggedEntry, formatTime, canEdit, START_HOUR, TOTAL_SLOTS, rooms, sections, teachers]);

    // Confirm the move despite conflicts
    const confirmMove = useCallback(() => {
        if (!pendingMove) return;
        applyMove(
            pendingMove.entry,
            pendingMove.newDay,
            pendingMove.newStartTime,
            pendingMove.newEndTime,
            pendingMove.customRoomId,
            pendingMove.customSectionId,
            pendingMove.customTeacherId
        );
        setShowConflictWarning(false);
        setPendingMove(null);
        setConflictDetails(null);
    }, [pendingMove, applyMove]);

    // Confirm the customization and proceed to check conflicts
    const confirmCustomization = useCallback(() => {
        if (!pendingMove) return;
        
        // Update pending move with custom selections
        const updatedPendingMove = {
            ...pendingMove,
            customRoomId: selectedCustomRoom,
            customSectionId: selectedCustomSection,
            customTeacherId: selectedCustomTeacher,
        };
        
        setShowCustomizationModal(false);
        
        // Check for conflicts with custom selections
        const conflicts = checkConflicts(
            pendingMove.entry, 
            pendingMove.newDay, 
            pendingMove.newStartTime, 
            pendingMove.newEndTime,
            selectedCustomRoom,
            selectedCustomSection,
            selectedCustomTeacher
        );
        
        if (conflicts.length > 0) {
            // Show conflict warning with suggestions
            const suggestions = generateSuggestions(pendingMove.entry, pendingMove.newDay, pendingMove.newStartTime);
            setPendingMove(updatedPendingMove);
            setConflictDetails({ conflicts, suggestions });
            setShowConflictWarning(true);
        } else {
            // Apply the move without conflicts
            applyMove(
                pendingMove.entry,
                pendingMove.newDay,
                pendingMove.newStartTime,
                pendingMove.newEndTime,
                selectedCustomRoom,
                selectedCustomSection,
                selectedCustomTeacher
            );
            setPendingMove(null);
        }
    }, [pendingMove, selectedCustomRoom, selectedCustomSection, selectedCustomTeacher, checkConflicts, generateSuggestions, applyMove]);

    // Cancel the move
    const cancelMove = useCallback(() => {
        setShowConflictWarning(false);
        setShowCustomizationModal(false);
        setPendingMove(null);
        setConflictDetails(null);
        setDraggedEntry(null);
        setSelectedCustomRoom('');
        setSelectedCustomSection('');
        setSelectedCustomTeacher('');
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
                            {isHour ? formatTimeDisplay(timeStr, timeFormat) : ''}
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
                            onDragOver={(e) => {
                                if (canEdit) {
                                    e.preventDefault();
                                    // Calculate span based on dragged entry duration
                                    const span = draggedEntry 
                                        ? Math.ceil((parseInt(draggedEntry.end.split(':')[0]) * 60 + parseInt(draggedEntry.end.split(':')[1]) - 
                                                   (parseInt(draggedEntry.start.split(':')[0]) * 60 + parseInt(draggedEntry.start.split(':')[1]))) / 30)
                                        : 1;
                                    setHoveredSlot({ day, slot, span });
                                }
                            }}
                            onDragLeave={() => setHoveredSlot(null)}
                            onDrop={(e) => {
                                setHoveredSlot(null);
                                if (!canEdit) return;
                                const startTime = formatTime(`${START_HOUR + Math.floor(slot / 2)}:${((slot % 2) * 30).toString().padStart(2, '0')}`);
                                handleDrop(e, day, startTime);
                            }}
                        />
                    ))
                )}

                {/* Drag hover highlight showing full span */}
                {hoveredSlot && draggedEntry && (
                    <div
                        className="sm-cal-cell"
                        style={{
                            gridColumn: dayOrder.indexOf(hoveredSlot.day) + 2,
                            gridRow: `${hoveredSlot.slot + 2} / span ${hoveredSlot.span}`,
                            backgroundColor: 'rgba(73, 136, 196, 0.2)',
                            border: '2px dashed #4988C4',
                            borderRadius: 4,
                            pointerEvents: 'none',
                            zIndex: 10,
                            margin: '1px',
                        }}
                    />
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
                            onDragEnd={handleDragEnd}
                            onContextMenu={onContextMenu ? (e) => onContextMenu(e, ev.entry) : undefined}
                            style={{
                                gridColumn: ev.dayIdx + 2,
                                gridRow: `${ev.start + 2} / span ${ev.span}`,
                                cursor: canEdit ? 'move' : 'default',
                            }}
                        >
                            <div
                                className={`sm-cal-event ${colorForKey(ev.entry.subjectName || ev.entry.sectionId)}`}
                                title={`${ev.entry.subjectName}\n${viewMode === 'section' ? `${formatTeacherName(ev.entry.teacherName, teachers)} - ${ev.entry.roomName}` : viewMode === 'teacher' ? `${ev.entry.sectionName} - ${ev.entry.roomName}` : `${ev.entry.sectionName} - ${formatTeacherName(ev.entry.teacherName, teachers)}`}\n${formatTimeDisplay(ev.entry.start, timeFormat)} - ${formatTimeDisplay(ev.entry.end, timeFormat)}`}
                                style={{ fontSize: getFontSize() }}
                            >
                                <div className="sm-cal-event-title" style={{ fontSize: getFontSize(), fontWeight: ev.span <= 1 ? 600 : 500 }}>
                                    {ev.entry.subjectName}
                                </div>
                                {ev.span > 1 && (
                                    <>
                                        <div className="sm-cal-event-sub" style={{ fontSize: getFontSize() }}>
                                            {viewMode === 'section' && (
                                                <>
                                                    {formatTeacherName(ev.entry.teacherName, teachers)} - {ev.entry.roomName}
                                                </>
                                            )}
                                            {viewMode === 'teacher' && (
                                                <>
                                                    {ev.entry.sectionName} - {ev.entry.roomName}
                                                </>
                                            )}
                                            {viewMode === 'room' && (
                                                <>
                                                    {ev.entry.sectionName} - {formatTeacherName(ev.entry.teacherName, teachers)}
                                                </>
                                            )}
                                        </div>
                                        <div className="sm-cal-event-time" style={{ fontSize: getFontSize() }}>
                                            {formatTimeDisplay(ev.entry.start, timeFormat)} - {formatTimeDisplay(ev.entry.end, timeFormat)}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    );
            })}
            </div>

            {/* Customization Modal */}
            {showCustomizationModal && pendingMove && (
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
                        backgroundColor: '#ffffff',
                        borderRadius: 8,
                        padding: 24,
                        maxWidth: 500,
                        width: '90%',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                        border: '1px solid var(--border-default)',
                    }}>
                        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
                            Customize Schedule Move
                        </h3>
                        
                        <div style={{ marginBottom: 16 }}>
                            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
                                Moving <strong>{pendingMove.entry.subjectName || pendingMove.entry.subjectCode || 'Unknown Subject'}</strong> to {pendingMove.newDay} at {formatTimeDisplay(pendingMove.newStartTime || '', timeFormat)} - {formatTimeDisplay(pendingMove.newEndTime || '', timeFormat)}
                            </p>
                            
                            {/* Room selection for section/teacher views */}
                            {(viewMode === 'section' || viewMode === 'teacher') && (
                                <div style={{ marginBottom: 12 }}>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                                        Select Room:
                                    </label>
                                    <select
                                        value={selectedCustomRoom}
                                        onChange={(e) => setSelectedCustomRoom(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            borderRadius: 6,
                                            border: '1px solid var(--border-default)',
                                            backgroundColor: 'var(--bg-surface)',
                                            color: 'var(--text-primary)',
                                            fontSize: 14,
                                        }}
                                    >
                                        {rooms.length === 0 ? (
                                            <option value="">No rooms available</option>
                                        ) : (
                                            rooms.map(room => (
                                                <option key={room.id} value={room.id}>
                                                    {room.name} {room.building ? `(${room.building})` : ''} {room.capacity ? `- Cap: ${room.capacity}` : ''}
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>
                            )}
                            
                            {/* Teacher selection for section view */}
                            {viewMode === 'section' && (
                                <div style={{ marginBottom: 12 }}>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                                        Select Teacher:
                                    </label>
                                    <select
                                        value={selectedCustomTeacher}
                                        onChange={(e) => setSelectedCustomTeacher(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            borderRadius: 6,
                                            border: '1px solid var(--border-default)',
                                            backgroundColor: 'var(--bg-surface)',
                                            color: 'var(--text-primary)',
                                            fontSize: 14,
                                        }}
                                    >
                                        {teachers.filter(t => t.is_active !== false).length === 0 ? (
                                            <option value="">No teachers available</option>
                                        ) : (
                                            teachers
                                                .filter(teacher => teacher.is_active !== false) // Show only active teachers
                                                .map(teacher => (
                                                    <option key={teacher.id} value={teacher.id}>
                                                        {teacher.full_name} {teacher.department ? `- ${teacher.department}` : ''}
                                                    </option>
                                                ))
                                        )}
                                    </select>
                                </div>
                            )}
                            
                            {/* Section selection for room view */}
                            {viewMode === 'room' && (
                                <div style={{ marginBottom: 12 }}>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                                        Select Section:
                                    </label>
                                    <select
                                        value={selectedCustomSection}
                                        onChange={(e) => setSelectedCustomSection(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            borderRadius: 6,
                                            border: '1px solid var(--border-default)',
                                            backgroundColor: 'var(--bg-surface)',
                                            color: 'var(--text-primary)',
                                            fontSize: 14,
                                        }}
                                    >
                                        {sections.length === 0 ? (
                                            <option value="">No sections available</option>
                                        ) : (
                                            sections.map(section => {
                                                // Check if section name already contains program and year level (e.g., "MAWD-11a")
                                                // For senior high school (years 11-12), just show the section name
                                                const isSHS = section.year_level && (section.year_level >= 11 && section.year_level <= 12);
                                                const nameContainsInfo = isSHS && /[A-Za-z]+-\d+[a-z]/i.test(section.name);

                                                if (nameContainsInfo) {
                                                    return (
                                                        <option key={section.id} value={section.id}>
                                                            {section.name}
                                                        </option>
                                                    );
                                                }

                                                return (
                                                    <option key={section.id} value={section.id}>
                                                        {section.name} {section.program ? `- ${section.program}` : ''} {section.year_level ? `- Year ${section.year_level}` : ''}
                                                    </option>
                                                );
                                            })
                                        )}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button
                                onClick={cancelMove}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 6,
                                    border: '1px solid var(--border-default)',
                                    backgroundColor: 'var(--bg-surface)',
                                    color: 'var(--text-primary)',
                                    fontSize: 14,
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmCustomization}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 6,
                                    border: 'none',
                                    backgroundColor: 'var(--accent-primary)',
                                    color: 'white',
                                    fontSize: 14,
                                    cursor: 'pointer',
                                }}
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                        backgroundColor: '#ffffff',
                        borderRadius: 8,
                        padding: 24,
                        maxWidth: 500,
                        width: '90%',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                        border: '1px solid var(--border-color)',
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
                                    backgroundColor: 'var(--accent-primary)',
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
