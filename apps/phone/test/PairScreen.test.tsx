import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { PairScreen } from '~/features/pair/PairScreen';

jest.mock('~/hooks/useVoice', () => ({ requestVoicePermission: jest.fn(async () => true) }));
jest.mock('~/state/traces', () => ({ useRecordingAvailable: jest.fn(() => false) }));

describe('PairScreen', () => {
  it('asks for voice while the phone is in hand, then pairs on the fourth digit', async () => {
    const { requestVoicePermission } = jest.requireMock('~/hooks/useVoice');
    const onPair = jest.fn();
    await render(<PairScreen notice={null} onPair={onPair} onRecord={jest.fn()} />);

    await fireEvent.changeText(screen.getByLabelText('Pairing code'), '482');
    expect(onPair).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Pairing code'), '4821');
    await waitFor(() => expect(onPair).toHaveBeenCalledWith('4821'));
    expect(requestVoicePermission).toHaveBeenCalled();
  });

  it('keeps only digits', async () => {
    await render(<PairScreen notice={null} onPair={jest.fn()} onRecord={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('Pairing code'), '4a8');
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
  });

  it('shows why the last attempt did not pair', async () => {
    await render(<PairScreen notice="No TV is showing that code." onPair={jest.fn()} onRecord={jest.fn()} />);
    expect(screen.getByText('No TV is showing that code.')).toBeTruthy();
  });

  it('offers trace recording only when the relay is recording', async () => {
    const { useRecordingAvailable } = jest.requireMock('~/state/traces');
    await render(<PairScreen notice={null} onPair={jest.fn()} onRecord={jest.fn()} />);
    expect(screen.queryByText('Record floor traces')).toBeNull();

    useRecordingAvailable.mockReturnValue(true);
    const onRecord = jest.fn();
    await render(<PairScreen notice={null} onPair={jest.fn()} onRecord={onRecord} />);
    await fireEvent.press(screen.getByText('Record floor traces'));
    expect(onRecord).toHaveBeenCalled();
  });
});
