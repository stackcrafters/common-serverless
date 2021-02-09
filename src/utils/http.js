export const response = (body, statusCode = code.OK, additionalHeaders = {}) => {
  return {
    statusCode: statusCode,
    body: JSON.stringify(body),
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store, max-age=0',
      ...additionalHeaders
    }
  };
};

export const messageResponse = (message, statusCode = code.FORBIDDEN) => {
  return {
    statusCode: statusCode,
    body: JSON.stringify({ statusCode, message }),
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store, max-age=0'
    }
  };
};

export const code = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  TOO_MANY_REQUESTS: 429
};
