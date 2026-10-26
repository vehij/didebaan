export type Plan = 'Pro' | 'Max 5x' | 'Max 20x' | 'Team' | 'Enterprise';
export const PLANS: Plan[] = ['Pro', 'Max 5x', 'Max 20x', 'Team', 'Enterprise'];

export type DeviceKind = 'laptop' | 'desktop' | 'server';

export interface Device {
  id: string;
  name: string;
  kind: DeviceKind;
  os: string;
  note: string;
  createdAt: string;
}

/** Weekday follows JS Date#getDay(): 0 = Sunday … 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface WeeklyLimit {
  /** Percentage of the weekly limit already used, 0–100. */
  usedPct: number;
  resetWeekday: Weekday;
  /** Local time of the weekly reset, "HH:MM". */
  resetTime: string;
  /** When usedPct was last entered (ISO). Used to detect a reset that happened since. */
  updatedAt: string | null;
}

export interface Account {
  id: string;
  label: string;
  email: string;
  /** Free-text name of the project this account is working on, e.g. "پروژه میرزا". */
  project: string;
  plan: Plan;
  active: boolean;
  deviceIds: string[];
  total: WeeklyLimit;
  fable: WeeklyLimit;
  /** When true, the Fable limit resets at the same weekday/time as the total limit. */
  fableSameReset: boolean;
  /** Gregorian date of the next renewal, "YYYY-MM-DD", or null when unknown. */
  renewalDate: string | null;
  remindDaysBefore: number;
  note: string;
  createdAt: string;
}

export interface UsageEntry {
  id: string;
  accountId: string;
  at: string;
  total: number;
  fable: number;
  /** "manual" when entered by the user, "reset" when zeroed by a weekly reset. */
  source: 'manual' | 'reset';
}

export interface NotifySettings {
  /** A limit crosses the warning threshold. */
  limit: boolean;
  /** A weekly limit was reset. */
  reset: boolean;
  /** A renewal is within the account's reminder window. */
  renewal: boolean;
}

export interface Settings {
  warnAt: number;
  /** Calendar used to show and pick dates. */
  calendar: 'jalali' | 'gregorian';
  thisDeviceId: string | null;
  notify: NotifySettings;
}

export interface Database {
  version: 1;
  devices: Device[];
  accounts: Account[];
  usage: UsageEntry[];
  settings: Settings;
  /** Keys of notifications already shown, so each one fires only once. */
  notified: string[];
}

export const emptyDatabase = (): Database => ({
  version: 1,
  devices: [],
  accounts: [],
  usage: [],
  settings: { warnAt: 85, calendar: 'jalali', thisDeviceId: null, notify: { limit: true, reset: true, renewal: true } },
  notified: [],
});
