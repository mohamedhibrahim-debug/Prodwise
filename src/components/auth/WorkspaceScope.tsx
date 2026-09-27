"use client";
import { createContext, useContext, type ReactNode } from "react";
const Scope=createContext<string>("");
/** Provided by the authenticated server layout. Old tabs retain their rendered
 * scope so a new cookie cannot silently retarget an already-filled form. */
export function WorkspaceScopeProvider({workspaceId,children}:{workspaceId:string;children:ReactNode}) {
  return <Scope.Provider value={workspaceId}>{children}</Scope.Provider>;
}
export function useWorkspaceScope(){return useContext(Scope);}
export function ScopeField(){return <input type="hidden" name="scopeWorkspaceId" value={useWorkspaceScope()}/>;}
