# Stage 2.2A rollback and reapply

Run only against a local disposable database for this audit. No hosted migration
or rollback is authorized by this remediation.

`0009_stage2_2_decision_truth.sql` reverses committed migration 0009 in a single
transaction and restores the Stage 2.1 reopen function. Its existing execution
privileges are preserved by CREATE OR REPLACE. The rollback refuses databases
containing decision or confirmer data or audit events; populated deployments need
a separately reviewed data-preserving migration, not deletion of decision history.

The committed `HUMAN_DECISION` enum label from 0008 remains. PostgreSQL does not
support removing an enum label directly. Do not edit system catalogs or recreate
the enum. Migration 0008 uses ADD VALUE IF NOT EXISTS so reapplying 0008 followed
by 0009 works with this retained label.

The Stage 2.2 harness commits 0008/0009, commits this rollback, verifies the removed
schema/RPC and retained enum, runs Stage 2.1 reopen tests, then reapplies 0008/0009
and runs choose-existing assertions. It also tests transaction rollback of the
initial migration application. All databases are local and disposable.
