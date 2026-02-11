/** Standard CORS headers applied to all API responses. */
export const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// Pre-built JSON templates to avoid repeated serialization for common response shapes
const ERROR_RESPONSE_TEMPLATE = JSON.stringify({ success: false, error: '' });
const SUCCESS_RESPONSE_TEMPLATE = JSON.stringify({ success: true });

/**
 * Creates a JSON Response with CORS headers.
 * Uses pre-built templates for simple success/error shapes to reduce serialization overhead.
 * @param {Object} data - Response payload
 * @param {number} [status=200] - HTTP status code
 * @returns {Response}
 */
export function createResponse(data, status = 200) {
  let body;
  if (data.success === false && data.error) {
    body = ERROR_RESPONSE_TEMPLATE.replace('""', `"${data.error}"`);
  } else if (data.success === true && Object.keys(data).length === 1) {
    body = SUCCESS_RESPONSE_TEMPLATE;
  } else {
    body = JSON.stringify(data);
  }

  return new Response(body, {
    status,
    headers: CORS_HEADERS
  });
}

/**
 * Shorthand for creating an error response with { success: false, error: message }.
 * @param {string} message - Error message
 * @param {number} [status=400] - HTTP status code
 * @returns {Response}
 */
export function createErrorResponse(message, status = 400) {
  return createResponse({ success: false, error: message }, status);
}
