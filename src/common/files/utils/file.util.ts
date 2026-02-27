import { FileType } from '../types/file.types';
import * as mime from 'mime-types';

export const createFileTypeRegex = (fileTypes: FileType[]): RegExp => {
  const mediaTypes = fileTypes
    .map((type) => mime.lookup(type))
    .filter((type) => type !== false); // mime-types returns false for unknown

  return new RegExp(mediaTypes.join('|'));
};
