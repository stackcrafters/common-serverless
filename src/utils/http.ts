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

export const response = (body: any, statusCode = code.OK): Response => {
  return {
    statusCode: statusCode,
    body: JSON.stringify(body),
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  };
};

export const messageResponse = (message: string, statusCode = code.FORBIDDEN): Response => {
  return {
    statusCode: statusCode,
    body: JSON.stringify({ statusCode, message }),
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  };
};
