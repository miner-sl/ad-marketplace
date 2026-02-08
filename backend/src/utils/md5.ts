import { createHash } from 'node:crypto';
import {BinaryLike, BinaryToTextEncoding} from 'crypto';

export function MD5(input: BinaryLike, encoding: BinaryToTextEncoding = "hex") {
  return createHash('md5')
    .update(input)
    .digest(encoding);
}
