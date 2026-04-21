# OptiSched Product Requirements Document

## Document Information

- **Product Name:** OptiSched
- **Document Version:** 1.0
- **Last Updated:** April 17, 2026
- **Status:** Draft

---

## 1. Product Summary

OptiSched is an academic scheduling platform designed for institutions that use fixed block scheduling for Senior High School and College. It centralizes schedule generation, manual editing, approval, publishing, viewing, and future expansion into mobile and multi-branch support. The system is presentation-ready now, but it must also be structured so it can scale into a real deployment later.

The product has two major entry points:
1. A landing page that introduces the system with polished motion, modern visuals, and a professional academic tone
2. An authenticated dashboard experience, where users are routed based on role after logging in

---

## 2. Product Vision

The vision is to replace manual and spreadsheet-based schedule building with a structured, intelligent, and collaborative system. The platform should:
- Reduce schedule conflicts
- Help managers work efficiently
- Protect data through versioning and approval
- Give teachers and students clean schedule access

The product should feel like a serious institutional tool, not a toy. It should look modern and creative, but still match academic use. Motion is important, but it must remain refined and professional.

---

## 3. Target Users

| Role | Description |
|------|-------------|
| **Power Admin** | Emergency-only system authorities. Reserved for security incidents, recovery, or critical overrides. |
| **Administrator** | Approval authorities. They review schedule manager output, edit schedules when necessary, and approve schedules before they are sent to users. |
| **Schedule Manager** | Build schedules. They input teachers, subjects, rooms, sections, and teacher roles. They generate schedules, edit them manually, manage sharing, and submit schedules for approval. |
| **Teacher** | Users who only receive approved schedules and can only view their own data. |
| **Student** | Users who only receive approved schedules and can only view their own data. |

---

## 4. Core Product Flow

1. A visitor lands on the OptiSched landing page
2. The landing page presents the product clearly, with animations that feel polished, calm, and academic
3. The user clicks the login tab or button
4. The user logs in
5. The system checks the user's role
6. The system sends the user to the correct dashboard
7. Schedule Managers create data, generate schedules, preview results, edit conflicts, and submit schedules
8. Administrators review, approve, or edit schedules
9. Approved schedules are distributed to teachers and students
10. Version history and audit logs preserve every important action

---

## 5. Landing Page Requirements

### 5.1 Visual Design
- Must be the most visually creative part of the system, but still look serious and credible
- Should feel like a modern enterprise academic platform
- Should use motion well, but not overload the user
- Should not feel cartoonish or playful in a childish way
- Animations should feel smooth, premium, and intentional

### 5.2 Content Structure
- Strong hero section
- Short explanation of what OptiSched does
- Feature highlights
- Visible login path
- Demonstration of scheduling complexity, collaboration, approval, AI assistance, and role-based access

### 5.3 User Experience
- Login tab should be easy to find
- Should transition cleanly into the authenticated experience
- Support both light mode and dark mode (light mode as default)

### 5.4 Color Palette
Blue academic family with colors like:
- `#0F2854`
- `#1C4D8D`
- `#4988C4`
- `#BDE8F5`

(Slight adjustments allowed for design refinement)

---

## 6. Roles and Permissions

### 6.1 Power Admin
- Access to everything
- Can override schedules
- Can edit any data
- Can inspect logs
- Can recover systems
- Can handle emergencies

### 6.2 Administrator
- Can approve schedules
- Can manually edit schedules
- Can lock and unlock schedule versions
- Can review schedule manager work

### 6.3 Schedule Manager
- Can create and manage teachers, rooms, subjects, sections, teacher roles, and schedules
- Can generate schedules
- Can manually edit schedules
- Can share elements
- Can mark elements public or private

### 6.4 Teachers
- Can view only their own schedules
- Can receive notifications
- Cannot create schedules

### 6.5 Students
- Can view only their own schedules
- Can view their assigned section schedules
- Cannot edit schedules

### 6.6 Approval Authority
- Only Administrators and Power Admins can finalize or override schedules

---

## 7. Academic Structure

### 7.1 Institution Model
- Supports one institution per deployment for now
- Architecture must be easy to expand later for multi-branch or multi-institution use
- Scheduling model based on fixed blocks
- Supports Senior High School and College inside the same institution
- Does not manage yearly school calendars
- Focuses only on weekly schedules

### 7.2 Section Hierarchy
- Sections are arranged in a hierarchical grouping structure (similar to folders)
- A parent node can contain groups and sections
- Example structure: STI College → SHS and College → Grade 11 and Grade 12 → Program groups (STEM 11, ABM 11)
- Each node in the hierarchy can have a weight or priority
- Weight influences scheduling priority and optimization
- Hierarchy must be visible and editable in the interface

---

## 8. Teacher Management

### 8.1 Availability
- Teacher availability is not gathered inside OptiSched itself
- Schedule Managers collect availability outside the system through personal communication, institutional forms, or other methods
- Managers input availability into OptiSched
- **Hard constraint:** Teachers must never be assigned outside their availability

### 8.2 Teacher Roles
- Each teacher can have one role only
- Teacher role defines:
  - Max hours per day
  - Max hours per week
  - Load rules
- Supports deloading, especially for teachers who are also administrators

### 8.3 Faculty Load Calculation
- System must calculate faculty load automatically
- System should show whether a teacher is:
  - Overloaded
  - Underloaded
  - Within target range

### 8.4 Teaching Constraints
- **Hard constraint:** Must enforce maximum consecutive teaching hours per day
- **Soft constraint:** Should try to spread teacher load evenly throughout the week

---

## 9. Subject Management

### 9.1 Subject Properties
- Subjects are core scheduling elements
- Each subject can have multiple qualified teachers, but only one teacher is used per session
- System does not handle substitute teacher assignment

### 9.2 Hours and Sessions
- Subjects can have required weekly hours
- Subjects can support split sessions
- Preferred split (when applicable): 1 hour 30 minutes per part
- Schedule Managers must be able to manually adjust required hours per week or per month

### 9.3 Subject Types
- Standard lecture subjects
- Special subjects (have special room requirements)

### 9.4 Subject Metadata
- Duration preferences
- Room compatibility
- Teacher qualification mapping

---

## 10. Room Management

### 10.1 Room Types
- **Common rooms:** Rooms wherein any subject can be taught. These are general-purpose classrooms without specialized equipment.
- **Special rooms:** Rooms that have equipment a specific subject needs (e.g., computer labs, science labs, studios, workshops). These are reserved preferentially for subjects that require them.
- **Hard constraint:** Special subjects (subjects with `requires_lab = true` or marked as requiring special equipment) can only be assigned to special rooms.
- **Soft constraint:** Special rooms are less likely to be used by common subjects (subjects that don't need special rooms). This maximizes room availability for subjects that actually require the specialized equipment.
- When conflicts exist, the scheduler prioritizes special subjects for special rooms, leaving common rooms available for general use.

### 10.2 Room Constraints
- **Hard constraint:** Room capacity must always be greater than or equal to section size
- **Hard constraint:** Only one section may occupy a room during a given session

### 10.3 Room Details
- Building
- Floor
- Room number
- Capacity
- These details are needed for soft constraint optimization (room movement and walking distance)

### 10.4 Room Optimization
- **Soft optimization goal:** Attempt to minimize unnecessary movement between buildings and floors

---

## 11. Section Management

### 11.1 Section Properties
- Sections represent fixed student groups
- Students belong to one section
- System does not support many sections in one room or one shared class slot
- Each section has its own schedule
- Section size must be stored (for room capacity checking)

### 11.2 Section Hierarchy
- Sections can be grouped into a folder-style hierarchy with weights
- Weights help the generator decide which section group to prioritize first when conflicts exist
- Hierarchy should support compact, nested groups for college and senior high structure
- Interface should let schedule managers expand and collapse groups

---

## 12. Schedule Generation

### 12.1 Generator Requirements
- Must generate conflict-free weekly schedules
- Must respect:
  - Teacher availability
  - Room capacity
  - Room compatibility
  - Section overlap rules
  - Teacher role limits
  - Subject hours
  - Break times

### 12.2 Scheduling Models
- Support fixed and block scheduling
- Support split sessions
- Allow managers to define or adjust class durations and session structure
- Support institutional free periods
- Support custom break times
  - Breaks may be shared across all sections or arranged differently
  - Break lengths must be customizable
  - Breaks can be turned on or off based on institutional rules

### 12.3 Generation Modes
- Full generation
- Partial regeneration (when only one section, teacher, room, or subject changes)

### 12.4 Workflow States
- Draft generation
- Manager review
- Submission
- Administrator approval

---

## 13. Constraints

### 13.1 Hard Constraints (Must Never Be Violated)
- No teacher overlap
- No room overlap
- No section overlap
- Room capacity compliance
- Subject-hour completion
- Room-subject compatibility
- Teacher qualification enforcement
- Teacher load requirement according to role
- Teacher availability enforcement
- Maximum consecutive hours per day
- Maximum daily teaching hours
- Break enforcement when enabled
- Single teacher per session
- Single room per session
- Fixed-time enforcement
- Locked schedule enforcement
- Hierarchy integrity
- Active version integrity

### 13.2 Soft Constraints (Optimization Goals)
- Teacher preferences
- Time-of-day preferences
- Compact schedules
- Reduced idle gaps
- Balanced daily loads
- Room utilization efficiency
- Fair teacher workload distribution
- Priority weighting
- Special room priority bias
- Minimized room switching
- Minimized teacher room switching
- Consistent subject spacing
- Preferred sequencing
- Even distribution across hierarchy
- Soft load smoothing
- Late-day minimization
- Early-day minimization

### 13.3 Priority System
- Priority weighting should be configurable
- System should be able to rank sections, groups, subjects, teachers, or other elements by importance
- Recommended: Normalized scoring system (0 to 100 scale) or weighted multiplier system
- Section hierarchy weights should influence scheduling priority
- Special room pressure should influence scheduling priority
- Generator should attempt to schedule higher-priority items first whenever possible

---

## 14. Collaboration and Sharing

### 14.1 Sharing Features
- Schedule Managers must be able to collaborate
- Should be able to share teachers, rooms, sections, and subjects with one another
- Should be able to mark shared elements public or private
- Public elements can be reused across schedule manager workspaces
- Private elements remain visible only to the manager or team allowed to see them

### 14.2 Versioning
- Versioning is required
- Every important edit or generation step should be trackable
- Managers should be able to:
  - Compare versions
  - Roll back versions
  - Review change history
- Protects against accidental overwrites and makes collaboration safer

---

## 15. Approval Workflow

### 15.1 Workflow States
- Draft
- Submitted
- Approved
- Published
- Locked

### 15.2 Workflow Steps
1. Schedule Managers generate schedules
2. Administrators review them
3. Administrators approve them before they reach users
4. Users only receive schedules after approval
5. Power Admin can intervene in emergencies

### 15.3 Logging
- Every state transition should be logged

---

## 16. AI Features

### 16.1 AI Capabilities

**For Teachers and Students:**
- Answer schedule questions (today's schedule, next class, break time, room location)

**For Schedule Managers:**
- Help create records
- Interpret natural language instructions

### 16.2 AI Constraints
- AI must not bypass hard constraints
- AI must not write directly to the database without validation and permission checks

### 16.3 AI Architecture
- AI should be able to run locally during development to reduce cost
- AI should be swappable to cloud AI later without changing the entire app
- AI should be wrapped in a provider layer so the system can use local or cloud models through the same interface

---

## 17. Notifications

### 17.1 Notification Triggers
- Teachers and students should receive notifications after schedule approval or change
- Notifications should be tied only to the relevant user

### 17.2 Future Support
- Should support future mobile notifications
- Offline access support should be planned for the app
- In-app notifications should be part of the initial design even if push notifications are added later

---

## 18. Dashboard Experience

### 18.1 Power Admin Dashboard
- Expose emergency and system-wide controls

### 18.2 Administrator Dashboard
- Focus on approval, editing, version control, and review

### 18.3 Schedule Manager Dashboard
- Focus on data creation, schedule generation, conflict review, optimization, and submission

### 18.4 Teacher Dashboard
- Show personal schedule
- Show room info
- Show workload
- Show notifications

### 18.5 Student Dashboard
- Show personal schedule
- Show section schedule
- Show room info
- Show notifications

### 18.6 Dashboard Principles
- Each dashboard should be role-based
- Should not expose functions outside the role

---

## 19. Design and UX Requirements

### 19.1 Overall Feel
- Professional, modern, and easy to use
- Landing page can be the most creative part of the system
- Authenticated dashboards should feel efficient and clean

### 19.2 Theme
- Light mode should be default
- Dark mode should still look excellent
- Color palette should remain in the blue academic family

### 19.3 Visual Quality
- UI should feel polished and serious enough for institutional presentation
- Animations should feel smooth, fast, and refined
- Animations should enhance the interface rather than distract from it

---

## 20. Cross-Platform and Future Mobile Support

### 20.1 Architecture
- Backend must be API-first
- Web app and future mobile app both connect to the same backend
- Backend should remain the single source of truth

### 20.2 Mobile App Scope
- Mobile app should not generate schedules locally
- Mobile app should focus on:
  - Viewing schedules
  - Receiving notifications
  - Asking schedule questions

---

## 21. Security Requirements

### 21.1 Authentication
- System must use secure authentication
- Passwords should be hashed using Argon2id

### 21.2 Access Control
- Role-based access control should be enforced on the backend
- Frontend should never be trusted for security decisions

### 21.3 Data Protection
- All secrets must live server-side
- Database should never be directly exposed to clients

### 21.4 Logging
- All admin actions, especially schedule changes and Power Admin overrides, should be logged

### 21.5 Transport
- System should support HTTPS in production

---

## 22. Performance and Scale

### 22.1 Target Load
- Around 30 teachers
- 15 to 20 rooms
- About 30 sections
- Large subject set

### 22.2 Performance Requirements
- Should remain responsive during generation
- Should be fast during schedule viewing

### 22.3 Scalability
- Should be easy to expand later for multiple branches or institutions
- Architecture should be modular so that each institution can eventually run in its own environment if necessary

---

## 23. Deployment Goals

- System is being built for presentation first
- Must still be easy to deploy later
- Backend, frontend, and database should all be designed in a way that can support production deployment later without major rewrites

---

## 24. Monetization Direction

- Long-term monetization model: Partnership-based licensing with institutions
- Schools would pay for usage and support as part of a licensing agreement
- This is not meant to be a user-paid consumer subscription model

---

## 25. Acceptance Criteria

The product is acceptable when:

1. A user can:
   - Open the landing page
   - See a polished professional academic experience
   - Log in
   - Be routed to the correct dashboard
   - Interact only with the functions allowed to that role

2. The system allows:
   - Schedule managers to create and generate schedules
   - Administrators to approve them
   - Users to view their schedules
   - Hard constraints to be enforced

3. The following features work in a coherent and expandable way:
   - Schedule versioning
   - Collaboration
   - Room and section hierarchy
   - Teacher role limits
   - AI support

4. The landing page:
   - Looks creative, modern, and animated
   - Still feels appropriate for a serious academic institution

---

## 26. Appendix

### 26.1 Color Palette Reference
- Dark Blue: `#0F2854`
- Medium Blue: `#1C4D8D`
- Light Blue: `#4988C4`
- Pale Blue: `#BDE8F5`

### 26.2 Key Terms
- **Hard Constraint:** A rule that must never be violated
- **Soft Constraint:** An optimization goal that the scheduler tries to satisfy as much as possible
- **Split Session:** A subject that is divided into multiple time blocks within a week
- **Section Hierarchy:** A folder-style grouping of sections with weights for scheduling priority
- **Teacher Role:** Defines max hours per day/week and load rules for a teacher
- **Special Room:** A room with specific requirements, prioritized for special subjects
- **Special Subject:** A subject that requires special room accommodations
