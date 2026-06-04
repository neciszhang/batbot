import { z } from "zod";

/**
 * OpenAI function tool schema format (sent to LLM).
 */
export interface ToolSchema {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
}

type JsonSchemaType =
  | "string"
  | "integer"
  | "number"
  | "boolean"
  | "array"
  | "object";

interface JsonSchema {
  type?: JsonSchemaType;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  [key: string]: unknown;
}

export abstract class Tool<S extends z.ZodType = z.ZodType> {
  protected static readonly _TYPE_MAP: Record<
    JsonSchemaType,
    (v: unknown) => boolean
  > = {
    string: (v) => typeof v === "string",
    integer: (v) => typeof v === "number" && Number.isInteger(v),
    number: (v) => typeof v === "number",
    boolean: (v) => typeof v === "boolean",
    array: (v) => Array.isArray(v),
    object: (v: unknown) =>
      typeof v === "object" && v !== null && !Array.isArray(v),
  };
  /** Tool name used in function calls. */
  abstract get name(): string;

  /** Description of what the tool does. */
  abstract get description(): string;

  /**
   * Zod schema describing the tool parameters (TS-specific).
   * Must correspond to an object-type JSON Schema.
   */
  abstract get schema(): S;

  /**
   * JSON Schema for tool parameters. Mirrors Python `parameters`.
   * Derived from the Zod `schema` via `z.toJSONSchema`.
   */
  get parameters(): JsonSchema {
    return z.toJSONSchema(this.schema) as JsonSchema;
  }

  /**
   * Execute the tool with given parameters.
   * @param params Tool-specific parameters.
   * @returns String result of the tool execution.
   */
  abstract execute(params: z.infer<S>): Promise<string>;

  /**
   * Apply safe schema-driven casts before validation.
   * @param params Parameters to cast.
   * @returns Casted parameters.
   */
  castParams(params: unknown): z.infer<S> {
    const schema: JsonSchema = this.parameters || {};
    if (schema.type ?? "object" !== "object") {
      return params as z.infer<S>;
    }
    return this._castObject(params, schema) as z.infer<S>;
  }

  /**
   * Cast an object (dict) according to schema.
   * @param obj Object to cast.
   * @param schema JSON Schema for casting.
   * @returns Casted object.
   */
  _castObject(obj: unknown, schema: JsonSchema): Record<string, unknown> {
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      return obj as Record<string, unknown>;
    }

    const props = schema.properties ?? {};
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (props[key]) {
        result[key] = this._castValue(value, props[key]);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Cast a value according to schema.
   * @param val Value to cast.
   * @param schema JSON Schema for casting.
   * @returns Casted value.
   */
  _castValue(val: unknown, schema: JsonSchema): unknown {
    const targetType = schema.type;
    const TM = Tool._TYPE_MAP;
    if (targetType === "boolean" && TM.boolean(val)) {
      return val;
    }

    if (targetType === "integer" && TM.integer(val)) {
      return val;
    }

    if (
      targetType !== undefined &&
      targetType in TM &&
      !["boolean", "integer", "array", "object"].includes(targetType) &&
      TM[targetType](val)
    ) {
      return val;
    }

    // String -> integer
    if (targetType === "integer" && typeof val === "string") {
      const trimmed = val.trim();
      if (/^[-+]?\d+$/.test(trimmed)) {
        const n = parseInt(trimmed, 10);
        if (!Number.isNaN(n)) return n;
      }

      return val;
    }

    // String -> number
    if (targetType === "number" && typeof val === "string") {
      const trimmed = val.trim();
      if (/^[-+]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
        const n = parseFloat(trimmed);
        if (!Number.isNaN(n)) return n;
      }
      return val;
    }

    // Anything -> string
    if (targetType === "string") {
      return val === null || val === undefined ? val : String(val);
    }

    // String -> boolean
    if (targetType === "boolean" && typeof val === "string") {
      const lower = val.toLowerCase();
      if (["true", "1", "yes"].includes(lower)) return true;
      if (["false", "0", "no"].includes(lower)) return false;
      return val;
    }

    // Array -> recurse into items
    if (targetType === "array" && TM.array(val)) {
      const itemSchema = schema.items;
      return itemSchema
        ? (val as unknown[]).map((v) => this._castValue(v, itemSchema))
        : val;
    }

    // Object -> recurse into items
    if (targetType === "object" && TM.object(val)) {
      return this._castObject(val, schema);
    }

    return val;
  }

  /**
   * Validate tool parameters against JSON schema. Returns error list (empty if valid).
   * @param params Parameters to validate.
   */
  validateParams(params: unknown): string[] {
    if (
      typeof params !== "object" ||
      params === null ||
      Array.isArray(params)
    ) {
      const typeName = Array.isArray(params)
        ? "array"
        : params === null
          ? "null"
          : typeof params;
      return [`parameters must be an object, got ${typeName}`];
    }

    const schema: JsonSchema = this.parameters || {};
    if ((schema.type ?? "object") !== "object") {
      throw new Error(
        `Schema must be object type, got ${JSON.stringify(schema.type)}`,
      );
    }

    return this._validate(params, { ...schema, type: "object" }, "");
  }

  protected _validate(
    val: unknown,
    schema: JsonSchema,
    path: string,
  ): string[] {
    const t = schema.type;
    const label = path || "parameter";
    const TM = Tool._TYPE_MAP;

    if (t !== undefined && t in TM && !TM[t](val)) {
      return [`${label} must be a ${t}`];
    }

    const errors: string[] = [];

    if (schema.enum !== undefined && !schema.enum.includes(val))
      errors.push(`${label} must be one of ${JSON.stringify(schema.enum)}`);

    if (t === "integer" || t === "number") {
      const n = val as number;
      if (schema.minimum !== undefined && n < schema.minimum) {
        errors.push(`${label}  must be >=  ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && n > schema.maximum) {
        errors.push(`${label}  must be <=  ${schema.maximum}`);
      }
    }

    if (t === "string") {
      const s = val as string;
      if (schema.minLength !== undefined && s.length < schema.minLength) {
        errors.push(`${label} must be at least ${schema.minLength} characters`);
      }
      if (schema.maxLength !== undefined && s.length > schema.maxLength) {
        errors.push(`${label} must be at most ${schema.maxLength} characters`);
      }
    }

    if (t === "object") {
      const obj = val as Record<string, unknown>;
      const props = schema.properties ?? {};
      for (const k of schema.required ?? []) {
        if (!(k in obj)) {
          errors.push(`missing required ${path ? path + "." + k : k}`);
        }
      }

      for (const [k, v] of Object.entries(obj)) {
        if (k in props) {
          errors.push(
            ...this._validate(v, props[k], path ? `${path}.${k}` : k),
          );
        }
      }
    }

    if (t === "array" && schema.items !== undefined) {
      const arr = val as unknown[];

      arr.forEach((item, i) => {
        const itemErrors = this._validate(
          item,
          schema.items as JsonSchema,
          path ? `${path}[${i}]` : `[${i}]`,
        );
        errors.push(...itemErrors);
      });
    }

    return errors;
  }

  toSchema(): ToolSchema {
    return {
      type: "function",
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters,
      },
    };
  }
}
