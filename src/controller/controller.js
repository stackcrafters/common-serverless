import validateRequest from '../requestValidation/requestValidation';

const { debug, warn, error } = console;

export default (requestSchema, lambdaFunc) => async (event, context) => {
  if (event.source === 'serverless-plugin-warmup') {
    debug('serverless-plugin-warmup');
    context?.serverlessSdk?.tagEvent('serverless-plugin-warmup', 'serverless-plugin-warmup');
    return 'serverless-plugin-warmup';
  }
  const path = `${event.httpMethod} ${event.resource}`;
  const principal = event.requestContext?.authorizer?.principalId;
  context?.serverlessSdk?.tagEvent('principal', principal);
  try {
    debug(`Using request schema: ${process.env.REQUEST_SCHEMA} - ${path}`);
    const body = event.body && JSON.parse(event.body);
    if (process.env.REQUEST_SCHEMA && !requestSchema) {
      error(`[500] The request schema was not found for path: ${path}, schema: ${process.env.REQUEST_SCHEMA}`);
      return response({ message: '[500] Internal Server Error' }, code.INTERNAL_SERVER_ERROR);
    }
    if (requestSchema) {
      const { valid, validationResponse } = validateRequest(requestSchema, body);
      if (!valid) {
        warn(
          `[${validationResponse.statusCode}] Validation failed for execution for path: ${path}, principal: ${principal}`,
          validationResponse
        );
        return validationResponse;
      }
    }
    const response = await lambdaFunc({ event, body, context, principal, jwtClaims: event.requestContext?.authorizer?.claims });
    debug(`[${response.statusCode}] Controller execution for path: ${path}, principal: ${principal}`);
    return response;
  } catch (e) {
    context?.serverlessSdk?.captureError(e);
    error(`[500] Controller failed to execute with a exception for path ${path}, principal: ${principal}`, e);
    return response({ message: '[500] Internal Server Error' }, code.INTERNAL_SERVER_ERROR);
  }
};

export const response = (body, statusCode = code.OK) => {
  return {
    statusCode: statusCode,
    body: JSON.stringify(body),
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  };
};

export const code = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORISED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
};
