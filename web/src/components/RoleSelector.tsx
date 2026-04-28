import React from 'react';
import { X, Check } from 'lucide-react';
import { ROLE_DISPLAY_NAMES, type UserRole } from '../types/database';
import './RoleSelector.css';

interface RoleSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    currentRole: UserRole | null;
    availableRoles: UserRole[];
    onRoleSelect: (role: UserRole) => void;
}

const RoleSelector: React.FC<RoleSelectorProps> = ({
    isOpen,
    onClose,
    currentRole,
    availableRoles,
    onRoleSelect,
}) => {
    if (!isOpen) return null;

    return (
        <div className="role-selector-overlay" onClick={onClose}>
            <div className="role-selector-modal" onClick={(e) => e.stopPropagation()}>
                <div className="role-selector-header">
                    <h3>Select Role</h3>
                    <button className="role-selector-close" onClick={onClose} aria-label="Close">
                        <X size={20} />
                    </button>
                </div>
                <div className="role-selector-content">
                    <p className="role-selector-description">
                        Choose which role to use. The sidebar and dashboard will update based on your selection.
                    </p>
                    <div className="role-selector-list">
                        {availableRoles.map((role) => (
                            <button
                                key={role}
                                className={`role-selector-item ${currentRole === role ? 'role-selector-item-active' : ''}`}
                                onClick={() => onRoleSelect(role)}
                                aria-label={`Switch to ${ROLE_DISPLAY_NAMES[role] || role}`}
                            >
                                <span className="role-selector-item-name">
                                    {ROLE_DISPLAY_NAMES[role] || role}
                                </span>
                                {currentRole === role && (
                                    <Check size={18} className="role-selector-item-check" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoleSelector;
