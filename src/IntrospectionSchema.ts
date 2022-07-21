import { asError } from "catch-unknown";
import {
  assertInterfaceType,
  assertObjectType,
  GraphQLEnumType,
  GraphQLFieldConfig,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNamedType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLUnionType,
  TypeKind,
} from "graphql";
import { ObjMap } from "graphql/jsutils/ObjMap";
import {
  Field,
  IntrospectionQueryOutput,
  NamedType,
  TypeRef,
} from "./IntrospectionQuery";

type GraphQLNamedOutputType = GraphQLNamedType & GraphQLOutputType;

export class IntrospectionSchema {
  private readonly namedTypes = new Map<string, GraphQLNamedOutputType>();

  public constructor(introspection: IntrospectionQueryOutput) {
    for (const type of introspection.__schema.types) {
      const namedType = this.makeNamedType(type);
      if (namedType) {
        this.namedTypes.set(namedType.name, namedType);
      }
    }
  }

  public getNamedType(name: string): GraphQLNamedOutputType | undefined {
    return this.namedTypes.get(name);
  }

  private makeNamedType(type: NamedType): GraphQLNamedOutputType | null {
    const { kind, name } = type;
    try {
      switch (kind) {
        case TypeKind.SCALAR:
          return new GraphQLScalarType({ name });
        case TypeKind.OBJECT:
          return new GraphQLObjectType({
            name,
            fields: () => this.makeFieldConfig(type.fields ?? []),
            interfaces: () =>
              (type.interfaces ?? []).map((t) =>
                assertInterfaceType(this.resolveNamedType(t))
              ),
          });
        case TypeKind.INTERFACE:
          return new GraphQLInterfaceType({
            name,
            fields: () => this.makeFieldConfig(type.fields ?? []),
          });
        case TypeKind.UNION:
          return new GraphQLUnionType({
            name,
            types: () =>
              (type.possibleTypes ?? []).map((t) =>
                assertObjectType(this.resolveNamedType(t))
              ),
          });
        case TypeKind.ENUM:
          return new GraphQLEnumType({
            name,
            values: Object.fromEntries(
              (type.enumValues ?? []).map((v) => [v.name, {}])
            ),
          });
        default:
          // ignore input types
          return null;
      }
    } catch (err) {
      throw new Error(
        `Error constructing ${kind} type ${name}: ${asError(err).message}`
      );
    }
  }

  private makeFieldConfig(
    fields: Field[]
  ): ObjMap<GraphQLFieldConfig<unknown, unknown, unknown>> {
    return Object.fromEntries(
      fields.map((f) => {
        try {
          const type = this.resolveOutputType(f.type);
          return [f.name, { type }];
        } catch (err) {
          throw new Error(
            `Error resolving type of field ${f.name}: ${asError(err).message}`
          );
        }
      })
    );
  }

  private resolveOutputType(type: TypeRef): GraphQLOutputType {
    const { kind, ofType } = type;
    switch (kind) {
      case TypeKind.SCALAR:
      case TypeKind.OBJECT:
      case TypeKind.INTERFACE:
      case TypeKind.UNION:
      case TypeKind.ENUM:
        return this.resolveNamedType(type);
      case TypeKind.LIST:
        if (!ofType) {
          throw new Error("No element type for list type");
        }
        return new GraphQLList(this.resolveOutputType(ofType));
      case TypeKind.NON_NULL:
        if (!ofType) {
          throw new Error("No element type for non-null type");
        }
        return new GraphQLNonNull(this.resolveOutputType(ofType));
      default:
        throw new Error(`Unexpected ${kind} type`);
    }
  }

  private resolveNamedType(type: TypeRef): GraphQLNamedOutputType {
    const { kind, name } = type;
    if (!name) {
      throw new Error(`Name expected for ${kind} type`);
    }
    const namedType = this.namedTypes.get(name);
    if (!namedType) {
      throw new Error(`Unresolved reference to ${kind} type ${name}`);
    }
    return namedType;
  }
}
