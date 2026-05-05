/**
 * Hard Constraint Checker for the 15-phase CSP-based Schedule Generator
 *
 * This service implements the checking logic for all hard constraints:
 * - No teacher overlap
 * - No room overlap
 * - No section overlap
 * - Room capacity compliance
 * - Teacher qualification enforcement
 * - Teacher availability enforcement
 * - Max consecutive hours
 * - Max daily load
 * - Subject hour completion
 * - Special subject room priority
 * - Subject room consistency (same room for all sessions of a subject on a day)
 */

import type {
  PlacedSession,
  NormalizedTeacher,
  NormalizedRoom,
  NormalizedSection,
  NormalizedSubject,
} from './types';

/**
 * Result of a hard constraint check
 */
export interface HardConstraintCheckResult {
  isViolated: boolean;
  violationType: string;
  description: string;
  affectedEntities: string[];
}

/**
 * Check if a teacher has an overlapping session
 */
export function checkTeacherOverlap(
  teacherId: string,
  day: string,
  startTime: string,
  endTime: string,
  placedSessions: PlacedSession[]
): HardConstraintCheckResult {
  const overlapping = placedSessions.find(session =>
    session.teacher_id === teacherId &&
    session.day === day &&
    ((session.start_time >= startTime && session.start_time < endTime) ||
     (session.end_time > startTime && session.end_time <= endTime) ||
     (session.start_time <= startTime && session.end_time >= endTime))
  );

  if (overlapping) {
    return {
      isViolated: true,
      violationType: 'teacher_overlap',
      description: `Teacher ${teacherId} has overlapping session on ${day} at ${startTime}-${endTime}`,
      affectedEntities: [teacherId],
    };
  }

  return { isViolated: false, violationType: '', description: '', affectedEntities: [] };
}

/**
 * Check if a room has an overlapping session
 */
export function checkRoomOverlap(
  roomId: string,
  day: string,
  startTime: string,
  endTime: string,
  placedSessions: PlacedSession[]
): HardConstraintCheckResult {
  const overlapping = placedSessions.find(session =>
    session.room_id === roomId &&
    session.day === day &&
    ((session.start_time >= startTime && session.start_time < endTime) ||
     (session.end_time > startTime && session.end_time <= endTime) ||
     (session.start_time <= startTime && session.end_time >= endTime))
  );

  if (overlapping) {
    return {
      isViolated: true,
      violationType: 'room_overlap',
      description: `Room ${roomId} has overlapping session on ${day} at ${startTime}-${endTime}`,
      affectedEntities: [roomId],
    };
  }

  return { isViolated: false, violationType: '', description: '', affectedEntities: [] };
}

/**
 * Check if a section has an overlapping session
 */
export function checkSectionOverlap(
  sectionId: string,
  day: string,
  startTime: string,
  endTime: string,
  placedSessions: PlacedSession[]
): HardConstraintCheckResult {
  const overlapping = placedSessions.find(session =>
    session.section_id === sectionId &&
    session.day === day &&
    ((session.start_time >= startTime && session.start_time < endTime) ||
     (session.end_time > startTime && session.end_time <= endTime) ||
     (session.start_time <= startTime && session.end_time >= endTime))
  );

  if (overlapping) {
    return {
      isViolated: true,
      violationType: 'section_overlap',
      description: `Section ${sectionId} has overlapping session on ${day} at ${startTime}-${endTime}`,
      affectedEntities: [sectionId],
    };
  }

  return { isViolated: false, violationType: '', description: '', affectedEntities: [] };
}

/**
 * Check if room capacity is sufficient for the section
 */
export function checkRoomCapacity(
  roomId: string,
  sectionId: string,
  rooms: NormalizedRoom[],
  sections: NormalizedSection[]
): HardConstraintCheckResult {
  const room = rooms.find(r => r.id === roomId);
  const section = sections.find(s => s.id === sectionId);

  if (!room || !section) {
    return {
      isViolated: true,
      violationType: 'room_capacity',
      description: 'Room or section not found',
      affectedEntities: [roomId, sectionId],
    };
  }

  if (room.capacity < section.student_count) {
    return {
      isViolated: true,
      violationType: 'room_capacity',
      description: `Room ${room.name} capacity (${room.capacity}) is insufficient for section ${section.name} (${section.student_count} students)`,
      affectedEntities: [roomId, sectionId],
    };
  }

  return { isViolated: false, violationType: '', description: '', affectedEntities: [] };
}

/**
 * Check if teacher is qualified to teach the subject
 */
export function checkTeacherQualification(
  teacherId: string,
  subjectId: string,
  teachers: NormalizedTeacher[],
  subjects: NormalizedSubject[]
): HardConstraintCheckResult {
  const teacher = teachers.find(t => t.id === teacherId);
  const subject = subjects.find(s => s.id === subjectId);

  if (!teacher || !subject) {
    return {
      isViolated: true,
      violationType: 'teacher_qualification',
      description: 'Teacher or subject not found',
      affectedEntities: [teacherId, subjectId],
    };
  }

  if (!teacher.qualified_subjects.includes(subjectId)) {
    return {
      isViolated: true,
      violationType: 'teacher_qualification',
      description: `Teacher ${teacher.full_name} is not qualified to teach subject ${subject.code}`,
      affectedEntities: [teacherId, subjectId],
    };
  }

  return { isViolated: false, violationType: '', description: '', affectedEntities: [] };
}

/**
 * Check if teacher is available at the given time
 */
export function checkTeacherAvailability(
  teacherId: string,
  day: string,
  startTime: string,
  endTime: string,
  teachers: NormalizedTeacher[]
): HardConstraintCheckResult {
  const teacher = teachers.find(t => t.id === teacherId);

  if (!teacher) {
    return {
      isViolated: true,
      violationType: 'teacher_availability',
      description: 'Teacher not found',
      affectedEntities: [teacherId],
    };
  }

  // Check if day is in preferred days
  if (!teacher.preferred_days.includes(day)) {
    return {
      isViolated: true,
      violationType: 'teacher_availability',
      description: `Teacher ${teacher.full_name} is not available on ${day}`,
      affectedEntities: [teacherId],
    };
  }

  // Check if time falls within any availability window
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  for (const window of teacher.availability_windows) {
    const windowStart = timeToMinutes(window.start);
    const windowEnd = timeToMinutes(window.end);

    if (startMinutes >= windowStart && endMinutes <= windowEnd) {
      return { isViolated: false, violationType: '', description: '', affectedEntities: [] };
    }
  }

  return {
    isViolated: true,
    violationType: 'teacher_availability',
    description: `Teacher ${teacher.full_name} is not available at ${startTime}-${endTime} on ${day}`,
    affectedEntities: [teacherId],
  };
}

/**
 * Check if adding this session would exceed max consecutive hours for the teacher
 */
export function checkMaxConsecutiveHours(
  teacherId: string,
  day: string,
  startTime: string,
  endTime: string,
  maxConsecutiveHours: number,
  placedSessions: PlacedSession[]
): HardConstraintCheckResult {
  const teacherSessions = placedSessions.filter(
    session => session.teacher_id === teacherId && session.day === day
  );

  if (teacherSessions.length === 0) {
    return { isViolated: false, violationType: '', description: '', affectedEntities: [] };
  }

  // Sort sessions by start time
  const sortedSessions = [...teacherSessions, { start_time: startTime, end_time: endTime }]
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Check consecutive blocks
  let consecutiveMinutes = 0;
  let lastEnd = 0;

  for (const session of sortedSessions) {
    const sessionStart = timeToMinutes(session.start_time);
    const sessionEnd = timeToMinutes(session.end_time);
    const sessionDuration = sessionEnd - sessionStart;

    // If this session starts right after or overlaps with the previous one
    if (lastEnd > 0 && sessionStart <= lastEnd + 30) {
      consecutiveMinutes += sessionDuration;
    } else {
      consecutiveMinutes = sessionDuration;
    }

    lastEnd = sessionEnd;

    if (consecutiveMinutes > maxConsecutiveHours * 60) {
      return {
        isViolated: true,
        violationType: 'max_consecutive_hours',
        description: `Teacher would exceed max consecutive hours (${maxConsecutiveHours}h) on ${day}`,
        affectedEntities: [teacherId],
      };
    }
  }

  return { isViolated: false, violationType: '', description: '', affectedEntities: [] };
}

/**
 * Check if adding this session would exceed max daily load for the teacher
 */
export function checkMaxDailyLoad(
  teacherId: string,
  day: string,
  durationMinutes: number,
  maxDailyLoad: number,
  placedSessions: PlacedSession[]
): HardConstraintCheckResult {
  const teacherSessions = placedSessions.filter(
    session => session.teacher_id === teacherId && session.day === day
  );

  const currentLoad = teacherSessions.reduce((total, session) => {
    const [startHours, startMinutes] = session.start_time.split(':').map(Number);
    const [endHours, endMinutes] = session.end_time.split(':').map(Number);
    const sessionDuration = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
    return total + sessionDuration;
  }, 0);

  const newLoad = currentLoad + durationMinutes;

  if (newLoad > maxDailyLoad * 60) {
    return {
      isViolated: true,
      violationType: 'max_daily_load',
      description: `Teacher would exceed max daily load (${maxDailyLoad}h) on ${day}`,
      affectedEntities: [teacherId],
    };
  }

  return { isViolated: false, violationType: '', description: '', affectedEntities: [] };
}

/**
 * Check if subject hour requirements are being met
 */
export function checkSubjectHourCompletion(
  subjectId: string,
  sectionId: string,
  placedSessions: PlacedSession[],
  subjects: NormalizedSubject[]
): HardConstraintCheckResult {
  const subject = subjects.find(s => s.id === subjectId);

  if (!subject) {
    return {
      isViolated: true,
      violationType: 'subject_hour_completion',
      description: 'Subject not found',
      affectedEntities: [subjectId],
    };
  }

  const subjectSessions = placedSessions.filter(
    session => session.subject_id === subjectId && session.section_id === sectionId
  );

  const totalHours = subjectSessions.reduce((total, session) => {
    const [startHours, startMinutes] = session.start_time.split(':').map(Number);
    const [endHours, endMinutes] = session.end_time.split(':').map(Number);
    const sessionDuration = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
    return total + sessionDuration;
  }, 0);

  const requiredHours = subject.required_weekly_hours || 0;

  if (requiredHours > 0 && totalHours < requiredHours * 60) {
    return {
      isViolated: true,
      violationType: 'subject_hour_completion',
      description: `Subject ${subject.code} requires ${requiredHours}h but only has ${totalHours / 60}h scheduled`,
      affectedEntities: [subjectId, sectionId],
    };
  }

  return { isViolated: false, violationType: '', description: '', affectedEntities: [] };
}

/**
 * Check if special subject room priority is respected
 */
export function checkSpecialSubjectRoomPriority(
  subjectId: string,
  roomId: string,
  subjects: NormalizedSubject[],
  rooms: NormalizedRoom[]
): HardConstraintCheckResult {
  const subject = subjects.find(s => s.id === subjectId);
  const room = rooms.find(r => r.id === roomId);

  if (!subject || !room) {
    return {
      isViolated: true,
      violationType: 'special_room_priority',
      description: 'Subject or room not found',
      affectedEntities: [subjectId, roomId],
    };
  }

  // If subject is special, check if the room is special
  if (subject.type === 'special' && room.type !== 'special') {
    return {
      isViolated: true,
      violationType: 'special_room_priority',
      description: `Subject ${subject.code} requires a special room but ${room.name} is not special`,
      affectedEntities: [subjectId, roomId],
    };
  }

  return { isViolated: false, violationType: '', description: '', affectedEntities: [] };
}

/**
 * Check if a subject is already scheduled in a different room on the same day for the same section
 * This prevents splitting a subject across multiple rooms on the same day
 */
export function checkSubjectRoomConsistency(
  subjectId: string,
  sectionId: string,
  roomId: string,
  day: string,
  placedSessions: PlacedSession[]
): HardConstraintCheckResult {
  // Find all sessions for this subject + section on this day
  const subjectSectionSessions = placedSessions.filter(
    session => session.subject_id === subjectId && session.section_id === sectionId && session.day === day
  );

  // If there are existing sessions, check if they're all in the same room
  if (subjectSectionSessions.length > 0) {
    // If any existing session is in a different room, this is a violation
    const differentRoom = subjectSectionSessions.find(session => session.room_id !== roomId);

    if (differentRoom) {
      return {
        isViolated: true,
        violationType: 'subject_room_consistency',
        description: `Subject is already scheduled in a different room (${differentRoom.room_id}) on ${day}. All sessions for a subject must be in the same room on the same day.`,
        affectedEntities: [subjectId, sectionId, roomId, differentRoom.room_id],
      };
    }
  }

  return { isViolated: false, violationType: '', description: '', affectedEntities: [] };
}

/**
 * Run all hard constraint checks for a potential session placement
 */
export function checkAllHardConstraints(
  teacherId: string,
  roomId: string,
  sectionId: string,
  subjectId: string,
  day: string,
  startTime: string,
  endTime: string,
  durationMinutes: number,
  placedSessions: PlacedSession[],
  teachers: NormalizedTeacher[],
  rooms: NormalizedRoom[],
  sections: NormalizedSection[],
  subjects: NormalizedSubject[],
  enabledConstraints: {
    no_teacher_overlap: boolean;
    no_room_overlap: boolean;
    no_section_overlap: boolean;
    room_capacity_compliance: boolean;
    teacher_qualification_enforcement: boolean;
    teacher_availability_enforcement: boolean;
    max_consecutive_hours: number;
    max_daily_load: number;
    subject_hour_completion: boolean;
    special_subject_room_priority: boolean;
    subject_room_consistency: boolean;
  }
): HardConstraintCheckResult[] {
  const violations: HardConstraintCheckResult[] = [];

  if (enabledConstraints.no_teacher_overlap) {
    const result = checkTeacherOverlap(teacherId, day, startTime, endTime, placedSessions);
    if (result.isViolated) violations.push(result);
  }

  if (enabledConstraints.no_room_overlap) {
    const result = checkRoomOverlap(roomId, day, startTime, endTime, placedSessions);
    if (result.isViolated) violations.push(result);
  }

  if (enabledConstraints.no_section_overlap) {
    const result = checkSectionOverlap(sectionId, day, startTime, endTime, placedSessions);
    if (result.isViolated) violations.push(result);
  }

  if (enabledConstraints.room_capacity_compliance) {
    const result = checkRoomCapacity(roomId, sectionId, rooms, sections);
    if (result.isViolated) violations.push(result);
  }

  if (enabledConstraints.teacher_qualification_enforcement) {
    const result = checkTeacherQualification(teacherId, subjectId, teachers, subjects);
    if (result.isViolated) violations.push(result);
  }

  if (enabledConstraints.teacher_availability_enforcement) {
    const result = checkTeacherAvailability(teacherId, day, startTime, endTime, teachers);
    if (result.isViolated) violations.push(result);
  }

  if (enabledConstraints.max_consecutive_hours > 0) {
    const result = checkMaxConsecutiveHours(
      teacherId,
      day,
      startTime,
      endTime,
      enabledConstraints.max_consecutive_hours,
      placedSessions
    );
    if (result.isViolated) violations.push(result);
  }

  if (enabledConstraints.max_daily_load > 0) {
    const result = checkMaxDailyLoad(
      teacherId,
      day,
      durationMinutes,
      enabledConstraints.max_daily_load,
      placedSessions
    );
    if (result.isViolated) violations.push(result);
  }

  if (enabledConstraints.subject_hour_completion) {
    const result = checkSubjectHourCompletion(subjectId, sectionId, placedSessions, subjects);
    if (result.isViolated) violations.push(result);
  }

  if (enabledConstraints.special_subject_room_priority) {
    const result = checkSpecialSubjectRoomPriority(subjectId, roomId, subjects, rooms);
    if (result.isViolated) violations.push(result);
  }

  if (enabledConstraints.subject_room_consistency) {
    const result = checkSubjectRoomConsistency(subjectId, sectionId, roomId, day, placedSessions);
    if (result.isViolated) violations.push(result);
  }

  return violations;
}
