import * as migration_20260930_181743_initial from './20260930_181743_initial';

export const migrations = [
  {
    up: migration_20260930_181743_initial.up,
    down: migration_20260930_181743_initial.down,
    name: '20260930_181743_initial'
  },
];
