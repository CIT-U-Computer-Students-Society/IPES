import { execute, python } from '../../scripts/e2e-common.mjs';

export type Fixture = {
  namespace: string; scenario: string; title: string;
  organization: { id: number; name: string; code: string };
  foreignOrganization: { id: number; name: string };
  users: Record<string, { id: number; email: string; password: string }>;
  formId: number; assignmentId: number; questionIds: number[];
};
export type Snapshot = {
  engine: string; serverVersion: string; organizationId: number; capturedAt: string;
  organizations: { id: number; name: string; is_active: boolean }[];
  joinRequests: { id: number; user_id: number; status: string }[];
  sessions: { active_count: number }[];
  forms: { id: number; title: string; is_active: boolean; is_deleted: boolean; results_released: boolean }[];
  questions: { id: number; form_id_id: number; text: string; weight: number; order: number }[];
  assignments: { id: number; form_id_id: number; evaluator_id_id: number; evaluatee_id_id: number; status: string; total_score: number | null; submitted_at: string | null }[];
  responses: { id: number; assignment_id_id: number; question_id_id: number; score_value: number; text: string | null }[];
  accomplishments: { id: number; title: string; status: string; verified_by_id: number | null; comments: string | null }[];
  audit: { id: number; action: string; user_id_id: number }[];
};
export async function seed(scenario: string, namespace: string): Promise<Fixture> {
  if (!process.env.IPES_E2E_DATABASE) throw new Error('Use npm run test:e2e so a disposable database is provisioned.');
  return JSON.parse(await execute(python, ['manage.py', 'seed_e2e', '--scenario', scenario, '--namespace', namespace]));
}
export async function snapshot(organization: number): Promise<Snapshot> {
  return JSON.parse(await execute(python, ['manage.py', 'snapshot_e2e', '--organization', String(organization)]));
}
