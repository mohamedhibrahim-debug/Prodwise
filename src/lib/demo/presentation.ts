export const FIXTURE_ORIGIN_LABEL="Synthetic scenario preparation";

/** Fixture provenance takes precedence over referential-integrity actor labels. */
export function safeUserLabel(value:{preparedAsFixture?:boolean;confirmedByLabel?:string|null}):string {
  return value.preparedAsFixture ? FIXTURE_ORIGIN_LABEL : value.confirmedByLabel?.trim() || "Confirmation not recorded";
}
