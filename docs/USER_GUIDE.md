# OptiSched User Guide
**Complete System Tutorial and Feature Reference**

---

## Table of Contents
1. [System Overview](#system-overview)
2. [User Roles and Permissions](#user-roles-and-permissions)
3. [Getting Started](#getting-started)
4. [Power Admin Guide](#power-admin-guide)
5. [System Admin Guide](#system-admin-guide)
6. [Schedule Admin Guide](#schedule-admin-guide)
7. [Schedule Manager Guide](#schedule-manager-guide)
8. [Teacher Guide](#teacher-guide)
9. [Student Guide](#student-guide)
10. [Feature Reference](#feature-reference)
11. [Best Practices](#best-practices)
12. [Troubleshooting](#troubleshooting)

---

## System Overview

OptiSched is a comprehensive academic scheduling system that helps institutions manage class schedules, teacher assignments, room allocations, and student enrollments. The system is designed to be a serious institutional tool that feels modern and professional while meeting academic needs.

**What OptiSched Does:**
- Creates and manages class schedules
- Assigns teachers to subjects and sections
- Allocates rooms based on availability and capacity
- Tracks teacher workloads and preferences
- Manages approval workflows for schedule changes
- Provides real-time notifications
- Maintains version history of schedules
- Enables sharing and collaboration

**What OptiSched Does NOT Do:**
- Does not automatically generate perfect schedules without human oversight
- Does not replace institutional policies or approval processes
- Does not manage student grades or attendance
- Does not handle financial transactions
- Does not replace learning management systems (LMS)

---

## User Roles and Permissions

OptiSched has 6 distinct roles. Each role has specific capabilities and limitations.

### Role Summary

| Role | Can Create Users | Can Edit Schedules | Can Approve Schedules | Can Delete Schedules | Can View All Data |
|------|-----------------|-------------------|----------------------|---------------------|-------------------|
| Power Admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| System Admin | ✓ | ✗ | ✗ | ✗ | ✓ |
| Schedule Admin | ✗ | ✓ | ✓ | ✓ | ✓ |
| Schedule Manager | ✗ | ✓ | Limited | ✗ | Limited |
| Teacher | ✗ | Request Only | ✗ | ✗ | Own Data Only |
| Student | ✗ | ✗ | ✗ | ✗ | Own Data Only |

### Multi-Role Support

**Role Combinations Allowed:**
- A Teacher may also be a Schedule Manager and/or Schedule Admin (can hold all three simultaneously)
- A Schedule Manager may also be a Schedule Admin (and teacher role if applicable)
- A Schedule Admin may also be a Schedule Manager (and teacher role if applicable)
- Students cannot have any additional roles (student only)
- Power Admin and System Admin cannot have additional roles (single primary role for security)

**Switching Between Roles:**
- When a user has multiple roles, clicking the role badge in the top-right corner opens a role selector panel
- The panel shows all roles the user holds
- Selecting a role switches the sidebar tabs and dashboard to that role's view
- The system remembers the last selected role for the session

---

## Getting Started

### First-Time Login

1. Navigate to your institution's OptiSched URL
2. Enter your email and password
3. If you're a new user, you may need to set your password from an email link
4. Once logged in, you'll see the dashboard appropriate to your role

### Navigation

**Top Navigation Bar:**
- Logo: Returns to your dashboard
- Notifications Bell: Shows unread notifications
- User Menu: Profile settings, logout

**Sidebar Navigation:**
- Dashboard: Main overview for your role
- Schedules: View and manage schedules
- Data: Manage teachers, rooms, subjects, sections
- Other role-specific tabs appear based on your permissions

### Theme and Settings

- Click your profile icon in the top right
- Select "Settings" to access:
  - Theme toggle (light/dark mode)
  - Profile information
  - Notification preferences

---

## Power Admin Guide

### What Power Admins Can Do

**Full System Authority:**
- Create and manage all user accounts
- Assign any role to any user
- Override any system restriction
- Access all audit logs
- Impersonate other users (for troubleshooting)
- Configure system-wide settings
- View all data across the system
- Approve or reject schedules (emergency override)
- Delete schedules (soft deletion)

**What Power Admins CANNOT Do:**
- Cannot delete their own account (must use another admin)
- Cannot bypass database integrity constraints
- Cannot recover permanently deleted data without database access

### Key Features for Power Admins

#### 1. User Management

**Creating Users:**
1. Go to Dashboard → Users
2. Click "Add New User"
3. Enter email and select role
4. The user will receive an email to set their password
5. For immediate access, you can set a temporary password

**Role Assignment:**
- **Power Admin:** Only assign to trusted emergency responders
- **System Admin:** For managing access and system health
- **Schedule Admin:** For approving and reviewing schedules
- **Schedule Manager:** For building and managing schedules
- **Teacher:** For faculty members
- **Student:** For students

**Modifying Users:**
- Change user roles
- Reset passwords
- Deactivate accounts
- View user activity

#### 2. System Configuration

**Accessing System Rules:**
1. Go to Dashboard → System Rules
2. View current permission rules
3. Modify rules as needed
4. Changes are audit-logged

**Common System Rules:**
- `teachers_can_see_student_schedules`: Allow teachers to view student schedules
- `schedule_managers_can_create_without_approval`: Allow schedule managers to create and publish schedules without approval
- `schedule_managers_can_edit_without_approval`: Allow schedule managers to edit published schedules without re-approval
- `schedule_managers_access_all_data`: Allow schedule managers to access all data (if false, only their assigned department)
- `students_can_see_teacher_names`: Show teacher names to students
- `teachers_can_message_admins`: Allow teachers to send messages to admins

#### 3. Audit and Monitoring

**Viewing Audit Logs:**
1. Go to Dashboard → Audit
2. Filter by date, user, action type
3. Review detailed activity logs
4. Export logs if needed

**User Impersonation:**
- Use sparingly and only for troubleshooting
- All actions while impersonating are logged
- Click "Stop Impersonating" when done

#### 4. Emergency Recovery

**What to Do in Emergencies:**
- If the system is compromised, lock down user creation
- If a schedule is accidentally deleted, check version history
- If permissions are misconfigured, use Power Admin override
- For database-level issues, contact your database administrator

### Best Practices for Power Admins

1. **Principle of Least Privilege:** Assign the minimum role needed for each user
2. **Regular Audits:** Review audit logs weekly for suspicious activity
3. **Backup Critical Data:** Export important schedules and configurations regularly
4. **Document Changes:** Keep a record of major system configuration changes
5. **Test Changes:** Test system rule changes in a non-production environment first

---

## System Admin Guide

### What System Admins Can Do

**Access Governance:**
- Create and manage user accounts
- Assign roles (except Power Admin)
- Configure permission rules
- Assign schedule managers to departments
- Assign teachers to departments
- Configure default session length (block length)
- Monitor system health
- View audit logs
- Configure rate limits and security settings

**What System Admins CANNOT Do:**
- Cannot approve or edit schedules
- Cannot create Power Admin accounts
- Cannot impersonate users
- Cannot bypass schedule locks

### Key Features for System Admins

#### 1. User Account Management

**Creating Standard Users:**
1. Go to Dashboard → Users
2. Click "Add New User"
3. Enter email and select role (Teacher, Student, Schedule Manager, Schedule Admin)
4. User receives setup email

**Managing User Access:**
- Deactivate inactive accounts
- Reset forgotten passwords
- Reassign roles when job duties change
- Monitor for unusual login patterns

#### 2. Permission Rules Engine

**Understanding Rules:**
- Rules control what users can see and do
- Rules are stored in the `system_rules` table
- Changes take effect immediately
- All rule changes are logged

**Configuring Rules:**
1. Go to Dashboard → System Rules
2. Review current rule settings
3. Toggle boolean rules or update values
4. Add per-user overrides if needed
5. Save changes

**Common Rule Scenarios:**
- **During Exam Period:** Set `teachers_can_see_student_schedules` to true
- **For Quick Adjustments:** Set `schedule_managers_can_edit_without_approval` to true (allows schedule managers to make adjustments without re-approval)
- **For Privacy:** Set `students_can_see_teacher_names` to false

#### 3. System Health Monitoring

**Dashboard Metrics:**
- Active user count
- Recent login activity
- System performance indicators
- Error rate monitoring

**What to Monitor:**
- Failed login attempts (may indicate attacks)
- Slow query performance
- High error rates
- Unusual data access patterns

#### 4. Security Configuration

**Rate Limiting:**
- Configure API rate limits per role
- Set session timeout durations
- Configure idle session rules
- Enable/disable specific features

**Security Best Practices:**
- Enable two-factor authentication when available
- Regularly review user access
- Monitor for privilege escalation attempts
- Keep audit logs for compliance

### Best Practices for System Admins

1. **Document Rule Changes:** Keep a change log for permission rules
2. **Regular Reviews:** Quarterly review of all user accounts and roles
3. **Security First:** Always err on the side of tighter permissions
4. **Communication:** Notify users before making significant permission changes
5. **Testing:** Test rule changes with a small user group first

---

## Schedule Admin Guide

### What Schedule Admins Can Do

**Schedule Authority:**
- Approve or reject schedule submissions
- Edit any schedule directly
- View all schedules across the institution
- Manage approval workflow
- Access schedule version history
- Manage break times and institutional constraints
- Assign schedule managers to departments
- Assign teachers to departments
- Delete schedules (soft deletion)

**What Schedule Admins CANNOT Do:**
- Cannot manage user accounts
- Cannot modify system rules
- Cannot bypass database constraints

### Key Features for Schedule Admins

#### 1. Schedule Approval Workflow

**Reviewing Pending Approvals:**
1. Go to Dashboard → Approvals
2. View pending requests in the "Pending" tab
3. Click "Review" on any request
4. Review the change details
5. Add notes if needed
6. Approve or Reject

**Approval Criteria:**
- Check for conflicts (teacher, room, section overlaps)
- Verify teacher availability preferences
- Ensure room capacity matches section size
- Confirm break times are respected
- Validate against institutional policies

**Bulk Actions:**
- Approve multiple similar requests at once
- Reject with standard rejection reasons
- Request more information from submitter

#### 2. Direct Schedule Editing

**Editing Schedules:**
1. Go to Dashboard → Schedules
2. Select the schedule to edit
3. Make changes to:
   - Teacher assignment
   - Room allocation
   - Time slot
   - Day of week
4. Save changes

**Conflict Resolution:**
- System highlights conflicts automatically
- Use the Conflicts panel to see all issues
- Resolve by reassigning resources or adjusting times
- Mark conflicts as resolved when fixed

#### 3. Break Times Management

**Configuring Break Times:**
1. Go to Dashboard → Break Times
2. Click "Add Break Time"
3. Configure:
   - Name (e.g., "Lunch Break")
   - Type (lunch, recess, assembly, other)
   - Day(s) it applies to
   - Start and end time
   - Academic year and semester
4. Save

**Break Time Rules:**
- Schedules cannot overlap break times
- Generator respects break times when creating schedules
- Active break times are enforced
- Inactive break times are ignored

#### 5. Version History

**Viewing Schedule Versions:**
1. Open any schedule
2. Click "Version History"
3. View all changes over time
4. Compare versions
5. Restore previous version if needed

**Creating Version Sets:**
- Group related versions into a set
- Name the set (e.g., "Fall 2024 Final")
- Publish version sets for official records
- Track which version is currently published

### Best Practices for Schedule Admins

1. **Approve Quickly:** Don't leave approvals pending for long periods
2. **Document Reasons:** Always provide clear reasons for rejections
3. **Check Conflicts:** Always resolve conflicts before approving
4. **Version Control:** Create version sets before major releases

---

## Schedule Manager Guide

### What Schedule Managers Can Do

**Schedule Construction:**
- Create and manage teachers, rooms, subjects, sections
- Generate schedules using the automated generator
- Manually edit schedules
- Submit schedules for approval (if required)
- Publish schedules directly (if allowed by rules)
- Manage teacher preferences and availability
- Configure priority weights for resources

**What Schedule Managers CANNOT Do:**
- Cannot manage user accounts
- Cannot modify system rules
- Cannot approve other managers' schedules
- Cannot access all data unless `schedule_managers_access_all_data` rule is enabled (otherwise only their assigned department)
- Cannot bypass approval requirements unless `schedule_managers_can_create_without_approval` or `schedule_managers_can_edit_without_approval` rules are enabled

### Key Features for Schedule Managers

#### 1. Data Management

**Managing Teachers:**
1. Go to Dashboard → Data → Teachers
2. Click "Add Teacher"
3. Enter:
   - Profile information (links to existing user)
   - Department
   - Employment type (full-time, part-time)
   - Maximum hours per week
   - Priority weight (higher = more preferred for assignments)
4. Save

**Teacher Availability:**
1. Select a teacher from the list
2. Click "Preferences"
3. Set availability by day and time slot
4. Set preferred time range (e.g., 8:00 AM - 5:00 PM)
5. Set maximum classes per day
6. Set maximum consecutive classes
7. Save

**Managing Rooms:**
1. Go to Dashboard → Data → Rooms
2. Click "Add Room"
3. Enter:
   - Room name and building
   - Capacity
   - Type (lecture, laboratory, gymnasium, computer lab)
   - Equipment available
   - Priority weight
4. Save

**Managing Subjects:**
1. Go to Dashboard → Data → Subjects
2. Click "Add Subject"
3. Enter:
   - Subject code and name
   - Units and duration
   - Type (lecture, laboratory)
   - Program and year level
   - Whether it requires a lab
   - Priority weight
4. Save

**Managing Sections:**
1. Go to Dashboard → Data → Sections
2. Click "Add Section"
3. Enter:
   - Section name
   - Program
   - Year level
   - Student count
   - Parent section (for hierarchical organization)
   - Priority weight
4. Save

**Section Hierarchy:**
- Create groups to organize related sections
- Example: "CS Year 1" → "CS 1A", "CS 1B", "CS 1C"
- Use tree view to manage hierarchy
- Drag and drop to reorganize

#### 2. Schedule Generation

**Using the Generator:**
1. Go to Dashboard → Generate
2. Select academic year and semester
3. Configure generation options:
   - Priority strategy (highest weight, balanced, etc.)
   - Conflict resolution method
   - Whether to respect teacher preferences
   - Whether to respect break times
4. Click "Generate Schedule"
5. Review generated schedule
6. Make manual adjustments if needed
7. Submit for approval or publish

**Manual Scheduling:**
1. Go to Dashboard → Schedules
2. Click "Add Schedule"
3. Select subject, teacher, room, section
4. Select day and time
5. Check for conflicts
6. Save

**Conflict Detection:**
- System automatically highlights conflicts
- Red: High priority conflict (must resolve)
- Yellow: Medium priority conflict (should resolve)
- Gray: Informational (can ignore)

#### 3. Priority Configuration

**Setting Resource Priorities:**
- Higher weight = more likely to get preferred slots
- Teacher weight: Priority for teacher assignments
- Room weight: Priority for room allocations
- Subject weight: Priority for subject scheduling
- Section weight: Priority for section scheduling

**Configuring Global Priorities:**
1. Go to Dashboard → Priority
2. Adjust multipliers for each resource type
3. Set conflict resolution strategy
4. Set priority threshold
5. Save

**Priority Strategies:**
- **Highest Weight:** Assign most important resources first
- **Earliest Slot:** Fill earlier time slots first
- **Balanced:** Distribute resources evenly

#### 4. Sharing and Collaboration

**Sharing Resources:**
1. Go to Dashboard → Sharing
2. Select resource type (teacher, room, subject, section)
3. Choose to make public or share with specific users
4. Set sharing permissions
5. Send sharing request if needed

**Responding to Sharing Requests:**
1. Go to Dashboard → Sharing
2. View pending requests
3. Review the resource being shared
4. Approve or Reject
5. Add a note if needed

### Best Practices for Schedule Managers

1. **Set Priorities Wisely:** Use priority weights to guide the generator effectively
2. **Complete Data First:** Ensure all teachers, rooms, subjects, sections are entered before generating
3. **Check Availability:** Always verify teacher availability before assigning
4. **Review Conflicts:** Don't ignore conflict warnings
5. **Use Versioning:** Save versions before major changes

---

## Teacher Guide

### What Teachers Can Do

**Personal Schedule Management:**
- View their approved schedule
- View workload statistics
- Set availability preferences
- Submit schedule change requests
- Message administrators
- View their assigned subjects and sections
- Check room assignments

**What Teachers CANNOT Do:**
- Cannot edit schedules directly (must submit requests)
- Cannot view other teachers' schedules (unless permitted by rules)
- Cannot view student schedules (unless permitted by rules)
- Cannot manage institutional resources
- Cannot approve schedules

### Key Features for Teachers

#### 1. Viewing Your Schedule

**Dashboard Overview:**
- See today's classes at a glance
- View weekly schedule
- Check upcoming classes
- See workload statistics

**Schedule Details:**
- Subject name and code
- Room and building location
- Day and time
- Section information
- Any special notes

#### 2. Setting Availability Preferences

**Why Set Preferences:**
- Helps schedule managers assign you appropriately
- Respects your preferred working hours
- Avoids scheduling during unavailable times
- Improves work-life balance

**Setting Preferences:**
1. Go to Dashboard → Preferences
2. Set availability by day and time slot
3. Set preferred time range
4. Set maximum classes per day
5. Set maximum consecutive classes
6. Save

**Preference Tips:**
- Be realistic about your availability
- Update preferences when your schedule changes
- Communicate preferences with your department head
- Preferences are requests, not guarantees

#### 3. Submitting Change Requests

**When to Request Changes:**
- Schedule conflicts with other commitments
- Room is unsuitable for the subject
- Need to swap with another teacher
- Medical or family emergency
- Other legitimate reasons

**Submitting a Request:**
1. Go to Dashboard → Schedules
2. Find the schedule to change
3. Click "Request Change"
4. Describe the change needed
5. Provide justification
6. Submit

**Request Status:**
- **Pending:** Awaiting admin review
- **Approved:** Change has been made
- **Rejected:** Request denied with reason

#### 4. Messaging Administrators

**When to Message:**
- Questions about your schedule
- Reporting issues with assigned rooms
- Emergency scheduling conflicts
- General inquiries

**Sending Messages:**
1. Go to Dashboard → Messages
2. Click "New Message"
3. Select recipient (admin)
4. Write your message
5. Send

**Response Time:**
- Admins typically respond within 1-2 business days
- Mark urgent requests as high priority
- Follow up if no response after 3 days

#### 5. Workload Statistics

**Viewing Your Workload:**
- Total teaching hours per week
- Number of classes per day
- Consecutive class blocks
- Comparison to maximum allowed

**Workload Tips:**
- Monitor your workload regularly
- Report if workload exceeds your contract
- Request adjustments if workload is too high
- Use statistics for performance reviews

### Best Practices for Teachers

1. **Keep Preferences Updated:** Update availability when your situation changes
2. **Check Schedule Regularly:** Review your schedule weekly for changes
3. **Communicate Early:** Submit change requests as soon as you know about conflicts
4. **Be Professional:** Provide clear, justified reasons for change requests
5. **Document Everything:** Keep records of your communications regarding scheduling

---

## Student Guide

### What Students Can Do

**Schedule Viewing:**
- View their personal class schedule
- View section-level schedules
- Check upcoming classes
- View break times
- Read announcements
- View teacher names (if permitted by rules)

**What Students CANNOT Do:**
- Cannot edit any schedules
- Cannot submit change requests
- Cannot view other students' schedules
- Cannot message teachers or admins (unless permitted)
- Cannot access administrative features

### Key Features for Students

#### 1. Viewing Your Schedule

**Dashboard Overview:**
- See today's classes
- View weekly schedule
- Check upcoming classes
- See class locations and times

**Class Details:**
- Subject name and code
- Teacher name (if visible)
- Room and building
- Day and time
- Section information

#### 2. Section Schedules

**Viewing Section Schedules:**
1. Go to Dashboard → Sections
2. Select your program and year level
3. View all sections in your program
4. See schedules for each section

**Why View Section Schedules:**
- Know what other sections are doing
- Plan around common break times
- Understand program structure
- Coordinate with classmates

#### 3. Break Times

**Viewing Break Times:**
- See all institutional breaks
- Know when no classes are scheduled
- Plan study time around breaks
- Understand lunch/recess schedules

#### 4. Announcements

**Reading Announcements:**
1. Go to Dashboard → Announcements
2. View recent announcements
3. Filter by priority
4. Read important updates

**Announcement Types:**
- Schedule changes
- Room changes
- Exam schedules
- Holiday information
- Institutional updates

### Best Practices for Students

1. **Check Daily:** Review your schedule every morning
2. **Plan Ahead:** Look at your weekly schedule to plan study time
3. **Stay Informed:** Read announcements regularly
4. **Report Issues:** Let teachers know if you see scheduling errors
5. **Use Breaks Wisely:** Plan study time during break periods

---

## Feature Reference

### Schedules

**Creating Schedules:**
- Required fields: Subject, Teacher, Room, Section, Day, Time
- Optional fields: Notes, Status
- System checks for conflicts automatically
- Can be edited by Schedule Managers and Schedule Admins

**Editing Schedules:**
- Schedule Managers can edit their assigned schedules
- Schedule Admins can edit any schedule
- Teachers submit change requests instead of editing directly
- Students cannot edit schedules

**Deleting Schedules:**
- Only Schedule Admins and Power Admins can delete schedules (soft deletion)
- System Admin cannot delete schedules
- Soft-deleted schedules are retained for 30 days, then permanently deleted
- Deletion is logged in audit trail
- Version history retains deleted schedules

**Schedule Status:**
- **Draft:** Not yet submitted for approval
- **Submitted:** Awaiting Schedule Admin or Power Admin review
- **Approved:** Approved and instantly distributed to teachers and students
- **Published:** Officially published schedule
- **Archived:** Historical record, no longer active
- **Rejected:** Rejected by Schedule Admin with reason

**Note:** All status transitions are logged with who performed the action and timestamp for security.

### Data Management

**Teachers:**
- Create, edit, delete teachers
- Set availability preferences
- Assign to subjects and schedules
- Track workload

**Rooms:**
- Create, edit, delete rooms
- Set capacity and equipment
- Assign to schedules
- Track utilization

**Subjects:**
- Create, edit, delete subjects
- Set units and duration
- Assign to teachers and sections
- Track requirements

**Sections:**
- Create, edit, delete sections
- Organize in hierarchies
- Assign students
- Track enrollment

### Priority System

**Priority Weights:**
- Range: 0-100
- Higher weight = higher priority
- Applied to teachers, rooms, subjects, sections
- Affects schedule generation

**Priority Configuration:**
- Global multipliers for each resource type
- Conflict resolution strategies
- Priority thresholds
- Can be adjusted by System Admins

### Approval Workflow

**Request Types:**
- Schedule change
- New schedule
- Delete schedule
- Bulk change

**Approval States:**
- Pending: Awaiting review
- Approved: Change implemented
- Rejected: Change denied
- Cancelled: Request withdrawn

**Audit Trail:**
- All approval actions are logged
- Shows who approved/rejected and when
- Includes notes and reasons

### Break Times

**Break Types:**
- Lunch
- Recess
- Assembly
- Other

**Configuration:**
- Set by day of week
- Can apply to all days or specific days
- Active breaks are enforced
- Can be academic year/semester specific

### Notifications

**Notification Types:**
- Schedule change
- Sharing request
- Approval
- System
- Reminder

**Notification Features:**
- Real-time delivery
- Mark as read/unread
- Action links for quick responses
- Expiration for time-sensitive notifications

### Sharing

**Sharing Types:**
- Public: Visible to all users
- Private: Visible to owner only
- Shared with: Visible to specific users

**Sharing Request Flow:**
1. User requests access to resource
2. Resource owner receives notification
3. Owner approves or rejects
4. Access granted or denied based on response

### Version History

**Version Types:**
- Created: New schedule added
- Updated: Existing schedule modified
- Deleted: Schedule removed
- Status Change: Status changed
- Checkpoint: Manual save point

**Version Sets:**
- Group related versions
- Name for easy reference
- Can be published as official
- Track current published version

---

## Best Practices

### For Schedule Generation

1. **Complete Data Entry First:** Ensure all teachers, rooms, subjects, and sections are entered with complete information before generating schedules.

2. **Set Appropriate Priorities:** Use priority weights to guide the generator. High-priority items get preferred slots.

3. **Configure Constraints:** Set teacher availability, break times, and other constraints before generation.

4. **Review Generated Results:** Always review the generated schedule for conflicts and issues before publishing.

5. **Iterate if Needed:** If the first generation isn't satisfactory, adjust priorities and constraints, then regenerate.

### For Schedule Approval

1. **Review Thoroughly:** Check for conflicts, teacher preferences, room capacity, and institutional policies before approving.

2. **Provide Clear Feedback:** When rejecting, provide clear reasons so the submitter can make appropriate corrections.

3. **Respond Promptly:** Don't leave approvals pending for extended periods.

4. **Document Decisions:** Keep notes on why certain approval decisions were made for future reference.

5. **Lock After Publication:** Lock schedules once published to prevent accidental changes.

### For Data Management

1. **Keep Data Current:** Update teacher availability, room equipment, and other data as it changes.

2. **Use Hierarchies:** Organize sections in hierarchies for better management and reporting.

3. **Standardize Naming:** Use consistent naming conventions for rooms, subjects, and sections.

4. **Review Regularly:** Periodically review data for accuracy and completeness.

5. **Backup Important Data:** Export critical data regularly for backup purposes.

### For Communication

1. **Be Clear and Professional:** Write clear, professional messages when requesting changes or communicating issues.

2. **Provide Context:** Include relevant context when submitting requests or reporting problems.

3. **Follow Up Appropriately:** If you don't receive a response within a reasonable time, follow up politely.

4. **Use Proper Channels:** Use the messaging system for official communications, not email or other channels.

5. **Document Communications:** Keep records of important communications for reference.

### For Security

1. **Protect Credentials:** Never share your password with anyone.

2. **Log Out Properly:** Always log out when finished, especially on shared computers.

3. **Report Suspicious Activity:** If you notice unusual activity, report it to an admin immediately.

4. **Use Strong Passwords:** Create strong, unique passwords for your account.

5. **Keep Software Updated:** Keep your browser and operating system updated for security.

---

## Troubleshooting

### Common Issues and Solutions

**Issue: Cannot log in**
- Solution: Check your email and password. If you forgot your password, use the "Forgot Password" link. If you still can't log in, contact a System Admin.

**Issue: Schedule not showing**
- Solution: Check that you're viewing the correct academic year and semester. If the schedule should be there but isn't, contact a Schedule Manager.

**Issue: Conflict detected**
- Solution: Review the conflict details. Adjust the teacher, room, or time to resolve the conflict. If you can't resolve it, contact a Schedule Admin.

**Issue: Cannot edit schedule**
- Solution: Check your role permissions. Only Schedule Managers (their own drafts), Schedule Admins, and Power Admins can edit schedules.

**Issue: Approval request rejected**
- Solution: Read the rejection reason. Make the requested changes and resubmit. If you disagree with the rejection, contact the approver to discuss.

**Issue: Notification not received**
- Solution: Check your notification settings. Ensure notifications are enabled. Check your spam folder if email notifications are used.

**Issue: Cannot access a resource**
- Solution: Check if the resource is shared with you. If it should be shared but isn't, contact the resource owner or a Schedule Manager.

**Issue: Schedule generator produces poor results**
- Solution: Review and adjust priority weights. Check that all constraints are properly configured. Try different generation strategies.

**Issue: Performance is slow**
- Solution: Check your internet connection. If the issue persists, report it to a System Admin as it may be a system performance issue.

### Getting Help

**When to Contact Support:**
- System errors or bugs
- Performance issues
- Security concerns
- Feature requests
- Configuration help

**How to Contact Support:**
- Use the in-app messaging system to contact admins
- Check the documentation first for common issues
- Provide detailed information about the problem
- Include screenshots if relevant

**Information to Include:**
- Your role and username
- What you were trying to do
- What happened (error message, unexpected behavior)
- Steps to reproduce the issue
- Browser and device information

---

## Glossary

- **Academic Year:** The period for which schedules are created (e.g., 2024-2025)
- **Approval Workflow:** The process of reviewing and approving schedule changes
- **Audit Log:** A record of all system actions for security and compliance
- **Break Time:** A period when no classes are scheduled (lunch, recess, etc.)
- **Conflict:** A scheduling issue where resources overlap (teacher, room, or time)
- **Dashboard:** The main overview page for each user role
- **Hierarchy:** A tree structure for organizing sections (program → year → section)
- **Multi-Role:** A user having more than one role (possible for Teacher, Schedule Manager, Schedule Admin; not possible for Students, Power Admin, or System Admin)
- **Notification:** A message alerting users to important events
- **Priority Weight:** A numerical value (0-100) indicating scheduling preference
- **RLS (Row Level Security):** Database security that restricts data access based on user roles
- **Schedule:** A class assignment with subject, teacher, room, section, day, and time
- **Section:** A group of students taking the same subjects
- **Semester:** A division of the academic year (e.g., Fall, Spring)
- **Sharing:** Granting other users access to resources you own
- **Version History:** A record of all changes to a schedule over time
- **Version Set:** A group of related schedule versions

---

## Conclusion

OptiSched is a powerful tool for academic scheduling when used correctly. By understanding your role's capabilities and following best practices, you can help ensure smooth scheduling operations for your institution.

Remember:
- Use the features appropriate to your role
- Follow institutional policies and procedures
- Communicate clearly and professionally
- Keep data accurate and up to date
- Report issues promptly

For additional help, contact your institution's System Admin or refer to the technical documentation.
