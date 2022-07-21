export interface SubscriptionEventsBatch {
  __typename: "SubscriptionEventsBatch";

  // Events by subscription
  subscriptionEvents: SubscriptionEvents[];

  // For ping messages, when to expect the next ping by
  nextPingBy?: string;
}

export interface SubscriptionEvents {
  __typename: "SubscriptionEvents";

  subscriptionId: string;
  events: Event[];
}

export type Event = PingEvent | DataEventWithId;

export interface PingEvent {
  __typename: "PingEvent";

  lastDeliveredEventId?: string;
}

export type DataEventWithId = DataEvent & {
  eventId: string;
};

export type DataEvent = ObjectCreate | ObjectDelete | ObjectUpdate;

export interface ObjectCreate {
  __typename: "ObjectCreate";

  // Identity of the new (feed query) object
  objectId: string;
  objectType: string;
  objectCreatedAt: number;

  // If the (feed query) object is not a synchronization root object,
  // identity of that object and version
  syncObjectId?: string;
  syncObjectType?: string;
  syncObjectVersion?: number;

  // If neither object above is a conceptual root object,
  // identity of that object
  rootObjectId?: string;
  rootObjectType?: string;

  // Organization that owns the object
  organizationId: string;

  // The entire object representation, including generated or computed fields
  value: JsonValue;

  // User or actor that created the object
  userId: string;

  // Activity object associated with creation of the object, if any
  activityId?: string;
}

export interface ObjectDelete {
  __typename: "ObjectDelete";

  // Identity of the deleted (feed query) object and version
  objectId: string;
  objectType: string;
  objectVersion?: number;
  objectDeletedAt: number;

  // If the (feed query) object is not a synchronization root object,
  // identity of that object and version
  syncObjectId?: string;
  syncObjectType?: string;
  syncObjectVersion?: number;

  // If neither object above is a conceptual root object,
  // identity of that object
  rootObjectId?: string;
  rootObjectType?: string;

  // Organization that owned the object
  organizationId: string;

  // The entire object representation at the time of deletion
  oldValue: JsonValue;

  // User or actor that deleted the object
  userId: string;

  // Activity object associated with deletion of the object, if any
  activityId?: string;
}

export interface ObjectUpdate {
  __typename: "ObjectUpdate";

  // Identity of the (feed query) object and version (before the update)
  objectId: string;
  objectType: string;
  objectVersion?: number;
  objectWasUpdatedAt: number;
  objectNowUpdatedAt: number;

  // If the (feed query) object is not a synchronization root object,
  // identity of that object and version
  syncObjectId?: string;
  syncObjectType?: string;
  syncObjectVersion?: number;

  // If neither object above is a conceptual root object,
  // identity of that object
  rootObjectId?: string;
  rootObjectType?: string;

  // Organization that owns the object
  organizationId: string;

  // All changes to the object, including generated or computed fields
  fieldChanges: FieldChange[];

  // User or actor that updated the object
  userId: string;

  // Activity object associated with update of the object, if any
  activityId?: string;
}

export type FieldChange = FieldCreate | FieldAppend | FieldUpdate | FieldDelete;

export interface FieldCreate {
  __typename: "FieldCreate";

  // JSON Selector identifying the field being created
  selector: string;

  // The initial value of the new field (including generated or computed fields)
  value: JsonValue;
}

export interface FieldAppend {
  __typename: "FieldAppend";

  // JSON Selector identifying the array field to which the new value is being
  // appended
  selector: string;

  // The value being appended (including generated or computed fields)
  value: JsonValue;
}

export interface FieldUpdate {
  __typename: "FieldUpdate";

  // JSON Selector identifying the field being updated
  selector: string;

  // Field value before the update (including generated or computed fields)
  oldValue: JsonValue;

  // Field value after the update (including generated or computed fields)
  value: JsonValue;
}

export interface FieldDelete {
  __typename: "FieldDelete";

  // JSON Selector identifying the field or array element being deleted
  selector: string;

  // Field value at the time of deletion (including generated or computed
  // fields)
  oldValue: JsonValue;
}

export type JsonValue =
  | boolean
  | null
  | number
  | string
  | JsonArray
  | JsonObject;

export type JsonArray = JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}
