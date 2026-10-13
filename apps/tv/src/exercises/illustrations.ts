import generated from '@adapt/data/illustrations.json';

export type Illustration = {frameMs: number; frames: string[]};

export const illustrations: Partial<Record<string, Illustration>> = generated.movements;
export const illustrationCredit: string = generated.credit;
