import { TypeKind } from "graphql";
import { gql } from "graphql-request";
import { ApiClient } from "./ApiClient";

export interface IntrospectionQueryOutput {
  __schema: {
    types: NamedType[];
  };
}

export interface NamedType {
  kind: TypeKind;
  name: string;
  fields: Field[] | null;
  interfaces: TypeRef[] | null;
  possibleTypes: TypeRef[] | null;
  enumValues: EnumValue[] | null;
}

export interface Field {
  name: string;
  type: TypeRef;
}

export interface TypeRef {
  kind: TypeKind;
  name: string | null;
  ofType?: TypeRef;
}

export interface EnumValue {
  name: string;
}

const IntrospectionQuery = gql`
  query IntrospectionQuery {
    __schema {
      types {
        ...FullType
      }
    }
  }

  fragment FullType on __Type {
    kind
    name
    fields {
      name
      type {
        ...TypeRef
      }
    }
    interfaces {
      ...TypeRef
    }
    possibleTypes {
      ...TypeRef
    }
    enumValues {
      name
    }
  }

  fragment TypeRef on __Type {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

export async function getIntrospection(
  client: ApiClient
): Promise<IntrospectionQueryOutput> {
  return await client.request<IntrospectionQueryOutput>(IntrospectionQuery);
}
