import Type, { type TSchema } from "typebox";
import Ajv from "ajv";

const ajv = new Ajv({ allErrors: true, verbose: true });

export type { TSchema };

export function validateToolCall(
  schema: TSchema,
  params: unknown,
): { valid: boolean; errors?: string } {
  const validate = ajv.compile(schema);
  const valid = validate(params);

  if (!valid && validate.errors) {
    const errors = validate.errors.map((e) => `${e.instancePath} ${e.message}`).join(", ");
    return { valid: false, errors };
  }

  return { valid: true };
}

export function createToolSchema<T extends TSchema>(schema: T): T {
  return schema;
}

export const String = Type.String;
export const Number = Type.Number;
export const Boolean = Type.Boolean;
export const Object = Type.Object;
export const Array = Type.Array;
export const Optional = Type.Optional;
export const Union = Type.Union;
export const Enum = Type.Enum;
export const Null = Type.Null;
export const Any = Type.Any;
export const Unknown = Type.Unknown;
export const Literal = Type.Literal;

export function toolParams<T extends TSchema>(properties: T["properties"], required?: string[]): T {
  return Type.Object(properties, { required }) as T;
}
