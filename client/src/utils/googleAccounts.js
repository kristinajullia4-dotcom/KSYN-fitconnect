/**
 * KSYN FitConnect - Google Account Manager
 * 
 * Persists and synchronizes verified Google / Gmail accounts for instant 1-click sign-in.
 */

export const DEFAULT_GOOGLE_ACCOUNTS = [
  {
    name: 'JULLIA KRISTINA MARQUEZ',
    email: 'jmarquez.k12150582@umak.edu.ph',
    avatarText: 'J',
    avatarBg: '#0f766e',
    status: 'Signed out'
  },
  {
    name: 'Kristina Jullia',
    email: 'kristinajullia4@gmail.com',
    avatarText: 'K',
    avatarBg: '#e1c256',
    status: 'Signed out'
  }
];

export function getAvatarColor(str = '') {
  const colors = [
    '#e1c256', // KSYN Gold
    '#0f766e', // Teal
    '#1a73e8', // Google Blue
    '#e53935', // Google Red
    '#8e24aa', // Purple
    '#43a047', // Google Green
    '#fb8c00', // Orange
    '#00acc1', // Cyan
    '#3949ab'  // Indigo
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function formatAccountName(name = '', email = '') {
  if (name && name.trim()) return name.trim();
  const handle = (email || '').split('@')[0] || 'Athlete';
  return handle
    .split(/[\._\-]/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function getSavedGoogleAccounts() {
  let list = [];
  try {
    const raw = localStorage.getItem('ksyn_saved_google_accounts');
    if (raw) {
      list = JSON.parse(raw);
    }
  } catch (err) {
    list = [];
  }

  if (!Array.isArray(list) || list.length === 0) {
    list = [...DEFAULT_GOOGLE_ACCOUNTS];
  }

  // Detect active logged-in user and ensure they are added to the list
  try {
    const activeUserRaw = localStorage.getItem('ksyn_user');
    if (activeUserRaw) {
      const activeUser = JSON.parse(activeUserRaw);
      if (activeUser && activeUser.email) {
        const cleanEmail = activeUser.email.toLowerCase().trim();
        const existingIdx = list.findIndex(a => a.email.toLowerCase() === cleanEmail);
        const entry = {
          name: formatAccountName(activeUser.name, activeUser.email),
          email: cleanEmail,
          avatarText: (activeUser.name || activeUser.email || 'G')[0].toUpperCase(),
          avatarBg: getAvatarColor(cleanEmail),
          status: 'Signed in'
        };
        if (existingIdx >= 0) {
          list[existingIdx] = { ...list[existingIdx], ...entry };
        } else {
          list.push(entry);
        }
      }
    }
  } catch (err) {
    // ignore
  }

  // Determine 'Signed in' vs 'Signed out' dynamically based on current user token & session
  try {
    const activeUserRaw = localStorage.getItem('ksyn_user');
    const token = localStorage.getItem('ksyn_token');
    const activeEmail = (token && activeUserRaw) ? JSON.parse(activeUserRaw)?.email?.toLowerCase()?.trim() : null;

    list = list.map(acc => ({
      ...acc,
      status: activeEmail && acc.email.toLowerCase() === activeEmail ? 'Signed in' : 'Signed out'
    }));
  } catch (err) {
    // ignore
  }

  return list;
}

export function saveVerifiedGoogleAccount(account) {
  if (!account || !account.email) return getSavedGoogleAccounts();
  const cleanEmail = account.email.trim().toLowerCase();
  let list = getSavedGoogleAccounts();

  const idx = list.findIndex(a => a.email.toLowerCase() === cleanEmail);
  const formattedName = formatAccountName(account.name, cleanEmail);
  const avatarBg = account.avatarBg || getAvatarColor(cleanEmail);
  const avatarText = (formattedName || cleanEmail)[0].toUpperCase();

  // Mark this account as 'Signed in' and other accounts as 'Signed out'
  list = list.map(a => ({
    ...a,
    status: a.email.toLowerCase() === cleanEmail ? (account.status || 'Signed in') : 'Signed out'
  }));

  const newEntry = {
    name: formattedName,
    email: cleanEmail,
    avatarText,
    avatarBg,
    status: account.status || 'Signed in',
    lastVerified: Date.now()
  };

  if (idx >= 0) {
    list[idx] = { ...list[idx], ...newEntry };
  } else {
    // Insert new verified account right into the list
    list.push(newEntry);
  }

  try {
    localStorage.setItem('ksyn_saved_google_accounts', JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('ksyn_google_accounts_updated', { detail: list }));
  } catch (err) {
    console.warn('Could not save google accounts to localStorage:', err);
  }

  return list;
}

export function removeSavedGoogleAccount(emailToRemove) {
  if (!emailToRemove) return getSavedGoogleAccounts();
  const clean = emailToRemove.trim().toLowerCase();
  let list = getSavedGoogleAccounts();
  list = list.filter(a => a.email.toLowerCase() !== clean);
  try {
    localStorage.setItem('ksyn_saved_google_accounts', JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('ksyn_google_accounts_updated', { detail: list }));
  } catch (err) {
    // ignore
  }
  return list;
}
