import { setDeviceStatus } from '../lib/store';
import type { Device, DeviceStatus } from '../lib/types';
import { Ago } from './ui';

export const STATUS_LABEL: Record<DeviceStatus, string> = { working: 'در حال کار', idle: 'بیکار' };

/** One-click switch between working and idle, with how long the device has been in that state. */
export function WorkToggle({ device, now }: { device: Device; now: Date }) {
  const working = device.status === 'working';
  return (
    <div className="work-toggle-wrap">
      <button
        type="button"
        className={`work-toggle ${device.status}`}
        aria-pressed={working}
        aria-label={`وضعیت ${device.name}: ${STATUS_LABEL[device.status]}`}
        title={working ? 'بزن تا بیکار شود' : 'بزن تا در حال کار شود'}
        onClick={() => setDeviceStatus(device.id, working ? 'idle' : 'working')}
      >
        <span className="dot" />
        {STATUS_LABEL[device.status]}
      </button>
      {device.statusAt && (
        <span className="xsmall faint">
          <Ago iso={device.statusAt} now={now} />
        </span>
      )}
    </div>
  );
}
