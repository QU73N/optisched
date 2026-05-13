/**
 * Authentication System Verification Utility
 * 
 * This script performs comprehensive verification of the authentication system
 * including checks for user synchronization, email confirmation, RLS policies, etc.
 * 
 * Usage:
 * 1. Place this file in web/src/utils/
 * 2. Import and call: await verifyAuthSystem()
 * 3. Review console output for issues
 */

import { supabase } from '../lib/supabase';

interface VerificationResult {
    check: string;
    passed: boolean;
    message: string;
    severity: 'critical' | 'warning' | 'info';
    details?: Record<string, any>;
}

interface AuthAuditReport {
    timestamp: string;
    checks: VerificationResult[];
    summary: {
        totalChecks: number;
        passed: number;
        failed: number;
        warnings: number;
        criticalIssues: number;
    };
    status: 'healthy' | 'warning' | 'critical';
}

/**
 * Main verification function - runs all checks
 */
export async function verifyAuthSystem(): Promise<AuthAuditReport> {
    console.log('🔍 Starting Authentication System Verification...');
    console.log('=' .repeat(60));

    const checks: VerificationResult[] = [];
    const startTime = performance.now();

    // Check 1: Supabase Configuration
    checks.push(await checkSupabaseConfig());

    // Check 2: Database Connection
    checks.push(await checkDatabaseConnection());

    // Check 3: Current User Session
    checks.push(await checkCurrentSession());

    // Check 4: Profiles Table
    checks.push(await checkProfilesTable());

    // Check 5: Auth Users
    checks.push(await checkAuthUsers());

    // Check 6: Auth/Profile Synchronization
    checks.push(await checkAuthProfileSync());

    // Check 7: Email Confirmation Status
    checks.push(await checkEmailConfirmation());

    // Check 8: RLS Policies
    checks.push(await checkRLSPolicies());

    // Check 9: Profile Read Permission
    checks.push(await checkProfileReadPermission());

    // Check 10: Role Data Integrity
    checks.push(await checkRoleData());

    // Check 11: Trigger Status
    checks.push(await checkTriggerStatus());

    // Check 12: Duplicate Detection
    checks.push(await checkDuplicateEmails());

    // Compile summary
    const summary = generateSummary(checks);
    const endTime = performance.now();

    const report: AuthAuditReport = {
        timestamp: new Date().toISOString(),
        checks,
        summary,
        status: summary.criticalIssues > 0 ? 'critical' : summary.warnings > 0 ? 'warning' : 'healthy',
    };

    // Print report
    printReport(report, endTime - startTime);

    return report;
}

// ============================================================================
// Individual Check Functions
// ============================================================================

async function checkSupabaseConfig(): Promise<VerificationResult> {
    try {
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const passed = !!(url && key && url.includes('supabase.co'));

        return {
            check: 'Supabase Configuration',
            passed,
            message: passed 
                ? '✅ Supabase URL and Anonymous Key are configured' 
                : '❌ Missing or invalid Supabase configuration',
            severity: 'critical',
            details: {
                hasUrl: !!url,
                hasKey: !!key,
                isValidUrl: url?.includes('supabase.co') ?? false,
            },
        };
    } catch (error) {
        return {
            check: 'Supabase Configuration',
            passed: false,
            message: `❌ Error checking configuration: ${(error as Error).message}`,
            severity: 'critical',
        };
    }
}

async function checkDatabaseConnection(): Promise<VerificationResult> {
    try {
        const { error } = await supabase
            .from('profiles')
            .select('count', { count: 'exact', head: true })
            .limit(1);

        const passed = !error;

        return {
            check: 'Database Connection',
            passed,
            message: passed 
                ? '✅ Database connection is working' 
                : `❌ Database connection failed: ${error?.message}`,
            severity: 'critical',
        };
    } catch (error) {
        return {
            check: 'Database Connection',
            passed: false,
            message: `❌ Error connecting to database: ${(error as Error).message}`,
            severity: 'critical',
        };
    }
}

async function checkCurrentSession(): Promise<VerificationResult> {
    try {
        const { data: { session } } = await supabase.auth.getSession();

        const passed = !!session;

        return {
            check: 'Current User Session',
            passed,
            message: passed 
                ? `✅ User is logged in as: ${session?.user.email}` 
                : '⚠️  No active session (run this after logging in)',
            severity: 'info',
            details: {
                isAuthenticated: !!session,
                email: session?.user.email,
                userId: session?.user.id,
            },
        };
    } catch (error) {
        return {
            check: 'Current User Session',
            passed: false,
            message: `❌ Error checking session: ${(error as Error).message}`,
            severity: 'critical',
        };
    }
}

async function checkProfilesTable(): Promise<VerificationResult> {
    try {
        const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });

        const passed = !error && count !== null && count > 0;

        return {
            check: 'Profiles Table',
            passed,
            message: passed 
                ? `✅ Profiles table has ${count} records` 
                : `❌ Profiles table error: ${error?.message}`,
            severity: passed ? 'info' : 'critical',
            details: { recordCount: count },
        };
    } catch (error) {
        return {
            check: 'Profiles Table',
            passed: false,
            message: `❌ Error accessing profiles table: ${(error as Error).message}`,
            severity: 'critical',
        };
    }
}

async function checkAuthUsers(): Promise<VerificationResult> {
    try {
        // This can only be checked if user is admin with direct database access
        // For now, we'll try to read from profiles table stats
        const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .not('id', 'is', null)
            .limit(5);

        const passed = !error && !!data;

        return {
            check: 'Auth Users System',
            passed,
            message: passed 
                ? '✅ Auth system is accessible' 
                : `❌ Auth system check failed: ${error?.message}`,
            severity: 'critical',
        };
    } catch (error) {
        return {
            check: 'Auth Users System',
            passed: false,
            message: `❌ Error checking auth system: ${(error as Error).message}`,
            severity: 'critical',
        };
    }
}

async function checkAuthProfileSync(): Promise<VerificationResult> {
    try {
        // Try to read own profile after confirming session exists
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return {
                check: 'Auth/Profile Synchronization',
                passed: false,
                message: '⚠️  Cannot check sync without active session',
                severity: 'warning',
            };
        }

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

        const passed = !error && !!profile;

        return {
            check: 'Auth/Profile Synchronization',
            passed,
            message: passed 
                ? `✅ Profile synced for logged-in user` 
                : `❌ Profile not found for auth user: ${error?.message}`,
            severity: 'critical',
            details: {
                userId: session.user.id,
                hasProfile: !!profile,
                profileRole: profile?.role,
            },
        };
    } catch (error) {
        return {
            check: 'Auth/Profile Synchronization',
            passed: false,
            message: `❌ Error checking sync: ${(error as Error).message}`,
            severity: 'critical',
        };
    }
}

async function checkEmailConfirmation(): Promise<VerificationResult> {
    try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return {
                check: 'Email Confirmation Status',
                passed: false,
                message: '⚠️  Cannot check without active session',
                severity: 'warning',
            };
        }

        const emailConfirmed = !!session.user.email_confirmed_at;

        return {
            check: 'Email Confirmation Status',
            passed: emailConfirmed,
            message: emailConfirmed 
                ? '✅ Email is confirmed for logged-in user' 
                : '❌ Email is NOT confirmed for logged-in user',
            severity: 'warning',
            details: {
                emailConfirmedAt: session.user.email_confirmed_at,
            },
        };
    } catch (error) {
        return {
            check: 'Email Confirmation Status',
            passed: false,
            message: `❌ Error checking email confirmation: ${(error as Error).message}`,
            severity: 'warning',
        };
    }
}

async function checkRLSPolicies(): Promise<VerificationResult> {
    try {
        // Try to select profiles - if RLS is broken, this might fail
        const { error } = await supabase
            .from('profiles')
            .select('id')
            .limit(1);

        // Note: Error might still happen due to RLS, but we can detect certain patterns
        const isRLSError = error?.message?.includes('row-level security') ?? false;

        return {
            check: 'RLS Policies (Profiles)',
            passed: !isRLSError,
            message: isRLSError 
                ? '❌ RLS Policy violation detected' 
                : '✅ RLS policies appear to be working',
            severity: isRLSError ? 'critical' : 'info',
            details: {
                hasRLSError: isRLSError,
                errorMessage: error?.message,
            },
        };
    } catch (error) {
        return {
            check: 'RLS Policies (Profiles)',
            passed: false,
            message: `❌ Error checking RLS: ${(error as Error).message}`,
            severity: 'warning',
        };
    }
}

async function checkProfileReadPermission(): Promise<VerificationResult> {
    try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return {
                check: 'Profile Read Permissions',
                passed: false,
                message: '⚠️  Cannot check without active session',
                severity: 'info',
            };
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        const passed = !error && !!data;

        return {
            check: 'Profile Read Permissions',
            passed,
            message: passed 
                ? '✅ Can read own profile' 
                : `❌ Cannot read own profile: ${error?.message}`,
            severity: 'critical',
        };
    } catch (error) {
        return {
            check: 'Profile Read Permissions',
            passed: false,
            message: `❌ Error checking read permissions: ${(error as Error).message}`,
            severity: 'critical',
        };
    }
}

async function checkRoleData(): Promise<VerificationResult> {
    try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return {
                check: 'Role Data Integrity',
                passed: false,
                message: '⚠️  Cannot check without active session',
                severity: 'info',
            };
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        const hasValidRole = profile?.role && 
            ['student', 'teacher', 'admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'].includes(profile.role);

        return {
            check: 'Role Data Integrity',
            passed: hasValidRole,
            message: hasValidRole 
                ? `✅ User has valid role: ${profile?.role}` 
                : `❌ Invalid or missing role: ${profile?.role}`,
            severity: 'critical',
            details: {
                role: profile?.role,
            },
        };
    } catch (error) {
        return {
            check: 'Role Data Integrity',
            passed: false,
            message: `❌ Error checking role data: ${(error as Error).message}`,
            severity: 'critical',
        };
    }
}

async function checkTriggerStatus(): Promise<VerificationResult> {
    // This is informational - we can't directly test triggers from client
    return {
        check: 'Trigger Status (handle_new_user)',
        passed: true,
        message: '⚠️  Trigger status can only be verified with database admin access',
        severity: 'info',
        details: {
            note: 'Run database audit script for full verification',
        },
    };
}

async function checkDuplicateEmails(): Promise<VerificationResult> {
    try {
        // We can't directly check duplicates from client due to RLS
        // This is informational
        return {
            check: 'Duplicate Email Detection',
            passed: true,
            message: '⚠️  Duplicate detection requires database admin access',
            severity: 'info',
            details: {
                note: 'Run database audit script for full verification',
            },
        };
    } catch (error) {
        return {
            check: 'Duplicate Email Detection',
            passed: false,
            message: `❌ Error checking duplicates: ${(error as Error).message}`,
            severity: 'warning',
        };
    }
}

// ============================================================================
// Reporting Functions
// ============================================================================

function generateSummary(checks: VerificationResult[]) {
    const totalChecks = checks.length;
    const passed = checks.filter(c => c.passed).length;
    const failed = checks.filter(c => !c.passed).length;
    const warnings = checks.filter(c => !c.passed && c.severity === 'warning').length;
    const criticalIssues = checks.filter(c => !c.passed && c.severity === 'critical').length;

    return {
        totalChecks,
        passed,
        failed,
        warnings,
        criticalIssues,
    };
}

function printReport(report: AuthAuditReport, duration: number) {
    console.log('\n' + '=' .repeat(60));
    console.log('📊 AUTHENTICATION SYSTEM VERIFICATION REPORT');
    console.log('=' .repeat(60));
    console.log(`\nTimestamp: ${report.timestamp}`);
    console.log(`Duration: ${duration.toFixed(2)}ms`);

    // Print summary
    console.log('\n📈 SUMMARY');
    console.log('-' .repeat(60));
    console.log(`Total Checks: ${report.summary.totalChecks}`);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`⚠️  Warnings: ${report.summary.warnings}`);
    console.log(`🔴 Critical Issues: ${report.summary.criticalIssues}`);
    console.log(`\nOverall Status: ${getStatusEmoji(report.status)} ${report.status.toUpperCase()}`);

    // Print detailed results
    console.log('\n📋 DETAILED RESULTS');
    console.log('-' .repeat(60));

    // Group by severity
    const bySeverity = {
        critical: report.checks.filter(c => c.severity === 'critical'),
        warning: report.checks.filter(c => c.severity === 'warning'),
        info: report.checks.filter(c => c.severity === 'info'),
    };

    if (bySeverity.critical.length > 0) {
        console.log('\n🔴 CRITICAL ISSUES:');
        bySeverity.critical.forEach(check => {
            console.log(`  ${check.passed ? '✅' : '❌'} ${check.check}`);
            console.log(`     ${check.message}`);
            if (check.details) {
                console.log(`     Details:`, check.details);
            }
        });
    }

    if (bySeverity.warning.length > 0) {
        console.log('\n⚠️  WARNINGS:');
        bySeverity.warning.forEach(check => {
            console.log(`  ${check.passed ? '✅' : '⚠️ '} ${check.check}`);
            console.log(`     ${check.message}`);
            if (check.details) {
                console.log(`     Details:`, check.details);
            }
        });
    }

    console.log('\nℹ️  INFORMATION:');
    bySeverity.info.forEach(check => {
        console.log(`  ℹ️  ${check.check}`);
        console.log(`     ${check.message}`);
        if (check.details) {
            console.log(`     Details:`, check.details);
        }
    });

    // Recommendations
    if (report.status === 'critical') {
        console.log('\n🚨 RECOMMENDATIONS:');
        console.log('  1. Login is likely NOT WORKING due to critical issues');
        console.log('  2. Run database audit: database/supabase/user_integrity_audit.sql');
        console.log('  3. Apply fixes: database/supabase/fix_user_integrity.sql');
        console.log('  4. Re-run this verification after applying fixes');
    } else if (report.status === 'warning') {
        console.log('\n📌 RECOMMENDATIONS:');
        console.log('  1. Login may have issues - review warnings above');
        console.log('  2. Run database audit for more detailed information');
        console.log('  3. Check that RLS policies are correctly configured');
    } else {
        console.log('\n✅ SYSTEM APPEARS TO BE HEALTHY');
        console.log('  If login is still not working, check:');
        console.log('  1. Correct email address and password');
        console.log('  2. Browser console for JavaScript errors');
        console.log('  3. Network tab for HTTP errors');
    }

    console.log('\n' + '=' .repeat(60));
}

function getStatusEmoji(status: string): string {
    switch (status) {
        case 'healthy':
            return '✅';
        case 'warning':
            return '⚠️';
        case 'critical':
            return '🔴';
        default:
            return '❓';
    }
}

// Export for testing
export type { VerificationResult, AuthAuditReport };
