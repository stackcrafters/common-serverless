/* eslint-disable @typescript-eslint/no-use-before-define */
import { code, Response, response } from '../utils/http';

interface SchemaType {
  type: string;
  mandatory?: boolean;
  required?: boolean;
  strict?: boolean;
  function?: (name: string, schemaNode: SchemaNode | SchemaNodeArray, bodyNode: any) => Record<string, string>;
  minLength?: number;
  maxLength?: number;
  uniqueEntries?: string | boolean | ((v: string) => string);
  pattern?: string;
  patternHelper?: string;
  min?: number;
  max?: number;
  options?: { label: string; value: string }[];
  optionsHelper?: string;
}

export interface SchemaNode extends SchemaType {
  properties?: { [key: string]: SchemaNode };
}

export interface SchemaNodeArray extends SchemaType {
  items?: SchemaNode;
  properties?: SchemaNode;
}

const isEmptyObject = (obj: any): boolean => Object.keys(obj).length === 0 && obj.constructor === Object;

const isRequired = (schemaNode: SchemaNode | SchemaNodeArray): boolean => schemaNode?.required || schemaNode?.mandatory || false;

const validateObject = (propNames: string[], schemaNode: SchemaNode, bodyNode: any): Record<string, string> => {
  /** Check if Object is Required but not present */
  if (isRequired(schemaNode) && (bodyNode === null || bodyNode === undefined)) {
    return { [propNames.length > 0 ? propNames.join('.') : 'body']: 'is required' };
  }
  if (typeof bodyNode !== 'undefined' && bodyNode.constructor !== Object) {
    return { [propNames.length > 0 ? propNames.join('.') : 'body']: 'must be of type object' };
  }
  if (bodyNode && bodyNode.constructor === Object) {
    const schemaKeys = schemaNode.strict && schemaNode.properties ? Object.keys(schemaNode.properties) : [];

    return {
      /** Recursive call to each of the properties of the object */
      ...Object.entries(schemaNode.properties || {}).reduce((errors, [propName, propNode]) => {
        return merge(errors, validateNode(propNode, bodyNode[propName], propNames.concat([propName])));
      }, {}),

      ...(schemaNode.strict &&
        schemaNode.properties &&
        Object.keys(bodyNode).reduce((acc, k) => {
          if (!schemaKeys.includes(k)) {
            return {
              ...acc,
              [`${[propNames.length > 0 ? `${propNames.join('.')}.` : '']}${k}`]: 'is not allowed on this object'
            };
          }
          return acc;
        }, {})),

      /** Call Function if exists */
      ...(schemaNode.function && schemaNode.function(propNames.length > 0 ? propNames.join('.') : 'body', schemaNode, bodyNode))
    };
  }
  return {};
};

const validateArray = (propNames: string[], schemaNode: SchemaNodeArray, bodyNode: any): Record<string, string> => {
  /** Check if Array is Required but not present */
  const isPresent = bodyNode !== null && bodyNode !== undefined;
  if (isRequired(schemaNode) && !isPresent) {
    return { [propNames.length > 0 ? propNames.join('.') : 'body']: 'is required' };
  }

  if (isPresent) {
    if (!Array.isArray(bodyNode)) {
      return { [propNames.length > 0 ? propNames.join('.') : 'body']: 'must be of type array' };
    }

    /** Check if length is between min and max if both exists */
    if (typeof schemaNode.minLength === 'number' && typeof schemaNode.maxLength === 'number') {
      if (bodyNode.length < schemaNode.minLength || bodyNode.length > schemaNode.maxLength) {
        return {
          [propNames.length > 0
            ? propNames.join('.')
            : 'body']: `length must be between ${schemaNode.minLength} and ${schemaNode.maxLength}`
        };
      }
    } else {
      /** Check if length is greater than min (only one exists [not between]) */
      if (typeof schemaNode.minLength === 'number' && bodyNode.length < schemaNode.minLength) {
        return { [propNames.length > 0 ? propNames.join('.') : 'body']: `length must be at least ${schemaNode.minLength}` };
      }
      /** Check if length is less than max (only one exists [not between]) */
      if (typeof schemaNode.maxLength === 'number' && bodyNode.length > schemaNode.maxLength) {
        return { [propNames.length > 0 ? propNames.join('.') : 'body']: `length must not exceed ${schemaNode.maxLength}` };
      }
    }

    if (schemaNode.uniqueEntries) {
      const uniqueEntriesErrors = Object.entries(
        bodyNode.reduce<Record<string, number[]>>((acc, o: any, i: number) => {
          let value: string;
          if (typeof schemaNode.uniqueEntries === 'string') {
            value = o[schemaNode.uniqueEntries];
          } else if (typeof schemaNode.uniqueEntries === 'function') {
            value = schemaNode.uniqueEntries(o);
          } else {
            value = o;
          }
          if (value) {
            acc[value] = acc[value] || [];
            acc[value].push(i);
          }
          return acc;
        }, {})
      )
        .filter(([_, i]) => i.length > 1)
        .reduce((acc, [p, i]) => {
          const schemaUniqPropName = typeof schemaNode.uniqueEntries === 'string' ? `.${schemaNode.uniqueEntries}` : '';
          i.forEach((ii, ind) => {
            if (ind > 0) {
              acc[`${propNames.length > 0 ? `${propNames.join('.')}.` : ''}index-${ii}${schemaUniqPropName}`] = `is a duplicate (${p})`;
            }
          });
          return acc;
        }, {});
      if (!isEmptyObject(uniqueEntriesErrors)) {
        return uniqueEntriesErrors;
      }
    }
    if (Array.isArray(bodyNode) && (schemaNode.items || schemaNode.properties)) {
      return {
        /** Recursive call to each of the properties of the array */
        ...bodyNode.reduce((errors: Record<string, string>, arrayNode, arrayIndex) => {
          return merge(
            errors,
            validateNode(<SchemaNodeArray>(schemaNode.items || schemaNode.properties), arrayNode, propNames.concat([`index-${arrayIndex}`]))
          );
        }, {}),

        /** Call Function if exists */
        ...(schemaNode.function && schemaNode.function(propNames.length > 0 ? propNames.join('.') : 'body', schemaNode, bodyNode))
      };
    }
  }
  return {};
};

const validateString = (propNames: string[], schemaNode: SchemaNode, bodyNode: any): Record<string, string> => {
  /** Check if String is Required but not present */
  if (!bodyNode || bodyNode === '') {
    if (isRequired(schemaNode)) {
      return { [propNames.join('.')]: 'is required' };
    } else {
      return {};
    }
  }
  /** Check if String is of type String */
  if (typeof bodyNode !== 'undefined' && typeof bodyNode !== 'string') {
    return { [propNames.join('.')]: 'must be of type string' };
  }
  const schemaNodeString = <string>bodyNode;
  /** Check if String matches a pattern if pattern exists */
  if (schemaNode.pattern && !new RegExp(schemaNode.pattern).test(schemaNodeString)) {
    return { [propNames.join('.')]: `does not match pattern${schemaNode.patternHelper ? ` (${schemaNode.patternHelper})` : ''}` };
  }
  if (schemaNode.options && schemaNode.options?.length > 0 && !schemaNode.options.map((n) => n.value).includes(<string>bodyNode)) {
    return { [propNames.join('.')]: `not a valid option${schemaNode.optionsHelper ? ` (${schemaNode.optionsHelper})` : ''}` };
  }
  /** Check if String matches function if function exists */
  if (schemaNode.function) {
    return schemaNode.function(propNames.join('.'), schemaNode, bodyNode);
  }
  return {};
};

const validateBoolean = (propNames: string[], schemaNode: SchemaNode, bodyNode: any): Record<string, string> => {
  /** Check if Boolean is Required but not present */
  if (isRequired(schemaNode) && typeof bodyNode === 'undefined') {
    return { [propNames.join('.')]: 'is required' };
  }
  /** Check if is of type Boolean */
  if (typeof bodyNode !== 'undefined' && typeof bodyNode !== 'boolean') {
    return { [propNames.join('.')]: 'must be of type boolean' };
  }
  return {};
};

const validateNumber = (propNames: string[], schemaNode: SchemaNode, bodyNode: any): Record<string, string> => {
  /** Check if Number is Required but not present */
  if (isRequired(schemaNode) && typeof bodyNode === 'undefined') {
    return { [propNames.join('.')]: 'is required' };
  }
  /** Check if Number is of type Number */
  if (typeof bodyNode !== 'undefined' && typeof bodyNode !== 'number') {
    return { [propNames.join('.')]: 'must be of type number' };
  }
  const bodyNodeNum = <number>bodyNode;
  /** Check if Number matches a pattern if pattern exists */
  if (schemaNode.pattern && !new RegExp(schemaNode.pattern).test(bodyNodeNum.toString())) {
    return { [propNames.join('.')]: `does not match pattern${schemaNode.patternHelper ? ` (${schemaNode.patternHelper})` : ''}` };
  }
  /** Check if Number is between min and max if both exists */
  if (typeof schemaNode.min === 'number' && typeof schemaNode.max === 'number') {
    if (bodyNodeNum < schemaNode.min || bodyNodeNum > schemaNode.max) {
      return { [propNames.join('.')]: `must be between ${schemaNode.min} and ${schemaNode.max}` };
    }
  } else {
    /** Check if Number is greater than min (only one exists [not between]) */
    if (typeof schemaNode.min === 'number' && bodyNodeNum < schemaNode.min) {
      return { [propNames.join('.')]: `must be greater than ${schemaNode.min}` };
    }
    /** Check if Number is less than max (only one exists [not between]) */
    if (typeof schemaNode.max === 'number' && bodyNodeNum > schemaNode.max) {
      return { [propNames.join('.')]: `must be less than ${schemaNode.max}` };
    }
  }
  if (
    schemaNode.options &&
    schemaNode.options?.length > 0 &&
    !schemaNode.options.map((n) => n.value).includes((<number>bodyNode).toString())
  ) {
    return { [propNames.join('.')]: 'not a valid option' };
  }
  /** Check if Number matches function if function exists */
  if (schemaNode.function) {
    return schemaNode.function(propNames.join('.'), schemaNode, bodyNode);
  }
  return {};
};

export const validateNode = (schemaNode: SchemaNode | SchemaNodeArray, bodyNode: any, propNames: string[] = []): Record<string, string> => {
  switch (schemaNode.type) {
    case 'object':
      return validateObject(propNames, <SchemaNode>schemaNode, bodyNode);
    case 'array':
      return validateArray(propNames, <SchemaNodeArray>schemaNode, bodyNode);
    case 'string':
      return validateString(propNames, <SchemaNode>schemaNode, bodyNode);
    case 'number':
      return validateNumber(propNames, <SchemaNode>schemaNode, bodyNode);
    case 'boolean':
      return validateBoolean(propNames, <SchemaNode>schemaNode, bodyNode);
    case 'ignore':
      return {};
    default:
      throw Error(`Unknown schema type ${schemaNode.type}`);
  }
};

const merge = (object1: Record<string, string>, object2: Record<string, string>): Record<string, string> => ({
  ...object1,
  ...object2
});

export const makeResponseFromErrors = (validationErrors: Record<string, string>): Response => {
  console.info('[400] Validation Errors - ', JSON.stringify(validationErrors));
  return response({ message: 'Validation Errors', validationErrors }, code.BAD_REQUEST);
};

export const validateRequest = (
  requestSchema: SchemaNode | SchemaNodeArray,
  body: any
): { valid: boolean; validationResponse?: Response } => {
  try {
    const validationErrors = validateNode(requestSchema, body);
    if (isEmptyObject(validationErrors)) {
      return { valid: true };
    }
    return { valid: false, validationResponse: makeResponseFromErrors(validationErrors) };
  } catch (e) {
    throw e;
  }
};

export default validateRequest;
