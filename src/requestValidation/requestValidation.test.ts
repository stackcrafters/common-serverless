import validateRequest, { SchemaNode, SchemaNodeArray } from './requestValidation';

const setupSchema = ({
  type,
  required,
  function: func,
  properties,
  pattern,
  patternHelper,
  strict,
  ...more
}: SchemaNode | SchemaNodeArray) => {
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

const setupSchemaObject = (required, func?, properties?, strict?) =>
  setupSchema({
    type: 'object',
    required,
    function: func,
    properties,
    strict
  });
const setupSchemaArray = (required, func?, properties?, minLength?, maxLength?, uniqueEntries?) =>
  setupSchema({ type: 'array', required, function: func, properties, minLength, maxLength, uniqueEntries });
const setupSchemaString = (required, pattern?, func?, patternHelper?, options?, optionsHelper?) =>
  setupSchema({ type: 'string', required, pattern, function: func, patternHelper, options, optionsHelper });
const setupSchemaNumber = (required, pattern?, min?, max?, func?, options?) =>
  setupSchema({
    type: 'number',
    required,
    pattern,
    function: func,
    min,
    max,
    options
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
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'is required' }) })
      );
    });
    it('object - is of type object', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, 'a non object body');
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'must be of type object' }) })
      );
    });
    it('object - properties are recursive', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: {} });
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ 'a.b': 'is required' }) })
      );
    });
    it('object - strict detects additional properties', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, { c: {} });
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ c: 'is not allowed on this object' }) })
      );
    });
    it('object - function has errors', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, {});
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'function has errors' }) })
      );
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
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'is required' }) })
      );
    });
    it('array - is of type array', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, 'a non array body');
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'must be of type array' }) })
      );
    });
    it('array - properties are recursive', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, [['']]);
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ 'index-0.index-0': 'must be of type array' }) })
      );
    });
    it('array - function has errors', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, []);
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'function has errors' }) })
      );
    });
    describe('array length', () => {
      it('array - length below min', async () => {
        requestSchema = setupSchemaArray(true, false, setupSchemaNumber(true), 2, undefined);
        const { valid, validationResponse } = await validateRequest(requestSchema, [1]);
        expect(valid).toBe(false);
        expect(JSON.parse(<string>validationResponse?.body)).toEqual(
          expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'length must be at least 2' }) })
        );
      });
      it('array - length above max', async () => {
        requestSchema = setupSchemaArray(true, false, setupSchemaNumber(true), undefined, 4);
        const { valid, validationResponse } = await validateRequest(requestSchema, [1, 2, 3, 4, 5]);
        expect(valid).toBe(false);
        expect(JSON.parse(<string>validationResponse?.body)).toEqual(
          expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'length must not exceed 4' }) })
        );
      });
    });
    describe('array length between', () => {
      beforeEach(() => {
        requestSchema = setupSchemaArray(true, false, setupSchemaNumber(true), 2, 4);
      });
      it('array - length below min', async () => {
        const { valid, validationResponse } = await validateRequest(requestSchema, [1]);
        expect(valid).toBe(false);
        expect(JSON.parse(<string>validationResponse?.body)).toEqual(
          expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'length must be between 2 and 4' }) })
        );
      });
      it('array - length above max', async () => {
        const { valid, validationResponse } = await validateRequest(requestSchema, [1, 2, 3, 4, 5]);
        expect(valid).toBe(false);
        expect(JSON.parse(<string>validationResponse?.body)).toEqual(
          expect.objectContaining({ validationErrors: expect.objectContaining({ body: 'length must be between 2 and 4' }) })
        );
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
          expect(JSON.parse(<string>validationResponse?.body)).toEqual(
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
          expect(JSON.parse(<string>validationResponse?.body)).toEqual(
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
      describe('function', () => {
        it('array - contains duplicates', () => {
          requestSchema = setupSchemaArray(
            true,
            false,
            setupSchemaArray(true, false, setupSchemaObject(true, false, { prop: setupSchemaNumber(true) }), 2, undefined, (o) => o.prop)
          );
          const { valid, validationResponse } = validateRequest(requestSchema, [[{ prop: 1 }, { prop: 1 }, { prop: 2 }, { prop: 1 }]]);
          expect(valid).toBe(false);
          expect(JSON.parse(<string>validationResponse?.body)).toEqual(
            expect.objectContaining({
              validationErrors: {
                'index-0.index-1': 'is a duplicate (1)',
                'index-0.index-3': 'is a duplicate (1)'
              }
            })
          );
        });
      });
      describe('nested', () => {
        it('array - contains duplicates', () => {
          requestSchema = setupSchemaArray(
            true,
            false,
            setupSchemaArray(true, false, setupSchemaObject(true, false, { prop: setupSchemaNumber(true) }), 2, undefined, 'prop')
          );
          const { valid, validationResponse } = validateRequest(requestSchema, [[{ prop: 1 }, { prop: 1 }, { prop: 2 }, { prop: 1 }]]);
          expect(valid).toBe(false);
          expect(JSON.parse(<string>validationResponse?.body)).toEqual(
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
          expect(JSON.parse(<string>validationResponse?.body)).toEqual(
            expect.objectContaining({
              validationErrors: {
                'index-0.index-1': 'is a duplicate (1)',
                'index-0.index-3': 'is a duplicate (1)'
              }
            })
          );
        });
      });
      describe('options', () => {
        beforeEach(() => {
          requestSchema = setupSchemaArray(
            true,
            false,
            setupSchemaString(true, '^[a-z]+$', undefined, '', [{ label: 'x', value: 'x' }]),
            2,
            undefined,
            true
          );
        });
        it('rejects invalid options', async () => {
          const { valid, validationResponse } = await validateRequest(requestSchema, ['x', 'y']);
          expect(valid).toBe(false);
          expect(JSON.parse(<string>validationResponse?.body)).toEqual(
            expect.objectContaining({ validationErrors: expect.objectContaining({ 'index-1': 'not a valid option' }) })
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
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'is required' }) })
      );
    });
    it('string - is of type string', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: 1 });
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'must be of type string' }) })
      );
    });
    it('string - not match pattern', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: 'A' });
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'does not match pattern' }) })
      );
    });
    it('string - not match pattern with patternHelper', async () => {
      requestSchema = setupSchemaObject(true, false, {
        a: setupSchemaString(true, '^[a-z]+$', () => ({ a: 'string function has errors' }), 'a to z only')
      });
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: 'A' });
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'does not match pattern (a to z only)' }) })
      );
    });
    it('string - function has errors', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: 'a' });
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'string function has errors' }) })
      );
    });
    describe('options', () => {
      beforeEach(() => {
        requestSchema = setupSchemaObject(true, false, {
          a: setupSchemaString(
            true,
            '^[a-z]+$',
            undefined,
            '',
            [
              {
                label: 'x',
                value: 'x'
              }
            ],
            'only x'
          )
        });
      });
      it('not a valid option', async () => {
        const { valid, validationResponse } = await validateRequest(requestSchema, { a: 'a' });
        expect(valid).toBe(false);
        expect(JSON.parse(<string>validationResponse?.body)).toEqual(
          expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'not a valid option (only x)' }) })
        );
      });
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
    describe('options', () => {
      it('valid option', async () => {
        requestSchema = setupSchemaObject(true, false, {
          a: setupSchemaString(true, '^[a-z]+$', undefined, '', [{ label: 'x', value: 'x' }])
        });
        const { valid } = await validateRequest(requestSchema, { a: 'x' });
        expect(valid).toBe(true);
      });
      it('valid option when empty options defined', async () => {
        requestSchema = setupSchemaObject(true, false, {
          a: setupSchemaString(true, '^[a-z]+$', undefined, '', [])
        });
        const { valid } = await validateRequest(requestSchema, { a: 'x' });
        expect(valid).toBe(true);
      });
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
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'is required' }) })
      );
    });
    it('number - is of type string', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: '1' });
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'must be of type number' }) })
      );
    });
    it('number - not match pattern', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: 0 });
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'does not match pattern' }) })
      );
    });
    it('number - not between min and max', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: 1 });
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'must be between 2 and 9' }) })
      );
    });
    it('number - not less than min', async () => {
      requestSchema = setupSchemaObject(true, false, {
        a: setupSchemaNumber(true, false, 2, undefined)
      });
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: 1 });
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'must be greater than 2' }) })
      );
    });
    it('number - not greater than max', async () => {
      requestSchema = setupSchemaObject(true, false, {
        a: setupSchemaNumber(true, false, undefined, 1)
      });
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: 2 });
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'must be less than 1' }) })
      );
    });
    it('number - function has errors', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: 2 });
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'number function has errors' }) })
      );
    });
    describe('options', () => {
      beforeEach(() => {
        requestSchema = setupSchemaObject(true, false, {
          a: setupSchemaNumber(true, false, undefined, undefined, undefined, [{ label: '1', value: '9' }])
        });
      });
      it('not a valid option', async () => {
        const { valid, validationResponse } = await validateRequest(requestSchema, { a: 4 });
        expect(valid).toBe(false);
        expect(JSON.parse(<string>validationResponse?.body)).toEqual(
          expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'not a valid option' }) })
        );
      });
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
    describe('options', () => {
      it('valid option', async () => {
        requestSchema = setupSchemaObject(true, false, {
          a: setupSchemaNumber(true, false, undefined, undefined, undefined, [{ label: '1', value: '9' }])
        });
        const { valid } = await validateRequest(requestSchema, { a: 9 });
        expect(valid).toBe(true);
      });
      it('valid option when empty options defined', async () => {
        requestSchema = setupSchemaObject(true, false, {
          a: setupSchemaString(true, '^[a-z]+$', undefined, '', [])
        });
        const { valid } = await validateRequest(requestSchema, { a: 'x' });
        expect(valid).toBe(true);
      });
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
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'is required' }) })
      );
    });
    it('is not of type boolean', async () => {
      const { valid, validationResponse } = await validateRequest(requestSchema, { a: 0 });
      expect(valid).toBe(false);
      expect(JSON.parse(<string>validationResponse?.body)).toEqual(
        expect.objectContaining({ validationErrors: expect.objectContaining({ a: 'must be of type boolean' }) })
      );
    });
  });
  describe('return valid', () => {
    it('is present', async () => {
      const { valid } = await validateRequest(requestSchema, { a: false });
      expect(valid).toBe(true);
    });
  });
});
