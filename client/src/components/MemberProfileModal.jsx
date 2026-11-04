import React from 'react';
import { createPortal } from 'react-dom';
import { User, Phone, Mail, MapPin, AlertCircle, Dumbbell, CreditCard, CheckCircle2 } from 'lucide-react';

export default function MemberProfileModal({ member, onClose }) {
  if (!member) return null;

  const cleanName = (member.name || 'Athlete Member').replace(/\s*\((?:Active\s+)?Member\)/gi, '').trim();
  const address = member.address || member.residential_address || 'No residential address on file';
  const emergencyName = member.emergency_contact_name || member.emergency_contact || 'No emergency contact specified';
  const emergencyPhone = member.emergency_contact_phone || member.emergency_phone || 'No emergency phone on file';
  const emergencyRelation = member.emergency_contact_relationship || '';
  const fitnessGoal = member.fitness_goal || member.primary_fitness_goal || 'Athletic Conditioning & Hypertrophy';
  const rfidUid = member.rfid_card_uid || member.keycard_uid || member.rfid || 'KS-8829-4102';
  const planName = member.plan_name || member.membership_plan || member.subscription?.plan || '1 Month Pro Pass';
  const tierName = member.membership_tier || member.subscription?.tier || 'basic';
  const isElite = tierName === 'elite' || planName.includes('12');
  const isPro = tierName === 'pro' || planName.includes('6') || planName.includes('3');
  const subEnd = member.subscription?.end_date ? new Date(member.subscription.end_date).toLocaleDateString() : 'Active Contract';

  // Calculate completeness
  const checks = [
    Boolean(member.name && member.name.trim()),
    Boolean(member.email && member.email.trim()),
    Boolean(member.phone && member.phone.trim()),
    Boolean(member.address || member.residential_address),
    Boolean(member.emergency_contact_name || member.emergency_contact),
    Boolean(member.emergency_contact_phone || member.emergency_phone),
    Boolean(member.fitness_goal || member.primary_fitness_goal)
  ];
  const filledCount = checks.filter(Boolean).length;
  const completionPct = member.profile_completion_percentage !== undefined 
    ? member.profile_completion_percentage 
    : Math.round((filledCount / checks.length) * 100);
  const isComplete = completionPct === 100;

  const modalContent = (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999999,
        background: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div 
        className="ksyn-card relative w-full max-w-xl rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#161924',
          border: '1px solid rgba(225, 194, 86, 0.25)',
          boxShadow: '0 25px 60px -15px rgba(0,0,0,0.9), 0 0 25px rgba(225, 194, 86, 0.08)',
          color: '#ffffff',
          position: 'relative',
          zIndex: 10000000
        }}
      >
        {/* Header Profile Area with Clean Spacing & Removed Collapsing X */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '16px',
          borderBottom: '1px solid #2a3245',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0, flex: 1 }}>
            <div 
              style={{
                width: '48px',
                height: '48px',
                minWidth: '48px',
                minHeight: '48px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '1.125rem',
                color: '#000000',
                marginRight: '8px',
                flexShrink: 0,
                background: isElite
                  ? 'linear-gradient(135deg, #e1c256 0%, #cbaa42 100%)'
                  : (isPro ? 'linear-gradient(135deg, #f7ffc4 0%, #7c3aed 100%)' : '#e1c256'),
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
            >
              {(cleanName || 'M').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{
                  fontSize: '1.25rem',
                  fontWeight: 900,
                  color: '#ffffff',
                  margin: 0,
                  letterSpacing: '-0.02em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {cleanName}
                </h2>
                <span style={{
                  fontSize: '0.625rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: isElite ? 'rgba(254, 243, 199, 0.15)' : 'rgba(167, 243, 208, 0.15)',
                  color: isElite ? '#fef08a' : '#a7f3d0',
                  border: `1px solid ${isElite ? 'rgba(253, 224, 71, 0.35)' : 'rgba(110, 231, 183, 0.35)'}`
                }}>
                  {member.status || 'Active Member'}
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {member.branch_name || 'KSYN Flagship'} &bull; ID: <span className="font-mono text-gray-300">{member.id?.slice(0, 16)}...</span>
              </p>
            </div>
          </div>
        </div>

        {/* Profile Completion Classification Banner - Completely removed once 100% complete */}
        {!isComplete && (
          <div style={{
            background: 'rgba(254, 243, 199, 0.06)',
            border: '1px solid rgba(251, 191, 36, 0.25)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '14px'
          }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: 'rgba(254, 243, 199, 0.18)',
                  color: '#fef08a',
                  border: '1px solid rgba(251, 191, 36, 0.35)'
                }}>
                  {completionPct}% Information Completed
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fde047' }}>
                  Requires Address & Emergency Contact
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-gray-400">{filledCount}/7 Fields</span>
            </div>

            <div style={{ width: '100%', height: '6px', background: '#202636', borderRadius: '999px', overflow: 'hidden' }}>
              <div 
                style={{
                  width: `${completionPct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #fde68a 0%, #fbbf24 100%)',
                  borderRadius: '999px',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
          </div>
        )}

        {/* 2-Column Info Grid - Pastel Accents */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {/* Contact & Residential Address (Soft Pastel Slate/Blue) */}
          <div style={{
            background: 'rgba(147, 197, 253, 0.05)',
            border: '1px solid rgba(147, 197, 253, 0.18)',
            borderRadius: '10px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={13} /> Contact & Residential Address
            </div>

            <div>
              <span style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>Registered Email</span>
              <span style={{ fontSize: '0.8125rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', wordBreak: 'break-all' }}>
                <Mail size={12} className="text-gray-400 flex-shrink-0" /> {member.email || 'None on file'}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>Mobile Phone</span>
              <span style={{ fontSize: '0.8125rem', color: '#ffffff', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <Phone size={12} className="text-gray-400 flex-shrink-0" /> {member.phone || 'None on file'}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>Residential Address</span>
              <span style={{
                fontSize: '0.75rem',
                color: address !== 'No residential address on file' ? '#e2e8f0' : '#fca5a5',
                display: 'block',
                marginTop: '4px',
                lineHeight: 1.4,
                background: address !== 'No residential address on file' ? 'rgba(167, 243, 208, 0.06)' : 'rgba(254, 202, 202, 0.12)',
                padding: '7px 11px',
                borderRadius: '6px',
                border: address !== 'No residential address on file' ? '1px solid rgba(110, 231, 183, 0.3)' : '1.5px solid rgba(248, 113, 113, 0.55)',
                fontWeight: address !== 'No residential address on file' ? 500 : 700
              }}>
                {address}
              </span>
            </div>
          </div>

          {/* Emergency Safety Protocol (Soft Pastel Rose) */}
          <div style={{
            background: 'rgba(254, 202, 202, 0.05)',
            border: '1px solid rgba(254, 202, 202, 0.20)',
            borderRadius: '10px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={13} /> Emergency Protocol
            </div>

            <div>
              <span style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>Contact Person & Relation</span>
              <span style={{
                fontSize: '0.75rem',
                color: emergencyName !== 'No emergency contact specified' ? '#e2e8f0' : '#fca5a5',
                display: 'block',
                marginTop: '4px',
                background: emergencyName !== 'No emergency contact specified' ? 'rgba(167, 243, 208, 0.06)' : 'rgba(254, 202, 202, 0.12)',
                padding: '7px 11px',
                borderRadius: '6px',
                border: emergencyName !== 'No emergency contact specified' ? '1px solid rgba(110, 231, 183, 0.3)' : '1.5px solid rgba(248, 113, 113, 0.55)',
                fontWeight: emergencyName !== 'No emergency contact specified' ? 500 : 700
              }}>
                {emergencyName} {emergencyRelation ? `(${emergencyRelation})` : ''}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>Emergency Phone</span>
              <span style={{
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: emergencyPhone !== 'No emergency phone on file' ? '#e2e8f0' : '#fca5a5',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '4px',
                background: emergencyPhone !== 'No emergency phone on file' ? 'rgba(167, 243, 208, 0.06)' : 'rgba(254, 202, 202, 0.12)',
                padding: '7px 11px',
                borderRadius: '6px',
                border: emergencyPhone !== 'No emergency phone on file' ? '1px solid rgba(110, 231, 183, 0.3)' : '1.5px solid rgba(248, 113, 113, 0.55)',
                fontWeight: emergencyPhone !== 'No emergency phone on file' ? 500 : 700
              }}>
                <Phone size={12} className={emergencyPhone !== 'No emergency phone on file' ? "text-emerald-400 flex-shrink-0" : "text-red-400 flex-shrink-0"} /> {emergencyPhone}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>Primary Fitness Goal</span>
              <span style={{ fontSize: '0.75rem', color: '#fde047', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <Dumbbell size={12} className="text-yellow-400 flex-shrink-0" /> {fitnessGoal}
              </span>
            </div>
          </div>
        </div>

        {/* Turnstile Access & Membership Details - Soft Pastel Amber */}
        <div style={{
          background: 'rgba(225, 194, 86, 0.05)',
          border: '1px solid rgba(225, 194, 86, 0.20)',
          borderRadius: '10px',
          padding: '10px 14px',
          marginBottom: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', background: 'rgba(225, 194, 86, 0.12)', border: '1px solid rgba(225, 194, 86, 0.3)', borderRadius: '8px', color: '#e1c256' }}>
              <CreditCard size={18} />
            </div>
            <div>
              <span style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>Contract Plan & Tier</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase' }}>{planName}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.72rem' }}>
            <div>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.625rem' }}>Valid Until</span>
              <span className="mono" style={{ color: '#ffffff', fontWeight: 700 }}>{subEnd}</span>
            </div>
            <div>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.625rem' }}>RFID Keycard</span>
              <span className="mono" style={{ color: '#e1c256', fontWeight: 700 }}>{rfidUid}</span>
            </div>
            <div>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.625rem' }}>Lifetime Scans</span>
              <span className="mono" style={{ color: '#a7f3d0', fontWeight: 800, textAlign: 'center', display: 'block' }}>{member.total_check_ins || 0}</span>
            </div>
          </div>
        </div>

        {/* Personal Training Package & Completed Workouts Section (Requirement 5) */}
        {member.is_pt_enrolled && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08), rgba(22, 25, 36, 0.95))',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: '12px',
            padding: '14px',
            marginBottom: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' }}>
                  <Dumbbell size={16} />
                </div>
                <div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    Personal Training Package ({member.pt_sessions_completed || 0} / {member.pt_sessions_total || 12} Completed)
                  </h4>
                  <p style={{ fontSize: '0.72rem', color: '#cbd5e1', margin: '2px 0 0' }}>
                    {member.pt_package_name || '12-Session Signature PT Package'} &bull; Coach: <strong style={{ color: '#c084fc' }}>{member.pt_coach_name || 'Assigned Coach'}</strong>
                  </p>
                </div>
              </div>
              <span style={{
                fontSize: '0.6875rem',
                fontWeight: 800,
                color: '#c084fc',
                background: 'rgba(168, 85, 247, 0.15)',
                padding: '3px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(168, 85, 247, 0.35)'
              }}>
                {member.pt_sessions_remaining || 0} Sessions Remaining
              </span>
            </div>

            {/* Progress bar */}
            <div style={{ width: '100%', height: '6px', background: '#1e2433', borderRadius: '999px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{
                width: `${Math.min(100, Math.round(((member.pt_sessions_completed || 0) / (member.pt_sessions_total || 12)) * 100))}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #c084fc 0%, #a855f7 100%)',
                borderRadius: '999px'
              }} />
            </div>

            {/* Finished Workouts List */}
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.04em', marginBottom: '6px' }}>
                Completed Workout Logs ({(member.pt_completed_workouts || []).length}):
              </div>

              {(!member.pt_completed_workouts || member.pt_completed_workouts.length === 0) ? (
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                  No sessions logged yet. Ready for Session #1 (Movement Assessment & Target Programming).
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                  {member.pt_completed_workouts.map((w, idx) => (
                    <div
                      key={w.id || idx}
                      style={{
                        background: '#10131c',
                        border: '1px solid #252c3d',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.75rem'
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 800, color: '#e1c256' }}>Session #{w.session_number || idx + 1}:</span>
                          <span style={{ fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {w.workout_title || w.focus_area}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '2px' }}>
                          Coach: {w.coach_name} &bull; {new Date(w.session_date).toLocaleDateString()} ({w.duration_mins || 60}m)
                          {Array.isArray(w.exercise_list) && w.exercise_list.length > 0 && (
                            <span style={{ color: '#cbd5e1' }}> &bull; {w.exercise_list.map(ex => ex.name || ex).join(', ')}</span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#34d399', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                        VERIFIED
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Action */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="ksyn-btn ksyn-btn-gold"
            style={{
              padding: '8px 20px',
              fontSize: '0.75rem',
              fontWeight: 800,
              borderRadius: '8px'
            }}
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
