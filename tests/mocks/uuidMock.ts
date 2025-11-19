/**
 * UUID Mock for Jest
 *
 * uuid パッケージのESMエラーを回避するためのモック
 */

let counter = 0;

export const v1 = () => `00000000-0000-1000-8000-${String(counter++).padStart(12, '0')}`;
export const v3 = () => `00000000-0000-3000-8000-${String(counter++).padStart(12, '0')}`;
export const v4 = () => `00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`;
export const v5 = () => `00000000-0000-5000-8000-${String(counter++).padStart(12, '0')}`;
export const v6 = () => `00000000-0000-6000-8000-${String(counter++).padStart(12, '0')}`;
export const v7 = () => `00000000-0000-7000-8000-${String(counter++).padStart(12, '0')}`;
export const NIL = '00000000-0000-0000-0000-000000000000';

// UUID validation function
export const validate = (uuid: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// UUID version detection
export const version = (uuid: string) => {
  if (!validate(uuid)) return undefined;
  return parseInt(uuid.charAt(14), 16);
};

export default {
  v1,
  v3,
  v4,
  v5,
  v6,
  v7,
  NIL,
  validate,
  version,
};
