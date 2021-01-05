/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
 
// tslint:disable-next-line: import-name
import {CryptoFactory, SubtleCryptoExtension, SubtleCryptoNode, PairwiseKey } from '../lib/index';
import { KeyStoreInMemory, KeyReference } from 'verifiablecredentials-crypto-sdk-typescript-keystore';
import { PrivateKey, EcPrivateKey, OctKey, KeyContainer } from 'verifiablecredentials-crypto-sdk-typescript-keys';
import base64url from 'base64url';
import RsaPairwiseKey from '../lib/Pairwise/RsaPairwiseKey';

class Helpers {
  // Make sure we generate the same pairwise key
  public static async generateSamePairwise (subtleCryptoExtensions: SubtleCryptoExtension, seedReference: string, alg: any, persona: string, peer: string) {
    // Generate key
      const pairwiseKey1: PrivateKey = await subtleCryptoExtensions.generatePairwiseKey(<any>alg, seedReference, persona, peer);
  
      // return the same
      const pairwiseKey2: PrivateKey = await subtleCryptoExtensions.generatePairwiseKey(<any>alg, seedReference, persona, peer);
      expect(pairwiseKey1.getPublicKey()).toEqual(pairwiseKey2.getPublicKey());
    }
  
    // Make sure the pairwise key is unique
    public static async generateUniquePairwise (subtleCryptoExtensions: SubtleCryptoExtension, seedReference: string, alg: any, persona: string, peer: string) {
      const results: string[] = [];
      for (let index = 0 ; index < 10; index++) {
        const pairwiseKey: EcPrivateKey = <EcPrivateKey> await subtleCryptoExtensions.generatePairwiseKey(<any>alg, seedReference, `${persona}-${index}`, peer);
        results.push(<string>pairwiseKey.d);
        expect(1).toBe(results.filter(element => element === pairwiseKey.d).length);
      }
    }
    
}

describe('PairwiseKey', () => {

  const KeyGenerationAlgorithm_RSA256 = 0;
  const KeyGenerationAlgorithm_ECDSA =  1;

  // tslint:disable-next-line:mocha-no-side-effect-code
  const supportedKeyGenerationAlgorithms = [
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 1024, publicExponent: new Uint8Array([0x01, 0x00, 0x01]), hash: { name: 'SHA-256' } },
      { name: 'ECDSA', namedCurve: 'secp256k1', hash: { name: 'SHA-256' } },
      { name: 'EdDSA', namedCurve: 'ed25519', hash: { name: 'SHA-256' } }
    ];

  const unsupportedKeyGenerationAlgorithms = [
      { name: 'HMAC', hash: 'SHA-256' }
    ];

  // Default Crypto factory
  let keyStore: KeyStoreInMemory;
  let defaultCryptoFactory: CryptoFactory;
  let subtleCryptoExtensions:SubtleCryptoExtension;
  const subtle = SubtleCryptoNode.getSubtleCrypto();

  const seedReference = 'masterSeed';

  let originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
  beforeEach(async() => {
  // Default Crypto factory
  keyStore = new KeyStoreInMemory();
  const seed = new OctKey('ABDE');
  await keyStore.save(new KeyReference(seedReference), seed);
  defaultCryptoFactory = new CryptoFactory(keyStore, subtle);
  subtleCryptoExtensions = new SubtleCryptoExtension(defaultCryptoFactory);
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
  });

  afterEach(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
  });

  it(`should throw because the algorithm is not supported for pairwise key generation`, async () => {
    const alg = unsupportedKeyGenerationAlgorithms[0];
    let throwed = false;
    await subtleCryptoExtensions.generatePairwiseKey(<any>alg, seedReference, 'did:persona', 'did:peer')    
    .catch((err: any) => {
      throwed = true;
      expect(`Pairwise key for type 'oct' is not supported.`).toBe(err.message);
    });
    expect(throwed).toBeTruthy();
  });

  it(`should throw because the EC curve is not supported for pairwise key generation`, async () => {
    const alg =  { name: 'ECDSA', namedCurve: 'P-256', hash: { name: 'SHA-256' } };
    let throwed = false;
    await subtleCryptoExtensions.generatePairwiseKey(<any>alg, seedReference, 'did:persona', 'did:peer')    
    .catch((err: any) => {
      throwed = true;
      expect(err.message).toBe('Curve P-256 is not supported');
    });
    expect(throwed).toBeTruthy();
  });

// tslint:disable-next-line: mocha-unneeded-done
  it('should generate a masterkey', async (done) => {
    const keyStore = new KeyStoreInMemory();
    const seed = new OctKey(base64url.encode(Buffer.from('abcdefg')));
    await keyStore.save(new KeyReference(seedReference), seed);
    const pairwise = new PairwiseKey(new CryptoFactory(keyStore, subtle));
    let masterkey = await (<any>pairwise).generatePersonaMasterKey(seedReference, 'persona');
    let encoded = base64url.encode(masterkey);
    expect(encoded).toEqual('h-Z5gO1eBjY1EYXh64-f8qQF5ojeh1KVMKxmd0JI3YKScTOYjVm-h1j2pUNV8q6s8yphAR4lk5yXYiQhAOVlUw');

    masterkey = await (<any>pairwise).generatePersonaMasterKey(seedReference, 'persona');
    encoded = base64url.encode(masterkey);
    expect(encoded).toEqual('h-Z5gO1eBjY1EYXh64-f8qQF5ojeh1KVMKxmd0JI3YKScTOYjVm-h1j2pUNV8q6s8yphAR4lk5yXYiQhAOVlUw');
    masterkey = await (<any>pairwise).generatePersonaMasterKey(seedReference, 'persona1');
    encoded = base64url.encode(masterkey);
    expect(encoded).not.toEqual('h-Z5gO1eBjY1EYXh64-f8qQF5ojeh1KVMKxmd0JI3YKScTOYjVm-h1j2pUNV8q6s8yphAR4lk5yXYiQhAOVlUw');
    done();
  });
  // tslint:disable-next-line:mocha-unneeded-done
  it('should generate the same keys as in the EC reference file', async (done) => {
    let inx: number = 0;
    let nrIds: number = 100;
    const alg = supportedKeyGenerationAlgorithms[KeyGenerationAlgorithm_ECDSA];
    const pairwiseKeys = require('./Pairwise.EC.json');
    const seed = new OctKey(base64url.encode('xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi'));
    await keyStore.save(new KeyReference('masterSeed'), seed);
 
    // for production, seed should be 256 bits.
    const seedReference = 'masterkey';
    await keyStore.save(new KeyReference(seedReference), seed);
    for (inx = 0; inx < nrIds; inx++) {
      const persona: string = 'abcdef';
      let id = `${inx}`;
      
      // Generate key
      const pairwiseKey: EcPrivateKey = <EcPrivateKey> await subtleCryptoExtensions.generatePairwiseKey(<any>alg, seedReference, persona, id);
      expect(pairwiseKey.kid).toBeDefined();

      console.log(`{ "pwid": "${id}", "key": "${pairwiseKey.d}"},`);
      expect(pairwiseKeys[inx].key).toBe(pairwiseKey.d);
      expect(1).toBe(pairwiseKeys.filter((element: any) => element.key === pairwiseKey.d).length);
    }

    done();
  });

  // tslint:disable-next-line:mocha-unneeded-done
  it('should generate the same keys as in the RSA reference file', async (done) => {
    const alg = supportedKeyGenerationAlgorithms[KeyGenerationAlgorithm_RSA256];
    const pairwiseKeys = require('./Pairwise.RSA.json');
    const seed = new OctKey(base64url.encode(Buffer.from('xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi')));
    const seedReference = 'masterkey';
    await keyStore.save(new KeyReference(seedReference), seed);
    for (let inx = 0; inx < 30; inx++) {
      const persona: string = 'abcdef';
      let id = `${inx}`;
      // Generate key
      const pairwiseKey: EcPrivateKey = <EcPrivateKey>await subtleCryptoExtensions.generatePairwiseKey(<any>alg, seedReference, persona, id);
      expect(pairwiseKey.kid).toBeDefined();

      // console.log(`{ "pwid": "${id}", "key": "${pairwiseKey.d}"},`);
      expect(pairwiseKeys[inx].key).toBe(pairwiseKey.d);
      expect(1).toBe(pairwiseKeys.filter((element: any) => element.key === pairwiseKey.d).length);
    }

    done();
  });

  // tslint:disable-next-line:mocha-unneeded-done
  it('should generate a 2048 bit pairwise RSA key', async (done) => {
    const alg = supportedKeyGenerationAlgorithms[KeyGenerationAlgorithm_RSA256];
    alg.modulusLength = 2048;
    const seed = new OctKey(base64url.encode(Buffer.from('xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi')));
    const seedReference = 'masterkey';
    await keyStore.save(new KeyReference(seedReference), seed);
    const persona: string = 'did:persona';
    const peer = 'did:peer';

    // Generate key
    const pairwiseKey: EcPrivateKey = <EcPrivateKey>await subtleCryptoExtensions.generatePairwiseKey(<any>alg, seedReference, persona, peer);
    expect(pairwiseKey.kid).toBeDefined();

    expect(pairwiseKey.d).toBe('LrJvTmCSQsIZajmSHGw98j7pOE1-umx7gemMxXS29cWPmaw8XZGnrpp6PG3zvIC5mF0zu8BtbRl8Bws-fZGqJXiqJNBFcA03erU22yNEsbA-IeylCIZ34Qk34hcRCzP9Q7AkOn5EaS9I2k22Bk0qgOjJS8WVByj-B-ll9GHzahI1Vq76BVTh8lahHI6TEf5kdg5byndw-pFwab_zZ5ftdAPtmIu61mPr5wA0ykxn-MzSTZVvggpvNef-Obdj32sCp1Rz2x8KCrkrWUD7W4hhVF2QLHve4Cm9IpfzPZttSp-OlIdTYEAJhd3nj2BhStKK-K6FGgi65VrbPYSbh21cAQ');
    done();
  });

  it('should generate a deterministic pairwise key capable of signing', async () => {
    const alg = supportedKeyGenerationAlgorithms[KeyGenerationAlgorithm_ECDSA];
    // Generate key
    const pairwiseKey1: PrivateKey = await subtleCryptoExtensions.generatePairwiseKey(<any>alg, seedReference, 'did:persona', 'did:peer');
    keyStore.save(new KeyReference('key'), pairwiseKey1);
    const data = Buffer.from('1234567890');
    const signature = await subtleCryptoExtensions.signByKeyStore(alg, new KeyReference('key'), Buffer.from('1234567890'));
    const verify = await subtleCryptoExtensions.verifyByJwk(alg, pairwiseKey1.getPublicKey(), signature, data);
    expect(verify).toBeTruthy();
  });

  it('should generate a deterministic pairwise key', async () => {
    supportedKeyGenerationAlgorithms.forEach(async (alg) => {
      const persona = 'did:persona:1';
      const peer = 'did:peer:1';
      await Helpers.generateSamePairwise(subtleCryptoExtensions, seedReference, alg, persona, peer);
    });
  });

  it('should generate unique pairwise keys for different personas', async () => {
    
    supportedKeyGenerationAlgorithms.forEach(async (alg) => {
      const persona = 'did:persona:1';
      const peer = 'did:peer:1';
      console.log('Generate unique pairwise key');
      await Helpers.generateUniquePairwise(subtleCryptoExtensions, seedReference, alg, persona, peer);
    });
  });

  it('should generate unique pairwise identifiers using a different seed', async () => {
    const results: string[] = [];
    const alg = supportedKeyGenerationAlgorithms[KeyGenerationAlgorithm_ECDSA];
    const persona = 'did:persona:1';
    const peer = 'did:peer:1';
    for (let index = 0 ; index < 100; index++) {
      const keyReference = `key-${index}`;
      const keyValue = new OctKey(base64url.encode(`1234567890-${index}`));
      await keyStore.save(new KeyReference(seedReference), keyValue);
      await keyStore.save(new KeyReference(keyReference), keyValue);
      const pairwiseKey: EcPrivateKey = <EcPrivateKey> await subtleCryptoExtensions.generatePairwiseKey(<any>alg, keyReference, persona, peer);
      results.push(<string>pairwiseKey.d);
      expect(1).toBe(results.filter(element => element === pairwiseKey.d).length);
    }
  });

  it('should generate unique pairwise identifiers for different peers', async () => {
    const results: string[] = [];
    const alg = supportedKeyGenerationAlgorithms[KeyGenerationAlgorithm_ECDSA];
    const persona = 'did:persona:1';
    const peer = 'did:peer:1';
    for (let index = 0 ; index < 100; index++) {
      const pairwiseKey: EcPrivateKey = <EcPrivateKey> await subtleCryptoExtensions.generatePairwiseKey(<any>alg, seedReference, persona,`${peer}-${index}`);
      results.push(<string>pairwiseKey.d);
      expect(1).toBe(results.filter(element => element === pairwiseKey.d).length);
    }
  });

  it('should generate RSA pairwise', async () =>{
    const keyStore = new KeyStoreInMemory();
    const cryptoFactory = new CryptoFactory(keyStore, new SubtleCryptoNode().getSubtleCrypto());
  
    const alg = { name: 'RSASSA-PKCS1-v1_5', publicExponent: new Uint8Array([0x01, 0x00, 0x01]), hash: { name: 'SHA-256' }};
    const rsaPairwiseKey: any = await RsaPairwiseKey.generate(cryptoFactory, Buffer.from('seed'), <any>alg, 'peer');
    expect(base64url.toBuffer(rsaPairwiseKey.n).byteLength).toEqual(256);
  });
});
