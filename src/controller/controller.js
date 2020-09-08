import validateRequest from '../requestValidation/requestValidation';

export default (requestSchemas, lambdaFunc) => async (event, context) => {
  if (event.source === 'serverless-plugin-warmup') {
    console.log('serverless-plugin-warmup');
    return 'serverless-plugin-warmup';
  }
  console.log('Principal: ', (event.requestContext.authorizer || {}).principalId);
  try {
    console.debug(`Using request schema: ${process.env.REQUEST_SCHEMA} - ${event.httpMethod} ${event.resource}`);
    const requestSchema = requestSchemas[process.env.REQUEST_SCHEMA];
    if (process.env.REQUEST_SCHEMA && !requestSchema) {
      throw new Error(`The request schema was not found : ${process.env.REQUEST_SCHEMA}`);
    }
    if (requestSchema) {
      const { valid, validationResponse } = validateRequest(requestSchema, event);
      if (!valid) {
        return validationResponse;
      }
    }
    const response = await lambdaFunc(event, context);
    console.debug(`[${response.statusCode}] Controller execution for path: ${event.resource}`);
    return response;
  } catch (e) {
    console.error(`[500] Controller failed to execute with a exception for path ${event.resource}`, e);
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
