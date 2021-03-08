export interface IField {
  name: string;
  type: string;
  description?: string;
}

export interface ICustomObjectRelationship {
  name: string;
  type: "array" | "object";
  remote_table: string;
  field_mapping: Record<string, string>; // localField: remoteField
}

export interface IEnumValue {
  value: string;
  desctiption?: string;
  is_deprecated?: boolean;
}

export interface ICustomObjectType {
  type: "ObjectType";
  name: string;
  fields: IField[];
  relationships?: ICustomObjectRelationship[];
  description?: string;
}

export interface ICustomInputType {
  type: "InputType";
  name: string;
  fields: IField[];
  description?: string;
}

export interface ICustomEnumType {
  type: "EnumType";
  name: string;
  values: IEnumValue[];
  description?: string;
}

export type ICustomType =
  | ICustomEnumType
  | ICustomInputType
  | ICustomObjectType;
