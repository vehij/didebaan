import { describe, expect, it } from 'vitest';
import { ALL_PROJECTS, NO_PROJECT, deviceInProject, inProject } from './projects';
import type { Account, Device } from './types';

const device = (id: string, project: string): Device => ({ id, name: id, kind: 'laptop', os: '', project, status: 'idle', statusAt: null, note: '', createdAt: '' });
const account = (project: string, deviceIds: string[]) => ({ project, deviceIds }) as unknown as Account;

describe('project filter', () => {
  const devices = new Map([
    ['d1', device('d1', 'گومان')],
    ['d2', device('d2', '')],
  ]);

  it('matches an account by its own project or a device’s project', () => {
    expect(inProject(account('میرزا', ['d2']), 'میرزا', devices)).toBe(true);
    expect(inProject(account('', ['d1']), 'گومان', devices)).toBe(true);
    expect(inProject(account('میرزا', ['d2']), 'گومان', devices)).toBe(false);
    expect(inProject(account('', ['d2']), NO_PROJECT, devices)).toBe(true);
    expect(inProject(account('', ['d1']), NO_PROJECT, devices)).toBe(false);
    expect(inProject(account('x', []), ALL_PROJECTS, devices)).toBe(true);
  });

  it('matches a device by its own project or an account logged in on it', () => {
    const accounts = [account('میرزا', ['d2'])];
    expect(deviceInProject(devices.get('d2')!, 'میرزا', accounts)).toBe(true);
    expect(deviceInProject(devices.get('d1')!, 'میرزا', accounts)).toBe(false);
    expect(deviceInProject(devices.get('d1')!, 'گومان', accounts)).toBe(true);
  });
});
