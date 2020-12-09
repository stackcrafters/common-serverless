import validateRequest from '../requestValidation/requestValidation';
import { code, messageResponse } from '../utils/http';

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

  let body;
  try {
    body = event.body && JSON.parse(event.body.trim());
  } catch (e) {
    error(`[400] Malformed request body for path ${path}, principal: ${principal}`, e);
    context?.serverlessSdk?.captureError(e);
    return messageResponse('Malformed Request Body', code.BAD_REQUEST);
  }

  try {
    if (requestSchema && typeof requestSchema?.type === 'string') {
      error(`[500] The request schema was not found for path: ${path}`);
      return messageResponse('Internal Server Error', code.INTERNAL_SERVER_ERROR);
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
    return messageResponse('Internal Server Error', code.INTERNAL_SERVER_ERROR);
  }
};
