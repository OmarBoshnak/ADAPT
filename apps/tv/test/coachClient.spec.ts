import {askCoach, askCoachEarly} from '~/state/coach';

const fetchMock = jest.fn();
const answered = (body: unknown) => Promise.resolve({ok: true, json: () => Promise.resolve(body)});

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('askCoach', () => {
  it('reuses the question already asked from the setup screen', async () => {
    fetchMock.mockReturnValue(answered({title: 'Living Room Reset'}));
    askCoachEarly({task: 'plan', count: 6});
    await expect(askCoach({task: 'plan', count: 6})).resolves.toEqual({title: 'Living Room Reset'});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks again when the choice changed after the early question', async () => {
    fetchMock.mockReturnValue(answered({}));
    askCoachEarly({task: 'plan', count: 6});
    await askCoach({task: 'plan', count: 8});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up at the deadline', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const answer = askCoach({task: 'plan'}, 4000);
    jest.advanceTimersByTime(4000);
    await expect(answer).resolves.toBeNull();
  });
});
