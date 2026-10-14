import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { memoryDirectory, nativeDirectory, prepareNativeDirectory } from '../src/claude.ts';

const options = { executable: 'claude' };

test('the notes of a project are filed by device and project, not by session', () => {
  const project = { projectPath: 'D:\\work', device: { id: 'laptop' } };
  const first = memoryDirectory('/data/state', project);
  assert.equal(
    memoryDirectory('/data/state', { ...project }),
    first,
    'The same project is one place',
  );
  assert.ok(isAbsolute(first));
  assert.notEqual(memoryDirectory('/data/state', { ...project, projectPath: 'D:\\other' }), first);
  assert.notEqual(
    memoryDirectory('/data/state', { ...project, device: { id: 'desktop' } }),
    first,
    'The same path on another device is another project',
  );
  assert.equal(
    memoryDirectory('/data/state', { projectPath: 'D:\\work' }),
    memoryDirectory('/data/state', { projectPath: 'D:\\work', device: null }),
    'A session from before devices were named has a place too',
  );
});

test('every session of a project gets the same notes directory, and the rest of its settings stay', (t) => {
  const data = mkdtempSync(join(tmpdir(), 'proxy-memory-'));
  t.after(() => rmSync(data, { recursive: true, force: true }));
  const memory = memoryDirectory(data, { projectPath: '/work', device: { id: 'laptop' } });
  const settings = (session: string) =>
    JSON.parse(
      readFileSync(join(nativeDirectory(data, session), '.claude', 'settings.local.json'), 'utf8'),
    );
  prepareNativeDirectory(options, data, 'session-a', memory);
  prepareNativeDirectory(options, data, 'session-b', memory);
  assert.equal(settings('session-a').autoMemoryDirectory, memory);
  assert.equal(settings('session-b').autoMemoryDirectory, memory);
  assert.ok(existsSync(memory), 'The directory exists before the CLI is started');
  // A call that does not know the project, such as reading a status, does not take the setting away.
  prepareNativeDirectory(options, data, 'session-a');
  assert.equal(settings('session-a').autoMemoryDirectory, memory);
  assert.equal(settings('session-a').cleanupPeriodDays, 3650);
});

test('sessions without a project share the notes of the folder their dated folders are made in', () => {
  const device = { id: 'laptop' };
  const at = (projectPath: string) => memoryDirectory('/data/state', { projectPath, device });
  const root = 'C:\\Users\\me\\Documents\\CC Desk Tunnel';
  assert.equal(at(`${root}\\2026-10-14\\033912`), at(`${root}\\2026-10-15\\214501`));
  assert.equal(at(`${root}\\2026-10-14\\033912-1`), at(`${root}\\2026-10-14\\033912`));
  assert.equal(
    at('/home/me/CC Desk Tunnel/2026-10-14/033912'),
    at('/home/me/CC Desk Tunnel/2026-10-15/1'),
  );
  assert.notEqual(
    at(`${root}\\2026-10-14\\033912`),
    at('C:\\Users\\me\\Documents\\Other\\2026-10-14\\033912'),
  );
  assert.notEqual(
    at(root),
    at(`${root}\\2026-10-14\\033912`),
    'The root itself, as a project, is its own',
  );
  assert.notEqual(at(`${root}\\2026-10-14`), at(`${root}\\2026-10-14\\033912`));
});
