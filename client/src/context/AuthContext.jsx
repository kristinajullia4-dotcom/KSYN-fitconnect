import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('ksyn_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(localStorage.getItem('ksyn_token') || null);
  const [loading, setLoading] = useState(!localStorage.getItem('ksyn_token'));
  const [error, setError] = useState(null);

  // Initialize and verify existing token
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data && data.success) {
          setUser(data.user);
          localStorage.setItem('ksyn_user', JSON.stringify(data.user));
          setLoading(false);
          return;
        }

        // If 401 or token expired, attempt transparent refresh using refresh token
        const storedRefreshToken = localStorage.getItem('ksyn_refresh_token');
        if (storedRefreshToken) {
          try {
            const refreshRes = await fetch('/api/auth/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: storedRefreshToken })
            });
            const refreshData = await refreshRes.json();
            if (refreshRes.ok && refreshData?.success && refreshData.token) {
              localStorage.setItem('ksyn_token', refreshData.token);
              if (refreshData.refreshToken) {
                localStorage.setItem('ksyn_refresh_token', refreshData.refreshToken);
              }
              setToken(refreshData.token);

              const retryRes = await fetch('/api/auth/profile', {
                headers: { Authorization: `Bearer ${refreshData.token}` }
              });
              const retryData = await retryRes.json();
              if (retryRes.ok && retryData?.success && retryData.user) {
                setUser(retryData.user);
                localStorage.setItem('ksyn_user', JSON.stringify(retryData.user));
                setLoading(false);
                return;
              }
            }
          } catch (refErr) {
            console.warn('[loadUser transparent refresh attempt failed]:', refErr.message);
          }
        }

        // Check if there is an in-flight payment checkout return callback in the URL
        const isPaymentReturnUrl = window.location.search.includes('payment_status') || window.location.search.includes('status=paid');

        if (!isPaymentReturnUrl) {
          logout();
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        // Do NOT call logout() on network/offline errors! Retain cached user from localStorage
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [token]);

  // Standard Login with Auto-Retry & Resilient Fallback
  async function login(email, password) {
    setError(null);
    let lastError = null;

    // Attempt up to 2 times with a 1-second delay if backend is starting up
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, client_type: 'web' })
        });
        const data = await res.json();
        
        if (data && data.error === 'BACKEND_OFFLINE' && attempt < 2) {
          console.warn(`[KSYN Auth] Backend starting up on port 5080. Retrying attempt ${attempt + 1}...`);
          await new Promise(r => setTimeout(r, 1200));
          continue;
        }

        if (!res.ok || !data || !data.success) {
          const customErr = new Error((data && data.message) || 'Login failed. Please check credentials.');
          customErr.data = data;
          customErr.status = res.status;
          customErr.error = data?.error;
          customErr.remaining_attempts = data?.remaining_attempts;
          customErr.remaining_seconds = data?.remaining_seconds;
          throw customErr;
        }

        // If Multi-Factor Authentication is required for administrative tier
        if (data.mfa_required) {
          return data;
        }

        localStorage.setItem('ksyn_token', data.token);
        if (data.refreshToken) {
          localStorage.setItem('ksyn_refresh_token', data.refreshToken);
        }
        localStorage.setItem('ksyn_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return data.user;
      } catch (err) {
        lastError = err;
        if (err.message?.includes('5080') || err.message?.includes('offline')) {
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 1200));
            continue;
          }
        } else {
          break;
        }
      }
    }

    setError(lastError?.message || 'Login failed.');
    throw lastError || new Error('Login failed.');
  }

  // Direct Sign-In with Google (OAuth2 ID Token or Real Google Profile)
  async function loginWithGoogle(payload) {
    setError(null);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data || !data.success) {
        throw new Error((data && data.message) || 'Google sign-in failed.');
      }

      // If user is new, return Google profile so UI can prompt for remaining gym requirements
      if (data.is_new_user) {
        return { is_new_user: true, google_profile: data.google_profile };
      }

      localStorage.setItem('ksyn_token', data.token);
      if (data.refreshToken) {
        localStorage.setItem('ksyn_refresh_token', data.refreshToken);
      }
      localStorage.setItem('ksyn_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message || 'Google sign-in failed.');
      throw err;
    }
  }

  // Complete Google Registration with System Requirements (Phone, DOB, Branch, Plan, Emergency, Waiver)
  async function completeGoogleRegistration(payload) {
    setError(null);
    try {
      const res = await fetch('/api/auth/google/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data || !data.success) {
        throw new Error((data && data.message) || 'Failed to complete athlete registration.');
      }

      localStorage.setItem('ksyn_token', data.token);
      if (data.refreshToken) {
        localStorage.setItem('ksyn_refresh_token', data.refreshToken);
      }
      localStorage.setItem('ksyn_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message || 'Failed to complete athlete registration.');
      throw err;
    }
  }

  // 1-Click Interactive Role Switcher (For seamless testing and evaluator walkthroughs)
  async function demoSwitchRole(demoRole) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/demo-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoRole })
      });
      const data = await res.json();
      if (!res.ok || !data || !data.success) {
        throw new Error((data && data.message) || 'Demo role switch failed.');
      }
      localStorage.setItem('ksyn_token', data.token);
      if (data.refreshToken) {
        localStorage.setItem('ksyn_refresh_token', data.refreshToken);
      }
      localStorage.setItem('ksyn_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  // 2FA TOTP Code Verification
  async function verifyMfa(mfaTicket, totpCode) {
    setError(null);
    try {
      const res = await fetch('/api/auth/verify-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfa_ticket: mfaTicket, totp_code: totpCode })
      });
      const data = await res.json();
      if (!res.ok || !data || !data.success) {
        throw new Error((data && data.message) || '2FA TOTP verification failed.');
      }
      localStorage.setItem('ksyn_token', data.token);
      if (data.refreshToken) {
        localStorage.setItem('ksyn_refresh_token', data.refreshToken);
      }
      localStorage.setItem('ksyn_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message || '2FA verification failed.');
      throw err;
    }
  }

  async function logout() {
    const activeToken = token || localStorage.getItem('ksyn_token');
    const storedRefreshToken = localStorage.getItem('ksyn_refresh_token');
    if (activeToken || storedRefreshToken) {
      try {
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeToken || ''}`
          },
          body: JSON.stringify({ refreshToken: storedRefreshToken })
        }).catch(() => {});
      } catch (err) {
        // continue local cleanup
      }
    }
    localStorage.removeItem('ksyn_token');
    localStorage.removeItem('ksyn_refresh_token');
    localStorage.removeItem('ksyn_user');
    localStorage.removeItem('ksyn_last_path');
    sessionStorage.removeItem('ksyn_last_active_view');
    sessionStorage.removeItem('ksyn_dismissed_announcements');
    setToken(null);
    setUser(null);
  }

  // Authenticated fetch helper with seamless auto-refresh token rotation
  async function authFetch(url, options = {}) {
    const activeToken = token || localStorage.getItem('ksyn_token');
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
      Authorization: `Bearer ${activeToken}`
    };

    try {
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401) {
        // Intercept 401 and attempt transparent session renewal via refresh token
        const storedRefreshToken = localStorage.getItem('ksyn_refresh_token');
        if (storedRefreshToken) {
          try {
            const refreshRes = await fetch('/api/auth/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: storedRefreshToken })
            });
            const refreshData = await refreshRes.json();
            if (refreshRes.ok && refreshData?.success && refreshData.token) {
              localStorage.setItem('ksyn_token', refreshData.token);
              if (refreshData.refreshToken) {
                localStorage.setItem('ksyn_refresh_token', refreshData.refreshToken);
              }
              setToken(refreshData.token);

              // Re-attempt original request with refreshed token
              const retryHeaders = {
                ...options.headers,
                'Content-Type': 'application/json',
                Authorization: `Bearer ${refreshData.token}`
              };
              return await fetch(url, { ...options, headers: retryHeaders });
            }
          } catch (refreshErr) {
            console.warn('[authFetch transparent refresh error]:', refreshErr.message);
          }
        }

        logout();
        throw new Error('Session expired. Please log in again.');
      }
      return res;
    } catch (err) {
      if (err.message && err.message.includes('Session expired')) {
        throw err;
      }
      console.warn(`[authFetch warning] Request to ${url} failed:`, err.message);
      throw err;
    }
  }

  // Reload current user profile from backend
  async function refreshUser() {
    const currentToken = token || localStorage.getItem('ksyn_token');
    if (!currentToken) return null;
    try {
      const res = await fetch('/api/auth/profile', {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      const data = await res.json();
      if (res.ok && data?.success && data.user) {
        setUser(data.user);
        localStorage.setItem('ksyn_user', JSON.stringify(data.user));
        return data.user;
      }
    } catch (err) {
      console.warn('[refreshUser warning]:', err.message);
    }
    return null;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        token,
        setToken,
        loading,
        error,
        login,
        loginWithGoogle,
        completeGoogleRegistration,
        verifyMfa,
        logout,
        demoSwitchRole,
        authFetch,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
