export type Trainer = {id: string; name: string; descriptor: string};

export const TRAINERS: Trainer[] = [
  {id: 'sam', name: 'Sam', descriptor: 'Direct'},
  {id: 'nadia', name: 'Nadia', descriptor: 'Encouraging'},
];

export const trainerName = (id: string) => TRAINERS.find(t => t.id === id)?.name ?? 'Sam';
