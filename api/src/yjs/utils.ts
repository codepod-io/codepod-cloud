import { Schema, Node as PMNode } from "@remirror/pm/model";
import {
  prosemirrorToYDoc,
  prosemirrorToYXmlFragment,
  yXmlFragmentToProsemirrorJSON,
} from "y-prosemirror";

import * as Y from "yjs";

import { customAlphabet } from "nanoid";
import { lowercase, numbers } from "nanoid-dictionary";

import { schema } from "./remirrorSchema";

export const myNanoId = customAlphabet(lowercase + numbers, 20);

/**
 * From prosemirror json to Y.XmlFragment.
 * @param json Parsed json object.
 * @returns
 */
export function json2yxml(json: Object) {
  if (!json) {
    return new Y.XmlFragment();
  }
  // const myschema = new Schema(myspec);
  const doc2 = PMNode.fromJSON(schema, json);
  // console.log("PMDoc2", doc2);
  const yxml = prosemirrorToYXmlFragment(doc2);
  // console.log("Ydoc2", ydoc2.toJSON());
  return yxml;
}

export function yxml2json(yxml) {
  return yXmlFragmentToProsemirrorJSON(yxml);
}
