import {generateMnemonic as bip39Gen, validateMnemonic as bip39Val} from 'bip39';

export function bip39Generate(strength = 128): string {
  return bip39Gen(strength);
}

export function bip39Validate(mnemonic: string): boolean {
  return bip39Val(mnemonic);
}
