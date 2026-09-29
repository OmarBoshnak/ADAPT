import { fireEvent, render, screen } from '@testing-library/react-native';
import type { RelayStatus, SensorSnapshot } from '@adapt/core';

import { SessionScreen } from '~/features/session/SessionScreen';
import { jumpingJacks, snapshot, status } from './fixtures';

const mockLink = {
  status: status(),
  snapshot: snapshot(),
  push: jest.fn(),
  correct: jest.fn(),
  command: jest.fn(),
};

jest.mock('~/state/link', () => ({ useSensorLink: () => mockLink }));
jest.mock('~/hooks/useMotion', () => ({ useMotion: () => true }));
jest.mock('~/hooks/useVoice', () => ({ useVoice: () => 'listening' }));
jest.mock('~/hooks/useFloorDim', () => ({ useFloorDim: jest.fn() }));

async function show(s: Partial<SensorSnapshot>, r: Partial<RelayStatus> = {}, onLeave = jest.fn()) {
  mockLink.snapshot = snapshot(s);
  mockLink.status = status(r);
  await render(<SessionScreen code="4821" onLeave={onLeave} />);
  return onLeave;
}

beforeEach(() => jest.clearAllMocks());

describe('SessionScreen', () => {
  it('sends a pressed "easier" and echoes it', async () => {
    await show({ phase: 'active', exercise: jumpingJacks });
    await fireEvent.press(screen.getByText('Easier'));
    expect(mockLink.correct).toHaveBeenCalledWith('easier');
    expect(screen.getByText('“easier”')).toBeTruthy();
  });

  it('swaps the movement from a button too', async () => {
    await show({ phase: 'active', exercise: jumpingJacks });
    await fireEvent.press(screen.getByText('Swap this'));
    expect(mockLink.command).toHaveBeenCalledWith('swap');
  });

  it('offers the buttons only while a movement is running', async () => {
    await show({ phase: 'rest' });
    expect(screen.queryByText('Easier')).toBeNull();
  });

  it('can resume a session paused on the TV', async () => {
    await show({ phase: 'paused' });
    await fireEvent.press(screen.getByText('Resume'));
    expect(mockLink.command).toHaveBeenCalledWith('resume');
  });

  it('asks to be put on the floor until it is', async () => {
    await show({ phase: 'getready', onFloor: false });
    expect(screen.getByText('Place me on the floor beside you, screen up')).toBeTruthy();
  });

  it('lists the words it listens for during a session', async () => {
    await show({ phase: 'active', exercise: jumpingJacks });
    expect(screen.getByText('Say “easier”, “harder”, “swap this” or “pause”')).toBeTruthy();
  });

  it('returns to pairing with the reason when the TV refuses the code', async () => {
    const onLeave = await show({}, { connection: 'rejected', rejectedReason: 'unknown-code' });
    expect(onLeave).toHaveBeenCalledWith(expect.stringMatching(/No TV is showing that code/));
  });
});
