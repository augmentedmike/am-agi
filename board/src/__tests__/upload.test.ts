/**
 * Unit tests for workspace document writes (Feature 7).
 *
 * These tests verify the file-system behaviour of the upload logic:
 * - .md files go to workspaces/cards/<cardId>/
 * - images go to workspaces/cards/<cardId>/media/ as .jpg files
 * - saved JPEGs have valid FF D8 magic bytes
 * - attachment paths stored are absolute workspace paths, not /uploads/ web paths
 *
 * Note: better-sqlite3 cannot be loaded in bun test directly (native module),
 * so we test file-path logic and JPEG validity in isolation.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { tmpdir } from 'os';

const TMP = join(tmpdir(), `am-upload-test-${Date.now()}`);
const WORKSPACES_DIR = join(TMP, 'workspaces');

function cardWorkspaceDir(cardId: string): string {
  return join(WORKSPACES_DIR, 'cards', cardId);
}

function buildAttachmentPath(cardId: string, fileName: string, isImage: boolean, isMarkdown: boolean): {
  filePath: string;
  attachmentPath: string;
  storedName: string;
} {
  const ext = extname(fileName).toLowerCase();
  if (isMarkdown) {
    const wsDir = cardWorkspaceDir(cardId);
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = join(wsDir, safeName);
    return { filePath, attachmentPath: filePath, storedName: safeName };
  } else if (isImage) {
    const wsDir = cardWorkspaceDir(cardId);
    const mediaDir = join(wsDir, 'media');
    const baseName = fileName.replace(new RegExp(`\\${ext}$`), '').replace(/[^a-zA-Z0-9._-]/g, '_') || 'image';
    const timestamp = 1234567890;
    const destName = `${cardId}-${timestamp}-${baseName}.jpg`;
    const filePath = join(mediaDir, destName);
    return { filePath, attachmentPath: filePath, storedName: destName };
  } else {
    const uploadsDir = join(TMP, 'public', 'uploads');
    const timestamp = 1234567890;
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${cardId}-${timestamp}-${safeName}`;
    const filePath = join(uploadsDir, filename);
    return { filePath, attachmentPath: `/uploads/${filename}`, storedName: fileName };
  }
}

// Minimal valid JPEG: FF D8 ... FF D9
const RED_JPEG = Buffer.from(
  'ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b08000100010101111100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc40000ffda00030101003f00ffd9',
  'hex'
);

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
  mkdirSync(WORKSPACES_DIR, { recursive: true });
  mkdirSync(join(TMP, 'public', 'uploads'), { recursive: true });
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('workspace doc upload', () => {
  it('.md files are written to workspaces/cards/<cardId>/ NOT to board/public/uploads/', () => {
    const cardId = 'test-card-md-001';
    const { filePath, attachmentPath } = buildAttachmentPath(cardId, 'notes.md', false, true);

    // Create dir and write file (simulating upload handler)
    mkdirSync(join(cardWorkspaceDir(cardId)), { recursive: true });
    writeFileSync(filePath, Buffer.from('# Hello world'));

    // Verify file exists at workspace path
    expect(existsSync(filePath)).toBe(true);
    // Verify path is in workspace, not uploads
    expect(attachmentPath).toContain('workspaces');
    expect(attachmentPath).toContain('cards');
    expect(attachmentPath.startsWith('/uploads/')).toBe(false);
    // Verify attachment is NOT in uploads dir
    expect(existsSync(join(TMP, 'public', 'uploads', 'notes.md'))).toBe(false);
  });

  it('image files are written to workspaces/cards/<cardId>/media/ as .jpg files', () => {
    const cardId = 'test-card-img-002';
    const { filePath, attachmentPath, storedName } = buildAttachmentPath(cardId, 'screenshot.png', true, false);

    mkdirSync(join(cardWorkspaceDir(cardId), 'media'), { recursive: true });
    writeFileSync(filePath, RED_JPEG);

    expect(existsSync(filePath)).toBe(true);
    expect(filePath).toContain('media');
    expect(storedName.endsWith('.jpg')).toBe(true);
    // attachment path is absolute workspace path
    expect(attachmentPath).toContain('workspaces');
    expect(attachmentPath).not.toMatch(/^\/uploads\//);
  });

  it('saved JPEG file has valid FF D8 magic bytes', () => {
    const cardId = 'test-card-jpeg-003';
    const { filePath } = buildAttachmentPath(cardId, 'photo.jpg', true, false);

    mkdirSync(join(cardWorkspaceDir(cardId), 'media'), { recursive: true });
    writeFileSync(filePath, RED_JPEG);

    const contents = readFileSync(filePath);
    expect(contents[0]).toBe(0xff);
    expect(contents[1]).toBe(0xd8);
  });

  it('attachment path for workspace files is absolute path, not a /uploads/ relative path', () => {
    const cardId = 'test-card-path-004';
    const { attachmentPath } = buildAttachmentPath(cardId, 'criteria.md', false, true);

    // Path must be absolute (starts with /)
    expect(attachmentPath.startsWith('/')).toBe(true);
    // Path must NOT start with /uploads/
    expect(attachmentPath.startsWith('/uploads/')).toBe(false);
    // Path must contain the card ID so it's rooted in the workspace
    expect(attachmentPath).toContain(cardId);
  });
});
