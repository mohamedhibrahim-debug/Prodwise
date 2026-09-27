export const FIXTURE_ORIGIN_LABEL="Prodwise demo setup";

/** Fixture provenance takes precedence over referential-integrity actor labels. */
export function safeUserLabel(value:{preparedAsFixture?:boolean;confirmedByLabel?:string|null}):string {
  return value.preparedAsFixture ? FIXTURE_ORIGIN_LABEL : value.confirmedByLabel?.trim() || "Confirmation not recorded";
}
