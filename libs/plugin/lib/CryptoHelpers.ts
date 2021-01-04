/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Subtle } from './index';
import { PublicKey, EcPublicKey, JoseConstants, W3cCryptoApiConstants } from 'verifiablecredentials-crypto-sdk-typescript-keys';
import { CryptoAlgorithm, KeyReference } from 'verifiablecredentials-crypto-sdk-typescript-keystore';
import CryptoFactory, { CryptoFactoryScope } from './CryptoFactory';

/**
 * Crypto helpers support for plugable crypto layer
 */
export default class CryptoHelpers {

  /**
   * The API which implements the requested algorithm
   * @param cryptoFactory Crypto suite
   * @param algorithmName Requested algorithm
   * @param hash Optional hash for the algorithm
   */
  public static getSubtleCryptoForAlgorithm(cryptoFactory: CryptoFactory, algorithm: any, scope: CryptoFactoryScope, keyReference: KeyReference): Subtle {
    const jwa = CryptoHelpers.webCryptoToJwa(algorithm)
    switch (algorithm.name.toUpperCase()) {
      case 'RSASSA-PKCS1-V1_5':
      case 'ECDSA':
      case 'EDDSA':
        return cryptoFactory.getMessageSigner(jwa, scope, keyReference);
      case 'RSA-OAEP':
      case 'RSA-OAEP-256':
        return cryptoFactory.getKeyEncrypter(jwa, scope, keyReference);
      case 'AES-GCM':
        return cryptoFactory.getSymmetricEncrypter(jwa, scope, keyReference);
      case 'HMAC':
        return cryptoFactory.getMessageAuthenticationCodeSigner(jwa, scope, keyReference);
      case 'SHA-256':
      case 'SHA-384':
      case 'SHA-512':
        return cryptoFactory.getMessageDigest(jwa, scope, keyReference);
      default:
        throw new Error(`Algorithm '${JSON.stringify(algorithm)}' is not supported. Should be unreachable`);
      }
  }

  /**
   * Map the JWA algorithm to the W3C crypto API algorithm.
   * The method restricts the supported algorithms. This can easily be extended.
   * Based on https://www.w3.org/TR/WebCryptoAPI/ A. Mapping between JSON Web Key / JSON Web Algorithm
   * @param jwaAlgorithmName Requested algorithm
   */
  public static jwaToWebCrypto(jwa: string, ...args: any): any {
    const regex = new RegExp('\\d+');
    let matches: RegExpExecArray;

    jwa = jwa.toUpperCase();
    switch (jwa) {
      case JoseConstants.Rs256:
      case JoseConstants.Rs384:
      case JoseConstants.Rs512:
        return { name: W3cCryptoApiConstants.RsaSsaPkcs1V15, modulusLength: 2048, publicExponent: new Uint8Array([0x01, 0x00, 0x01]), hash: { name: `SHA-${jwa.replace('RS', '')}` } };
      case JoseConstants.RsaOaep:
        case JoseConstants.RsaOaep256:
          return { name: 'RSA-OAEP', hash: 'SHA-256', modulusLength: 2048, publicExponent: new Uint8Array([0x01, 0x00, 0x01]) };
      case JoseConstants.AesGcm128:
      case JoseConstants.AesGcm192:
      case JoseConstants.AesGcm256:
        const iv = args[0];
        const aad = args[1];
        matches = <RegExpExecArray>regex.exec(jwa);
        const length = parseInt(CryptoHelpers.getRegexMatch(<RegExpExecArray>matches, 0));
        return { name: W3cCryptoApiConstants.AesGcm, iv: iv, additionalData: aad, tagLength: 128, length: length };
      case JoseConstants.Es256K:
        return { name: 'ECDSA', namedCurve: 'secp256k1', crv: 'secp256k1', hash: { name: 'SHA-256' } };
      case 'EDDSA':
        return { name: 'EdDSA', namedCurve: 'ed25519', crv: 'ed25519', hash: { name: 'SHA-256' } };
      case JoseConstants.Sha256:
      case 'SHA-384':
      case 'SHA-512':
        return { hash: { name: `${jwa.toUpperCase()}` } };
      case 'HS256':
      case 'HS384':
      case 'HS512':
        return { name: 'HMAC', hash: { name: `SHA-${jwa.toUpperCase().replace('HS', '')}` } };
    }

    throw new Error(`Algorithm '${jwa}' is not supported`);
  }

  /**
   * Maps the subtle crypto algorithm name to the JWA name
   * @param algorithmName Requested algorithm
   * @param hash Optional hash for the algorithm
   */
  public static webCryptoToJwa(algorithm: any): string {
    const hash: string = algorithm.hash || algorithm.name || 'SHA-256';
    switch (algorithm.name.toUpperCase()) {
      case 'RSASSA-PKCS1-V1_5':
        return `RS${CryptoHelpers.getHash(hash)}`;
      case 'ECDSA':
        return `ES256K`;
      case 'EDDSA':
        return `EdDSA`;
      case 'RSA-OAEP-256':
        return 'RSA-OAEP-256';
      case 'RSA-OAEP':
        return `RSA-OAEP-256`;
      case 'AES-GCM':
        const length = algorithm.length || 128;
        return `A${length}GCM`;

      case 'HMAC':
        return `HS256`;

      case 'SHA-256':
      case 'SHA-384':
      case 'SHA-512':
        return `${hash.toUpperCase()}`;
      default:
        throw new Error(`Algorithm '${JSON.stringify(algorithm)}' is not supported`);
    }
  }

  /**
   * Derive the key import algorithm
   * @param algorithm used for signature
   */
  public static getKeyImportAlgorithm(algorithm: CryptoAlgorithm, jwk: PublicKey | JsonWebKey): string | RsaHashedImportParams | EcKeyImportParams | HmacImportParams | DhImportKeyParams {
    const hash = (<any>algorithm).hash || (<any>algorithm).name || 'SHA-256';
    const name = algorithm.name;
    switch (algorithm.name.toUpperCase()) {
      case 'RSASSA-PKCS1-V1_5':
        return <RsaHashedImportParams>{ name, hash };
      case 'HMAC':
      case 'SHA-256':
      case 'SHA-384':
      case 'SHA-512':
        return <RsaHashedImportParams>{ name, hash };
      case 'ECDSA':
      case 'EDDSA':
      case 'ECDH':
        return <EcKeyImportParams>{ name, namedCurve: (<EcPublicKey>jwk).crv , hash};
      case 'RSA-OAEP':
      case 'RSA-OAEP-256':
        return { name: 'RSA-OAEP', hash: 'SHA-256' }
      case 'AES-GCM':
        return <RsaHashedImportParams>{ name };
    }
    throw new Error(`Algorithm '${JSON.stringify(algorithm)}' is not supported`);
  }

  private static getHash(hash: any) {
    if (hash.name) {
      return (hash.name).toUpperCase().replace('SHA-', '');
    }
    return (hash || 'SHA-256').toUpperCase().replace('SHA-', '');
  }

  private static getRegexMatch(matches: RegExpExecArray, index: number): string {
    return matches[index];
  }
}
