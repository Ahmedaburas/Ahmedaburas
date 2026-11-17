import { createContext, useContext } from "react";

export const MetaContext = createContext(null);

export function useMeta() {
  const meta = useContext(MetaContext);
  if (!meta) throw new Error("Directory has not loaded");
  return meta;
}
