import * as migration_20260930_181743_initial from './20260930_181743_initial';
import * as migration_20260930_185348_email_otp_auth from './20260930_185348_email_otp_auth';
import * as migration_20261001_144024_localize_changelog from './20261001_144024_localize_changelog';

export const migrations = [
  {
    up: migration_20260930_181743_initial.up,
    down: migration_20260930_181743_initial.down,
    name: '20260930_181743_initial',
  },
  {
    up: migration_20260930_185348_email_otp_auth.up,
    down: migration_20260930_185348_email_otp_auth.down,
    name: '20260930_185348_email_otp_auth',
  },
  {
    up: migration_20261001_144024_localize_changelog.up,
    down: migration_20261001_144024_localize_changelog.down,
    name: '20261001_144024_localize_changelog'
  },
];
