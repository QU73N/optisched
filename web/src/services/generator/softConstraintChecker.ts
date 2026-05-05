/**
 * Soft Constraint Checker for the 15-phase CSP-based Schedule Generator
 * 
 * This service implements the checking and scoring logic for all soft constraints:
 * - Balanced weekly load
 * - Reduced idle gaps
 * - Compact section schedules
 * - Room movement minimization
 * - Time of day preference
 * - Room utilization efficiency
 * - Schedule compactness
 * - Fairness between teachers
 * - Priority weighting
 */

import type {
  PlacedSession,
  NormalizedRoom,
  NormalizedSection,
  NormalizedSubject,
} from './types';

/**
 * Result of a soft constraint check with a penalty score
 */
export interface SoftConstraintCheckResult {
  penalty: number; // 0-100, higher is worse
  violationType: string;
  description: string;
  affectedEntities: string[];
}

/**
 * Calculate the penalty for unbalanced weekly load across teachers
 */
export function checkBalancedWeeklyLoad(
  placedSessions: PlacedSession[],
  maxDailyLoad: number
): SoftConstraintCheckResult {
  const teacherLoads = new Map<string, number>();

  // Calculate total hours per teacher
  for (const session of placedSessions) {
    const currentLoad = teacherLoads.get(session.teacher_id) || 0;
    const [startHours, startMinutes] = session.start_time.split(':').map(Number);
    const [endHours, endMinutes] = session.end_time.split(':').map(Number);
    const sessionDuration = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
    teacherLoads.set(session.teacher_id, currentLoad + sessionDuration);
  }

  // Calculate standard deviation of loads
  const loads = Array.from(teacherLoads.values());
  if (loads.length === 0) {
    return { penalty: 0, violationType: '', description: '', affectedEntities: [] };
  }

  const mean = loads.reduce((sum, load) => sum + load, 0) / loads.length;
  const variance = loads.reduce((sum, load) => sum + Math.pow(load - mean, 2), 0) / loads.length;
  const stdDev = Math.sqrt(variance);

  // Convert to percentage penalty
  const penalty = Math.min(100, (stdDev / (maxDailyLoad * 60)) * 100);

  if (penalty > 20) {
    return {
      penalty,
      violationType: 'unbalanced_load',
      description: `Teacher loads are unbalanced (std dev: ${(stdDev / 60).toFixed(1)}h)`,
      affectedEntities: Array.from(teacherLoads.keys()),
    };
  }

  return { penalty, violationType: '', description: '', affectedEntities: [] };
}

/**
 * Calculate the penalty for idle gaps in schedules
 */
export function checkReducedIdleGaps(
  placedSessions: PlacedSession[]
): SoftConstraintCheckResult {
  const totalGapMinutes = new Map<string, number>();

  // Group sessions by teacher and day
  const sessionsByTeacherDay = new Map<string, PlacedSession[]>();
  for (const session of placedSessions) {
    const key = `${session.teacher_id}_${session.day}`;
    if (!sessionsByTeacherDay.has(key)) {
      sessionsByTeacherDay.set(key, []);
    }
    sessionsByTeacherDay.get(key)!.push(session);
  }

  // Calculate gaps for each teacher-day combination
  for (const [key, sessions] of sessionsByTeacherDay) {
    sessions.sort((a, b) => a.start_time.localeCompare(b.start_time));

    for (let i = 0; i < sessions.length - 1; i++) {
      const [endHours, endMinutes] = sessions[i].end_time.split(':').map(Number);
      const [startHours, startMinutes] = sessions[i + 1].start_time.split(':').map(Number);
      const gap = (startHours * 60 + startMinutes) - (endHours * 60 + endMinutes);

      if (gap > 30) { // More than 30 minutes is considered a gap
        const teacherId = key.split('_')[0];
        const currentGap = totalGapMinutes.get(teacherId) || 0;
        totalGapMinutes.set(teacherId, currentGap + gap);
      }
    }
  }

  // Calculate total penalty
  const totalGaps = Array.from(totalGapMinutes.values()).reduce((sum, gap) => sum + gap, 0);
  const totalSessions = placedSessions.length;
  const penalty = totalSessions > 0 ? Math.min(100, (totalGaps / (totalSessions * 60)) * 100) : 0;

  if (penalty > 15) {
    return {
      penalty,
      violationType: 'idle_gaps',
      description: `Significant idle gaps in schedules (${(totalGaps / 60).toFixed(1)}h total)`,
      affectedEntities: Array.from(totalGapMinutes.keys()),
    };
  }

  return { penalty, violationType: '', description: '', affectedEntities: [] };
}

/**
 * Calculate the penalty for non-compact section schedules
 */
export function checkCompactSectionSchedules(
  placedSessions: PlacedSession[]
): SoftConstraintCheckResult {
  const sectionGaps = new Map<string, number>();

  // Group sessions by section and day
  const sessionsBySectionDay = new Map<string, PlacedSession[]>();
  for (const session of placedSessions) {
    const key = `${session.section_id}_${session.day}`;
    if (!sessionsBySectionDay.has(key)) {
      sessionsBySectionDay.set(key, []);
    }
    sessionsBySectionDay.get(key)!.push(session);
  }

  // Calculate spread for each section-day combination
  for (const [key, sessions] of sessionsBySectionDay) {
    if (sessions.length < 2) continue;

    const startTimes = sessions.map(s => {
      const [hours, minutes] = s.start_time.split(':').map(Number);
      return hours * 60 + minutes;
    });
    const endTimes = sessions.map(s => {
      const [hours, minutes] = s.end_time.split(':').map(Number);
      return hours * 60 + minutes;
    });

    const earliestStart = Math.min(...startTimes);
    const latestEnd = Math.max(...endTimes);
    const totalDuration = endTimes.reduce((sum, end) => {
      const [hours, minutes] = sessions[endTimes.indexOf(end)].start_time.split(':').map(Number);
      return sum + end - (hours * 60 + minutes);
    }, 0);

    const spread = latestEnd - earliestStart - totalDuration;
    if (spread > 60) { // More than 1 hour spread is non-compact
      const sectionId = key.split('_')[0];
      const currentSpread = sectionGaps.get(sectionId) || 0;
      sectionGaps.set(sectionId, currentSpread + spread);
    }
  }

  // Calculate total penalty
  const totalSpread = Array.from(sectionGaps.values()).reduce((sum, spread) => sum + spread, 0);
  const totalSessions = placedSessions.length;
  const penalty = totalSessions > 0 ? Math.min(100, (totalSpread / (totalSessions * 60)) * 100) : 0;

  if (penalty > 15) {
    return {
      penalty,
      violationType: 'non_compact',
      description: `Section schedules are not compact (${(totalSpread / 60).toFixed(1)}h total spread)`,
      affectedEntities: Array.from(sectionGaps.keys()),
    };
  }

  return { penalty, violationType: '', description: '', affectedEntities: [] };
}

/**
 * Calculate the penalty for excessive room movement
 * Accounts for building movement (higher penalty) and room movement (lower penalty)
 */
export function checkRoomMovementMinimization(
  placedSessions: PlacedSession[],
  rooms: { id: string; building: string; floor: number }[] = []
): SoftConstraintCheckResult {
  const sectionRoomChanges = new Map<string, number>();
  const sectionBuildingChanges = new Map<string, number>();

  // Create room lookup map
  const roomMap = new Map(rooms.map(r => [r.id, r]));

  // Group sessions by section and day
  const sessionsBySectionDay = new Map<string, PlacedSession[]>();
  for (const session of placedSessions) {
    const key = `${session.section_id}_${session.day}`;
    if (!sessionsBySectionDay.has(key)) {
      sessionsBySectionDay.set(key, []);
    }
    sessionsBySectionDay.get(key)!.push(session);
  }

  // Count room and building changes for each section-day combination
  for (const [key, sessions] of sessionsBySectionDay) {
    sessions.sort((a, b) => a.start_time.localeCompare(b.start_time));

    let roomChanges = 0;
    let buildingChanges = 0;

    for (let i = 0; i < sessions.length - 1; i++) {
      const currentRoom = roomMap.get(sessions[i].room_id);
      const nextRoom = roomMap.get(sessions[i + 1].room_id);

      if (sessions[i].room_id !== sessions[i + 1].room_id) {
        roomChanges++;
        // Check if it's a building change
        if (currentRoom && nextRoom && currentRoom.building !== nextRoom.building) {
          buildingChanges++;
        }
      }
    }

    if (roomChanges > 0) {
      const sectionId = key.split('_')[0];
      const currentRoomChanges = sectionRoomChanges.get(sectionId) || 0;
      sectionRoomChanges.set(sectionId, currentRoomChanges + roomChanges);
    }

    if (buildingChanges > 0) {
      const sectionId = key.split('_')[0];
      const currentBuildingChanges = sectionBuildingChanges.get(sectionId) || 0;
      sectionBuildingChanges.set(sectionId, currentBuildingChanges + buildingChanges);
    }
  }

  // Calculate total penalty (building changes have 3x weight)
  const totalRoomChanges = Array.from(sectionRoomChanges.values()).reduce((sum, changes) => sum + changes, 0);
  const totalBuildingChanges = Array.from(sectionBuildingChanges.values()).reduce((sum, changes) => sum + changes, 0);
  const totalSessions = placedSessions.length;
  
  // Building changes are penalized more heavily (3x weight)
  const weightedChanges = totalRoomChanges + (totalBuildingChanges * 3);
  const penalty = totalSessions > 0 ? Math.min(100, (weightedChanges / totalSessions) * 50) : 0;

  if (penalty > 20) {
    return {
      penalty,
      violationType: 'room_switching',
      description: `Excessive room movement (${totalRoomChanges} room changes, ${totalBuildingChanges} building changes)`,
      affectedEntities: Array.from(sectionRoomChanges.keys()),
    };
  }

  return { penalty, violationType: '', description: '', affectedEntities: [] };
}

/**
 * Calculate the penalty for not respecting time of day preferences
 */
export function checkTimeOfDayPreference(
  placedSessions: PlacedSession[],
  subjects: NormalizedSubject[]
): SoftConstraintCheckResult {
  let violations = 0;

  for (const session of placedSessions) {
    const subject = subjects.find(s => s.id === session.subject_id);
    if (!subject || !subject.preferred_time_window) continue;

    const [hours] = session.start_time.split(':').map(Number);

    let matchesPreference = false;
    if (subject.preferred_time_window === 'early' && hours < 12) {
      matchesPreference = true;
    } else if (subject.preferred_time_window === 'mid' && hours >= 11 && hours < 14) {
      matchesPreference = true;
    } else if (subject.preferred_time_window === 'late' && hours >= 14) {
      matchesPreference = true;
    }

    if (!matchesPreference) {
      violations++;
    }
  }

  const penalty = placedSessions.length > 0 ? Math.min(100, (violations / placedSessions.length) * 100) : 0;

  if (penalty > 10) {
    return {
      penalty,
      violationType: 'time_preference',
      description: `Time of day preferences not respected (${violations} violations)`,
      affectedEntities: placedSessions.slice(0, 10).map(s => s.subject_id),
    };
  }

  return { penalty, violationType: '', description: '', affectedEntities: [] };
}

/**
 * Calculate the penalty for poor room utilization
 */
export function checkRoomUtilizationEfficiency(
  placedSessions: PlacedSession[],
  rooms: NormalizedRoom[]
): SoftConstraintCheckResult {
  const roomUtilization = new Map<string, { capacity: number; used: number }>();

  // Initialize room utilization
  for (const room of rooms) {
    roomUtilization.set(room.id, { capacity: room.capacity, used: 0 });
  }

  // Count students in each room
  for (const session of placedSessions) {
    const utilization = roomUtilization.get(session.room_id);
    if (utilization) {
      const section = session.section_name.match(/\d+/);
      const studentCount = section ? parseInt(section[0]) * 30 : 30; // Approximate
      utilization.used += studentCount;
    }
  }

  // Calculate efficiency (used / capacity ratio)
  let totalEfficiency = 0;
  let roomCount = 0;

  for (const utilization of roomUtilization.values()) {
    if (utilization.capacity > 0) {
      const efficiency = utilization.used / utilization.capacity;
      totalEfficiency += Math.min(1, efficiency); // Cap at 100%
      roomCount++;
    }
  }

  const avgEfficiency = roomCount > 0 ? totalEfficiency / roomCount : 1;
  const penalty = (1 - avgEfficiency) * 100;

  if (penalty > 25) {
    return {
      penalty,
      violationType: 'poor_utilization',
      description: `Room utilization is inefficient (${(avgEfficiency * 100).toFixed(1)}%)`,
      affectedEntities: Array.from(roomUtilization.keys()),
    };
  }

  return { penalty, violationType: '', description: '', affectedEntities: [] };
}

/**
 * Calculate the penalty for non-compact overall schedule
 */
export function checkScheduleCompactness(
  placedSessions: PlacedSession[]
): SoftConstraintCheckResult {
  if (placedSessions.length === 0) {
    return { penalty: 0, violationType: '', description: '', affectedEntities: [] };
  }

  // Calculate time spread
  const startTimes = placedSessions.map(s => {
    const [hours, minutes] = s.start_time.split(':').map(Number);
    return hours * 60 + minutes;
  });
  const endTimes = placedSessions.map(s => {
    const [hours, minutes] = s.end_time.split(':').map(Number);
    return hours * 60 + minutes;
  });

  const earliestStart = Math.min(...startTimes);
  const latestEnd = Math.max(...endTimes);
  const totalDuration = endTimes.reduce((sum, end, i) => {
    return sum + end - startTimes[i];
  }, 0);

  const spread = latestEnd - earliestStart - totalDuration;
  const penalty = Math.min(100, (spread / (totalDuration + spread)) * 100);

  if (penalty > 20) {
    return {
      penalty,
      violationType: 'non_compact',
      description: `Overall schedule is not compact (${(spread / 60).toFixed(1)}h spread)`,
      affectedEntities: [],
    };
  }

  return { penalty, violationType: '', description: '', affectedEntities: [] };
}

/**
 * Calculate the penalty for unfair distribution between teachers
 */
export function checkFairnessBetweenTeachers(
  placedSessions: PlacedSession[]
): SoftConstraintCheckResult {
  const teacherSessionCounts = new Map<string, number>();

  for (const session of placedSessions) {
    const count = teacherSessionCounts.get(session.teacher_id) || 0;
    teacherSessionCounts.set(session.teacher_id, count + 1);
  }

  const counts = Array.from(teacherSessionCounts.values());
  if (counts.length === 0) {
    return { penalty: 0, violationType: '', description: '', affectedEntities: [] };
  }

  const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;
  const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
  const stdDev = Math.sqrt(variance);

  const penalty = Math.min(100, (stdDev / mean) * 100);

  if (penalty > 15) {
    return {
      penalty,
      violationType: 'unfair_distribution',
      description: `Unfair session distribution (std dev: ${stdDev.toFixed(1)})`,
      affectedEntities: Array.from(teacherSessionCounts.keys()),
    };
  }

  return { penalty, violationType: '', description: '', affectedEntities: [] };
}

/**
 * Calculate the penalty for not respecting priority weighting
 */
export function checkPriorityWeighting(
  placedSessions: PlacedSession[],
  unplacedSessions: { subject_id: string; section_id: string; reason: string }[],
  subjects: NormalizedSubject[],
  sections: NormalizedSection[]
): SoftConstraintCheckResult {
  let highPriorityPlaced = 0;
  let highPriorityTotal = 0;

  for (const session of placedSessions) {
    const subject = subjects.find(s => s.id === session.subject_id);
    const section = sections.find(s => s.id === session.section_id);

    if (subject && section) {
      const priorityScore = (subject.priority_level + section.priority_weight) / 2;
      if (priorityScore > 70) {
        highPriorityPlaced++;
      }
    }
  }

  for (const unplaced of unplacedSessions) {
    const subject = subjects.find(s => s.id === unplaced.subject_id);
    const section = sections.find(s => s.id === unplaced.section_id);

    if (subject && section) {
      const priorityScore = (subject.priority_level + section.priority_weight) / 2;
      if (priorityScore > 70) {
        highPriorityTotal++;
      }
    }
  }

  highPriorityTotal += highPriorityPlaced;

  const placedRatio = highPriorityTotal > 0 ? highPriorityPlaced / highPriorityTotal : 1;
  const penalty = (1 - placedRatio) * 100;

  if (penalty > 10) {
    return {
      penalty,
      violationType: 'priority_violation',
      description: `High priority sessions not prioritized (${(placedRatio * 100).toFixed(1)}% placed)`,
      affectedEntities: [],
    };
  }

  return { penalty, violationType: '', description: '', affectedEntities: [] };
}

/**
 * Run all soft constraint checks and return overall score
 */
export function checkAllSoftConstraints(
  placedSessions: PlacedSession[],
  unplacedSessions: { subject_id: string; section_id: string; reason: string }[],
  rooms: NormalizedRoom[],
  sections: NormalizedSection[],
  subjects: NormalizedSubject[],
  enabledConstraints: {
    balanced_weekly_load: boolean;
    reduced_idle_gaps: boolean;
    compact_section_schedules: boolean;
    room_movement_minimization: boolean;
    time_of_day_preference: boolean;
    room_utilization_efficiency: boolean;
    schedule_compactness: boolean;
    fairness_between_teachers: boolean;
    priority_weighting: boolean;
  },
  maxDailyLoad: number
): SoftConstraintCheckResult[] {
  const results: SoftConstraintCheckResult[] = [];

  if (enabledConstraints.balanced_weekly_load) {
    results.push(checkBalancedWeeklyLoad(placedSessions, maxDailyLoad));
  }

  if (enabledConstraints.reduced_idle_gaps) {
    results.push(checkReducedIdleGaps(placedSessions));
  }

  if (enabledConstraints.compact_section_schedules) {
    results.push(checkCompactSectionSchedules(placedSessions));
  }

  if (enabledConstraints.room_movement_minimization) {
    results.push(checkRoomMovementMinimization(placedSessions, rooms));
  }

  if (enabledConstraints.time_of_day_preference) {
    results.push(checkTimeOfDayPreference(placedSessions, subjects));
  }

  if (enabledConstraints.room_utilization_efficiency) {
    results.push(checkRoomUtilizationEfficiency(placedSessions, rooms));
  }

  if (enabledConstraints.schedule_compactness) {
    results.push(checkScheduleCompactness(placedSessions));
  }

  if (enabledConstraints.fairness_between_teachers) {
    results.push(checkFairnessBetweenTeachers(placedSessions));
  }

  if (enabledConstraints.priority_weighting) {
    results.push(checkPriorityWeighting(placedSessions, unplacedSessions, subjects, sections));
  }

  return results;
}
