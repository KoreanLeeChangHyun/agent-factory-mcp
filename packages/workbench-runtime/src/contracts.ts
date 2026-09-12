import type { AssetParameter, WorkbenchDefinition } from "@agent-factory/contracts";

export interface RuntimeScope {
  userId: string;
  organizationId: string;
  workspaceId: string;
  workbenchId: string;
  releaseId: string;
}
export type RuntimeValue = string | number | boolean | null | RuntimeRecord | RuntimeValue[];
export interface RuntimeRecord {
  [key: string]: RuntimeValue;
}
export interface BindingRequest {
  operationId: string;
  input: RuntimeRecord;
  scope: RuntimeScope;
  signal: AbortSignal;
}
export interface BindingClient {
  execute(request: BindingRequest): Promise<RuntimeRecord>;
}
export interface BindingOperation {
  id: string;
  inputs: readonly AssetParameter[];
  outputs: readonly AssetParameter[];
}
export interface RuntimeDiagnostic {
  path: string;
  code: string;
  message: string;
}
export interface WorkbenchRegistration {
  definition: WorkbenchDefinition;
  origin: "standard" | "customer";
  releaseId: string;
}
