import {
  accessWithJsonSelector,
  parseJsonSelector,
} from "@loancrate/json-selector";
import { FieldChange } from "./SubscriptionEventsBatch.js";
import { isArray } from "./util.js";

export function applyFieldChange(change: FieldChange, target: unknown): void {
  const selector = parseJsonSelector(change.selector);
  const accessor = accessWithJsonSelector(selector, target);
  if (!accessor.valid) {
    throw new Error(
      `Invalid selector in ${change.__typename}: ${accessor.path}`
    );
  }
  switch (change.__typename) {
    case "FieldCreate": {
      const oldValue = accessor.get();
      if (oldValue != null) {
        throw new Error(
          `Unexpected existing value of type ${typeof oldValue} for field create at ${
            accessor.path
          }`
        );
      }
      accessor.set(change.value);
      break;
    }
    case "FieldDelete": {
      accessor.delete();
      break;
    }
    case "FieldUpdate": {
      accessor.set(change.value);
      break;
    }
    case "FieldAppend": {
      const oldValue = accessor.get();
      if (isArray(oldValue)) {
        accessor.set([...oldValue, change.value]);
      } else if (oldValue == null) {
        accessor.set([change.value]);
      } else {
        throw new Error(
          `Unexpected existing value of type ${typeof oldValue} for field append at ${
            accessor.path
          }`
        );
      }
      break;
    }
  }
}
