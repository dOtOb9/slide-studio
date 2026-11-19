const NAME_WHEN_DECK_HAS_NO_FILE_NAME = 'deck';

export function exportFileName(fileName: string, exporterId: string, extension: string): string {
  const dot = fileName.lastIndexOf('.');
  const base = (dot > 0 ? fileName.slice(0, dot) : fileName) || NAME_WHEN_DECK_HAS_NO_FILE_NAME;
  return `${base}-${exporterId}.${extension}`;
}
