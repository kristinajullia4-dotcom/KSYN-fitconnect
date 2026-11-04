/**
 * KSYN FitConnect - Universal User Display Name Resolution
 * Eliminates raw database slugs, email handles, and trailing digits across all roles.
 */
export function formatUserDisplayName(user) {
  if (!user) return 'User';
  if (user.first_name && typeof user.first_name === 'string' && user.first_name.trim()) {
    return user.first_name.trim();
  }
  if (user.full_name && typeof user.full_name === 'string' && user.full_name.trim()) {
    const first = user.full_name.replace(/\s*\([^\)]*\)\s*/g, '').trim().split(' ')[0];
    if (first && !/^[0-9_.-]+$/.test(first)) return first;
  }
  if (user.name && typeof user.name === 'string' && user.name.trim()) {
    let clean = user.name.replace(/\s*\([^\)]*\)\s*/g, '').trim();
    if (clean.toLowerCase().startsWith('coach ')) {
      clean = clean.slice(6).trim();
    }
    const first = clean.split(' ')[0];
    if (first && !/[0-9]/.test(first)) {
      return first.charAt(0).toUpperCase() + first.slice(1);
    }
    const stripped = first.replace(/[0-9_.-]+$/, '');
    if (stripped) {
      if (stripped.includes('_')) {
        const parts = stripped.split('_').filter(Boolean);
        const namePart = parts.find(p => p.length > 2) || parts[0];
        return namePart.charAt(0).toUpperCase() + namePart.slice(1);
      }
      return stripped.charAt(0).toUpperCase() + stripped.slice(1);
    }
  }
  // Fallback: Strip trailing numeric digits and underscores from username/email handle
  const raw = (user.username || user.email || 'User').split('@')[0];
  const cleaned = raw.replace(/[0-9_.-]+$/, '');
  if (cleaned.includes('_')) {
    const parts = cleaned.split('_').filter(Boolean);
    const namePart = parts.find(p => p.length > 2) || parts[0];
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  }
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : 'User';
}

export function formatRoleGreeting(user) {
  if (!user) return 'Welcome back, User';
  const role = (user.role || '').toLowerCase();
  const name = formatUserDisplayName(user);
  if (role === 'coach' || role === 'trainer') {
    return `Welcome back, Coach ${name}`;
  }
  return `Welcome back, ${name}`;
}
