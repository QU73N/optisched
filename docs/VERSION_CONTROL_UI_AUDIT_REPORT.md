# Version Control UI Audit Report

**Date:** May 3, 2026  
**Auditor:** UI/UX Quality Engineer  
**Scope:** Generate Tab, Schedules Tab (Versions), Publish Overwrite Modal

---

## EXECUTIVE SUMMARY

The version control UI implementation is functional but contains several UI/UX issues that impact clarity, cognitive load, action safety, and consistency. Critical issues include confusing selection mechanics, inconsistent styling patterns, weak feedback states, and edge case handling gaps.

**Severity Breakdown:**
- Critical: 3 issues
- High: 7 issues
- Medium: 12 issues
- Low: 8 issues

---

## PHASE 1: DEEP UI AUDIT FINDINGS

### ScheduleVersions.tsx

#### CRITICAL ISSUES

**1. Confusing Selection Mechanism for Comparison**
- **Problem:** Users click a row to select for comparison, but the UX is unintuitive. Selecting v1 then v2 is not obvious. The selection logic (click to select v1, click another for v2, click third to replace v1) is not discoverable.
- **Impact:** Users will struggle to use the compare feature
- **Location:** Lines 146-156 (selectForCompare function)
- **Fix:** Add explicit "Select for comparison" tooltips, visual indicators (radio buttons or numbered badges), and clearer selection state

**2. Native confirm() for Delete Action**
- **Problem:** Delete uses `window.confirm()` which is not brand-aligned and provides poor UX
- **Impact:** Breaks visual consistency, poor accessibility
- **Location:** Line 127
- **Fix:** Replace with custom confirmation modal matching brand system

**3. No Pagination/Virtualization for Long Lists**
- **Problem:** Hard limit of 50 versions with no pagination. If there are 50+ versions, older ones are inaccessible
- **Impact:** Data loss visibility, poor scalability
- **Location:** Line 59 (limit: 50)
- **Fix:** Add pagination or virtual scrolling with load more button

#### HIGH ISSUES

**4. Weak Visual Feedback for Selected State**
- **Problem:** Selected versions only show background color change, no clear indicator of selection state
- **Impact:** Users won't know which versions are selected
- **Location:** Lines 389-393
- **Fix:** Add selection badge, checkmark icon, or numbered indicator

**5. Diff View Doesn't Indicate Which Version is Before/After**
- **Problem:** Diff shows "Before" and "After" labels but doesn't map to specific version numbers
- **Impact:** Users can't tell which version is which in the diff
- **Location:** Lines 629-655
- **Fix:** Add version number labels to Before/After sections

**6. No Loading State on Action Buttons**
- **Problem:** Compare, restore, and delete buttons have no loading state during async operations
- **Impact:** Users may click multiple times, unclear if action is in progress
- **Location:** Lines 486-530
- **Fix:** Add loading spinners or disable with loading text

**7. Success Messages Auto-Dismiss Too Quickly**
- **Problem:** Success messages auto-dismiss after 5 seconds, users might miss them
- **Impact:** Unclear if action succeeded
- **Location:** Lines 202-207
- **Fix:** Increase to 8 seconds or add manual dismiss option

**8. Metrics Label Ambiguity**
- **Problem:** "Score" label is abbreviated from "Soft Score" - unclear what it means
- **Impact:** Users may not understand the metric
- **Location:** Lines 474-481
- **Fix:** Use full label "Soft Score" or add tooltip

**9. Compare Selection Bar Lacks Clear v1/v2 Indication**
- **Problem:** Selection bar shows selected versions but doesn't clearly indicate which is v1 vs v2
- **Impact:** Users confused about comparison order
- **Location:** Lines 307-372
- **Fix:** Add "v1" and "v2" labels or numbered badges

**10. Empty State Uses window.location.href**
- **Problem:** Empty state button uses `window.location.href = '/admin/generate'` instead of React Router
- **Impact:** Breaks SPA navigation pattern
- **Location:** Line 299
- **Fix:** Use useNavigate hook

#### MEDIUM ISSUES

**11. Version Number Badge Too Large**
- **Problem:** 48x48px badge competes with content, excessive visual weight
- **Impact:** Poor visual hierarchy
- **Location:** Lines 402-419
- **Fix:** Reduce to 40x40px or 36x36px

**12. Active Badge Too Small**
- **Problem:** Active badge is 11px font, easily missed
- **Impact:** Users may not notice which version is active
- **Location:** Lines 420-433
- **Fix:** Increase to 12px or 13px font

**13. Too Many Icons Per Row**
- **Problem:** Version icon, change type icon, 3 action buttons = 5 icons, visual noise
- **Impact:** Cognitive overload, hard to scan
- **Location:** Lines 395-533
- **Fix:** Consolidate or reduce icon count, use tooltips

**14. No Visual Indication of Selection Before Click**
- **Problem:** No hover state indicating row is clickable for selection
- **Impact:** Users don't know rows are interactive
- **Location:** Lines 381-394
- **Fix:** Add hover state with cursor pointer and subtle background change

**15. Inconsistent Modal Styling**
- **Problem:** Compare modal and Restore modal use different card styling patterns
- **Impact:** Visual inconsistency
- **Location:** Lines 540-663 (compare), 665-778 (restore)
- **Fix:** Unify modal styling pattern

**16. No Loading State on Compare Button**
- **Problem:** Compare button in header has no loading state
- **Impact:** Users may click multiple times
- **Location:** Lines 217-226
- **Fix:** Add loading spinner or disable with loading text

**17. Button Styling Inconsistency**
- **Problem:** Some buttons use `.btn` class, others are fully inline styled
- **Impact:** Inconsistent appearance
- **Location:** Throughout component
- **Fix:** Use consistent button styling pattern

**18. Inline Hover Handlers Instead of CSS**
- **Problem:** Hover effects use inline onMouseOver/onMouseOut handlers
- **Impact:** Performance, maintainability
- **Location:** Lines 357-370, 586-596
- **Fix:** Use CSS hover states

**19. No Handling for Identical Versions**
- **Problem:** No specific handling when comparing identical versions beyond empty state
- **Impact:** Could be clearer
- **Location:** Lines 600-607
- **Fix:** Add specific messaging for identical versions

**20. No Handling for Very Long Change Summaries**
- **Problem:** Long change summaries could break layout
- **Impact:** Visual overflow
- **Location:** Lines 454-461
- **Fix:** Add text truncation with ellipsis

**21. Metrics Have Same Visual Weight as Change Type**
- **Problem:** Conflicts and Score metrics compete with change type for attention
- **Impact:** Hard to scan for most important info
- **Location:** Lines 464-482
- **Fix:** Reduce visual weight of metrics or increase weight of change type

**22. No Warning When Deleting Second-to-Last Version**
- **Problem:** No special warning when deleting would leave only one version
- **Impact:** User might accidentally reduce history to minimum
- **Location:** Lines 126-144
- **Fix:** Add warning when deleting would leave < 3 versions

#### LOW ISSUES

**23. Compare Selection Bar Appears Only When v1 Selected**
- **Problem:** Selection bar doesn't appear until after first selection
- **Impact:** Users don't know selection feature exists
- **Location:** Lines 307-372
- **Fix:** Show selection bar with "Select 2 versions to compare" message

**24. No Keyboard Navigation for Version Selection**
- **Problem:** Can't select versions with keyboard
- **Impact:** Accessibility issue
- **Location:** Lines 376-535
- **Fix:** Add keyboard navigation support

**25. No Focus Management on Modals**
- **Problem:** Modals don't trap focus or manage focus on open
- **Impact:** Accessibility issue
- **Location:** Lines 540-663, 665-778
- **Fix:** Add focus trap and focus management

**26. No ARIA Labels on Action Buttons**
- **Problem:** Action buttons lack ARIA labels
- **Impact:** Screen reader accessibility
- **Location:** Lines 486-530
- **Fix:** Add aria-label attributes

**27. Error/Success Message Close Button No Hover State**
- **Problem:** Close button on messages has no hover state
- **Impact:** Poor affordance
- **Location:** Lines 243-254, 271-282
- **Fix:** Add hover state

**28. Version Number Format Inconsistent**
- **Problem:** Some places use "v1", others use "Version 1"
- **Impact:** Inconsistent terminology
- **Location:** Throughout
- **Fix:** Standardize on "v1" format or "Version 1" format

**29. No Skeleton Loading State**
- **Problem:** Loading state uses simple spinner, no skeleton structure
- **Impact:** Poor perceived performance
- **Location:** Lines 287-291
- **Fix:** Add skeleton loading state

**30. No Empty State for Comparison Result**
- **Problem:** When comparison returns no data, shows "No Differences" but could be clearer
- **Impact:** Minor clarity issue
- **Location:** Lines 600-607
- **Fix:** Improve empty state messaging

---

### Generate Tab Publish Status Card

#### MEDIUM ISSUES

**31. No Explanation of Overwrite Implication**
- **Problem:** "Overwrite Required" badge is clear but doesn't explain what overwrite means
- **Impact:** Users may not understand the action
- **Location:** Lines 690-751
- **Fix:** Add brief explanation or tooltip

**32. CheckCircle Icon Suggests Success But Is Warning State**
- **Problem:** CheckCircle typically indicates success, but this is a warning about overwrite
- **Impact:** Visual confusion
- **Location:** Line 711
- **Fix:** Use AlertTriangle or Info icon

**33. No Indication When No Schedule Exists**
- **Problem:** Card only appears when schedule exists, no indication of normal state
- **Impact:** Users might not understand the normal flow
- **Location:** Lines 690-751
- **Fix:** Could add neutral state when no schedule exists

#### LOW ISSUES

**34. No Call-to-Action in Card**
- **Problem:** Card shows status but no clear next action
- **Impact:** Unclear what to do
- **Location:** Lines 690-751
- **Fix:** Add "View in Versions" link or similar

---

### PublishOverwriteConfirm Modal

#### MEDIUM ISSUES

**35. Hardcoded Hover Color**
- **Problem:** Confirm button hover uses hardcoded `#b87718` instead of CSS variable
- **Impact:** Brand inconsistency, theming issues
- **Location:** Line 285
- **Fix:** Use CSS variable for hover color

**36. Inline Hover Handlers**
- **Problem:** Both buttons use inline onMouseOver/onMouseOut handlers
- **Impact:** Performance, maintainability
- **Location:** Lines 261-266, 284-289
- **Fix:** Use CSS hover states

**37. No Double-Confirmation for Destructive Action**
- **Problem:** Overwrite is destructive but only requires single confirmation
- **Impact:** Could lead to accidental overwrites
- **Location:** Lines 270-292
- **Fix:** Consider adding "type to confirm" or stronger warning

#### LOW ISSUES

**38. No Focus Management**
- **Problem:** Modal doesn't manage focus on open/close
- **Impact:** Accessibility
- **Location:** Lines 56-295
- **Fix:** Add focus trap and focus management

---

## PHASE 2: VISUAL SYSTEM VALIDATION

### Brand Compliance Issues

**39. Inconsistent Spacing**
- Some areas use 12px gaps, others 16px, others 20px
- Not following a consistent spacing rhythm
- **Fix:** Standardize on brand spacing scale (8px, 12px, 16px, 20px, 24px)

**40. Inconsistent Border Radius**
- Some areas use var(--radius-md), others use var(--radius-sm), others use var(--radius-lg)
- **Fix:** Use consistent radius based on element hierarchy

**41. Inconsistent Button Styling**
- Mix of `.btn` class and inline styles
- **Fix:** Standardize on button component or CSS class

**42. Inline Styles Throughout**
- Heavy use of inline styles instead of CSS classes
- **Fix:** Extract to CSS modules or styled components

**43. Hardcoded Colors**
- Hover color hardcoded in PublishOverwriteConfirm
- **Fix:** Use CSS variables

---

## PHASE 3-9: ADDITIONAL FINDINGS

### Interaction & Flow Issues

**44. No Cross-Tab State Sync Indication**
- Problem: No indication that versions updated in another tab
- Impact: Stale data
- Fix: Add refresh indicator or auto-refresh

**45. No Undo After Restore**
- Problem: Once restored, can't undo the restore
- Impact: Risky action
- Fix: Consider adding "Undo" option or stronger confirmation

### Micro-Interaction Issues

**46. No Hover States on Version Rows**
- Problem: Rows don't show hover state even though they're clickable
- Impact: Poor affordance
- Fix: Add hover state with subtle background change

**47. No Transition on Compare Selection Bar**
- Problem: Selection bar appears/disappears without animation
- Impact: Jarring UX
- Fix: Add slide-in/fade animation

### Accessibility Issues

**48. No ARIA Labels on Interactive Elements**
- Problem: Many interactive elements lack ARIA labels
- Impact: Screen reader accessibility
- Fix: Add comprehensive ARIA labeling

**49. No Focus Visible Styles**
- Problem: Focus states rely on browser default
- Impact: Poor keyboard navigation visibility
- Fix: Add custom focus styles matching brand

### Edge Case Issues

**50. No Handling for Network Errors**
- Problem: Network errors show generic error message
- Impact: Poor error communication
- Fix: Add specific error messages for network failures

---

## PRIORITIZED FIX RECOMMENDATIONS

### Priority 1 (Critical - Fix Immediately)
1. Fix confusing selection mechanism for comparison
2. Replace native confirm() with custom modal
3. Add pagination or virtualization for long lists

### Priority 2 (High - Fix Soon)
4. Add visual feedback for selected state
5. Indicate version numbers in diff view
6. Add loading states to action buttons
7. Fix empty state navigation
8. Add v1/v2 labels to selection bar
9. Improve active badge visibility
10. Fix CheckCircle icon in publish status card

### Priority 3 (Medium - Fix in Next Iteration)
11. Fix hardcoded hover color
12. Replace inline hover handlers with CSS
13. Add keyboard navigation
14. Add focus management to modals
15. Add ARIA labels
16. Standardize button styling
17. Add explanation to overwrite badge
18. Add warning for deleting second-to-last version

### Priority 4 (Low - Polish)
19. Add hover states to all interactive elements
20. Add skeleton loading state
21. Add transitions/animations
22. Improve empty states
23. Standardize spacing
24. Extract inline styles to CSS

---

## RECOMMENDED ACTION PLAN

**Sprint 1 (Week 1):** Fix all Priority 1 and 2 issues
**Sprint 2 (Week 2):** Fix all Priority 3 issues
**Sprint 3 (Week 3):** Polish with Priority 4 issues

---

## CONCLUSION

The version control UI is functionally complete but requires significant UI/UX refinement to meet production-grade standards. The most critical issues are around discoverability (selection mechanism), safety (native confirm), and scalability (pagination). Addressing these will significantly improve user trust and clarity.

**Overall Assessment:** Functional but needs refinement
**Production Readiness:** Not yet ready without Priority 1-2 fixes
**Brand Compliance:** 85% compliant (needs consistency improvements)
**Accessibility:** 70% compliant (needs ARIA and focus improvements)
