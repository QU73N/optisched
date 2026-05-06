// SystemRules - Permission Rules Engine editor.
// 3-tier overrides: global > role override > per-user override.
// Power Admin and System Admin can edit (System Admin cannot edit Power Admin's per-user overrides).

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePermissions, ROLE_RANK } from '../../hooks/usePermissions';
import { logAudit } from '../../hooks/useActivityLogger';
import { ROLE_DISPLAY_NAMES, type UserRole } from '../../types/database';
import {
    Shield, Save, Loader2, Search, AlertCircle,
    Users, User, Globe, ChevronDown, ChevronRight, Lock
} from 'lucide-react';
import './Dashboard.css';
import './SystemRules.css';

interface RuleRow {
    rule_key: string;
    rule_value: unknown;
    description: string | null;
    category: string;
    role_overrides: Record<string, unknown>;
    updated_at: string;
}
interface ProfileLite {
    id: string;
    full_name: string;
    email: string;
    role: string;
}
interface UserOverrideRow {
    id: string;
    user_id: string;
    rule_key: string;
    rule_value: unknown;
    reason: string | null;
    expires_at: string | null;
    profile?: ProfileLite | null;
}

const ROLES_FOR_OVERRIDES: UserRole[] = [
    'system_admin', 'schedule_admin', 'schedule_manager', 'teacher', 'student'
];

const SystemRules: React.FC = () => {
    const perms = usePermissions();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [rules, setRules] = useState<RuleRow[]>([]);
    const [filter, setFilter] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [expandedRule, setExpandedRule] = useState<string | null>(null);
    const [userOverrides, setUserOverrides] = useState<UserOverrideRow[]>([]);
    const [users, setUsers] = useState<ProfileLite[]>([]);
    const [overrideUserId, setOverrideUserId] = useState('');
    const [overrideValue, setOverrideValue] = useState('');
    const [overrideReason, setOverrideReason] = useState('');
    const [overrideExpiresAt, setOverrideExpiresAt] = useState('');
    const [institutionName, setInstitutionName] = useState('');

    useEffect(() => {
        const run = async () => {
            try {
                const [{ data: rulesData }, { data: usersData }, { data: overridesData }] = await Promise.all([
                    supabase.from('system_rules').select('*').order('category').order('rule_key'),
                    supabase.from('profiles').select('id, full_name, email, role').order('full_name'),
                    supabase.from('user_permission_overrides')
                        .select('id, user_id, rule_key, rule_value, reason, expires_at, profile:profiles(id, full_name, email, role)')
                        .order('created_at', { ascending: false }),
                ]);
                setRules((rulesData || []) as RuleRow[]);
                setUsers((usersData || []) as ProfileLite[]);
                setUserOverrides(((overridesData || []) as unknown) as UserOverrideRow[]);
                
                // Load institution name
                const instRule = (rulesData || []).find((r: RuleRow) => r.rule_key === 'institution_name');
                if (instRule) {
                    setInstitutionName(formatValue(instRule.rule_value));
                }
            } catch (err) {
                console.error('[SystemRules] load failed', err);
            } finally {
                setLoading(false);
            }
        };
        run();
    }, []);

    const categories = useMemo(() => {
        const set = new Set<string>(['all']);
        rules.forEach(r => set.add(r.category));
        return Array.from(set);
    }, [rules]);

    const filteredRules = useMemo(() => {
        const q = filter.trim().toLowerCase();
        return rules.filter(r => {
            if (activeCategory !== 'all' && r.category !== activeCategory) return false;
            if (!q) return true;
            return r.rule_key.toLowerCase().includes(q)
                || (r.description || '').toLowerCase().includes(q);
        });
    }, [rules, filter, activeCategory]);

    const formatValue = (v: unknown): string => {
        if (v === null || v === undefined) return 'null';
        if (typeof v === 'boolean') return String(v);
        if (typeof v === 'number') return String(v);
        if (typeof v === 'string') return v;
        return JSON.stringify(v);
    };

    const parseValue = (input: string, original: unknown): unknown => {
        const trimmed = input.trim();
        if (typeof original === 'boolean' || trimmed === 'true' || trimmed === 'false') {
            return trimmed === 'true';
        }
        if (typeof original === 'number' || /^-?\d+(\.\d+)?$/.test(trimmed)) {
            const n = Number(trimmed);
            if (!isNaN(n)) return n;
        }
        try { return JSON.parse(trimmed); } catch { return trimmed; }
    };

    const updateGlobalRule = async (key: string, newValue: unknown) => {
        setSaving(key);
        try {
            const { error } = await supabase
                .from('system_rules')
                .update({ rule_value: newValue, updated_by: perms.profile?.id, updated_at: new Date().toISOString() })
                .eq('rule_key', key);
            if (error) throw error;
            setRules(prev => prev.map(r => r.rule_key === key ? { ...r, rule_value: newValue } : r));
            await logAudit('rule.global.update', 'system_rules', null, { rule_key: key, new_value: newValue });
        } catch (err) {
            console.error('[SystemRules] update global failed', err);
            alert('Failed to update rule. Check console.');
        } finally {
            setSaving(null);
        }
    };

    const updateRoleOverride = async (key: string, role: string, newValue: unknown | null) => {
        setSaving(`${key}:${role}`);
        try {
            const rule = rules.find(r => r.rule_key === key);
            if (!rule) return;
            const overrides = { ...rule.role_overrides };
            if (newValue === null) delete overrides[role];
            else overrides[role] = newValue;
            const { error } = await supabase
                .from('system_rules')
                .update({ role_overrides: overrides, updated_by: perms.profile?.id })
                .eq('rule_key', key);
            if (error) throw error;
            setRules(prev => prev.map(r => r.rule_key === key ? { ...r, role_overrides: overrides } : r));
            await logAudit('rule.role.update', 'system_rules', null, { rule_key: key, role, new_value: newValue });
        } catch (err) {
            console.error('[SystemRules] role override failed', err);
            alert('Failed to update role override.');
        } finally {
            setSaving(null);
        }
    };

    const addUserOverride = async (key: string) => {
        if (!overrideUserId || !overrideValue.trim()) {
            alert('Pick a user and provide a value.');
            return;
        }
        const target = users.find(u => u.id === overrideUserId);
        if (!target) { alert('User not found.'); return; }
        // hierarchy guard (UI side; SQL also enforces)
        if ((ROLE_RANK[target.role] ?? 0) >= perms.myRank) {
            alert('You cannot set per-user overrides on a user of equal or higher rank.');
            return;
        }
        setSaving(`user:${key}`);
        try {
            const rule = rules.find(r => r.rule_key === key);
            const parsed = parseValue(overrideValue, rule?.rule_value);
            const { error } = await supabase
                .from('user_permission_overrides')
                .upsert({
                    user_id: overrideUserId,
                    rule_key: key,
                    rule_value: parsed,
                    reason: overrideReason || null,
                    expires_at: overrideExpiresAt || null,
                    set_by: perms.profile?.id,
                }, { onConflict: 'user_id,rule_key' });
            if (error) throw error;
            await logAudit('rule.user.set', 'user_permission_overrides', overrideUserId, {
                rule_key: key, value: parsed, reason: overrideReason, expires_at: overrideExpiresAt
            });
            // reload overrides
            const { data } = await supabase.from('user_permission_overrides')
                .select('id, user_id, rule_key, rule_value, reason, expires_at, profile:profiles(id, full_name, email, role)')
                .order('created_at', { ascending: false });
            setUserOverrides(((data || []) as unknown) as UserOverrideRow[]);
            setOverrideValue(''); setOverrideReason(''); setOverrideExpiresAt('');
        } catch (err) {
            console.error('[SystemRules] user override failed', err);
            alert('Failed to add user override.');
        } finally {
            setSaving(null);
        }
    };

    const removeUserOverride = async (overrideId: string) => {
        if (!confirm('Remove this per-user override?')) return;
        try {
            const { error } = await supabase
                .from('user_permission_overrides')
                .delete()
                .eq('id', overrideId);
            if (error) throw error;
            setUserOverrides(prev => prev.filter(o => o.id !== overrideId));
            await logAudit('rule.user.remove', 'user_permission_overrides', overrideId);
        } catch (err) {
            console.error('[SystemRules] remove failed', err);
            alert('Failed to remove override.');
        }
    };

    const editableUsers = useMemo(
        () => users.filter(u => (ROLE_RANK[u.role] ?? 0) < perms.myRank),
        [users, perms.myRank]
    );

    const updateInstitutionName = async (newName: string) => {
        setSaving('institution_name');
        try {
            const { error } = await supabase
                .from('system_rules')
                .update({ rule_value: newName, updated_at: new Date().toISOString() })
                .eq('rule_key', 'institution_name');
            if (error) throw error;
            setInstitutionName(newName);
            await logAudit('institution_name.update', 'system_rules', null, { new_name: newName });
        } catch (err) {
            console.error('[SystemRules] update institution name failed', err);
            alert('Failed to update institution name.');
        } finally {
            setSaving(null);
        }
    };

    if (!perms.isSystemAdmin) {
        return (
            <div className="dashboard">
                <div className="dash-empty"><Lock size={28} /><div>You do not have permission to view this page.</div></div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="dashboard">
                <div className="dash-loading-center"><Loader2 className="spin" size={28} /></div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1 className="dashboard-title"><Shield size={20} /> System Rules</h1>
                <p className="dashboard-subtitle">
                    Permission Rules Engine. Three tiers: <strong>Global</strong> · <strong>Role override</strong> · <strong>Per-user override</strong>.
                    Most-specific tier wins. All edits are audit-logged.
                </p>
            </div>

            {/* Institution Name Editor */}
            <div className="card" style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Globe size={14} /> Institution Name
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    The institution name is used in group chat names. Updating this will automatically update all group chat names.
                </p>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input
                        className="input"
                        value={institutionName}
                        onChange={(e) => setInstitutionName(e.target.value)}
                        placeholder="Enter institution name"
                        style={{ flex: 1, maxWidth: 400 }}
                    />
                    <button
                        className="btn btn-primary"
                        onClick={() => updateInstitutionName(institutionName)}
                        disabled={saving === 'institution_name'}
                    >
                        {saving === 'institution_name' ? <Loader2 className="spin" size={14} /> : <Save size={14} />} Save
                    </button>
                </div>
            </div>

            {/* Filter bar */}
            <div className="rules-toolbar">
                <div className="rules-search">
                    <Search size={14} />
                    <input
                        type="text"
                        placeholder="Filter rules…"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>
                <div className="rules-categories">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            className={`rules-category-pill ${activeCategory === cat ? 'rules-category-active' : ''}`}
                            onClick={() => setActiveCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Rule list */}
            <div className="rules-list">
                {filteredRules.length === 0 ? (
                    <div className="dash-empty"><AlertCircle size={28} /><div>No rules match your filter.</div></div>
                ) : filteredRules.map(rule => {
                    const expanded = expandedRule === rule.rule_key;
                    const ovs = userOverrides.filter(o => o.rule_key === rule.rule_key);
                    return (
                        <div key={rule.rule_key} className={`rule-card ${expanded ? 'rule-card-expanded' : ''}`}>
                            <button
                                className="rule-card-header"
                                onClick={() => setExpandedRule(expanded ? null : rule.rule_key)}
                                aria-expanded={expanded}
                            >
                                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <div className="rule-card-key">
                                    <code>{rule.rule_key}</code>
                                    <span className="rule-card-cat">{rule.category}</span>
                                </div>
                                <div className="rule-card-desc">{rule.description || 'None'}</div>
                                <div className="rule-card-current">
                                    <Globe size={12} /> {formatValue(rule.rule_value)}
                                </div>
                            </button>

                            {expanded && (
                                <div className="rule-card-body">
                                    {/* Global value */}
                                    <div className="rule-tier">
                                        <div className="rule-tier-label">
                                            <Globe size={12} /> Global default
                                            <span className="rule-tier-hint">applies to everyone unless overridden</span>
                                        </div>
                                        <div className="rule-tier-control">
                                            <input
                                                className="input"
                                                defaultValue={formatValue(rule.rule_value)}
                                                onBlur={(e) => {
                                                    const v = parseValue(e.target.value, rule.rule_value);
                                                    if (v !== rule.rule_value) updateGlobalRule(rule.rule_key, v);
                                                }}
                                            />
                                            {saving === rule.rule_key && <Loader2 className="spin" size={14} />}
                                        </div>
                                    </div>

                                    {/* Role overrides */}
                                    <div className="rule-tier">
                                        <div className="rule-tier-label">
                                            <Users size={12} /> Role overrides
                                            <span className="rule-tier-hint">applies to all users in that role</span>
                                        </div>
                                        <div className="rule-role-grid">
                                            {ROLES_FOR_OVERRIDES.map(role => {
                                                const v = rule.role_overrides?.[role];
                                                const has = v !== undefined && v !== null;
                                                return (
                                                    <div key={role} className="rule-role-item">
                                                        <label>{ROLE_DISPLAY_NAMES[role]}</label>
                                                        <div className="rule-role-control">
                                                            <input
                                                                className="input"
                                                                placeholder={`(uses global: ${formatValue(rule.rule_value)})`}
                                                                defaultValue={has ? formatValue(v) : ''}
                                                                onBlur={(e) => {
                                                                    const txt = e.target.value.trim();
                                                                    if (!txt) {
                                                                        if (has) updateRoleOverride(rule.rule_key, role, null);
                                                                    } else {
                                                                        const parsed = parseValue(txt, rule.rule_value);
                                                                        if (parsed !== v) updateRoleOverride(rule.rule_key, role, parsed);
                                                                    }
                                                                }}
                                                            />
                                                            {saving === `${rule.rule_key}:${role}` && <Loader2 className="spin" size={12} />}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Per-user overrides */}
                                    <div className="rule-tier">
                                        <div className="rule-tier-label">
                                            <User size={12} /> Per-user overrides
                                            <span className="rule-tier-hint">applies to a single user; can expire</span>
                                        </div>

                                        {ovs.length > 0 && (
                                            <div className="rule-user-list">
                                                {ovs.map(o => (
                                                    <div key={o.id} className="rule-user-row">
                                                        <strong>{o.profile?.full_name || 'Unknown'}</strong>
                                                        <code>{formatValue(o.rule_value)}</code>
                                                        {o.expires_at && (
                                                            <span className="rule-user-expires">
                                                                expires {new Date(o.expires_at).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                        {o.reason && <span className="rule-user-reason">{o.reason}</span>}
                                                        <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }}
                                                            onClick={() => removeUserOverride(o.id)}>Remove</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="rule-user-add">
                                            <select
                                                className="input"
                                                value={overrideUserId}
                                                onChange={(e) => setOverrideUserId(e.target.value)}
                                            >
                                                <option value="">Select user…</option>
                                                {editableUsers.map(u => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.full_name} · {ROLE_DISPLAY_NAMES[u.role as UserRole] || u.role}
                                                    </option>
                                                ))}
                                            </select>
                                            <input
                                                className="input"
                                                placeholder="Value"
                                                value={overrideValue}
                                                onChange={(e) => setOverrideValue(e.target.value)}
                                            />
                                            <input
                                                className="input"
                                                placeholder="Reason (optional)"
                                                value={overrideReason}
                                                onChange={(e) => setOverrideReason(e.target.value)}
                                            />
                                            <input
                                                className="input"
                                                type="date"
                                                value={overrideExpiresAt}
                                                onChange={(e) => setOverrideExpiresAt(e.target.value)}
                                            />
                                            <button className="btn btn-primary" onClick={() => addUserOverride(rule.rule_key)} disabled={saving === `user:${rule.rule_key}`}>
                                                {saving === `user:${rule.rule_key}` ? <Loader2 className="spin" size={14} /> : <Save size={14} />} Set
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SystemRules;
