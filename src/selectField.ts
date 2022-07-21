import {
  GraphQLInterfaceType,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLOutputType,
  isEnumType,
  isInterfaceType,
  isNamedType,
  isObjectType,
  isScalarType,
  isUnionType,
} from "graphql";

export interface SelectFieldOptions {
  omitFieldType?: (type: GraphQLNamedType) => boolean;
}

export function selectAllFields(
  type: GraphQLObjectType | GraphQLInterfaceType,
  options?: SelectFieldOptions
): string[] {
  const omitFieldType = (t: GraphQLNamedType): boolean => {
    return t === type || options?.omitFieldType?.(t) === true;
  };
  const result: string[] = [];
  for (const field of Object.values(type.getFields())) {
    const { name, type } = field;
    const select = selectField(name, type, { omitFieldType });
    if (select != null) {
      result.push(select);
    }
  }
  return result;
}

export function selectField(name: string, type: GraphQLOutputType): string;
export function selectField(
  name: string,
  type: GraphQLOutputType,
  options?: SelectFieldOptions
): string | null;
export function selectField(
  name: string,
  type: GraphQLOutputType,
  options?: SelectFieldOptions
): string | null {
  if (!isNamedType(type)) {
    return selectField(name, type.ofType, options);
  }
  if (options?.omitFieldType?.(type)) {
    return null;
  }
  if (isScalarType(type) || isEnumType(type)) {
    return name;
  }
  if (isObjectType(type) || isInterfaceType(type)) {
    const selects = selectAllFields(type, options);
    return selectSubfields(name, selects);
  }
  if (isUnionType(type)) {
    const selects = new Set<string>();
    for (const member of type.getTypes()) {
      selectAllFields(member, options).forEach((select) => selects.add(select));
    }
    return selectSubfields(name, Array.from(selects));
  }
  return null;
}

export function selectSubfields(name: string, fields: string[]): string {
  return `${name} { ${fields.join(" ")} }`;
}
