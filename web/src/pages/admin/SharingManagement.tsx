import React, { useEffect, useState } from 'react';
import { Share2, Users, Lock, Globe, Check, X, Send } from 'lucide-react';
import '../admin/Dashboard.css';
import {
    shareResource,
    respondToSharingRequest,
    setResourcePublic,
    getIncomingSharingRequests,
    getOutgoingSharingRequests,
    getUsers
} from '../../services/sharingService';
import type { Teacher, Room, Subject, Section, SharingRequest, Profile } from '../../types/database';

type ResourceType = 'teacher' | 'room' | 'subject' | 'section';

const SharingManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing' | 'my-resources'>('incoming');
    const [incomingRequests, setIncomingRequests] = useState<(SharingRequest & { from_user?: Profile; to_user?: Profile })[]>([]);
    const [outgoingRequests, setOutgoingRequests] = useState<(SharingRequest & { from_user?: Profile; to_user?: Profile })[]>([]);
    const [myResources, setMyResources] = useState<(Teacher | Room | Subject | Section)[]>([]);
    const [users, setUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Share modal state
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareResourceType, setShareResourceType] = useState<ResourceType>('teacher');
    const [shareResourceId, setShareResourceId] = useState('');
    const [shareToUserId, setShareToUserId] = useState('');
    const [shareMessage, setShareMessage] = useState('');
    const [sharing, setSharing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [incoming, outgoing, userList] = await Promise.all([
                getIncomingSharingRequests(),
                getOutgoingSharingRequests(),
                getUsers()
            ]);
            setIncomingRequests(incoming);
            setOutgoingRequests(outgoing);
            setUsers(userList);
        } catch (error: unknown) {
            console.error('Error loading sharing data:', error);
            setMessage({ type: 'error', text: 'Failed to load sharing data' });
        }
        setLoading(false);
    };

    const getResourceName = (resource: Teacher | Room | Subject | Section): string => {
        if ('name' in resource) return resource.name;
        if ('profile' in resource && resource.profile) return resource.profile.full_name;
        return 'Unknown';
    };

    const loadMyResources = async (resourceType: ResourceType) => {
        try {
            const { getMySharedResources } = await import('../../services/sharingService');
            const resources = await getMySharedResources(resourceType);
            setMyResources(resources);
        } catch (error: unknown) {
            console.error('Error loading resources:', error);
        }
    };

    const handleShare = async () => {
        if (!shareToUserId) return;
        
        setSharing(true);
        setMessage(null);

        try {
            await shareResource(shareResourceType, shareResourceId, shareToUserId, shareMessage);
            setMessage({ type: 'success', text: 'Share request sent successfully' });
            setShowShareModal(false);
            setShareMessage('');
            await loadData();
        } catch (error: unknown) {
            console.error('Error sharing resource:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to share resource';
            setMessage({ type: 'error', text: errorMessage });
        }

        setSharing(false);
    };

    const handleRespond = async (requestId: string, status: 'approved' | 'rejected') => {
        try {
            await respondToSharingRequest(requestId, status);
            setMessage({ type: 'success', text: `Request ${status} successfully` });
            await loadData();
        } catch (error: unknown) {
            console.error('Error responding to request:', error);
            setMessage({ type: 'error', text: 'Failed to respond to request' });
        }
    };

    const handleTogglePublic = async (resourceType: ResourceType, resourceId: string, isPublic: boolean) => {
        try {
            await setResourcePublic(resourceType, resourceId, !isPublic);
            setMessage({ type: 'success', text: `Resource ${!isPublic ? 'made public' : 'made private'}` });
            await loadMyResources(resourceType);
        } catch (error: unknown) {
            console.error('Error toggling public status:', error);
            setMessage({ type: 'error', text: 'Failed to update public status' });
        }
    };

    if (loading) {
        return (
            <div className="dashboard fade-in">
                <div className="dashboard-header">
                    <div>
                        <h1 className="dashboard-title">Sharing & Collaboration</h1>
                        <p className="dashboard-subtitle">Manage resource sharing with other schedule managers</p>
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                    <div className="spinner" />
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Sharing & Collaboration</h1>
                    <p className="dashboard-subtitle">Manage resource sharing with other schedule managers</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowShareModal(true)}>
                    <Share2 size={16} />
                    Share Resource
                </button>
            </div>

            {message && (
                <div style={{
                    padding: 12,
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 24,
                    background: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
                    color: message.type === 'success' ? '#10b981' : '#ef4444',
                    fontSize: 14
                }}>
                    {message.text}
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: 4, border: '1px solid var(--border-default)' }}>
                <button
                    className={`btn ${activeTab === 'incoming' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1, borderRadius: 'var(--radius-sm)' }}
                    onClick={() => setActiveTab('incoming')}
                >
                    <Users size={16} />
                    Incoming Requests {incomingRequests.length > 0 && `(${incomingRequests.length})`}
                </button>
                <button
                    className={`btn ${activeTab === 'outgoing' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1, borderRadius: 'var(--radius-sm)' }}
                    onClick={() => setActiveTab('outgoing')}
                >
                    <Send size={16} />
                    Outgoing Requests
                </button>
                <button
                    className={`btn ${activeTab === 'my-resources' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1, borderRadius: 'var(--radius-sm)' }}
                    onClick={() => setActiveTab('my-resources')}
                >
                    <Lock size={16} />
                    My Resources
                </button>
            </div>

            {/* Incoming Requests */}
            {activeTab === 'incoming' && (
                <div className="dash-card" style={{ padding: 24 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Incoming Sharing Requests</h2>
                    {incomingRequests.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                            No pending sharing requests
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {incomingRequests.map(request => (
                                <div key={request.id} style={{ 
                                    padding: 16, 
                                    background: 'var(--bg-secondary)', 
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-default)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 14 }}>
                                                {request.from_user?.full_name || 'Unknown User'}
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                wants to share a {request.resource_type} with you
                                            </div>
                                        </div>
                                        <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
                                            PENDING
                                        </span>
                                    </div>
                                    {request.message && (
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, padding: 8, background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                                            "{request.message}"
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button 
                                            className="btn btn-primary" 
                                            style={{ fontSize: 13, padding: '6px 12px' }}
                                            onClick={() => handleRespond(request.id, 'approved')}
                                        >
                                            <Check size={14} />
                                            Accept
                                        </button>
                                        <button 
                                            className="btn btn-secondary" 
                                            style={{ fontSize: 13, padding: '6px 12px' }}
                                            onClick={() => handleRespond(request.id, 'rejected')}
                                        >
                                            <X size={14} />
                                            Decline
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Outgoing Requests */}
            {activeTab === 'outgoing' && (
                <div className="dash-card" style={{ padding: 24 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Outgoing Sharing Requests</h2>
                    {outgoingRequests.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                            No outgoing sharing requests
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {outgoingRequests.map(request => (
                                <div key={request.id} style={{ 
                                    padding: 16, 
                                    background: 'var(--bg-secondary)', 
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-default)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 14 }}>
                                                {request.to_user?.full_name || 'Unknown User'}
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                shared {request.resource_type} with you
                                            </div>
                                        </div>
                                        <span className="badge" style={{
                                            background: request.status === 'approved' ? 'rgba(16,185,129,0.15)' : 
                                                       request.status === 'rejected' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                                            color: request.status === 'approved' ? '#10b981' : 
                                                   request.status === 'rejected' ? '#ef4444' : '#fbbf24'
                                        }}>
                                            {request.status.toUpperCase()}
                                        </span>
                                    </div>
                                    {request.message && (
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: 8, background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                                            "{request.message}"
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* My Resources */}
            {activeTab === 'my-resources' && (
                <div className="dash-card" style={{ padding: 24 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>My Resources</h2>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, display: 'block' }}>Resource Type</label>
                        <select 
                            className="input" 
                            style={{ width: '100%', maxWidth: 300 }}
                            onChange={(e) => loadMyResources(e.target.value as ResourceType)}
                        >
                            <option value="">Select type...</option>
                            <option value="teacher">Teachers</option>
                            <option value="room">Rooms</option>
                            <option value="subject">Subjects</option>
                            <option value="section">Sections</option>
                        </select>
                    </div>
                    {myResources.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                            Select a resource type to view
                        </div>
                    ) : (
                        <div style={{ overflow: 'auto' }}>
                            <table style={{ width: '100%', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                                        <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Name</th>
                                        <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Visibility</th>
                                        <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Shared With</th>
                                        <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {myResources.map(resource => (
                                        <tr key={resource.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                            <td style={{ padding: 8, fontWeight: 500 }}>{getResourceName(resource)}</td>
                                            <td style={{ padding: 8 }}>
                                                <span className="badge" style={{
                                                    background: resource.is_public ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.15)',
                                                    color: resource.is_public ? '#10b981' : '#6b7280'
                                                }}>
                                                    {resource.is_public ? <Globe size={12} style={{ display: 'inline', marginRight: 4 }} /> : <Lock size={12} style={{ display: 'inline', marginRight: 4 }} />}
                                                    {resource.is_public ? 'Public' : 'Private'}
                                                </span>
                                            </td>
                                            <td style={{ padding: 8 }}>{resource.shared_with?.length || 0} users</td>
                                            <td style={{ padding: 8 }}>
                                                <button 
                                                    className="btn btn-ghost"
                                                    style={{ padding: 4 }}
                                                    onClick={() => handleTogglePublic(shareResourceType, resource.id, resource.is_public)}
                                                    title={resource.is_public ? 'Make private' : 'Make public'}
                                                >
                                                    {resource.is_public ? <Lock size={14} /> : <Globe size={14} />}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Share Modal */}
            {showShareModal && (
                <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
                    <div className="modal-content slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Share Resource</h2>
                            <button className="btn btn-ghost" onClick={() => setShowShareModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleShare(); }} className="modal-form">
                            <div className="field">
                                <label className="field-label">RESOURCE TYPE</label>
                                <select className="input" value={shareResourceType} onChange={(e) => setShareResourceType(e.target.value as ResourceType)}>
                                    <option value="teacher">Teacher</option>
                                    <option value="room">Room</option>
                                    <option value="subject">Subject</option>
                                    <option value="section">Section</option>
                                </select>
                            </div>
                            <div className="field">
                                <label className="field-label">RESOURCE ID</label>
                                <input className="input" required value={shareResourceId} onChange={(e) => setShareResourceId(e.target.value)} placeholder="Enter resource ID" />
                            </div>
                            <div className="field">
                                <label className="field-label">SHARE WITH</label>
                                <select className="input" required value={shareToUserId} onChange={(e) => setShareToUserId(e.target.value)}>
                                    <option value="">Select user...</option>
                                    {users.map(user => (
                                        <option key={user.id} value={user.id}>{user.full_name} ({user.email})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="field">
                                <label className="field-label">MESSAGE (OPTIONAL)</label>
                                <textarea className="input" rows={3} value={shareMessage} onChange={(e) => setShareMessage(e.target.value)} placeholder="Add a message explaining why you want to share..." />
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={sharing}>
                                {sharing ? 'Sending...' : 'Send Request'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SharingManagement;
