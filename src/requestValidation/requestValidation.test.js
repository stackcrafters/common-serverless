import validateRequest from './RequestValidation';

const setupEvent = ({ principalId, pathParameters, body }) => {
  return { requestContext: { authorizer: { principalId } }, pathParameters, body: body ? JSON.stringify(body) : body };
};

const setupSchema = ({ type, required, func, properties, pattern, ...more }) => {
  return {
    type: type,
    ...(required && { required }),
    ...(func && { function: func }),
    ...(properties && { properties }),
    ...(pattern && { pattern }),
    ...more
  };
};

const setupSchemaObject = (required, func, properties) => setupSchema({ type: 'object', required, func, properties });
const setupSchemaArray = (required, func, properties) => setupSchema({ type: 'array', required, func, properties });
const setupSchemaString = (required, pattern, func) => setupSchema({ type: 'string', required, pattern, func });
const setupSchemaNumber = (required, pattern, min, max, func) => setupSchema({ type: 'number', required, pattern, func, min, max });
const setupSchemaBoolean = (required) => setupSchema({ type: 'boolean', required });

let event;
let requestSchema;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});
describe('type validation for object', () => {
  describe('return valid:false - bad request', () => {
    beforeEach(() => {
      requestSchema = setupSchemaObject(true, () => ({ body: 'function has errors' }), {
        a: setupSchemaObject(true, false, { b: setupSchemaObject(true) })
      });
    });
    it('object - is required', async () => {
      event = setupEvent({ body: undefined });
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'is required' }) })
      );
      expect(valid).toBe(false);
    });
    it('object - is of type object', async () => {
      event = setupEvent({ body: 'a non object body' });
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'must be of type object' }) })
      );
      expect(valid).toBe(false);
    });
    it('object - properties are recursive', async () => {
      event = setupEvent({ body: { a: {} } });
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ 'a.b': 'is required' }) })
      );
      expect(valid).toBe(false);
    });
    it('object - function has errors', async () => {
      event = setupEvent({ body: {} });
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'function has errors' }) })
      );
      expect(valid).toBe(false);
    });
  });
  describe('return valid:true', () => {
    beforeEach(() => {
      event = setupEvent({ body: { a: {} } });
      requestSchema = setupSchemaObject(true, () => ({}), { a: setupSchemaObject(true) });
    });
    it('object - has no errors', async () => {
      const { valid } = await validateRequest(requestSchema, event);
      expect(valid).toBe(true);
    });
  });
});

describe('type validation for array', () => {
  describe('return valid:false - bad request', () => {
    beforeEach(() => {
      event = setupEvent({ body: undefined });
      requestSchema = setupSchemaArray(
        true,
        () => ({ body: 'function has errors' }),
        setupSchemaArray(true, false, setupSchemaArray(true))
      );
    });
    it('array - is required', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'is required' }) })
      );
      expect(valid).toBe(false);
    });
    it('array - is of type array', async () => {
      event = setupEvent({ body: 'a non array body' });
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'must be of type array' }) })
      );
      expect(valid).toBe(false);
    });
    it('array - properties are recursive', async () => {
      event = setupEvent({ body: [['']] });
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ 'index-0.index-0': 'must be of type array' }) })
      );
      expect(valid).toBe(false);
    });
    it('array - function has errors', async () => {
      event = setupEvent({ body: [] });
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'function has errors' }) })
      );
      expect(valid).toBe(false);
    });
  });
  describe('return valid:true', () => {
    describe('required:true', () => {
      beforeEach(() => {
        event = setupEvent({ body: [[]] });
        requestSchema = setupSchemaArray(true, () => ({}), setupSchemaArray(true));
      });
      it('array - has no errors', async () => {
        const { valid } = await validateRequest(requestSchema, event);
        expect(valid).toBe(true);
      });
    });
    describe('required:false', () => {
      beforeEach(() => {
        event = setupEvent({ body: undefined });
        requestSchema = setupSchemaArray(false, () => ({}));
      });
      it('array - has no errors', async () => {
        const r = await validateRequest(requestSchema, event);
        expect(r.valid).toBe(true);
      });
    });
  });
});

describe('type validation for string', () => {
  describe('return valid:false - bad request', () => {
    beforeEach(() => {
      requestSchema = setupSchemaObject(true, false, {
        a: setupSchemaString(true, '^[a-z]+$', () => ({ a: 'string function has errors' }))
      });
    });
    it('string - is required', async () => {
      event = setupEvent({ body: { a: undefined } });
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'is required' }) })
      );
      expect(valid).toBe(false);
    });
    it('string - is of type string', async () => {
      event = setupEvent({ body: { a: 1 } });
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'must be of type string' }) })
      );
      expect(valid).toBe(false);
    });
    it('string - not match pattern', async () => {
      event = setupEvent({ body: { a: 'A' } });
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'does not match pattern' }) })
      );
      expect(valid).toBe(false);
    });
    it('string - function has errors', async () => {
      event = setupEvent({ body: { a: 'a' } });
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'string function has errors' }) })
      );
      expect(valid).toBe(false);
    });
  });
  describe('return valid:true', () => {
    beforeEach(() => {
      event = setupEvent({ body: { a: 'a' } });
      requestSchema = setupSchemaObject(true, false, {
        a: setupSchemaString(true, '^[a-z]+$', () => ({}))
      });
    });
    it('string - has no errors', async () => {
      const { valid } = await validateRequest(requestSchema, event);
      expect(valid).toBe(true);
    });
    it('string - not required with defined pattern', async () => {
      requestSchema = setupSchemaObject(true, false, {
        a: setupSchemaString(false, '^[a-z]+$', () => ({}))
      });
      event = setupEvent({ body: { a: '' } });
      const { valid } = await validateRequest(requestSchema, event);
      expect(valid).toBe(true);
    });
  });
});

describe('type validation for number', () => {
  describe('return valid:false - bad request', () => {
    beforeEach(() => {
      requestSchema = setupSchemaObject(true, false, {
        a: setupSchemaNumber(true, '^[1-9]+$', 2, 9, () => ({ a: 'number function has errors' }))
      });
    });
    it('number - is required', async () => {
      event = setupEvent({ body: { a: undefined } });
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'is required' }) })
      );
      expect(valid).toBe(false);
    });
    it('number - is of type string', async () => {
      event = setupEvent({ body: { a: '1' } });
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'must be of type number' }) })
      );
      expect(valid).toBe(false);
    });
    it('number - not match pattern', async () => {
      event = setupEvent({ body: { a: 0 } });
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'does not match pattern' }) })
      );
      expect(valid).toBe(false);
    });
    it('number - not between min and max', async () => {
      event = setupEvent({ body: { a: 1 } });
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'must be between 2 and 9' }) })
      );
      expect(valid).toBe(false);
    });
    it('number - not less than min', async () => {
      event = setupEvent({ body: { a: 1 } });
      requestSchema = setupSchemaObject(true, false, {
        a: setupSchemaNumber(true, false, 2, undefined)
      });
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'must be greater than 2' }) })
      );
      expect(valid).toBe(false);
    });
    it('number - not greater than max', async () => {
      event = setupEvent({ body: { a: 2 } });
      requestSchema = setupSchemaObject(true, false, {
        a: setupSchemaNumber(true, false, undefined, 1)
      });
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'must be less than 1' }) })
      );
      expect(valid).toBe(false);
    });
    it('number - function has errors', async () => {
      event = setupEvent({ body: { a: 2 } });
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'number function has errors' }) })
      );
      expect(valid).toBe(false);
    });
  });
  describe('return valid:true', () => {
    beforeEach(() => {
      event = setupEvent({ body: { a: 1 } });
      requestSchema = setupSchemaObject(true, false, {
        a: setupSchemaNumber(true, '^[0-9]+$', 0, 9, () => ({}))
      });
    });
    it('number - has no errors', async () => {
      const { valid } = await validateRequest(requestSchema, event);
      expect(valid).toBe(true);
    });
  });
});

describe('type validation for boolean', () => {
  describe('return invalid', () => {
    beforeEach(() => {
      requestSchema = setupSchemaObject(true, false, {
        a: setupSchemaBoolean(true)
      });
    });
    it('is missing', async () => {
      event = setupEvent({ body: {} });
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'is required' }) })
      );
      expect(valid).toBe(false);
    });
    it('is not of type boolean', async () => {
      event = setupEvent({ body: { a: 0 } });
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'must be of type boolean' }) })
      );
      expect(valid).toBe(false);
    });
  });
  describe('return valid', () => {
    it('is present', async () => {
      event = setupEvent({ body: { a: false } });
      const { valid, validationResponse } = await validateRequest(requestSchema, event);
      expect(valid).toBe(true);
    });
  });
});
