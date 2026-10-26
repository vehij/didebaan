import type { Account, Device } from './types';

export const ALL_PROJECTS = '__all__';
export const NO_PROJECT = '__none__';

/** An account belongs to a project if it, or any device it is logged in on, is assigned to it. */
export function inProject(a: Account, project: string, devices: Map<string, Device>): boolean {
  if (project === ALL_PROJECTS) return true;
  const names = [a.project, ...a.deviceIds.map((id) => devices.get(id)?.project ?? '')].map((p) => p.trim());
  if (project === NO_PROJECT) return names.every((p) => !p);
  return names.includes(project);
}

/** A device belongs to a project if it, or any account logged in on it, is assigned to it. */
export function deviceInProject(d: Device, project: string, accounts: Account[]): boolean {
  if (project === ALL_PROJECTS) return true;
  const names = [d.project, ...accounts.filter((a) => a.deviceIds.includes(d.id)).map((a) => a.project)].map((p) => p.trim());
  if (project === NO_PROJECT) return names.every((p) => !p);
  return names.includes(project);
}
