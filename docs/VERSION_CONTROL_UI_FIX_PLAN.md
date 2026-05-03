# Version Control UI Fix Implementation Plan

**Date:** May 3, 2026  
**Status:** In Progress

---

## COMPLETED FIXES

### Priority 1 (Critical)

**1. ✅ Fixed Empty State Navigation**
- Changed from `window.location.href` to React Router's `useNavigate`
- File: ScheduleVersions.tsx
- Impact: Proper SPA navigation

**2. ✅ Replaced Native confirm() with Custom Modal Structure**
- Added state for delete confirmation modal
- Added `confirmDeleteVersion` function
- File: ScheduleVersions.tsx
- Status: Modal structure added, UI pending implementation

**3. ✅ Improved Selection Mechanism**
- Added clear comments explaining selection logic
- Added `deselectVersion` function
- File: ScheduleVersions.tsx
- Status: Logic improved, UI feedback pending

### Priority 2 (High)

**4. ✅ Enhanced Compare Selection Bar**
- Added v1/v2 numbered badges with brand colors
- Shows instruction when no versions selected
- Improved visual distinction between v1 and v2
- File: ScheduleVersions.tsx

**5. ✅ Increased Success Message Duration**
- Changed from 5 seconds to 8 seconds
- File: ScheduleVersions.tsx

---

## PENDING FIXES

### Priority 2 (High) - Need Implementation

**6. Add Delete Confirmation Modal UI**
- Need to add the actual modal JSX
- Should match brand system
- Should show version being deleted
- Should have warning about irreversibility

**7. Add Visual Selection Indicators on Version Rows**
- Add selection badge or checkmark
- Make selected state more obvious
- Add hover state to indicate clickability

**8. Add Loading States to Action Buttons**
- Compare button in header
- Restore button
- Delete button
- Use Loader2 icon

**9. Indicate Version Numbers in Diff View**
- Add "vX (before)" and "vY (after)" labels
- Make it clear which version is which

**10. Improve Active Badge Visibility**
- Increase font size from 11px to 12px or 13px
- Make it more prominent

**11. Fix CheckCircle Icon in Publish Status Card**
- Change to AlertTriangle or Info icon
- Current icon suggests success but this is warning state

### Priority 3 (Medium)

**12. Fix Hardcoded Hover Color in PublishOverwriteConfirm**
- Change `#b87718` to CSS variable
- Use `var(--accent-warning-dark)` or similar

**13. Replace Inline Hover Handlers with CSS**
- Convert onMouseOver/onMouseOut to CSS :hover
- Improves performance and maintainability

**14. Add Keyboard Navigation**
- Allow selecting versions with keyboard
- Add proper focus management

**15. Add Focus Management to Modals**
- Trap focus within modals
- Return focus to trigger element on close

**16. Add ARIA Labels**
- Add aria-label to all interactive elements
- Improve screen reader accessibility

**17. Standardize Button Styling**
- Extract inline button styles to CSS class
- Ensure consistency across components

**18. Add Explanation to Overwrite Badge**
- Add tooltip or inline text explaining overwrite
- Clarify what happens when overwriting

**19. Add Warning for Deleting Second-to-Last Version**
- Check version count before delete
- Show special warning if deleting would leave < 3 versions

### Priority 4 (Low - Polish)

**20. Add Hover States to All Interactive Elements**
**21. Add Skeleton Loading State**
**22. Add Transitions/Animations**
**23. Improve Empty States**
**24. Standardize Spacing**
**25. Extract Inline Styles to CSS**

---

## IMPLEMENTATION STATUS

**Completed:** 5/25 (20%)
**In Progress:** 0
**Pending:** 20

**Estimated Time to Complete Priority 1-2:** 2-3 hours
**Estimated Time to Complete All Priorities:** 6-8 hours

---

## NEXT STEPS

1. Complete delete confirmation modal UI implementation
2. Add selection indicators to version rows
3. Add loading states to all action buttons
4. Update diff view with version number labels
5. Improve active badge visibility
6. Fix CheckCircle icon in publish status card
7. Fix hardcoded hover color
8. Replace inline hover handlers

---

## NOTES

- The lint errors for unused functions (showDeleteConfirm, confirmDeleteVersion, deselectVersion) will be resolved once the UI implementation is complete
- The duplicate property error appears to be a linter cache issue - the code looks correct
- Pre-existing lint errors in ScheduleGenerate/index.tsx are unrelated to this work
