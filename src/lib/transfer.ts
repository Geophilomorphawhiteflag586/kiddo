/**
 * Перенос профилей между браузерами и устройствами.
 *
 * Прогресс живёт в localStorage, а он у каждого браузера свой: открыв
 * приложение в другом браузере, пользователь видит пустого гостя, хотя данные
 * никуда не делись. Экспорт в файл и импорт обратно закрывают эту дыру и
 * заодно служат резервной копией.
 *
 * Функции чистые — переносом занимается только логика, без DOM и store.
 */
import { STORE_VERSION, migrateStore, type PersistedState } from './migrate.ts';
import { normalizeChineseProgress } from '../modules/chinese/progress.ts';
import { normalizeEnglishProgress } from '../modules/english/progress.ts';
import { normalizeMathProgress } from '../modules/mathematics/progress.ts';
import { emptyProfileData, type ProfileData } from './progress.ts';
import type { UserProfile } from './types.ts';

export interface ProfileBackup {
  app: 'mapapp';
  version: number;
  exportedAt: string;
  profiles: Record<string, UserProfile>;
  data: Record<string, ProfileData>;
}

export class BackupError extends Error {}

export function buildBackup(state: PersistedState, now = Date.now()): ProfileBackup {
  return {
    app: 'mapapp',
    version: STORE_VERSION,
    exportedAt: new Date(now).toISOString(),
    profiles: state.profiles,
    data: state.data,
  };
}

/** Разбирает файл резервной копии. Бросает понятную ошибку, а не падает. */
export function parseBackup(raw: unknown): ProfileBackup {
  const backup = raw as Partial<ProfileBackup> | null;
  if (!backup || typeof backup !== 'object') {
    throw new BackupError('Файл повреждён или это не резервная копия');
  }
  if (backup.app !== 'mapapp') {
    throw new BackupError('Это файл не от MapApp');
  }
  if (!backup.profiles || typeof backup.profiles !== 'object') {
    throw new BackupError('В файле нет профилей');
  }
  if (!backup.data || typeof backup.data !== 'object') {
    throw new BackupError('В файле нет прогресса');
  }

  // Копия из старой версии приложения прогоняется через обычную миграцию.
  const version = typeof backup.version === 'number' ? backup.version : 1;
  const migrated = migrateStore(
    { profiles: backup.profiles, data: backup.data, activeProfileId: '' },
    version,
  );

  return {
    app: 'mapapp',
    version: STORE_VERSION,
    exportedAt: typeof backup.exportedAt === 'string' ? backup.exportedAt : '',
    profiles: migrated.profiles,
    data: migrated.data,
  };
}

/** Профиль без единого ответа — такой можно молча заменить импортом. */
export function isEmptyProfileData(data: ProfileData | undefined): boolean {
  if (!data) return true;
  if ((data.xp ?? 0) > 0) return false;
  if (Object.keys(data.cards ?? {}).length > 0) return false;
  if (Object.keys(normalizeEnglishProgress(data.english).cards).length > 0) return false;
  if (Object.keys(normalizeChineseProgress(data.chinese).cards).length > 0) return false;

  const math = normalizeMathProgress(data.math);
  return Object.values(math.addition).every((level) => level.solved === 0);
}

export interface MergeResult {
  state: PersistedState;
  /** Имена профилей, добавленных как новые. */
  imported: string[];
  /** Имена, заменившие пустой профиль с тем же id (обычно «Гость»). */
  replaced: string[];
}

/**
 * Вливает копию в текущее состояние. Существующий прогресс не затирается:
 * при совпадении id профиль импортируется под новым идентификатором, и лишь
 * пустой профиль (свежий «Гость») заменяется молча.
 */
export function mergeBackup(
  current: PersistedState,
  backup: ProfileBackup,
  now = Date.now(),
): MergeResult {
  const profiles = { ...current.profiles };
  const data = { ...current.data };
  const imported: string[] = [];
  const replaced: string[] = [];

  let index = 0;
  for (const [id, profile] of Object.entries(backup.profiles)) {
    const incoming = backup.data[id] ?? emptyProfileData();
    const collision = profiles[id] !== undefined;

    if (!collision) {
      profiles[id] = profile;
      data[id] = incoming;
      imported.push(profile.name);
      continue;
    }

    if (isEmptyProfileData(data[id])) {
      profiles[id] = profile;
      data[id] = incoming;
      replaced.push(profile.name);
      continue;
    }

    // Такой id уже занят живым профилем — импортируем рядом, ничего не теряя.
    const freshId = `imported-${now.toString(36)}-${index++}`;
    profiles[freshId] = { ...profile, id: freshId };
    data[freshId] = incoming;
    imported.push(profile.name);
  }

  // Если текущий профиль пустой, а импортированные — нет, переключаемся на
  // самый «нагулянный»: пользователь наверняка хочет продолжить именно его.
  let activeProfileId = current.activeProfileId;
  if (isEmptyProfileData(data[activeProfileId])) {
    const best = Object.entries(data)
      .filter(([id]) => profiles[id])
      .sort((a, b) => (b[1].xp ?? 0) - (a[1].xp ?? 0))[0];
    if (best && (best[1].xp ?? 0) > 0) activeProfileId = best[0];
  }

  return { state: { profiles, data, activeProfileId }, imported, replaced };
}

/** Имя файла копии — с датой, чтобы копии не перезаписывали друг друга. */
export function backupFileName(now = Date.now()): string {
  return `mapapp-progress-${new Date(now).toISOString().slice(0, 10)}.json`;
}
