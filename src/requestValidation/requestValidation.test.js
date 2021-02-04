import validateRequest from './requestValidation';

const setupSchema = ({ type, required, func, properties, pattern, patternHelper, strict, ...more }) => {
  return {
    type: type,
    ...(required && { required }),
    ...(func && { function: func }),
    ...(properties && { properties }),
    ...(pattern && { pattern }),
    ...(patternHelper && { patternHelper }),
    ...(strict && { strict }),
    ...more
  };
};

const setupSchemaObject = (required, func, properties, strict) =>
  setupSchema({
    type: 'object',
    required,
    func,
    properties,
    strict
  });
const setupSchemaArray = (required, func, properties, minLength, maxLength, uniqueEntries) =>
  setupSchema({ type: 'array', required, func, properties, minLength, maxLength, uniqueEntries });
const setupSchemaString = (required, pattern, func, patternHelper) =>
  setupSchema({ type: 'string', required, pattern, func, patternHelper });
const setupSchemaNumber = (required, pattern, min, max, func) =>
  setupSchema({
    type: 'number',
    required,
    pattern,
    func,
    min,
    max
  });
const setupSchemaBoolean = (required) => setupSchema({ type: 'boolean', required });

let requestSchema;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});
describe('type validation for object', () => {
  describe('return valid:false - bad request', () => {
    beforeEach(() => {
      requestSchema = setupSchemaObject(
        true,
        () => ({ body: 'function has errors' }),
        {
          a: setupSchemaObject(true, false, { b: setupSchemaObject(true) })
        },
        true
      );
    });
    it('object - is required', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, undefined);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'is required' }) })
      );
      expect(valid).toBe(false);
    });
    it('object - is of type object', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, 'a non object body');
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'must be of type object' }) })
      );
      expect(valid).toBe(false);
    });
    it('object - properties are recursive', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: {} });
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ 'a.b': 'is required' }) })
      );
      expect(valid).toBe(false);
    });
    it('object - strict detects additional properties', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, { c: {} });
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ c: 'is not allowed on this object' }) })
      );
      expect(valid).toBe(false);
    });
    it('object - function has errors', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, {});
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'function has errors' }) })
      );
      expect(valid).toBe(false);
    });
  });
  describe('return valid:true', () => {
    beforeEach(() => {
      requestSchema = setupSchemaObject(true, () => ({}), { a: setupSchemaObject(true) }, false);
    });
    it('object - has no errors', async () => {
      const { valid } = await validateRequest(requestSchema, { a: {} });
      expect(valid).toBe(true);
    });
    it('object - when not strict ignore additional properties', async () => {
      const { valid } = await validateRequest(requestSchema, { a: {}, c: {} });
      expect(valid).toBe(true);
    });
  });
});

describe('type validation for array', () => {
  describe('return valid:false - bad request', () => {
    beforeEach(() => {
      requestSchema = setupSchemaArray(
        true,
        () => ({ body: 'function has errors' }),
        setupSchemaArray(true, false, setupSchemaArray(true))
      );
    });
    it('array - is required', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, undefined);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'is required' }) })
      );
      expect(valid).toBe(false);
    });
    it('array - is of type array', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, 'a non array body');
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'must be of type array' }) })
      );
      expect(valid).toBe(false);
    });
    it('array - properties are recursive', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, [['']]);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ 'index-0.index-0': 'must be of type array' }) })
      );
      expect(valid).toBe(false);
    });
    it('array - function has errors', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, []);
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'function has errors' }) })
      );
      expect(valid).toBe(false);
    });
    describe('array length', () => {
      it('array - length below min', async () => {
        requestSchema = setupSchemaArray(true, false, setupSchemaNumber(true), 2, undefined);
        const { valid, validationResponse } = await validateRequest(requestSchema, [1]);
        expect(JSON.parse(validationResponse.body)).toEqual(
          expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'length must be at least 2' }) })
        );
        expect(valid).toBe(false);
      });
      it('array - length above max', async () => {
        requestSchema = setupSchemaArray(true, false, setupSchemaNumber(true), undefined, 4);
        const { valid, validationResponse } = await validateRequest(requestSchema, [1, 2, 3, 4, 5]);
        expect(JSON.parse(validationResponse.body)).toEqual(
          expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'length must not exceed 4' }) })
        );
        expect(valid).toBe(false);
      });
    });
    describe('array length between', () => {
      beforeEach(() => {
        requestSchema = setupSchemaArray(true, false, setupSchemaNumber(true), 2, 4);
      });
      it('array - length below min', async () => {
        const { valid, validationResponse } = await validateRequest(requestSchema, [1]);
        expect(JSON.parse(validationResponse.body)).toEqual(
          expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'length must be between 2 and 4' }) })
        );
        expect(valid).toBe(false);
      });
      it('array - length above max', async () => {
        const { valid, validationResponse } = await validateRequest(requestSchema, [1, 2, 3, 4, 5]);
        expect(JSON.parse(validationResponse.body)).toEqual(
          expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'length must be between 2 and 4' }) })
        );
        expect(valid).toBe(false);
      });
    });
    describe('unique entries only', () => {
      describe('primitive values', () => {
        beforeEach(() => {
          requestSchema = setupSchemaArray(true, false, setupSchemaNumber(true), 2, undefined, true);
        });
        it('array - contains duplicates', () => {
          const { valid, validationResponse } = validateRequest(requestSchema, [1, 1, 2, 1, 3]);
          expect(valid).toBe(false);
          expect(JSON.parse(validationResponse.body)).toEqual(
            expect.objectContaining({
              validationErrors: {
                'index-1': 'is a duplicate (1)',
                'index-3': 'is a duplicate (1)'
              }
            })
          );
        });
        it('array - does not contain duplicates', () => {
          const { valid } = validateRequest(requestSchema, [1, 2, 3]);
          expect(valid).toBe(true);
        });
        it('array - contains duplicates (allowed)', () => {
          requestSchema = setupSchemaArray(true, false, setupSchemaNumber(true), 2, undefined, false);
          const { valid } = validateRequest(requestSchema, [1, 1, 2, 1, 3]);
          expect(valid).toBe(true);
        });
      });
      describe('object prop', () => {
        beforeEach(() => {
          requestSchema = setupSchemaArray(
            true,
            false,
            setupSchemaObject(true, false, { prop: setupSchemaNumber(true) }),
            2,
            undefined,
            'prop'
          );
        });
        it('array - contains duplicates', () => {
          const { valid, validationResponse } = validateRequest(requestSchema, [{ prop: 1 }, { prop: 1 }, { prop: 2 }, { prop: 1 }]);
          expect(valid).toBe(false);
          expect(JSON.parse(validationResponse.body)).toEqual(
            expect.objectContaining({
              validationErrors: {
                'index-1.prop': 'is a duplicate (1)',
                'index-3.prop': 'is a duplicate (1)'
              }
            })
          );
        });
        it('array - does not contain duplicates', () => {
          const { valid } = validateRequest(requestSchema, [{ prop: 1 }, { prop: 2 }, { prop: 3 }]);
          expect(valid).toBe(true);
        });
        it('array - contains duplicates (allowed)', () => {
          requestSchema = setupSchemaArray(
            true,
            false,
            setupSchemaObject(true, false, { prop: setupSchemaNumber(true) }),
            2,
            undefined,
            false
          );
          const { valid } = validateRequest(requestSchema, [{ prop: 1 }, { prop: 1 }, { prop: 2 }, { prop: 1 }]);
          expect(valid).toBe(true);
        });
      });
      describe('nested', () => {
        it('array - contains duplicates', async () => {
          requestSchema = setupSchemaArray(
            true,
            false,
            setupSchemaArray(true, false, setupSchemaObject(true, false, { prop: setupSchemaNumber(true) }), 2, undefined, 'prop')
          );
          const { valid, validationResponse } = await validateRequest(requestSchema, [
            [{ prop: 1 }, { prop: 1 }, { prop: 2 }, { prop: 1 }]
          ]);
          expect(valid).toBe(false);
          expect(JSON.parse(validationResponse.body)).toEqual(
            expect.objectContaining({
              validationErrors: {
                'index-0.index-1.prop': 'is a duplicate (1)',
                'index-0.index-3.prop': 'is a duplicate (1)'
              }
            })
          );
        });
        it('array of primitives - contains duplicates', async () => {
          requestSchema = setupSchemaArray(true, false, setupSchemaArray(true, false, setupSchemaNumber(true), 2, undefined, true));
          const { valid, validationResponse } = await validateRequest(requestSchema, [[1, 1, 2, 1]]);
          expect(valid).toBe(false);
          expect(JSON.parse(validationResponse.body)).toEqual(
            expect.objectContaining({
              validationErrors: {
                'index-0.index-1': 'is a duplicate (1)',
                'index-0.index-3': 'is a duplicate (1)'
              }
            })
          );
        });
      });
    });
  });
  describe('return valid:true', () => {
    describe('required:true', () => {
      beforeEach(() => {
        requestSchema = setupSchemaArray(true, () => ({}), setupSchemaArray(true), 2, 4);
      });
      it('array - has no errors', async () => {
        const { valid } = await validateRequest(requestSchema, [[], [], []]);
        expect(valid).toBe(true);
      });
    });
    describe('required:false', () => {
      beforeEach(() => {
        requestSchema = setupSchemaArray(false, () => ({}));
      });
      it('array - has no errors', async () => {
        const r = await validateRequest(requestSchema, undefined);
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
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: undefined });
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'is required' }) })
      );
      expect(valid).toBe(false);
    });
    it('string - is of type string', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: 1 });
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'must be of type string' }) })
      );
      expect(valid).toBe(false);
    });
    it('string - not match pattern', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: 'A' });
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'does not match pattern' }) })
      );
      expect(valid).toBe(false);
    });
    it('string - not match pattern with patternHelper', async () => {
      requestSchema = setupSchemaObject(true, false, {
        a: setupSchemaString(true, '^[a-z]+$', () => ({ a: 'string function has errors' }), 'a to z only')
      });
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: 'A' });
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'does not match pattern (a to z only)' }) })
      );
      expect(valid).toBe(false);
    });
    it('string - function has errors', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: 'a' });
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'string function has errors' }) })
      );
      expect(valid).toBe(false);
    });
  });
  describe('return valid:true', () => {
    beforeEach(() => {
      requestSchema = setupSchemaObject(true, false, {
        a: setupSchemaString(true, '^[a-z]+$', () => ({}))
      });
    });
    it('string - has no errors', async () => {
      const { valid } = await validateRequest(requestSchema, { a: 'a' });
      expect(valid).toBe(true);
    });
    it('string - not required with defined pattern', async () => {
      requestSchema = setupSchemaObject(true, false, {
        a: setupSchemaString(false, '^[a-z]+$', () => ({}))
      });
      const { valid } = await validateRequest(requestSchema, { a: '' });
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
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: undefined });
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'is required' }) })
      );
      expect(valid).toBe(false);
    });
    it('number - is of type string', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: '1' });
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'must be of type number' }) })
      );
      expect(valid).toBe(false);
    });
    it('number - not match pattern', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: 0 });
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'does not match pattern' }) })
      );
      expect(valid).toBe(false);
    });
    it('number - not between min and max', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: 1 });
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'must be between 2 and 9' }) })
      );
      expect(valid).toBe(false);
    });
    it('number - not less than min', async () => {
      requestSchema = setupSchemaObject(true, false, {
        a: setupSchemaNumber(true, false, 2, undefined)
      });
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: 1 });
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'must be greater than 2' }) })
      );
      expect(valid).toBe(false);
    });
    it('number - not greater than max', async () => {
      requestSchema = setupSchemaObject(true, false, {
        a: setupSchemaNumber(true, false, undefined, 1)
      });
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: 2 });
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'must be less than 1' }) })
      );
      expect(valid).toBe(false);
    });
    it('number - function has errors', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: 2 });
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'number function has errors' }) })
      );
      expect(valid).toBe(false);
    });
  });
  describe('return valid:true', () => {
    beforeEach(() => {
      requestSchema = setupSchemaObject(true, false, {
        a: setupSchemaNumber(true, '^[0-9]+$', 0, 9, () => ({}))
      });
    });
    it('number - has no errors', async () => {
      const { valid } = await validateRequest(requestSchema, { a: 1 });
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
      const { valid, validationResponse } = await validateRequest(requestSchema, {});
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'is required' }) })
      );
      expect(valid).toBe(false);
    });
    it('is not of type boolean', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: 0 });
      expect(JSON.parse(validationResponse.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'must be of type boolean' }) })
      );
      expect(valid).toBe(false);
    });
  });
  describe('return valid', () => {
    it('is present', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: false });
      expect(valid).toBe(true);
    });
  });
});
