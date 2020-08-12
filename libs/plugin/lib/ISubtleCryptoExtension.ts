/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Subtle } from './index';
import { CryptoAlgorithm, KeyReference } from 'verifiablecredentials-crypto-sdk-typescript-keystore';
import { PrivateKey } from 'verifiablecredentials-crypto-sdk-typescript-keys';
import { CryptoFactoryScope } from './CryptoFactory';

/**
 * Interface for the Subtle Crypto extensions
 */
export default interface ISubtleCryptoExtension extends Subtle {
  /**
   * Generate a pairwise key
   * @param algorithm for the key
   * @param seedReference Reference to the seed
   * @param personaId Id for the persona
   * @param peerId Id for the peer
   * @param extractable True if key is exportable
   * @param keyops Key operations
   */
  generatePairwiseKey(algorithm: EcKeyGenParams | RsaHashedKeyGenParams, seedReference: string, personaId: string, peerId: string, extractable: boolean, keyops: string[]): Promise<PrivateKey>;  
  
  /**
   * Sign with a key referenced in the key store.
   * The referenced key must be a jwk key.
   * @param algorithm used for signature
   * @param keyReference points to key in the key store
   * @param data to sign
   */
   signByKeyStore(algorithm: CryptoAlgorithm, keyReference: string | KeyReference, data: BufferSource): PromiseLike<ArrayBuffer>;  

   /**
   * Verify with JWK.
   * @param algorithm used for verification
   * @param jwk Json web key used to verify
   * @param signature to verify
   * @param payload which was signed
   */
   verifyByJwk(algorithm: CryptoAlgorithm, jwk: JsonWebKey, signature: BufferSource, payload: BufferSource): Promise<boolean>;
       
   /**
   * Decrypt with JWK.
   * @param algorithm used for decryption
   * @param jwk Json web key to decrypt
   * @param cipher to decrypt
   */
   decryptByJwk(algorithm: CryptoAlgorithm, jwk: JsonWebKey, cipher: BufferSource): Promise<ArrayBuffer>;
  
  /**
   * Decrypt with a key referenced in the key store.
   * The referenced key must be a jwk key.
   * @param algorithm used for encryption
   * @param keyReference points to key in the key store
   * @param cipher to decrypt
   */
   decryptByKeyStore(algorithm: CryptoAlgorithm, keyReference: KeyReference, cipher: BufferSource): PromiseLike<ArrayBuffer>;  
}   
