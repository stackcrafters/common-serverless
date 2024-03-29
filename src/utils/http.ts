export interface Response {
  statusCode: code;
  body?: string;
  headers?: Record<string, string>;
}

export enum code {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500,
  TOO_MANY_REQUEST = 429
}

export const response = (body: any, statusCode = code.OK, additionalHeaders = {}): Response => {
  return {
    statusCode: statusCode,
    body: JSON.stringify(body),
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token, X-Amz-User-Agent',
      'Cache-Control': 'no-store, max-age=0',
      ...additionalHeaders
    }
  };
};

export const messageResponse = (message: string, statusCode = code.FORBIDDEN): Response => {
  return {
    statusCode: statusCode,
    body: JSON.stringify({ statusCode, message }),
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token, X-Amz-User-Agent',
      'Cache-Control': 'no-store, max-age=0'
    }
  };
};
