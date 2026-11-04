/**
 * KSYN FitConnect Safe Fetch & JSON Response Handler
 *
 * Prevents "Failed to execute 'json' on 'Response': Unexpected end of JSON input"
 * across all fetch/authFetch calls in the application by safely handling:
 * - Empty bodies (0 bytes, 204 No Content, empty 200, empty 500)
 * - HTML/Gateway error pages (502, 504, 404 falling back to index.html)
 * - Network stream aborts
 */

// Install global Response.prototype.json patch if running in browser
if (typeof window !== 'undefined' && typeof Response !== 'undefined' && Response.prototype) {
  Response.prototype.json = async function safeJsonPatched() {
    try {
      const text = await this.text();
      if (!text || !text.trim()) {
        // Return resilient empty payload instead of crashing with SyntaxError
        return { success: this.ok, data: [] };
      }
      try {
        return JSON.parse(text);
      } catch (parseErr) {
        console.warn('[safeJsonPatched] Non-JSON payload received from endpoint:', {
          status: this.status,
          statusText: this.statusText,
          sample: text.slice(0, 120)
        });
        return {
          success: false,
          error: 'INVALID_JSON_INPUT',
          message: this.statusText || 'Unexpected non-JSON response from server.',
          raw: text
        };
      }
    } catch (readErr) {
      console.warn('[safeJsonPatched] Failed to read response stream:', readErr.message);
      return {
        success: false,
        error: 'STREAM_READ_ERROR',
        message: readErr.message,
        data: []
      };
    }
  };
}

/**
 * Explicit helper to safely parse any Response object to JSON with custom fallback
 */
export async function safeJson(response, fallback = { success: false, data: [] }) {
  if (!response) return fallback;
  try {
    const text = await response.text();
    if (!text || !text.trim()) {
      return { ...fallback, success: response.ok };
    }
    return JSON.parse(text);
  } catch (err) {
    console.warn('[safeJson] Error parsing response JSON:', err.message);
    return { ...fallback, success: false, error: err.message };
  }
}

export default safeJson;
